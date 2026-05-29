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

function cleanText(value, max = 80) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : '';
}

function cleanSignatureCombo(value, primary) {
  const combo = cleanText(value, 80);
  const [secondary, comboPrimary] = combo.split('+');
  if (!ARCHETYPE_KEYS.includes(secondary) || comboPrimary !== primary || secondary === primary) {
    return '';
  }
  return combo;
}

function cleanSignatureFingerprint(value) {
  const fingerprint = cleanText(value, 120);
  const match = fingerprint.match(/^([a-z]+(?:\+[a-z]+){0,2}):(0|10|20|30|40|50|60|70|80|90)s$/);
  if (!match) return '';
  const archetypes = match[1].split('+');
  return archetypes.every((key) => ARCHETYPE_KEYS.includes(key)) ? fingerprint : '';
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
  const rawSecondary = cleanText(rawMeta.secondaryArchetype, 32);
  const secondary = ARCHETYPE_KEYS.includes(rawSecondary)
    ? rawSecondary
    : fallbackSecondary;
  const fallbackLabel = secondary
    ? `${SUB_PREFIXES[secondary] || secondary} ${ARCHETYPE_SHORT_NAMES[primary] || primary}`
    : '';
  const label = cleanText(rawMeta.signature, 80);
  const combo = cleanSignatureCombo(rawMeta.signatureCombo, primary);
  const fingerprint = cleanSignatureFingerprint(rawMeta.signatureFingerprint);

  return {
    label: label || fallbackLabel,
    combo: combo || (secondary ? `${secondary}+${primary}` : ''),
    secondary,
    fingerprint: fingerprint || signatureFingerprint(upload.scores, primary),
  };
}

export function rarityTier(count) {
  const n = Number(count) || 0;
  if (n <= 10) return 'rare';
  if (n <= 50) return 'uncommon';
  return 'common';
}
