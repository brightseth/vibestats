import { readSession } from '../_lib/auth.js';
import { publicAchievements } from '../_lib/achievements.js';
import { PRIVATE_PROFILE_CACHE } from '../_lib/cache.js';
import { publicUser, sql } from '../_lib/db.js';
import { profileEvolution } from '../_lib/evolution.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from '../_lib/http.js';
import { weeklyLeaderboardRank } from '../_lib/leaderboard-rank.js';
import { GOAL_LABELS } from '../_lib/matchmaking.js';
import { publicMatchSettings } from '../_lib/profile-settings.js';
import { metricVisibility, publicUpload } from '../_lib/public-profile.js';
import { rarityTier, signatureFromUpload } from '../_lib/signatures.js';
import { profileStreak } from '../_lib/streak.js';

function getHandle(req) {
  const raw = req.query?.handle;
  if (Array.isArray(raw)) return raw[0];
  return raw || '';
}

export function profileRarityPayload(signature, count, { isOwner = false } = {}) {
  if (!signature?.fingerprint) return null;
  const safeCount = Number(count) || 1;
  return {
    ...(isOwner ? { fingerprint: signature.fingerprint } : {}),
    count: safeCount,
    tier: rarityTier(safeCount),
    window_days: 30,
  };
}

function matchInterestBucket(count) {
  if (count >= 20) return { bucket: '20+', label: 'hot match interest', level: 'hot' };
  if (count >= 10) return { bucket: '10-19', label: 'strong match interest', level: 'strong' };
  if (count >= 3) return { bucket: '3-9', label: 'warming match interest', level: 'warming' };
  return { bucket: '1-2', label: 'early match interest', level: 'early' };
}

export function profileMatchInterestPayload(row = {}, { isOwner = false } = {}) {
  const events = Math.max(0, Number(row.week_count || 0));
  if (!events) return null;
  const bucket = matchInterestBucket(events);
  const topGoal = GOAL_LABELS[row.top_goal] ? row.top_goal : null;
  const goalText = topGoal ? `${GOAL_LABELS[topGoal]} interest` : 'profile interest';
  return {
    window_days: 7,
    level: bucket.level,
    label: bucket.label,
    count_bucket: bucket.bucket,
    top_goal: topGoal,
    top_goal_label: topGoal ? GOAL_LABELS[topGoal] : null,
    detail: `${goalText} from compare/contact/outcome actions`,
    ...(isOwner ? {
      events,
      contact_clicks: Math.max(0, Number(row.contact_count || 0)),
      intro_copies: Math.max(0, Number(row.copy_intro_count || 0)),
      compare_clicks: Math.max(0, Number(row.compare_count || 0)),
      share_clicks: Math.max(0, Number(row.share_count || 0)),
      intro_accepts: Math.max(0, Number(row.accept_count || 0)),
      positive_outcomes: Math.max(0, Number(row.positive_outcome_count || 0)),
      neutral_outcomes: Math.max(0, Number(row.neutral_outcome_count || 0)),
      negative_outcomes: Math.max(0, Number(row.negative_outcome_count || 0)),
    } : {}),
  };
}

function matchInterestUnavailable(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === '42P01' || message.includes('match_intro_events');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  const handle = String(getHandle(req)).trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) {
    return json(res, 400, { error: 'Invalid handle' }, NO_STORE_HEADERS);
  }

  try {
    const rows = await sql()`
      select id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = rows[0];
    if (!user) return json(res, 404, { error: 'Profile not found' }, { 'Cache-Control': PRIVATE_PROFILE_CACHE });

    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) {
      return json(res, 404, { error: 'Profile not found' }, { 'Cache-Control': PRIVATE_PROFILE_CACHE });
    }

    const uploads = await sql()`
      select id, archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 50
    `;
    const settingsRows = await sql()`
      select show_raw_counts, show_languages, looking_for, looking_for_expires_at, contact_url
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    const settings = settingsRows[0] || {};
    const visibility = metricVisibility(settings, { isOwner });
    const visibleUploads = isOwner ? uploads : uploads.slice(0, 1);
    const serializedUploads = visibleUploads.map((upload) => publicUpload(upload, visibility, { isOwner }));
    const latestSignature = signatureFromUpload(uploads[0]);
    let rarity = null;
    if (latestSignature?.fingerprint) {
      const rarityRows = await sql()`
        with latest_uploads as (
          select distinct on (user_id) user_id, raw_meta, uploaded_at
          from uploads
          order by user_id, uploaded_at desc
        )
        select count(*)::int as count
        from latest_uploads
        where raw_meta->>'signatureFingerprint' = ${latestSignature.fingerprint}
          and uploaded_at > now() - interval '30 days'
      `;
      const count = rarityRows[0]?.count || 1;
      rarity = profileRarityPayload(latestSignature, count, { isOwner });
    }

    const leaderboard = await weeklyLeaderboardRank(user, uploads[0]);
    const evolution = profileEvolution(uploads, { isOwner });
    const streak = profileStreak(uploads, { isOwner });
    let matchInterest = null;
    try {
      const interestRows = await sql()`
        with recent as (
          select goal, action
          from match_intro_events
          where lower(target_handle) = lower(${user.gh_handle})
            and created_at > now() - interval '7 days'
        ),
        top_goal as (
          select goal
          from recent
          group by goal
          order by count(*) desc, goal asc
          limit 1
        )
        select
          count(*)::int as week_count,
          count(*) filter (where action = 'contact_click')::int as contact_count,
          count(*) filter (where action = 'copy_intro')::int as copy_intro_count,
          count(*) filter (where action = 'compare_click')::int as compare_count,
          count(*) filter (where action = 'share_x')::int as share_count,
          count(*) filter (where action = 'intro_accept')::int as accept_count,
          count(*) filter (where action = 'outcome_positive')::int as positive_outcome_count,
          count(*) filter (where action = 'outcome_neutral')::int as neutral_outcome_count,
          count(*) filter (where action = 'outcome_negative')::int as negative_outcome_count,
          (select goal from top_goal) as top_goal
        from recent
      `;
      matchInterest = profileMatchInterestPayload(interestRows[0], { isOwner });
    } catch (err) {
      if (!matchInterestUnavailable(err)) throw err;
    }

    json(res, 200, {
      user: publicUser(user, { includePrivacy: isOwner, includeActivity: isOwner }),
      is_owner: Boolean(isOwner),
      metric_visibility: visibility,
      match: publicMatchSettings(settings),
      history: {
        visible: Boolean(isOwner),
        total_uploads: isOwner ? uploads.length : null,
      },
      uploads: serializedUploads,
      rarity,
      leaderboard,
      evolution,
      streak,
      match_interest: matchInterest,
      achievements: publicAchievements({
        upload: uploads[0],
        publicUpload: serializedUploads[0],
        signature: latestSignature,
        rarity,
        leaderboard,
        evolution,
        streak,
      }),
    }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('GET /api/u/[handle] error:', err);
    const status = err.statusCode || 500;
    const message = status >= 500 ? 'Profile unavailable' : (err.message || 'Profile failed');
    json(res, status, { error: message }, NO_STORE_HEADERS);
  }
}
