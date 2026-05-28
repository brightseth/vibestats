import { sql } from './db.js';

export function publicProfileSettings(row = {}) {
  return {
    weekly_digest_opt_in: Boolean(row.weekly_digest_opt_in),
    digest_email: row.digest_email || null,
    email_consent_at: row.email_consent_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function getProfileSettings(userId) {
  const rows = await sql()`
    insert into profile_settings (user_id)
    values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning weekly_digest_opt_in, digest_email, email_consent_at, updated_at
  `;
  return rows[0];
}

export function cleanDigestEmail(value) {
  if (value == null) return null;
  const email = String(value).trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Valid digest email required');
    err.statusCode = 400;
    throw err;
  }
  return email;
}
