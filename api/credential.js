import { originForRequest, readSession } from './_lib/auth.js';
import { PRIVATE_PROFILE_CACHE, profileShareCacheControl } from './_lib/cache.js';
import { buildDerivedProfileCredential } from './_lib/credential.js';
import { publicUser, sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from './_lib/http.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { metricVisibility, publicUpload } from './_lib/public-profile.js';
import { publicAchievements } from './_lib/achievements.js';
import { rarityTier, signatureFromUpload } from './_lib/signatures.js';

function getHandle(req) {
  const raw = req.query?.handle;
  if (Array.isArray(raw)) return raw[0];
  return raw || '';
}

async function rarityForLatest(signature) {
  if (!signature?.fingerprint) return null;
  const rows = await sql()`
    with latest_uploads as (
      select distinct on (user_id) user_id, raw_meta, uploaded_at
      from uploads
      order by user_id, uploaded_at desc
    )
    select count(*)::int as count
    from latest_uploads
    where raw_meta->>'signatureFingerprint' = ${signature.fingerprint}
      and uploaded_at > now() - interval '30 days'
  `;
  const count = Number(rows[0]?.count || 1);
  return {
    count,
    tier: rarityTier(count),
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
    const users = await sql()`
      select id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = users[0];
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
      limit 1
    `;
    const latest = uploads[0];
    if (!latest?.archetype) {
      return json(res, 404, { error: 'Profile has no derived credential yet' }, { 'Cache-Control': PRIVATE_PROFILE_CACHE });
    }

    const settingsRows = await sql()`
      select show_raw_counts, show_languages
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    const visibility = metricVisibility(settingsRows[0] || {}, { isOwner: false });
    const signature = signatureFromUpload(latest);
    const rarity = await rarityForLatest(signature);
    const leaderboard = await weeklyLeaderboardRank(user, latest);
    const serializedLatest = publicUpload(latest, visibility, { isOwner: false });
    const publicLatest = buildDerivedProfileCredential({
      origin: originForRequest(req),
      user: publicUser(user),
      upload: latest,
      visibility,
      rarity,
      leaderboard,
      achievements: publicAchievements({
        upload: latest,
        publicUpload: serializedLatest,
        signature,
        rarity,
        leaderboard,
      }),
    });

    return json(res, 200, publicLatest, {
      'Cache-Control': profileShareCacheControl(user),
    });
  } catch (err) {
    console.error('GET /api/credential error:', err);
    const status = err.statusCode || 500;
    const message = status >= 500 ? 'Credential unavailable' : (err.message || 'Credential failed');
    return json(res, status, { error: message }, NO_STORE_HEADERS);
  }
}
