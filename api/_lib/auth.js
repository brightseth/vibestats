import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getUserById } from './db.js';

export const SESSION_COOKIE = 'vibestats_auth';
export const OAUTH_STATE_COOKIE = 'vibestats_oauth_state';
const SESSION_TOKEN_TYPE = 'vibestats_session';
const DIGEST_UNSUBSCRIBE_TOKEN_TYPE = 'vibestats_digest_unsubscribe';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SYNC_TOKEN_MAX_AGE = 60 * 60 * 24 * 180;
const DIGEST_UNSUBSCRIBE_TOKEN_MAX_AGE = 60 * 60 * 24 * 180;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function secret() {
  const value = process.env.VIBE_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) {
    const err = new Error('VIBE_SESSION_SECRET is not configured');
    err.statusCode = 500;
    throw err;
  }
  return value;
}

function sign(input) {
  return base64url(createHmac('sha256', secret()).update(input).digest());
}

export function randomToken(bytes = 24) {
  return base64url(randomBytes(bytes));
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.id,
    gh_id: user.gh_id,
    gh_handle: user.gh_handle,
    avatar_url: user.avatar_url,
    typ: SESSION_TOKEN_TYPE,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  }));
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

export function createSyncToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.id,
    gh_handle: user.gh_handle,
    scope: 'sync',
    typ: 'vibestats_sync',
    iat: now,
    exp: now + SYNC_TOKEN_MAX_AGE,
  }));
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

export function createDigestUnsubscribeToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.id,
    scope: 'digest:unsubscribe',
    typ: DIGEST_UNSUBSCRIBE_TOKEN_TYPE,
    iat: now,
    exp: now + DIGEST_UNSUBSCRIBE_TOKEN_MAX_AGE,
  }));
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

export function syncTokenExpiresAt() {
  return new Date((Math.floor(Date.now() / 1000) + SYNC_TOKEN_MAX_AGE) * 1000).toISOString();
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = sign(data);
  const actual = parts[2];
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64url(parts[1]));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifySyncToken(token) {
  const payload = verifySessionToken(token);
  if (!payload || payload.typ !== 'vibestats_sync' || payload.scope !== 'sync') return null;
  return payload;
}

export function verifyDigestUnsubscribeToken(token) {
  const payload = verifySessionToken(token);
  if (!payload || payload.typ !== DIGEST_UNSUBSCRIBE_TOKEN_TYPE || payload.scope !== 'digest:unsubscribe') return null;
  return payload;
}

export function readBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function getCookie(req, name) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const index = cookie.indexOf('=');
    if (index === -1) continue;
    const key = cookie.slice(0, index).trim();
    if (key === name) return decodeURIComponent(cookie.slice(index + 1).trim());
  }
  return null;
}

function isSecureRequest(req) {
  const host = req.headers?.host || '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return false;
  return (req.headers?.['x-forwarded-proto'] || 'https') === 'https';
}

export function serializeCookie(req, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (isSecureRequest(req)) parts.push('Secure');
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join('; ');
}

export function appendSetCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', value);
  } else if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value]);
  } else {
    res.setHeader('Set-Cookie', [current, value]);
  }
}

export function setSessionCookie(req, res, user) {
  appendSetCookie(res, serializeCookie(req, SESSION_COOKIE, createSessionToken(user), {
    maxAge: SESSION_MAX_AGE,
  }));
}

export function clearCookie(req, res, name) {
  appendSetCookie(res, serializeCookie(req, name, '', {
    maxAge: 0,
    expires: new Date(0),
  }));
}

export function clearSessionCookie(req, res) {
  clearCookie(req, res, SESSION_COOKIE);
}

export function readSession(req) {
  const payload = verifySessionToken(getCookie(req, SESSION_COOKIE));
  if (!payload) return null;
  if (payload.typ && payload.typ !== SESSION_TOKEN_TYPE) return null;
  return payload;
}

export async function requireUser(req) {
  const session = readSession(req);
  if (!session?.sub) return null;
  return getUserById(session.sub);
}

export async function requireSyncUser(req) {
  const session = verifySyncToken(readBearerToken(req));
  if (!session?.sub) return null;
  return getUserById(session.sub);
}

export function originForRequest(req) {
  if (process.env.VIBESTATS_URL) return process.env.VIBESTATS_URL.replace(/\/$/, '');
  const host = req.headers?.host || 'localhost:3000';
  const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    ? 'http'
    : (req.headers?.['x-forwarded-proto'] || 'https');
  return `${proto}://${host}`;
}

export function encodeStatePayload(payload) {
  return base64url(JSON.stringify(payload));
}

export function decodeStatePayload(value) {
  try {
    return JSON.parse(fromBase64url(value));
  } catch {
    return null;
  }
}
