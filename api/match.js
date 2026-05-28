import { json, methodNotAllowed } from './_lib/http.js';
import { LOOKING_FOR_VALUES, publicMatchSettings } from './_lib/profile-settings.js';
import { publicActivity } from './_lib/public-profile.js';
import { sql } from './_lib/db.js';
import { signatureFromUpload } from './_lib/signatures.js';
import { ARCHETYPE_LABELS, GOAL_LABELS, cleanSeekerArchetype, goalFit } from './_lib/matchmaking.js';

function getGoal(req) {
  const raw = req.query?.goal;
  const goal = String(Array.isArray(raw) ? raw[0] : raw || 'pair-coding').trim();
  if (!LOOKING_FOR_VALUES.has(goal) || goal === 'idle') {
    const err = new Error('Invalid match goal');
    err.statusCode = 400;
    throw err;
  }
  return goal;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function entry(row, goal, seekerArchetype) {
  const upload = {
    archetype: row.archetype,
    scores: row.scores || {},
    metrics: row.metrics || {},
    raw_meta: row.raw_meta || {},
  };
  const signature = signatureFromUpload(upload);
  const match = publicMatchSettings(row);
  const score = Math.round(safeNumber(row.scores?.[row.archetype]));
  const fit = goalFit({
    goal,
    lookingFor: match.looking_for,
    candidateArchetype: row.archetype,
    seekerArchetype,
    signal: score,
  });

  return {
    user: {
      gh_handle: row.gh_handle,
      avatar_url: row.avatar_url,
    },
    match,
    fit_score: fit.score,
    fit_level: fit.level,
    fit_reason: fit.reason,
    archetype: row.archetype,
    archetype_label: ARCHETYPE_LABELS[row.archetype] || row.archetype,
    score,
    signature: signature ? {
      label: signature.label,
      combo: signature.combo,
      secondary: signature.secondary,
    } : null,
    activity: publicActivity(row.metrics || {}),
    uploaded_at: row.uploaded_at,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  let goal = null;
  let seekerArchetype = null;
  try {
    goal = getGoal(req);
    seekerArchetype = cleanSeekerArchetype(req.query?.archetype);
    const rows = await sql()`
      with latest_uploads as (
        select distinct on (u.id)
          u.gh_handle,
          u.avatar_url,
          ps.looking_for,
          ps.looking_for_expires_at,
          ps.contact_url,
          up.archetype,
          up.scores,
          up.metrics,
          up.raw_meta,
          up.uploaded_at
        from users u
        join profile_settings ps on ps.user_id = u.id
        join uploads up on up.user_id = u.id
        where u.privacy = 'public'
          and ps.looking_for <> 'idle'
          and ps.looking_for_expires_at > now()
        order by u.id, up.uploaded_at desc
      )
      select *
      from latest_uploads
      order by
        case when looking_for = ${goal} then 0 else 1 end,
        looking_for_expires_at desc,
        uploaded_at desc
      limit 50
    `;

    const entries = rows.map((row) => entry(row, goal, seekerArchetype))
      .sort((a, b) => b.fit_score - a.fit_score || new Date(b.uploaded_at) - new Date(a.uploaded_at));

    return json(res, 200, {
      goal,
      goal_label: GOAL_LABELS[goal],
      seeker_archetype: seekerArchetype,
      seeker_archetype_label: seekerArchetype ? ARCHETYPE_LABELS[seekerArchetype] : null,
      entries,
    }, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    });
  } catch (err) {
    console.error('GET /api/match error:', err);
    const status = err.statusCode || 500;
    const fallbackGoal = status === 400 ? null : goal;
    return json(res, status === 400 ? 400 : 200, {
      goal: fallbackGoal,
      goal_label: fallbackGoal ? GOAL_LABELS[fallbackGoal] : null,
      seeker_archetype: status === 400 ? null : seekerArchetype,
      seeker_archetype_label: status !== 400 && seekerArchetype ? ARCHETYPE_LABELS[seekerArchetype] : null,
      entries: [],
      unavailable: status !== 400,
      error: err.message || 'Match failed',
    }, {
      'Cache-Control': 'public, s-maxage=60',
    });
  }
}
