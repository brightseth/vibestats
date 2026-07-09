import { NO_STORE_HEADERS, json, methodNotAllowed } from './_lib/http.js';
import { ARCHETYPE_IDENTITY } from '../lib/archetype-identity.js';
import { sql } from './_lib/db.js';
import { publicActivity, publicScores, uploadRecency } from './_lib/public-profile.js';
import { ARCHETYPE_KEYS, signatureFromUpload } from './_lib/signatures.js';

const ARCHETYPES = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, { name: ARCHETYPE_IDENTITY[key].short }]));

function getArchetype(req) {
  const raw = req.query?.archetype;
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim().toLowerCase();
}

export function leaderboardEntry(row, index) {
  const scores = publicScores(row.scores || {});
  const upload = {
    archetype: row.archetype,
    scores,
    metrics: row.metrics || {},
    raw_meta: row.raw_meta || {},
  };
  const signature = signatureFromUpload(upload);

  return {
    rank: index + 1,
    user: {
      gh_handle: row.gh_handle,
      avatar_url: row.avatar_url,
    },
    archetype: row.archetype,
    score: scores[row.archetype] || 0,
    signature: signature ? {
      label: signature.label,
      combo: signature.combo,
      secondary: signature.secondary,
    } : null,
    activity: publicActivity(row.metrics || {}),
    updated: uploadRecency(row.uploaded_at),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  const archetype = getArchetype(req) || 'builder';
  if (!ARCHETYPE_KEYS.includes(archetype)) {
    return json(res, 400, { error: 'Invalid archetype' }, NO_STORE_HEADERS);
  }

  try {
    const rows = await sql()`
      with latest_uploads as (
        select distinct on (u.id)
          u.gh_handle,
          u.avatar_url,
          up.archetype,
          up.scores,
          up.metrics,
          up.raw_meta,
          up.uploaded_at
        from users u
        join uploads up on up.user_id = u.id
        where u.privacy = 'public'
          and up.uploaded_at >= date_trunc('week', now())
        order by u.id, up.uploaded_at desc
      ),
      filtered as (
        select *,
          case
            when scores->>${archetype} ~ '^-?[0-9]+([.][0-9]+)?$'
              then least(greatest((scores->>${archetype})::numeric, 0), 100)
            else 0
          end as public_score
        from latest_uploads
        where archetype = ${archetype}
      )
      select *, count(*) over()::int as total, date_trunc('week', now()) as week_start
      from filtered
      order by public_score desc, uploaded_at desc
      limit 25
    `;

    return json(res, 200, {
      archetype,
      label: ARCHETYPES[archetype].name,
      week_start: rows[0]?.week_start || null,
      total: rows[0]?.total || 0,
      entries: rows.map(leaderboardEntry),
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return json(res, 200, {
      archetype,
      label: ARCHETYPES[archetype].name,
      week_start: null,
      total: 0,
      entries: [],
      unavailable: true,
    }, NO_STORE_HEADERS);
  }
}
