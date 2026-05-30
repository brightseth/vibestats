import { ARCHETYPE_KEYS, signatureFromUpload, topArchetype } from './signatures.js';
import { sanitizeMoments } from './moments.js';

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

function uploadSource(value) {
  return value === 'cli' ? 'cli' : 'browser';
}

export function sanitizeUploadPayload(body = {}, { source = 'browser' } = {}) {
  const requestedArchetype = cleanText(body.archetype, 32);
  if (!ARCHETYPE_KEYS.includes(requestedArchetype)) {
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
  const archetype = topArchetype(scores, requestedArchetype);

  const metrics = {};
  const sourceMetrics = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};
  for (const [key, max] of Object.entries(NUMERIC_METRICS)) {
    const value = clampNumber(sourceMetrics[key], max);
    if (value != null) metrics[key] = value;
  }

  const rawMeta = {};
  const sourceMeta = body.raw_meta && typeof body.raw_meta === 'object' ? body.raw_meta : {};
  const dateRange = cleanText(sourceMeta.dateRange, 80);
  if (dateRange) rawMeta.dateRange = dateRange;
  rawMeta.source = uploadSource(source);
  rawMeta.version = 'wave-1';
  const signature = signatureFromUpload({ archetype, scores, raw_meta: {} });
  if (signature?.label) rawMeta.signature = signature.label;
  if (signature?.combo) rawMeta.signatureCombo = signature.combo;
  if (signature?.fingerprint) rawMeta.signatureFingerprint = signature.fingerprint;
  if (ARCHETYPE_KEYS.includes(signature?.secondary) && signature.secondary !== archetype) {
    rawMeta.secondaryArchetype = signature.secondary;
  }
  const moments = sanitizeMoments(sourceMeta.moments);
  if (moments.length) rawMeta.moments = moments;

  return { archetype, scores, metrics, raw_meta: rawMeta };
}
