import { ARCHETYPE_KEYS } from './signatures.js';

const METRIC_KEYS = [
  'commitsPerDay',
  'sessions',
  'languages',
  'msgsPerSession',
  'days',
];
const RAW_META_KEYS = [
  'dateRange',
  'source',
  'version',
  'signature',
  'signatureCombo',
  'signatureFingerprint',
  'secondaryArchetype',
];

function copyFiniteNumbers(source = {}, keys = Object.keys(source)) {
  const out = {};
  for (const key of keys) {
    const value = source?.[key];
    if (value == null) continue;
    const number = Number(value);
    if (Number.isFinite(number)) out[key] = number;
  }
  return out;
}

function exportScores(scores = {}) {
  const out = copyFiniteNumbers(scores, ARCHETYPE_KEYS);
  if (scores._percentiles && typeof scores._percentiles === 'object') {
    const percentiles = copyFiniteNumbers(scores._percentiles, ARCHETYPE_KEYS);
    if (Object.keys(percentiles).length) out._percentiles = percentiles;
  }
  return out;
}

function exportMetrics(metrics = {}) {
  return copyFiniteNumbers(metrics, METRIC_KEYS);
}

function exportRawMeta(rawMeta = {}) {
  const out = {};
  for (const key of RAW_META_KEYS) {
    const value = rawMeta?.[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function exportableUpload(upload = {}) {
  return {
    id: upload.id,
    archetype: ARCHETYPE_KEYS.includes(upload.archetype) ? upload.archetype : null,
    scores: exportScores(upload.scores || {}),
    metrics: exportMetrics(upload.metrics || {}),
    raw_meta: exportRawMeta(upload.raw_meta || {}),
    uploaded_at: upload.uploaded_at,
  };
}
