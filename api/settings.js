import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { publicUser, sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, requireSameOrigin } from './_lib/http.js';
import { publicIdentityReadiness } from './_lib/identity-readiness.js';
import {
  cleanContactUrl,
  cleanDigestEmail,
  cleanLookingFor,
  getProfileSettings,
  lookingForExpiry,
  ownerProfileSettings,
} from './_lib/profile-settings.js';

const PRIVACY_VALUES = new Set(['public', 'unlisted', 'private']);

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE'], NO_STORE_HEADERS);
  }

  try {
    if (req.method !== 'GET') requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);

    if (req.method === 'GET') {
      const settings = await getProfileSettings(user.id);
      return json(res, 200, {
        user: publicUser(user, { includePrivacy: true, includeActivity: true }),
        settings: ownerProfileSettings(settings),
      }, NO_STORE_HEADERS);
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      let nextUser = user;
      let nextSettings = await getProfileSettings(user.id);

      if (Object.hasOwn(body, 'privacy')) {
        const privacy = String(body.privacy || '');
        if (!PRIVACY_VALUES.has(privacy)) {
          return json(res, 400, { error: 'Invalid privacy value' }, NO_STORE_HEADERS);
        }

        const rows = await sql()`
          update users
          set privacy = ${privacy}, last_seen_at = now()
          where id = ${user.id}
          returning id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
        `;
        nextUser = rows[0];
      }

      if (Object.hasOwn(body, 'weekly_digest_opt_in') || Object.hasOwn(body, 'digest_email')) {
        const optIn = Object.hasOwn(body, 'weekly_digest_opt_in')
          ? Boolean(body.weekly_digest_opt_in)
          : Boolean(nextSettings.weekly_digest_opt_in);
        const email = Object.hasOwn(body, 'digest_email')
          ? cleanDigestEmail(body.digest_email)
          : (nextSettings.digest_email || null);

        if (optIn && !email) {
          return json(res, 400, { error: 'Digest email required to opt in' }, NO_STORE_HEADERS);
        }
        if (optIn && publicIdentityReadiness().weekly_digest_available !== true) {
          return json(res, 503, { error: 'Weekly digest delivery is not configured' }, NO_STORE_HEADERS);
        }

        const settingsRows = await sql()`
          insert into profile_settings (
            user_id,
            weekly_digest_opt_in,
            digest_email,
            email_consent_at,
            updated_at
          )
          values (
            ${user.id},
            ${optIn},
            ${email},
            ${optIn ? new Date() : null},
            now()
          )
          on conflict (user_id) do update
            set weekly_digest_opt_in = excluded.weekly_digest_opt_in,
                digest_email = excluded.digest_email,
                email_consent_at = excluded.email_consent_at,
                updated_at = now()
          returning weekly_digest_opt_in, digest_email, email_consent_at, weekly_digest_sent_at,
            sync_token_invalidated_at, show_raw_counts, show_languages, looking_for, looking_for_expires_at,
            contact_url, updated_at
        `;
        nextSettings = settingsRows[0];
      }

      if (Object.hasOwn(body, 'show_raw_counts') || Object.hasOwn(body, 'show_languages')) {
        const showRawCounts = Object.hasOwn(body, 'show_raw_counts')
          ? Boolean(body.show_raw_counts)
          : Boolean(nextSettings.show_raw_counts);
        const showLanguages = Object.hasOwn(body, 'show_languages')
          ? Boolean(body.show_languages)
          : Boolean(nextSettings.show_languages);

        const settingsRows = await sql()`
          insert into profile_settings (
            user_id,
            show_raw_counts,
            show_languages,
            updated_at
          )
          values (
            ${user.id},
            ${showRawCounts},
            ${showLanguages},
            now()
          )
          on conflict (user_id) do update
            set show_raw_counts = excluded.show_raw_counts,
                show_languages = excluded.show_languages,
                updated_at = now()
          returning weekly_digest_opt_in, digest_email, email_consent_at, weekly_digest_sent_at,
            sync_token_invalidated_at, show_raw_counts, show_languages, looking_for, looking_for_expires_at,
            contact_url, updated_at
        `;
        nextSettings = settingsRows[0];
      }

      if (Object.hasOwn(body, 'looking_for') || Object.hasOwn(body, 'contact_url')) {
        const lookingFor = Object.hasOwn(body, 'looking_for')
          ? cleanLookingFor(body.looking_for)
          : cleanLookingFor(nextSettings.looking_for || 'idle');
        const contactUrl = Object.hasOwn(body, 'contact_url')
          ? cleanContactUrl(body.contact_url)
          : (nextSettings.contact_url || null);
        const expiresAt = lookingFor === 'idle' ? null : lookingForExpiry(7);

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
        nextSettings = settingsRows[0];
      }

      return json(res, 200, {
        user: publicUser(nextUser, { includePrivacy: true, includeActivity: true }),
        settings: ownerProfileSettings(nextSettings),
      }, NO_STORE_HEADERS);
    }

    await sql()`delete from users where id = ${user.id}`;
    clearSessionCookie(req, res);
    return json(res, 200, { ok: true }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('/api/settings error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Settings failed' }, NO_STORE_HEADERS);
  }
}
