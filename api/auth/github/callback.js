import {
  OAUTH_STATE_COOKIE,
  clearCookie,
  decodeStatePayload,
  getCookie,
  originForRequest,
  setSessionCookie,
} from '../../_lib/auth.js';
import { sql } from '../../_lib/db.js';
import { safeReturnTo } from '../../_lib/http.js';

async function exchangeCode(req, code) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const err = new Error('GitHub OAuth is not configured');
    err.statusCode = 500;
    throw err;
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${originForRequest(req)}/api/auth/github/callback`,
    }),
  });
  const tokenBody = await tokenRes.json();
  if (!tokenRes.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || tokenBody.error || 'GitHub token exchange failed');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenBody.access_token}`,
      'User-Agent': 'vibestats',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const user = await userRes.json();
  if (!userRes.ok || !user.id || !user.login) {
    throw new Error(user.message || 'GitHub user fetch failed');
  }

  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const statePayload = decodeStatePayload(getCookie(req, OAUTH_STATE_COOKIE) || '');
  clearCookie(req, res, OAUTH_STATE_COOKIE);

  if (!req.query?.code || !req.query?.state || statePayload?.state !== req.query.state) {
    return res.status(400).send('Invalid GitHub OAuth state');
  }

  try {
    const ghUser = await exchangeCode(req, req.query.code);
    const rows = await sql()`
      insert into users (gh_id, gh_handle, avatar_url, last_seen_at)
      values (${ghUser.id}, ${ghUser.login}, ${ghUser.avatar_url || null}, now())
      on conflict (gh_id) do update
        set gh_handle = excluded.gh_handle,
            avatar_url = excluded.avatar_url,
            last_seen_at = now()
      returning id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
    `;
    const user = rows[0];
    setSessionCookie(req, res, user);
    res.redirect(302, safeReturnTo(statePayload.returnTo, '/'));
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.status(err.statusCode || 500).send('GitHub sign-in failed');
  }
}

