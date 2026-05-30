import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db.js';

export const CLAIM_SESSION_TTL_SECONDS = 10 * 60;
export const CLAIM_CODE_PATTERN = /^VIBE-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

const CLAIM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CLI_PACKAGE = 'github:brightseth/vibestats#feat/wave-1-identity';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function randomClaimSuffix() {
  const bytes = randomBytes(8);
  let out = '';
  for (const byte of bytes) out += CLAIM_ALPHABET[byte % CLAIM_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function normalizeClaimCode(value) {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
  if (/^VIBE[A-Z2-9]{8}$/.test(compact)) {
    return `VIBE-${compact.slice(4, 8)}-${compact.slice(8)}`;
  }
  return String(value || '').trim().toUpperCase();
}

export function cleanClaimCode(value, { optional = false } = {}) {
  if ((value == null || value === '') && optional) return '';
  const code = normalizeClaimCode(value);
  if (!CLAIM_CODE_PATTERN.test(code)) {
    const err = new Error('Invalid claim code');
    err.statusCode = 400;
    throw err;
  }
  return code;
}

export function claimCodeHash(code) {
  return createHash('sha256').update(cleanClaimCode(code)).digest('hex');
}

export function generateClaimCode() {
  return `VIBE-${randomClaimSuffix()}`;
}

export function claimLocalCommand(origin, code) {
  return `curl -fsSL ${shellQuote(`${origin}/cli.sh`)} | sh -s -- claim ${shellQuote(code)} --host ${shellQuote(origin)}`;
}

export function claimNpxCommand(origin, code) {
  const packageSpec = process.env.VIBESTATS_CLI_PACKAGE || DEFAULT_CLI_PACKAGE;
  return `npx --yes ${shellQuote(packageSpec)} claim ${shellQuote(code)} --host ${shellQuote(origin)}`;
}

function expired(row) {
  return row?.expires_at && new Date(row.expires_at).getTime() <= Date.now();
}

function publicClaimSession(row) {
  if (!row) return null;
  const state = row.state === 'pending' && expired(row) ? 'expired' : row.state;
  const out = {
    state,
    expires_at: row.expires_at,
  };
  if (row.gh_handle) out.gh_handle = row.gh_handle;
  if (row.profile_url) out.profile_url = row.profile_url;
  if (row.compare_url) out.compare_url = row.compare_url;
  if (row.credential_url) out.credential_url = row.credential_url;
  if (row.consumed_at) out.consumed_at = row.consumed_at;
  return out;
}

async function markExpired(row) {
  if (!row || row.state !== 'pending' || !expired(row)) return row;
  const rows = await sql()`
    update ssh_claim_sessions
    set state = 'expired',
        updated_at = now()
    where code_hash = ${row.code_hash}
      and state = 'pending'
    returning state, gh_handle, profile_url, compare_url, credential_url, created_at, expires_at, consumed_at
  `;
  return rows[0] || { ...row, state: 'expired' };
}

export async function createClaimSession() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateClaimCode();
    const rows = await sql()`
      insert into ssh_claim_sessions (code_hash, expires_at)
      values (${claimCodeHash(code)}, now() + (${CLAIM_SESSION_TTL_SECONDS} * interval '1 second'))
      on conflict (code_hash) do nothing
      returning state, gh_handle, profile_url, compare_url, credential_url, created_at, expires_at, consumed_at
    `;
    if (rows[0]) return { code, session: publicClaimSession(rows[0]) };
  }

  const err = new Error('Could not create claim session');
  err.statusCode = 503;
  throw err;
}

export async function getClaimSessionStatus(code) {
  const hash = claimCodeHash(code);
  const rows = await sql()`
    select code_hash, state, gh_handle, profile_url, compare_url, credential_url, created_at, expires_at, consumed_at
    from ssh_claim_sessions
    where code_hash = ${hash}
    limit 1
  `;
  if (!rows[0]) {
    const err = new Error('Claim session not found');
    err.statusCode = 404;
    throw err;
  }
  return publicClaimSession(await markExpired(rows[0]));
}

export async function assertClaimSessionAttachable(code) {
  const hash = claimCodeHash(code);
  const rows = await sql()`
    select code_hash, state, expires_at
    from ssh_claim_sessions
    where code_hash = ${hash}
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    const err = new Error('Claim session not found');
    err.statusCode = 404;
    throw err;
  }
  if (row.state !== 'pending') {
    const err = new Error('Claim session already used');
    err.statusCode = 409;
    throw err;
  }
  if (expired(row)) {
    await markExpired(row);
    const err = new Error('Claim session expired');
    err.statusCode = 410;
    throw err;
  }
  return cleanClaimCode(code);
}

export async function attachClaimSession(code, user, links) {
  const cleanCode = cleanClaimCode(code);
  const hash = claimCodeHash(cleanCode);
  const rows = await sql()`
    update ssh_claim_sessions
    set state = 'synced',
        gh_handle = ${user.gh_handle},
        user_id = ${user.id},
        profile_url = ${links.profile_url},
        compare_url = ${links.compare_url},
        credential_url = ${links.credential_url},
        consumed_at = now(),
        updated_at = now()
    where code_hash = ${hash}
      and state = 'pending'
      and expires_at > now()
    returning state, gh_handle, profile_url, compare_url, credential_url, created_at, expires_at, consumed_at
  `;
  if (!rows[0]) return getClaimSessionStatus(cleanCode);
  return publicClaimSession(rows[0]);
}
