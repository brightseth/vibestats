import { NO_STORE_HEADERS, json, methodNotAllowed } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { LOOKING_FOR_VALUES, publicMatchSettings } from './_lib/profile-settings.js';
import { publicActivity, uploadRecency } from './_lib/public-profile.js';
import { ARCHETYPE_KEYS, signatureFromUpload } from './_lib/signatures.js';

const ARCHETYPES = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

const INTENT_LABELS = {
  any: 'Any intent',
  active: 'Active intent',
  'pair-coding': 'Pair coding',
  'co-founder': 'Co-founder',
  hire: 'Hiring',
  mentor: 'Mentor',
  mentee: 'Mentee',
};

function readParam(req, key, fallback = '') {
  const raw = req.query?.[key];
  return String(Array.isArray(raw) ? raw[0] : raw || fallback).trim().toLowerCase();
}

function getArchetype(req) {
  const archetype = readParam(req, 'archetype', 'all');
  if (archetype === 'all') return 'all';
  if (!ARCHETYPE_KEYS.includes(archetype)) {
    const err = new Error('Invalid archetype');
    err.statusCode = 400;
    throw err;
  }
  return archetype;
}

function getIntent(req) {
  const intent = readParam(req, 'intent', readParam(req, 'looking_for', 'any'));
  if (intent === 'any' || intent === 'active') return intent;
  if (!LOOKING_FOR_VALUES.has(intent) || intent === 'idle') {
    const err = new Error('Invalid intent');
    err.statusCode = 400;
    throw err;
  }
  return intent;
}

function getSort(req) {
  const sort = readParam(req, 'sort', 'recent');
  return sort === 'signal' ? 'signal' : 'recent';
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function browseEntry(row) {
  const upload = {
    archetype: row.archetype,
    scores: row.scores || {},
    metrics: row.metrics || {},
    raw_meta: row.raw_meta || {},
  };
  const signature = signatureFromUpload(upload);

  return {
    user: {
      gh_handle: row.gh_handle,
      avatar_url: row.avatar_url,
    },
    archetype: row.archetype,
    archetype_label: ARCHETYPES[row.archetype] || row.archetype,
    score: Math.round(safeNumber(row.scores?.[row.archetype])),
    signature: signature ? {
      label: signature.label,
      combo: signature.combo,
      secondary: signature.secondary,
    } : null,
    activity: publicActivity(row.metrics),
    match: publicMatchSettings(row),
    updated: uploadRecency(row.uploaded_at),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  let archetype = 'all';
  let intent = 'any';
  let sort = 'recent';

  try {
    archetype = getArchetype(req);
    intent = getIntent(req);
    sort = getSort(req);

    const filterArchetype = archetype !== 'all';
    const anyIntent = intent === 'any';
    const activeIntent = intent === 'active';
    const specificIntent = !anyIntent && !activeIntent;

    const rows = await sql()`
      with latest_uploads as (
        select distinct on (u.id)
          u.gh_handle,
          u.avatar_url,
          u.last_seen_at,
          coalesce(ps.looking_for, 'idle') as looking_for,
          ps.looking_for_expires_at,
          ps.contact_url,
          up.archetype,
          up.scores,
          up.metrics,
          up.raw_meta,
          up.uploaded_at
        from users u
        join uploads up on up.user_id = u.id
        left join profile_settings ps on ps.user_id = u.id
        where u.privacy = 'public'
        order by u.id, up.uploaded_at desc
      ),
      filtered as (
        select *
        from latest_uploads
        where (${filterArchetype} = false or archetype = ${archetype})
          and (
            ${anyIntent} = true
            or (
              ${activeIntent} = true
              and looking_for <> 'idle'
              and looking_for_expires_at > now()
            )
            or (
              ${specificIntent} = true
              and looking_for = ${intent}
              and looking_for_expires_at > now()
            )
          )
      )
      select *, count(*) over()::int as total
      from filtered
      order by
        case when ${sort} = 'signal' then coalesce((scores->>archetype)::numeric, 0) end desc nulls last,
        uploaded_at desc
      limit 60
    `;

    return json(res, 200, {
      filters: {
        archetype,
        archetype_label: archetype === 'all' ? 'All archetypes' : ARCHETYPES[archetype],
        intent,
        intent_label: INTENT_LABELS[intent],
        sort,
      },
      total: rows[0]?.total || 0,
      entries: rows.map(browseEntry),
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/browse error:', err);
    const status = err.statusCode || 500;
    return json(res, status === 400 ? 400 : 200, {
      filters: {
        archetype,
        archetype_label: archetype === 'all' ? 'All archetypes' : ARCHETYPES[archetype],
        intent,
        intent_label: INTENT_LABELS[intent],
        sort,
      },
      total: 0,
      entries: [],
      unavailable: status !== 400,
      error: status === 400 ? (err.message || 'Browse failed') : 'Browse unavailable',
    }, NO_STORE_HEADERS);
  }
}
