import { ARCHETYPE_KEYS } from './signatures.js';

export { ARCHETYPE_KEYS };

const NUMERIC_METRICS = {
  commitsPerDay: 500,
  sessions: 100000,
  languages: 200,
  msgsPerSession: 5000,
  days: 5000,
};

function clampNumber(value, max) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), max);
}

function cleanText(value, max = 120) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function sanitizeUploadPayload(body = {}) {
  const archetype = cleanText(body.archetype, 32);
  if (!ARCHETYPE_KEYS.includes(archetype)) {
    const err = new Error('valid archetype required');
    err.statusCode = 400;
    throw err;
  }

  const scores = {};
  const sourceScores = body.scores && typeof body.scores === 'object' ? body.scores : {};
  for (const key of ARCHETYPE_KEYS) {
    scores[key] = Math.round(clampNumber(sourceScores[key], 100) || 0);
  }
  if (sourceScores._percentiles && typeof sourceScores._percentiles === 'object') {
    scores._percentiles = {};
    for (const key of ARCHETYPE_KEYS) {
      const value = clampNumber(sourceScores._percentiles[key], 100);
      if (value != null) scores._percentiles[key] = Math.max(1, Math.round(value));
    }
  }

  const metrics = {};
  const sourceMetrics = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};
  for (const [key, max] of Object.entries(NUMERIC_METRICS)) {
    const value = clampNumber(sourceMetrics[key], max);
    if (value != null) metrics[key] = value;
  }

  const rawMeta = {};
  const sourceMeta = body.raw_meta && typeof body.raw_meta === 'object' ? body.raw_meta : {};
  for (const key of ['dateRange', 'source', 'version', 'signature', 'signatureCombo', 'signatureFingerprint']) {
    const value = cleanText(sourceMeta[key], key === 'dateRange' ? 80 : 40);
    if (value) rawMeta[key] = value;
  }
  const secondaryArchetype = cleanText(sourceMeta.secondaryArchetype, 32);
  if (ARCHETYPE_KEYS.includes(secondaryArchetype) && secondaryArchetype !== archetype) {
    rawMeta.secondaryArchetype = secondaryArchetype;
  }

  return { archetype, scores, metrics, raw_meta: rawMeta };
}
