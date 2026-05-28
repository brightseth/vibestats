import { ARCHETYPE_KEYS } from './signatures.js';

export const GOAL_LABELS = {
  'pair-coding': 'Pair coding',
  'co-founder': 'Co-founder',
  hire: 'Hiring',
  mentor: 'Mentor',
  mentee: 'Mentee',
  idle: 'Idle',
};

export const ARCHETYPE_LABELS = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

const ROLE_FIT = {
  'pair-coding': {
    builder: 16,
    shipper: 15,
    debugger: 13,
    sprinter: 12,
    orchestrator: 12,
    architect: 10,
    deepdiver: 10,
    polyglot: 9,
  },
  'co-founder': {
    architect: 16,
    orchestrator: 16,
    builder: 14,
    shipper: 12,
    deepdiver: 10,
    debugger: 9,
    polyglot: 8,
    sprinter: 8,
  },
  hire: {
    shipper: 16,
    debugger: 14,
    builder: 14,
    architect: 12,
    polyglot: 12,
    orchestrator: 10,
    deepdiver: 10,
    sprinter: 9,
  },
  mentor: {
    architect: 16,
    deepdiver: 15,
    debugger: 13,
    orchestrator: 13,
    polyglot: 11,
    builder: 10,
    shipper: 9,
    sprinter: 7,
  },
  mentee: {
    sprinter: 14,
    builder: 13,
    shipper: 12,
    polyglot: 10,
    debugger: 9,
    architect: 8,
    orchestrator: 8,
    deepdiver: 7,
  },
};

const PAIR_FIT = {
  'pair-coding': {
    'architect:builder': 24,
    'builder:shipper': 23,
    'debugger:shipper': 23,
    'debugger:deepdiver': 22,
    'deepdiver:orchestrator': 22,
    'orchestrator:sprinter': 21,
    'architect:sprinter': 20,
    'builder:orchestrator': 20,
    'builder:sprinter': 19,
    'deepdiver:shipper': 18,
  },
  'co-founder': {
    'architect:shipper': 23,
    'builder:orchestrator': 22,
    'architect:builder': 21,
    'deepdiver:shipper': 19,
    'debugger:shipper': 18,
    'orchestrator:sprinter': 18,
  },
  hire: {
    'debugger:shipper': 22,
    'architect:builder': 21,
    'builder:shipper': 21,
    'debugger:polyglot': 19,
    'deepdiver:orchestrator': 18,
  },
  mentor: {
    'architect:sprinter': 21,
    'debugger:builder': 20,
    'deepdiver:shipper': 19,
    'orchestrator:sprinter': 18,
    'architect:polyglot': 17,
  },
  mentee: {
    'architect:sprinter': 21,
    'debugger:builder': 20,
    'deepdiver:shipper': 19,
    'orchestrator:sprinter': 18,
    'architect:polyglot': 17,
  },
};

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pairKey(a, b) {
  return [a, b].sort().join(':');
}

export function cleanSeekerArchetype(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === '' || raw === 'any') return null;
  const archetype = String(raw).trim().toLowerCase();
  if (!ARCHETYPE_KEYS.includes(archetype)) {
    const err = new Error('Invalid seeker archetype');
    err.statusCode = 400;
    throw err;
  }
  return archetype;
}

function intentBonus(goal, lookingFor) {
  if (goal === lookingFor) return 22;
  if (goal === 'mentor' && lookingFor === 'mentee') return 24;
  if (goal === 'mentee' && lookingFor === 'mentor') return 24;
  if (lookingFor && lookingFor !== 'idle') return 8;
  return 0;
}

function archetypeBonus(goal, candidateArchetype, seekerArchetype) {
  if (seekerArchetype) {
    if (seekerArchetype === candidateArchetype) return goal === 'co-founder' ? 6 : 10;
    return PAIR_FIT[goal]?.[pairKey(seekerArchetype, candidateArchetype)] || 12;
  }
  return ROLE_FIT[goal]?.[candidateArchetype] || 8;
}

function levelFor(score) {
  if (score >= 90) return 'strong';
  if (score >= 80) return 'good';
  return 'available';
}

function reasonFor({ goal, lookingFor, candidateArchetype, seekerArchetype, pairBonus }) {
  const goalLabel = GOAL_LABELS[goal]?.toLowerCase() || goal;
  const candidateLabel = ARCHETYPE_LABELS[candidateArchetype] || candidateArchetype;
  const intentText = goal === lookingFor
    ? `active ${goalLabel} intent`
    : lookingFor && lookingFor !== 'idle'
      ? `active ${GOAL_LABELS[lookingFor]?.toLowerCase() || lookingFor} intent`
      : 'recent public profile';

  if (!seekerArchetype) {
    return `${candidateLabel} profile with ${intentText}.`;
  }

  const seekerLabel = ARCHETYPE_LABELS[seekerArchetype] || seekerArchetype;
  const complement = pairBonus >= 20 ? 'strong complement' : pairBonus >= 14 ? 'clean complement' : 'shared-style fit';
  return `${seekerLabel} + ${candidateLabel}: ${complement}, ${intentText}.`;
}

export function goalFit({ goal, lookingFor, candidateArchetype, seekerArchetype = null, signal = 0 }) {
  const normalizedSeeker = cleanSeekerArchetype(seekerArchetype);
  const signalScore = clampScore(signal);
  const pairBonus = archetypeBonus(goal, candidateArchetype, normalizedSeeker);
  const score = Math.max(55, Math.min(99, 48 + intentBonus(goal, lookingFor) + pairBonus + Math.round(signalScore * 0.09)));

  return {
    score,
    level: levelFor(score),
    reason: reasonFor({
      goal,
      lookingFor,
      candidateArchetype,
      seekerArchetype: normalizedSeeker,
      pairBonus,
    }),
  };
}
