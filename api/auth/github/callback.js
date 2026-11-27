import {
  OAUTH_STATE_COOKIE,
  clearCookie,
  decodeStatePayload,
  getCookie,
  originForRequest,
  setSessionCookie,
} from '../../_lib/auth.js';
import { fetchGithubUser, upsertGithubUser } from '../../_lib/github-oauth.js';
import { identityReadiness, identityUnavailableMessage } from '../../_lib/identity-readiness.js';
import { NO_STORE_HEADERS, methodNotAllowed, safeReturnTo, setNoStore } from '../../_lib/http.js';

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

  return fetchGithubUser(tokenBody.access_token);
}

export default async function handler(req, res) {
  setNoStore(res);

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  if (!identityReadiness().available) {
    clearCookie(req, res, OAUTH_STATE_COOKIE);
    return res.status(503).send(identityUnavailableMessage());
  }

  const statePayload = decodeStatePayload(getCookie(req, OAUTH_STATE_COOKIE) || '');
  clearCookie(req, res, OAUTH_STATE_COOKIE);

  if (!req.query?.code || !req.query?.state || statePayload?.state !== req.query.state) {
    return res.status(400).send('Invalid GitHub OAuth state');
  }

  try {
    const ghUser = await exchangeCode(req, req.query.code);
    const user = await upsertGithubUser(ghUser);
    setSessionCookie(req, res, user);
    res.redirect(302, safeReturnTo(statePayload.returnTo, '/'));
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.status(err.statusCode || 500).send('GitHub sign-in failed');
  }
}
