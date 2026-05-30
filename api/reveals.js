import { originForRequest } from './_lib/auth.js';
import { createRevealSnapshot } from './_lib/reveal-snapshots.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, requireSameOrigin, safeErrorMessage } from './_lib/http.js';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REVEAL_LINKS_PER_HOUR = 12;

async function redisPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return res.json();
}

function requestIp(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim() || 'unknown';
}

async function assertRevealRateLimit(req) {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  const key = `vs:rl:reveals:${requestIp(req)}`;
  let result;
  try {
    result = await redisPipeline([
      ['INCR', key],
      ['EXPIRE', key, '3600'],
    ]);
  } catch (err) {
    console.error('Reveal link rate limit unavailable:', err);
    return;
  }
  const count = Number(result?.[0]?.result || 0);
  if (count > REVEAL_LINKS_PER_HOUR) {
    const err = new Error('Reveal link limit reached. Try again in an hour.');
    err.statusCode = 429;
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  try {
    requireSameOrigin(req);
    await assertRevealRateLimit(req);
    const snapshot = await createRevealSnapshot(await readJson(req, { maxBytes: 64 * 1024 }), {
      origin: originForRequest(req),
    });
    return json(res, 201, { ok: true, ...snapshot }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('POST /api/reveals error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Reveal link failed') }, NO_STORE_HEADERS);
  }
}
