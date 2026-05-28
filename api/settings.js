import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { publicUser, sql } from './_lib/db.js';
import { json, methodNotAllowed, readJson, requireSameOrigin } from './_lib/http.js';
import { cleanDigestEmail, getProfileSettings, publicProfileSettings } from './_lib/profile-settings.js';

const PRIVACY_VALUES = new Set(['public', 'unlisted', 'private']);

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
  }

  try {
    if (req.method !== 'GET') requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' });

    if (req.method === 'GET') {
      const settings = await getProfileSettings(user.id);
      return json(res, 200, {
        user: publicUser(user, { includePrivacy: true }),
        settings: publicProfileSettings(settings),
      }, {
        'Cache-Control': 'no-store',
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      let nextUser = user;
      let nextSettings = await getProfileSettings(user.id);

      if (Object.hasOwn(body, 'privacy')) {
        const privacy = String(body.privacy || '');
        if (!PRIVACY_VALUES.has(privacy)) {
          return json(res, 400, { error: 'Invalid privacy value' });
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
          return json(res, 400, { error: 'Digest email required to opt in' });
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
          returning weekly_digest_opt_in, digest_email, email_consent_at, weekly_digest_sent_at, updated_at
        `;
        nextSettings = settingsRows[0];
      }

      return json(res, 200, {
        user: publicUser(nextUser, { includePrivacy: true }),
        settings: publicProfileSettings(nextSettings),
      });
    }

    await sql()`delete from users where id = ${user.id}`;
    clearSessionCookie(req, res);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('/api/settings error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Settings failed' });
  }
}
