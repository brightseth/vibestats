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

export function publicRawMeta(rawMeta = {}, { isOwner = false } = {}) {
  if (isOwner) return rawMeta || {};
  return {
    signature: rawMeta?.signature || undefined,
    signatureCombo: rawMeta?.signatureCombo || undefined,
    signatureFingerprint: rawMeta?.signatureFingerprint || undefined,
    secondaryArchetype: rawMeta?.secondaryArchetype || undefined,
  };
}

export function publicUpload(upload = {}, visibility = {}, { isOwner = false } = {}) {
  const out = {
    archetype: upload.archetype,
    scores: upload.scores || {},
    metrics: visibleMetrics(upload.metrics || {}, visibility),
    activity: publicActivity(upload.metrics || {}),
    updated: uploadRecency(upload.uploaded_at),
    raw_meta: publicRawMeta(upload.raw_meta || {}, { isOwner }),
  };
  if (isOwner) out.uploaded_at = upload.uploaded_at;
  if (isOwner) out.id = upload.id;
  return out;
}
