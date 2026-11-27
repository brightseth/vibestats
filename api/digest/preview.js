import { clearSessionCookie, createDigestUnsubscribeToken, originForRequest, requireUser } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { buildWeeklyDigest } from '../_lib/digest.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage } from '../_lib/http.js';
import { weeklyLeaderboardRank } from '../_lib/leaderboard-rank.js';
import { rarityForSignature } from '../_lib/social-proof.js';
import { signatureFromUpload } from '../_lib/signatures.js';

function sendHtml(res, status, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
  return res.status(status).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #06060a; color: #f5f7fb; }
    main { width: min(520px, calc(100vw - 32px)); }
    h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.05; letter-spacing: 0; }
    p { margin: 0 0 18px; color: #9aa7b7; line-height: 1.65; }
    a { color: #a8c7ff; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="/settings">Back to settings</a></p>
  </main>
</body>
</html>`);
}

async function latestUploads(userId) {
  return sql()`
    select archetype, scores, metrics, raw_meta, uploaded_at
    from uploads
    where user_id = ${userId}
    order by uploaded_at desc
    limit 8
  `;
}

export async function buildPreviewDigest({ user, uploads, origin, now = new Date() }) {
  const latest = uploads?.[0];
  if (!latest) return null;
  const signature = signatureFromUpload(latest);
  return buildWeeklyDigest({
    user,
    uploads,
    rarity: await rarityForSignature(signature),
    leaderboard: await weeklyLeaderboardRank(user, latest),
    origin,
    now,
    unsubscribeToken: createDigestUnsubscribeToken(user),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  try {
    const user = await requireUser(req);
    if (!user) {
      clearSessionCookie(req, res);
      return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);
    }

    const digest = await buildPreviewDigest({
      user,
      uploads: await latestUploads(user.id),
      origin: originForRequest(req),
    });
    if (!digest) {
      return sendHtml(
        res,
        404,
        'No digest yet',
        'Save one derived Claude Code profile first, then the weekly digest preview can show evolution, rarity, sharing, and return links.',
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
    return res.status(200).send(digest.html);
  } catch (err) {
    console.error('GET /api/digest/preview error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Digest preview failed') }, NO_STORE_HEADERS);
  }
}
