import { sql } from './db.js';

export const LOOKING_FOR_VALUES = new Set(['pair-coding', 'co-founder', 'hire', 'mentor', 'mentee', 'idle']);

const LOOKING_FOR_LABELS = {
  'pair-coding': 'Pair coding',
  'co-founder': 'Co-founder',
  hire: 'Hiring',
  mentor: 'Mentor',
  mentee: 'Mentee',
  idle: 'Idle',
};

export function publicProfileSettings(row = {}) {
  return {
    show_raw_counts: Boolean(row.show_raw_counts),
    show_languages: Boolean(row.show_languages),
    ...publicMatchSettings(row),
    updated_at: row.updated_at || null,
  };
}

export function ownerProfileSettings(row = {}) {
  const lookingFor = cleanLookingFor(row.looking_for || 'idle');
  return {
    weekly_digest_opt_in: Boolean(row.weekly_digest_opt_in),
    digest_email: row.digest_email || null,
    email_consent_at: row.email_consent_at || null,
    weekly_digest_sent_at: row.weekly_digest_sent_at || null,
    sync_token_invalidated_at: row.sync_token_invalidated_at || null,
    show_raw_counts: Boolean(row.show_raw_counts),
    show_languages: Boolean(row.show_languages),
    looking_for: lookingFor,
    looking_for_label: LOOKING_FOR_LABELS[lookingFor],
    looking_for_expires_at: row.looking_for_expires_at || null,
    contact_url: row.contact_url || null,
    updated_at: row.updated_at || null,
  };
}

export function publicMatchSettings(row = {}, { now = new Date() } = {}) {
  const lookingFor = cleanLookingFor(row.looking_for || 'idle');
  const expiresAt = row.looking_for_expires_at ? new Date(row.looking_for_expires_at) : null;
  const active = lookingFor !== 'idle' && expiresAt && expiresAt > now;
  return {
    looking_for: active ? lookingFor : 'idle',
    looking_for_label: active ? LOOKING_FOR_LABELS[lookingFor] : LOOKING_FOR_LABELS.idle,
    looking_for_expires_at: active ? row.looking_for_expires_at : null,
    contact_url: active ? row.contact_url || null : null,
  };
}

export async function getProfileSettings(userId) {
  const rows = await sql()`
    insert into profile_settings (user_id)
    values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning weekly_digest_opt_in, digest_email, email_consent_at, weekly_digest_sent_at,
      sync_token_invalidated_at, show_raw_counts, show_languages, looking_for, looking_for_expires_at,
      contact_url, updated_at
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

export function cleanLookingFor(value) {
  const next = String(value || 'idle').trim();
  if (!LOOKING_FOR_VALUES.has(next)) {
    const err = new Error('Invalid looking_for value');
    err.statusCode = 400;
    throw err;
  }
  return next;
}

export function cleanContactUrl(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.length > 500) {
    const err = new Error('Contact URL is too long');
    err.statusCode = 400;
    throw err;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    const err = new Error('Contact URL must be a valid URL');
    err.statusCode = 400;
    throw err;
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    const err = new Error('Contact URL must use http or https');
    err.statusCode = 400;
    throw err;
  }
  return url.toString();
}

export function lookingForExpiry(days = 7) {
  const clamped = Math.max(1, Math.min(30, Number(days) || 7));
  return new Date(Date.now() + clamped * 24 * 60 * 60 * 1000);
}
