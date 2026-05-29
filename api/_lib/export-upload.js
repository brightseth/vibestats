import { ARCHETYPE_KEYS, signatureFromUpload } from './signatures.js';

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

function exportRawMeta(rawMeta = {}, signature = null) {
  const out = {};
  for (const key of RAW_META_KEYS) {
    const value = rawMeta?.[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  if (signature?.label) out.signature = signature.label;
  if (signature?.combo) out.signatureCombo = signature.combo;
  if (signature?.fingerprint) out.signatureFingerprint = signature.fingerprint;
  if (ARCHETYPE_KEYS.includes(signature?.secondary)) out.secondaryArchetype = signature.secondary;
  return out;
}

export function exportableUpload(upload = {}) {
  const archetype = ARCHETYPE_KEYS.includes(upload.archetype) ? upload.archetype : null;
  const scores = exportScores(upload.scores || {});
  const signature = signatureFromUpload({ archetype, scores });
  return {
    id: upload.id,
    archetype,
    scores,
    metrics: exportMetrics(upload.metrics || {}),
    raw_meta: exportRawMeta(upload.raw_meta || {}, signature),
    uploaded_at: upload.uploaded_at,
  };
}
