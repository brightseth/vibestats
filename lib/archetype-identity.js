// Single source of truth for public archetype identity.
//
// The eight internal keys are LOCKED for launch and must stay mapped one-to-one:
//   orchestrator, shipper, architect, debugger, polyglot, sprinter, deepdiver, builder
// (enforced by db/migrations/0009_upload_archetype_canon.sql and the identity doctor).
//
// Public display fields — names, taglines, descriptions, colors — are open to
// rebrand. Change them HERE and every server renderer (og, card, embed, reveal,
// recap, profile, home, badge, digest, …) updates together. Client HTML templates
// consume the same data via injection helpers below, so there is one place to edit.
//
// Field guide:
//   name           public display name, e.g. "THE ORCHESTRATOR"
//   short          compact label, e.g. "Orchestrator"
//   plural         grid/leaderboard plural, e.g. "Orchestrators"
//   tagline        full one-line identity hook (em-dash voice)
//   taglineShort   compact variant for tight surfaces (profile embed card)
//   description    one-sentence personality line (homepage reveal)
//   color          primary brand color (gradient start)
//   accent         secondary brand color (gradient end)
//   gradient        135deg card gradient (color -> accent)
//   borderGradient  90deg sweep used on bordered cards
//   strength        comparison strength label (compare page)
//   style           comparison style label (compare page)
//   glyph           compact symbolic mark used as a shape channel across web,
//                   terminal, SVG badges, and generated OG images

// Reuse the canonical key list so there is exactly one source for the eight locked keys.
import { ARCHETYPE_KEYS } from '../api/_lib/signatures.js';
export { ARCHETYPE_KEYS };

export const ARCHETYPE_IDENTITY = {
  orchestrator: {
    name: 'THE ORCHESTRATOR',
    short: 'Orchestrator',
    plural: 'Orchestrators',
    tagline: "You don't code — you conduct.",
    taglineShort: "You don't code. You conduct.",
    description: 'Multi-session maestro running parallel agents from a central command hub.',
    color: '#6B8FFF',
    accent: '#a78bfa',
    gradient: 'linear-gradient(135deg, #6B8FFF, #a78bfa)',
    borderGradient: 'linear-gradient(90deg, transparent, #6B8FFF, #a78bfa, transparent)',
    strength: 'Parallel execution',
    style: 'Conductor',
    glyph: '||',
  },
  shipper: {
    name: 'THE SHIPPER',
    short: 'Shipper',
    plural: 'Shippers',
    tagline: 'Done is better than perfect. You live this.',
    taglineShort: 'Done is better than perfect.',
    description: "High commit velocity. You push code like it's breathing.",
    color: '#22c55e',
    accent: '#22d3ee',
    gradient: 'linear-gradient(135deg, #22c55e, #22d3ee)',
    borderGradient: 'linear-gradient(90deg, transparent, #22c55e, #22d3ee, transparent)',
    strength: 'Ship velocity',
    style: 'Deployer',
    glyph: '>>',
  },
  architect: {
    name: 'THE ARCHITECT',
    short: 'Architect',
    plural: 'Architects',
    tagline: 'You read before you write. You plan before you build.',
    taglineShort: 'You plan before you build.',
    description: 'Deep reader, careful planner. Your code is deliberate.',
    color: '#0891b2',
    accent: '#22d3ee',
    gradient: 'linear-gradient(135deg, #0891b2, #22d3ee)',
    borderGradient: 'linear-gradient(90deg, transparent, #0891b2, #22d3ee, transparent)',
    strength: 'System design',
    style: 'Planner',
    glyph: '[]',
  },
  debugger: {
    name: 'THE DEBUGGER',
    short: 'Debugger',
    plural: 'Debuggers',
    tagline: "You don't guess. You investigate.",
    taglineShort: "You don't guess. You investigate.",
    description: "High grep usage, systematic problem solver. Friction doesn't stop you.",
    color: '#f59e0b',
    accent: '#ef4444',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    borderGradient: 'linear-gradient(90deg, transparent, #f59e0b, #ef4444, transparent)',
    strength: 'Investigation',
    style: 'Detective',
    glyph: '??',
  },
  polyglot: {
    name: 'THE POLYGLOT',
    short: 'Polyglot',
    plural: 'Polyglots',
    tagline: 'One language is never enough.',
    taglineShort: 'One language is never enough.',
    description: 'Diverse tech stack, versatile builder across languages and paradigms.',
    color: '#ff79c6',
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #ff79c6, #f59e0b)',
    borderGradient: 'linear-gradient(90deg, transparent, #ff79c6, #22c55e, #6B8FFF, transparent)',
    strength: 'Versatility',
    style: 'Multilingual',
    glyph: '{}',
  },
  sprinter: {
    name: 'THE SPRINTER',
    short: 'Sprinter',
    plural: 'Sprinters',
    tagline: 'Fast, focused, ferocious.',
    taglineShort: 'Fast, focused, ferocious.',
    description: 'High-intensity sessions, rapid-fire messages. You move at breakneck speed.',
    color: '#ef4444',
    accent: '#ff79c6',
    gradient: 'linear-gradient(135deg, #ef4444, #ff79c6)',
    borderGradient: 'linear-gradient(90deg, transparent, #ef4444, #ff79c6, transparent)',
    strength: 'Raw speed',
    style: 'Rapid-fire',
    glyph: '!!',
  },
  deepdiver: {
    name: 'THE DEEP DIVER',
    short: 'Deep Diver',
    plural: 'Deep Divers',
    tagline: 'You go deep, not wide.',
    taglineShort: 'You go deep, not wide.',
    description: "Fewer sessions but much deeper. When you start, you don't come up for air.",
    color: '#3b82f6',
    accent: '#1e40af',
    gradient: 'linear-gradient(135deg, #3b82f6, #1e40af)',
    borderGradient: 'linear-gradient(90deg, transparent, #3b82f6, #1e40af, transparent)',
    strength: 'Deep focus',
    style: 'Immersive',
    glyph: '__',
  },
  builder: {
    name: 'THE BUILDER',
    short: 'Builder',
    plural: 'Builders',
    tagline: "You build things that didn't exist before.",
    taglineShort: "You build things that didn't exist before.",
    description: 'High write-to-read ratio. You create more than you consume.',
    color: '#84cc16',
    accent: '#facc15',
    gradient: 'linear-gradient(135deg, #84cc16, #facc15)',
    borderGradient: 'linear-gradient(90deg, transparent, #84cc16, #facc15, transparent)',
    strength: 'Creation',
    style: 'Maker',
    glyph: '++',
  },
};

export const FALLBACK_ARCHETYPE_KEY = 'builder';

export function isArchetypeKey(key) {
  return Object.prototype.hasOwnProperty.call(ARCHETYPE_IDENTITY, key);
}

// Resolve a key to its identity, falling back to a safe default.
export function archetype(key, fallback = FALLBACK_ARCHETYPE_KEY) {
  return ARCHETYPE_IDENTITY[key] || ARCHETYPE_IDENTITY[fallback] || ARCHETYPE_IDENTITY.builder;
}

// Build a subset view keyed by archetype, e.g. archetypeMap(['name', 'short'])
// returns { orchestrator: { name, short }, ... }. Server renderers use this to
// keep their local object shape identical to before the refactor.
export function archetypeMap(fields) {
  const keys = Array.isArray(fields) ? fields : null;
  const out = {};
  for (const key of ARCHETYPE_KEYS) {
    const source = ARCHETYPE_IDENTITY[key];
    if (!keys) {
      out[key] = { ...source };
      continue;
    }
    const picked = {};
    for (const field of keys) picked[field] = source[field];
    out[key] = picked;
  }
  return out;
}

// Serialize a subset view as a JS object literal for injecting into a client
// <script> (Phase 2). Uses JSON, which is valid JS for these plain values.
export function archetypeClientLiteral(fields) {
  return JSON.stringify(archetypeMap(fields), null, 2);
}
