import { publicMoments } from './moments.js';

const MAX_ACHIEVEMENTS = 5;

const ARCHETYPE_LABELS = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

const FACET_BADGES = {
  shipping_velocity: {
    label: 'Launch instinct',
    detail: 'Shipping velocity leads this profile shape',
  },
  system_design: {
    label: 'System thinker',
    detail: 'Architecture signal leads this profile shape',
  },
  debug_patience: {
    label: 'Debug anchor',
    detail: 'Investigation signal leads this profile shape',
  },
  tool_orchestration: {
    label: 'Agent conductor',
    detail: 'Tool orchestration leads this profile shape',
  },
  stack_breadth: {
    label: 'Stack switcher',
    detail: 'Stack breadth leads this profile shape',
  },
  deep_focus: {
    label: 'Deep work core',
    detail: 'Deep focus leads this profile shape',
  },
  build_energy: {
    label: 'Build engine',
    detail: 'Build energy leads this profile shape',
  },
};

function formatInt(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0));
}

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, 96);
}

function rankedBadge(badge, priority) {
  if (!badge?.id || !badge.label || !badge.value) return null;
  return {
    ...badge,
    label: cleanText(badge.label),
    value: cleanText(badge.value),
    detail: cleanText(badge.detail || 'Derived public profile signal'),
    priority,
  };
}

function topFacet(facets = []) {
  return facets
    .filter((facet) => facet?.id && Number.isFinite(Number(facet.value)))
    .sort((a, b) => Number(b.value) - Number(a.value))[0] || null;
}

function primaryScore(upload = {}) {
  const value = upload?.scores?.[upload?.archetype];
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

export function publicAchievements({
  upload = {},
  publicUpload = null,
  signature = null,
  rarity = null,
  leaderboard = null,
  evolution = null,
  streak = null,
} = {}) {
  const serialized = publicUpload || {};
  const badges = [];
  const score = primaryScore(serialized);
  const archetype = serialized.archetype || upload?.archetype;
  const archetypeLabel = ARCHETYPE_LABELS[archetype] || archetype || 'Claude Code';

  if (rarity?.count) {
    const label = rarity.tier === 'rare' ? 'Rare signature' : rarity.tier === 'uncommon' ? 'Uncommon combo' : 'Signature cohort';
    badges.push(rankedBadge({
      id: `rarity-${rarity.tier || 'known'}`,
      label,
      value: `1 of ${formatInt(rarity.count)}`,
      detail: `${Number(rarity.window_days) || 30}-day ${signature?.label || archetypeLabel} cohort`,
      tone: 'scarcity',
    }, rarity.tier === 'rare' ? 100 : rarity.tier === 'uncommon' ? 88 : 62));
  }

  if (leaderboard?.rank) {
    const rank = Math.max(1, Number(leaderboard.rank) || 1);
    badges.push(rankedBadge({
      id: 'weekly-rank',
      label: 'Board signal',
      value: `#${formatInt(rank)}`,
      detail: `weekly ${ARCHETYPE_LABELS[leaderboard.label] || archetypeLabel} leaderboard`,
      tone: rank <= 3 ? 'rank' : 'proof',
    }, rank <= 3 ? 96 : rank <= 10 ? 86 : 74));
  }

  const moments = publicMoments(upload?.raw_meta?.moments, { exact: false });
  if (moments[0]) {
    badges.push(rankedBadge({
      id: `moment-${moments[0].id}`,
      label: moments[0].label,
      value: moments[0].value,
      detail: moments[0].detail,
      tone: 'moment',
    }, 82));
  }

  const facet = topFacet(serialized.facets);
  if (facet) {
    const def = FACET_BADGES[facet.id] || { label: facet.label || 'Top facet', detail: facet.detail || 'Strongest derived profile axis' };
    badges.push(rankedBadge({
      id: `facet-${facet.id}`,
      label: def.label,
      value: `${Math.round(Number(facet.value) || 0)}%`,
      detail: def.detail,
      tone: 'facet',
    }, Math.max(60, Math.min(84, 54 + Math.round(Number(facet.value) || 0) / 2))));
  }

  if (signature?.label) {
    badges.push(rankedBadge({
      id: 'signature-combo',
      label: 'Signature combo',
      value: signature.label,
      detail: 'Top two public archetype signals',
      tone: 'signature',
    }, 58));
  }

  if (score >= 85) {
    badges.push(rankedBadge({
      id: 'high-signal',
      label: 'High signal',
      value: `${score}%`,
      detail: `${archetypeLabel} primary score`,
      tone: 'proof',
    }, 56));
  }

  if (streak && (Number(streak.days) > 1 || Number(streak.upload_count) > 1)) {
    badges.push(rankedBadge({
      id: 'return-streak',
      label: streak.active ? 'Return streak' : 'Streak paused',
      value: streak.label,
      detail: streak.detail || 'Saved profile cadence',
      tone: 'return',
    }, 52));
  }

  if (evolution?.label) {
    badges.push(rankedBadge({
      id: `evolution-${evolution.type || 'signal'}`,
      label: 'Evolving signal',
      value: evolution.label,
      detail: evolution.detail || 'Changed since the previous upload',
      tone: evolution.type === 'score-drop' ? 'warning' : 'return',
    }, 48));
  }

  const seen = new Set();
  return badges
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .filter((badge) => {
      if (seen.has(badge.id)) return false;
      seen.add(badge.id);
      return true;
    })
    .slice(0, MAX_ACHIEVEMENTS)
    .map(({ priority, ...badge }) => badge);
}
