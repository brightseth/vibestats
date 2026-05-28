import {
  OAUTH_STATE_COOKIE,
  appendSetCookie,
  encodeStatePayload,
  originForRequest,
  randomToken,
  serializeCookie,
} from '../../_lib/auth.js';
import { methodNotAllowed, safeReturnTo } from '../../_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('GITHUB_CLIENT_ID is not configured');
  }

  const state = randomToken();
  let refererPath = '/';
  try {
    refererPath = req.headers?.referer ? new URL(req.headers.referer).pathname : '/';
  } catch {
    refererPath = '/';
  }
  const returnTo = safeReturnTo(req.query?.returnTo || refererPath, '/');
  appendSetCookie(res, serializeCookie(req, OAUTH_STATE_COOKIE, encodeStatePayload({ state, returnTo }), {
    maxAge: 60 * 10,
  }));

  const origin = originForRequest(req);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/github/callback`,
    state,
    scope: '',
    allow_signup: 'true',
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
}
