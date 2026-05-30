// Aggregate stats API — works with Upstash Redis REST API (zero npm deps)
// Set env vars: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV)
// or: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, requireSameOrigin } from './_lib/http.js';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ARCHETYPE_KEYS = [
  'orchestrator', 'shipper', 'architect', 'debugger',
  'polyglot', 'sprinter', 'deepdiver', 'builder',
];

async function pipeline(commands) {
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

// Baseline stats (realistic estimates for launch day before real data accumulates)
const BASELINE = {
  total: 847,
  archetypes: {
    orchestrator: 42, shipper: 153, architect: 110, debugger: 76,
    polyglot: 68, sprinter: 119, deepdiver: 93, builder: 186,
  },
  averages: {
    commitsPerDay: 5.2, sessions: 148, languages: 2.8,
    msgsPerSession: 11, days: 34,
  },
};

function statsSource(realTotal = 0) {
  return {
    kind: realTotal > 0 ? 'launch-baseline-plus-live' : 'launch-baseline',
    baseline_total: BASELINE.total,
    live_total: realTotal,
    note: realTotal > 0
      ? 'Launch baseline blended with live anonymous submissions.'
      : 'Launch baseline shown until live anonymous submissions accumulate.',
  };
}

function baselineStats() {
  return {
    ...BASELINE,
    source: statsSource(0),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
    return res.status(200).end();
  }

  const hasRedis = REDIS_URL && REDIS_TOKEN;

  if (req.method === 'POST') {
    try {
      requireSameOrigin(req);
    } catch (err) {
      return json(res, err.statusCode || 403, { error: err.message || 'Stats mutation blocked' }, NO_STORE_HEADERS);
    }
    if (!hasRedis) return json(res, 200, { ok: true, stored: false }, NO_STORE_HEADERS);

    try {
      const body = await readJson(req, { maxBytes: 16 * 1024 });
      const { archetype, commitsPerDay, sessions, languages, msgsPerSession, days } = body || {};
      if (!archetype || !ARCHETYPE_KEYS.includes(archetype)) {
        return json(res, 400, { error: 'valid archetype required' }, NO_STORE_HEADERS);
      }

      // Rate limit: 1 submission per IP per hour
      const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const rlKey = `vs:rl:${ip}`;
      const rlCheck = await pipeline([['GET', rlKey]]);
      if (rlCheck[0]?.result) {
        return json(res, 429, { error: 'Rate limited — 1 submission per hour' }, NO_STORE_HEADERS);
      }
      await pipeline([['SET', rlKey, '1', 'EX', '3600']]);

      // Clamp numeric values to prevent extreme inputs
      const clamp = (v, max) => Math.min(Math.max(Number(v) || 0, 0), max);

      await pipeline([
        ['INCR', 'vs:total'],
        ['INCR', `vs:arch:${archetype}`],
        ['INCRBYFLOAT', 'vs:sum:cpd', String(clamp(commitsPerDay, 200))],
        ['INCRBYFLOAT', 'vs:sum:sess', String(clamp(sessions, 10000))],
        ['INCRBYFLOAT', 'vs:sum:langs', String(clamp(languages, 50))],
        ['INCRBYFLOAT', 'vs:sum:mps', String(clamp(msgsPerSession, 500))],
        ['INCRBYFLOAT', 'vs:sum:days', String(clamp(days, 1000))],
      ]);

      json(res, 200, { ok: true, stored: true }, NO_STORE_HEADERS);
    } catch (err) {
      console.error('Stats POST error:', err);
      json(res, 200, { ok: true, stored: false }, NO_STORE_HEADERS);
    }
  } else if (req.method === 'GET') {
    if (!hasRedis) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      return res.status(200).json(baselineStats());
    }

    try {
      const results = await pipeline([
        ['GET', 'vs:total'],
        ...ARCHETYPE_KEYS.map(k => ['GET', `vs:arch:${k}`]),
        ['GET', 'vs:sum:cpd'],
        ['GET', 'vs:sum:sess'],
        ['GET', 'vs:sum:langs'],
        ['GET', 'vs:sum:mps'],
        ['GET', 'vs:sum:days'],
      ]);

      const realTotal = parseInt(results[0].result) || 0;

      // Merge: baseline + real data
      const total = BASELINE.total + realTotal;
      const archetypes = {};
      ARCHETYPE_KEYS.forEach((k, i) => {
        archetypes[k] = (BASELINE.archetypes[k] || 0) + (parseInt(results[1 + i].result) || 0);
      });

      const si = 1 + ARCHETYPE_KEYS.length;
      const rd = realTotal || 1;
      const bt = BASELINE.total;
      const div = total || 1;

      // Weighted average of baseline + real
      const averages = {
        commitsPerDay: Math.round(((BASELINE.averages.commitsPerDay * bt) + parseFloat(results[si].result || 0)) / div * 10) / 10,
        sessions: Math.round(((BASELINE.averages.sessions * bt) + parseFloat(results[si + 1].result || 0)) / div),
        languages: Math.round(((BASELINE.averages.languages * bt) + parseFloat(results[si + 2].result || 0)) / div * 10) / 10,
        msgsPerSession: Math.round(((BASELINE.averages.msgsPerSession * bt) + parseFloat(results[si + 3].result || 0)) / div),
        days: Math.round(((BASELINE.averages.days * bt) + parseFloat(results[si + 4].result || 0)) / div),
      };

      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      res.status(200).json({ total, archetypes, averages, source: statsSource(realTotal) });
    } catch (err) {
      console.error('Stats GET error:', err);
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      res.status(200).json(baselineStats());
    }
  } else {
    return methodNotAllowed(res, ['GET', 'POST', 'OPTIONS'], NO_STORE_HEADERS);
  }
}
