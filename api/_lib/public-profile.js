import { ARCHETYPE_KEYS, signatureFromUpload } from './signatures.js';
import { publicMoments } from './moments.js';

const OWNER_RAW_META_KEYS = [
  'dateRange',
  'source',
  'version',
];

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function copyNumber(out, source, key) {
  const value = source?.[key];
  if (value == null) return;
  const n = Number(value);
  if (Number.isFinite(n)) out[key] = n;
}

function boundedNumber(value, { min = 0, max = 100, round = true } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const bounded = Math.min(Math.max(n, min), max);
  return round ? Math.round(bounded) : bounded;
}

export function publicScores(scores = {}) {
  const out = {};
  for (const key of ARCHETYPE_KEYS) {
    const value = boundedNumber(scores?.[key]);
    if (value != null) out[key] = value;
  }

  if (scores?._percentiles && typeof scores._percentiles === 'object') {
    const percentiles = {};
    for (const key of ARCHETYPE_KEYS) {
      const value = boundedNumber(scores._percentiles[key], { min: 1, max: 100 });
      if (value != null) percentiles[key] = value;
    }
    if (Object.keys(percentiles).length) out._percentiles = percentiles;
  }

  return out;
}

function bucketDays(days) {
  if (days >= 120) return '120+ days tracked';
  if (days >= 30) return '30-119 days tracked';
  if (days >= 7) return '7-29 days tracked';
  if (days > 0) return '<7 days tracked';
  return 'fresh profile';
}

function cadenceLabel(commitsPerDay) {
  if (commitsPerDay >= 12) return 'high-velocity cadence';
  if (commitsPerDay >= 5) return 'steady cadence';
  if (commitsPerDay > 0) return 'warming up';
  return 'cadence private';
}

function depthLabel(sessions) {
  if (sessions >= 100) return 'deep history';
  if (sessions >= 25) return 'seasoned history';
  if (sessions > 0) return 'fresh history';
  return 'history private';
}

export function uploadRecency(uploadedAt, now = new Date()) {
  if (!uploadedAt) return { bucket: 'unknown', label: 'recent result' };
  const date = uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) {
    return { bucket: 'unknown', label: 'recent result' };
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (ageDays < 7) return { bucket: 'this-week', label: 'updated this week' };
  if (ageDays < 30) return { bucket: 'this-month', label: 'updated this month' };
  if (ageDays < 90) return { bucket: 'this-quarter', label: 'updated this quarter' };
  return { bucket: 'older', label: 'updated earlier' };
}

export function metricVisibility(row = {}, { isOwner = false } = {}) {
  return {
    show_raw_counts: Boolean(isOwner || row.show_raw_counts),
    show_languages: Boolean(isOwner || row.show_languages),
  };
}

export function publicActivity(metrics = {}) {
  return {
    days: bucketDays(safeNumber(metrics.days)),
    cadence: cadenceLabel(safeNumber(metrics.commitsPerDay)),
    depth: depthLabel(safeNumber(metrics.sessions)),
  };
}

export function visibleMetrics(metrics = {}, visibility = {}) {
  const out = {};
  if (visibility.show_raw_counts) {
    copyNumber(out, metrics, 'days');
    copyNumber(out, metrics, 'commitsPerDay');
    copyNumber(out, metrics, 'sessions');
    copyNumber(out, metrics, 'msgsPerSession');
  }
  if (visibility.show_languages) {
    const languages = metrics.codeLangCount ?? metrics.languages;
    if (languages != null) copyNumber(out, { languages }, 'languages');
  }
  return out;
}

export function publicRawMeta(rawMeta = {}, { isOwner = false, signature = null, visibility = {} } = {}) {
  const out = {};
  for (const key of isOwner ? OWNER_RAW_META_KEYS : []) {
    const value = rawMeta?.[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  if (signature?.label) out.signature = signature.label;
  if (signature?.combo) out.signatureCombo = signature.combo;
  if (ARCHETYPE_KEYS.includes(signature?.secondary)) out.secondaryArchetype = signature.secondary;
  if (isOwner && signature?.fingerprint) out.signatureFingerprint = signature.fingerprint;
  const moments = publicMoments(rawMeta?.moments, { exact: Boolean(isOwner || visibility.show_raw_counts) });
  if (moments.length) out.moments = moments;
  return out;
}

export function publicUpload(upload = {}, visibility = {}, { isOwner = false } = {}) {
  const signature = signatureFromUpload(upload);
  const out = {
    archetype: upload.archetype,
    scores: publicScores(upload.scores || {}),
    metrics: visibleMetrics(upload.metrics || {}, visibility),
    activity: publicActivity(upload.metrics || {}),
    updated: uploadRecency(upload.uploaded_at),
    raw_meta: publicRawMeta(upload.raw_meta || {}, { isOwner, signature, visibility }),
  };
  if (isOwner) out.uploaded_at = upload.uploaded_at;
  if (isOwner) out.id = upload.id;
  return out;
}
