import { readSyncSession, syncTokenIsRevoked } from './_lib/auth.js';
import { getUserById, publicUser, sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, safeErrorMessage } from './_lib/http.js';
import { ARCHETYPE_KEYS } from './_lib/signatures.js';
import {
  cleanContactUrl,
  cleanLookingFor,
  lookingForExpiry,
  ownerProfileSettings,
} from './_lib/profile-settings.js';

function matchUrl(goal, archetype) {
  const params = new URLSearchParams();
  if (goal && goal !== 'idle') params.set('goal', goal);
  if (ARCHETYPE_KEYS.includes(archetype)) params.set('archetype', archetype);
  const query = params.toString();
  return query ? `/match?${query}` : '/match';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  try {
    const session = readSyncSession(req);
    const user = session?.sub ? await getUserById(session.sub) : null;
    if (!user) return json(res, 401, { error: 'Invalid sync token' }, NO_STORE_HEADERS);

    const existingSettings = await sql()`
      select sync_token_invalidated_at, contact_url, looking_for
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    if (syncTokenIsRevoked(session, existingSettings[0]?.sync_token_invalidated_at)) {
      return json(res, 401, { error: 'Sync token revoked. Generate a new token from Settings.' }, NO_STORE_HEADERS);
    }

    const body = await readJson(req, { maxBytes: 4 * 1024 });
    const lookingFor = cleanLookingFor(body.looking_for || 'idle');
    const contactUrl = Object.hasOwn(body, 'contact_url')
      ? cleanContactUrl(body.contact_url)
      : (existingSettings[0]?.contact_url || null);
    const expiresAt = lookingFor === 'idle' ? null : lookingForExpiry(7);
    let nextUser = user;

    if (body.make_public === true) {
      const userRows = await sql()`
        update users
        set privacy = 'public', last_seen_at = now()
        where id = ${user.id}
        returning id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
      `;
      nextUser = userRows[0] || user;
    } else {
      await sql()`update users set last_seen_at = now() where id = ${user.id}`;
    }

    const settingsRows = await sql()`
      insert into profile_settings (
        user_id,
        looking_for,
        looking_for_expires_at,
        contact_url,
        updated_at
      )
      values (
        ${user.id},
        ${lookingFor},
        ${expiresAt},
        ${contactUrl},
        now()
      )
      on conflict (user_id) do update
        set looking_for = excluded.looking_for,
            looking_for_expires_at = excluded.looking_for_expires_at,
            contact_url = excluded.contact_url,
            updated_at = now()
      returning weekly_digest_opt_in, digest_email, email_consent_at, weekly_digest_sent_at,
        sync_token_invalidated_at, show_raw_counts, show_languages, looking_for, looking_for_expires_at,
        contact_url, updated_at
    `;
    const latestRows = await sql()`
      select archetype
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latestArchetype = latestRows[0]?.archetype || null;

    return json(res, 200, {
      ok: true,
      user: publicUser(nextUser, { includePrivacy: true, includeActivity: true }),
      settings: ownerProfileSettings(settingsRows[0]),
      links: {
        profile_url: `/u/${encodeURIComponent(nextUser.gh_handle)}`,
        settings_url: '/settings#match-settings',
        browse_url: lookingFor === 'idle' ? '/browse' : `/browse?intent=${encodeURIComponent(lookingFor)}`,
        match_url: matchUrl(lookingFor, latestArchetype),
      },
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('POST /api/sync-settings error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Sync settings failed') }, NO_STORE_HEADERS);
  }
}
