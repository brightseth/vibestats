export const ARCHETYPE_KEYS = [
  'orchestrator', 'shipper', 'architect', 'debugger',
  'polyglot', 'sprinter', 'deepdiver', 'builder',
];

const SUB_PREFIXES = {
  orchestrator: 'parallel',
  shipper: 'high-velocity',
  architect: 'methodical',
  debugger: 'investigative',
  polyglot: 'multi-stack',
  sprinter: 'rapid-fire',
  deepdiver: 'deep-session',
  builder: 'prolific',
};

const ARCHETYPE_SHORT_NAMES = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

function sortedScores(scores = {}) {
  return Object.entries(scores)
    .filter(([key, value]) => ARCHETYPE_KEYS.includes(key) && Number.isFinite(Number(value)))
    .sort((a, b) => Number(b[1]) - Number(a[1]));
}

export function signatureFingerprint(scores = {}, primary) {
  if (!ARCHETYPE_KEYS.includes(primary)) return '';
  const top = sortedScores(scores).slice(0, 3).map(([key]) => key);
  if (!top.includes(primary)) top.unshift(primary);
  const topThree = [...new Set(top)].slice(0, 3);
  if (!topThree.length) return '';

  const primaryScore = Math.max(0, Math.min(100, Math.round(Number(scores[primary]) || 0)));
  const bucket = Math.min(90, Math.floor(primaryScore / 10) * 10);
  return `${topThree.join('+')}:${bucket}s`;
}

export function signatureFromUpload(upload = {}) {
  const primary = upload.archetype;
  if (!ARCHETYPE_KEYS.includes(primary)) return null;

  const rawMeta = upload.raw_meta || {};
  const fallbackSecondary = sortedScores(upload.scores)
    .filter(([key]) => key !== primary)[0]?.[0] || '';
  const secondary = ARCHETYPE_KEYS.includes(rawMeta.secondaryArchetype)
    ? rawMeta.secondaryArchetype
    : fallbackSecondary;
  const fallbackLabel = secondary
    ? `${SUB_PREFIXES[secondary] || secondary} ${ARCHETYPE_SHORT_NAMES[primary] || primary}`
    : '';

  return {
    label: rawMeta.signature || fallbackLabel,
    combo: rawMeta.signatureCombo || (secondary ? `${secondary}+${primary}` : ''),
    secondary,
    fingerprint: rawMeta.signatureFingerprint || signatureFingerprint(upload.scores, primary),
  };
}

export function rarityTier(count) {
  const n = Number(count) || 0;
  if (n <= 10) return 'rare';
  if (n <= 50) return 'uncommon';
  return 'common';
}
