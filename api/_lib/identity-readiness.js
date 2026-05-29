import { hasDatabase } from './db.js';

const IDENTITY_UNAVAILABLE_MESSAGE = 'Profile saves are not configured on this deployment yet.';
export const MIN_SESSION_SECRET_BYTES = 32;

function hasGitHubOAuth() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function hasWeeklyDigestDelivery() {
  return Boolean(process.env.CRON_SECRET && process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);
}

export function sessionSecretValue() {
  const value = process.env.VIBE_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  return String(value).trim();
}

export function hasStrongSessionSecret() {
  return Buffer.byteLength(sessionSecretValue(), 'utf8') >= MIN_SESSION_SECRET_BYTES;
}

export function identityReadiness() {
  const database = hasDatabase();
  const githubOAuth = hasGitHubOAuth();
  const sessionSecret = hasStrongSessionSecret();
  const missing = [];

  if (!database) missing.push('database');
  if (!githubOAuth) missing.push('github_oauth');
  if (!sessionSecret) missing.push('session_secret');

  return {
    available: missing.length === 0,
    database,
    github_oauth: githubOAuth,
    session_secret: sessionSecret,
    missing,
  };
}

export function publicIdentityReadiness() {
  const readiness = identityReadiness();
  return {
    identity_available: readiness.available,
    profile_save_available: readiness.available,
    weekly_digest_available: hasWeeklyDigestDelivery(),
    missing: readiness.missing,
  };
}

export function identityUnavailableMessage() {
  return IDENTITY_UNAVAILABLE_MESSAGE;
}
