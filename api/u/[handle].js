import { readSession } from '../_lib/auth.js';
import { PRIVATE_PROFILE_CACHE } from '../_lib/cache.js';
import { publicUser, sql } from '../_lib/db.js';
import { profileEvolution } from '../_lib/evolution.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from '../_lib/http.js';
import { weeklyLeaderboardRank } from '../_lib/leaderboard-rank.js';
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
      leaderboard: await weeklyLeaderboardRank(user, uploads[0]),
      evolution: profileEvolution(uploads, { isOwner }),
      streak: profileStreak(uploads, { isOwner }),
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
