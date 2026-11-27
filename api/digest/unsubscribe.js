import { verifyDigestUnsubscribeToken } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { NO_STORE_HEADERS, methodNotAllowed, safeErrorMessage } from '../_lib/http.js';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function sendHtml(res, status, title, message) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
  return res.status(status).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | vibestats</title>
  <style>
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #06060a; color: #e0e0e0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(520px, calc(100vw - 32px)); }
    h1 { margin: 0 0 12px; color: #fff; font-size: 34px; line-height: 1; }
    p, a { font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; color: #8888a0; }
    a { color: #9bb5ff; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    <p><a href="/settings">Open settings</a> / <a href="/">Reveal new stats</a></p>
  </main>
</body>
</html>`);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST'], NO_STORE_HEADERS);

  try {
    const token = firstParam(req.query?.token);
    if (!token) {
      return sendHtml(res, 400, 'Unsubscribe link invalid', 'This digest unsubscribe link is missing a token.');
    }

    const payload = verifyDigestUnsubscribeToken(token);
    if (!payload?.sub) {
      return sendHtml(res, 400, 'Unsubscribe link expired', 'Open settings to manage weekly digest email instead.');
    }

    await sql()`
      update profile_settings
      set weekly_digest_opt_in = false,
          digest_email = null,
          email_consent_at = null,
          updated_at = now()
      where user_id = ${payload.sub}
    `;

    return sendHtml(res, 200, 'Weekly digest is off', 'You will not receive weekly vibestats digest emails.');
  } catch (err) {
    console.error('digest unsubscribe error:', err);
    return sendHtml(res, err.statusCode || 500, 'Unsubscribe failed', safeErrorMessage(err, 'Digest unsubscribe failed.'));
  }
}
