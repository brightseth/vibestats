import { createSyncToken, originForRequest, requireUser, syncTokenExpiresAt } from '../_lib/auth.js';
import { NO_STORE_HEADERS, methodNotAllowed, requireSameOrigin, safeErrorMessage, setNoStore } from '../_lib/http.js';

const LOCAL_CALLBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function htmlEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function isValidCliNonce(value) {
  return typeof value === 'string' && NONCE_PATTERN.test(value);
}

export function allowedLocalCallback(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:') return null;
    if (!LOCAL_CALLBACK_HOSTS.has(url.hostname)) return null;
    if (!url.port || Number(url.port) < 1 || Number(url.port) > 65535) return null;
    if (url.pathname !== '/callback') return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function localTokenPath(callback, nonce) {
  const params = new URLSearchParams({ callback, nonce });
  return `/api/cli/local-token?${params.toString()}`;
}

export function localTokenRedirectUrl({ callback, token, host, expiresAt, handle, nonce }) {
  const url = new URL(callback);
  url.searchParams.set('token', token);
  url.searchParams.set('host', host);
  url.searchParams.set('expires_at', expiresAt);
  url.searchParams.set('handle', handle || '');
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

function authorizationPage({ action, handle, host }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize vibestats CLI</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #080a12; color: #f4f7fb; }
    main { width: min(440px, calc(100vw - 32px)); }
    h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.1; letter-spacing: 0; }
    p { margin: 0 0 16px; color: #9aa7b7; line-height: 1.55; }
    .handle { color: #a8c7ff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    form { margin-top: 24px; }
    button { width: 100%; min-height: 46px; border: 1px solid rgba(107,143,255,0.5); border-radius: 8px; background: rgba(107,143,255,0.16); color: #dbe7ff; font-weight: 700; cursor: pointer; }
    small { display: block; margin-top: 16px; color: #6d7888; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Authorize vibestats CLI</h1>
    <p>Signed in as <span class="handle">@${htmlEsc(handle)}</span>. This creates a revocable sync token for local <span class="handle">npx vibestats sync</span>.</p>
    <p>Raw Claude Code <span class="handle">/insights</span> data stays on your machine. The CLI uploads only derived metrics to ${htmlEsc(host)}.</p>
    <form method="post" action="${htmlEsc(action)}">
      <button type="submit">Authorize CLI sync</button>
    </form>
    <small>Close this tab if you did not start this from the vibestats CLI.</small>
  </main>
</body>
</html>`;
}

function invalidRequest(res) {
  setNoStore(res);
  return res.status(400).send('Invalid vibestats CLI authorization request.');
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST'], NO_STORE_HEADERS);

  setNoStore(res);

  const callback = firstQueryValue(req.query?.callback);
  const nonce = firstQueryValue(req.query?.nonce);
  const localCallback = allowedLocalCallback(callback);
  if (!localCallback || !isValidCliNonce(nonce)) return invalidRequest(res);

  try {
    if (req.method === 'POST') requireSameOrigin(req);

    const user = await requireUser(req);
    const returnTo = localTokenPath(localCallback.toString(), nonce);
    if (!user) {
      const params = new URLSearchParams({ returnTo });
      return res.redirect(302, `/api/auth/github/start?${params.toString()}`);
    }

    const origin = originForRequest(req);
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(authorizationPage({
        action: returnTo,
        handle: user.gh_handle,
        host: origin,
      }));
    }

    const token = createSyncToken(user);
    return res.redirect(302, localTokenRedirectUrl({
      callback: localCallback.toString(),
      token,
      host: origin,
      expiresAt: syncTokenExpiresAt(),
      handle: user.gh_handle,
      nonce,
    }));
  } catch (err) {
    console.error('CLI local token error:', err);
    return res.status(err.statusCode || 500).send(safeErrorMessage(err, 'CLI authorization failed'));
  }
}
