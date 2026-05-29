import { hasDatabase } from './db.js';

const IDENTITY_UNAVAILABLE_MESSAGE = 'Profile saves are not configured on this deployment yet.';

function hasGitHubOAuth() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function hasSessionSecret() {
  return Boolean(process.env.VIBE_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
}

export function identityReadiness() {
  const database = hasDatabase();
  const githubOAuth = hasGitHubOAuth();
  const sessionSecret = hasSessionSecret();
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
    missing: readiness.missing,
  };
}

export function identityUnavailableMessage() {
  return IDENTITY_UNAVAILABLE_MESSAGE;
}
