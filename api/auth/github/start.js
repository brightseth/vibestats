import {
  OAUTH_STATE_COOKIE,
  appendSetCookie,
  encodeStatePayload,
  originForRequest,
  randomToken,
  serializeCookie,
} from '../../_lib/auth.js';
import { identityReadiness, identityUnavailableMessage } from '../../_lib/identity-readiness.js';
import { NO_STORE_HEADERS, methodNotAllowed, safeReturnTo, setNoStore } from '../../_lib/http.js';

export function returnToFromRequest(req, fallback = '/') {
  const explicit = safeReturnTo(req.query?.returnTo, '');
  if (explicit) return explicit;

  try {
    if (!req.headers?.referer) return fallback;
    const referer = new URL(req.headers.referer);
    if (referer.origin !== originForRequest(req)) return fallback;
    return safeReturnTo(`${referer.pathname}${referer.search}`, fallback);
  } catch {
    return fallback;
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'], NO_STORE_HEADERS);
  }

  setNoStore(res);

  if (!identityReadiness().available) {
    return res.status(503).send(identityUnavailableMessage());
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('GITHUB_CLIENT_ID is not configured');
  }

  const state = randomToken();
  const returnTo = returnToFromRequest(req, '/');
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
