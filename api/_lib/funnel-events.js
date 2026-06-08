import { hasDatabase, sql } from './db.js';
import { ARCHETYPE_KEYS } from './uploads.js';

// The compare-intent funnel. Steps the server-rendered viral_events can't see,
// because they happen in the browser before any navigation:
//   compare_intent_view  — landed on a ?compareTo / ?compareArchetype link
//   pairing_shown        — picked an archetype and saw the chemistry result
//   pairing_share_x      — clicked "Share our pairing" (X intent)
//   pairing_share_copy   — copied the pairing link
//   pairing_open_full    — opened the full /compare pairing page
//   pairing_reveal_click — clicked "reveal yours" (entered the create path)
const FUNNEL_EVENTS = new Set([
  'compare_intent_view',
  'pairing_shown',
  'pairing_share_x',
  'pairing_share_copy',
  'pairing_open_full',
  'pairing_reveal_click',
]);

export const FUNNEL_EVENT_NAMES = [...FUNNEL_EVENTS];

export function isFunnelEvent(name) {
  return FUNNEL_EVENTS.has(String(name || ''));
}

export async function recordFunnelEvent({ event, archetype = null } = {}) {
  const name = String(event || '');
  if (!FUNNEL_EVENTS.has(name)) {
    const err = new Error('Invalid funnel event');
    err.statusCode = 400;
    throw err;
  }
  if (!hasDatabase()) return false;
  const arch = ARCHETYPE_KEYS.includes(String(archetype || '').toLowerCase())
    ? String(archetype).toLowerCase()
    : null;
  try {
    await sql()`insert into funnel_events (event, archetype) values (${name}, ${arch})`;
    return true;
  } catch (err) {
    // Analytics must never break the app: no-op if the table isn't migrated yet.
    if (err?.code === '42P01' || String(err?.message || '').includes('funnel_events')) return false;
    throw err;
  }
}
