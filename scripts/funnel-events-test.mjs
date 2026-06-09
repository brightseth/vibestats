#!/usr/bin/env node
// The funnel beacon is unauthenticated, so the allowlist is the only guard against
// arbitrary strings reaching the DB. Verify it holds and that bad input is rejected
// before any DB work.
import assert from 'node:assert/strict';
import { isFunnelEvent, recordFunnelEvent, FUNNEL_EVENT_NAMES } from '../api/_lib/funnel-events.js';

assert.equal(FUNNEL_EVENT_NAMES.length, 8, 'expected 8 funnel steps');
for (const name of ['compare_intent_view', 'pairing_shown', 'pairing_share_x', 'pairing_share_copy', 'pairing_open_full', 'pairing_reveal_click', 'wrapped_view', 'wrapped_share']) {
  assert.ok(isFunnelEvent(name), `${name} must be allowlisted`);
}
for (const bad of ['secret_leak', '__proto__', 'drop table', '', 'PAIRING_SHOWN', 'pairing_shown ']) {
  assert.ok(!isFunnelEvent(bad), `${bad} must be rejected`);
}

// Invalid event must throw 400 BEFORE any DB access.
await assert.rejects(() => recordFunnelEvent({ event: 'nope' }), /Invalid funnel event/);
await assert.rejects(() => recordFunnelEvent({ event: '__proto__' }), /Invalid funnel event/);

// Valid event with no DB configured must no-op (false), never throw.
const r = await recordFunnelEvent({ event: 'pairing_shown', archetype: 'orchestrator' });
assert.equal(r, false, 'no DB configured → graceful no-op');

console.log('funnel-events-test: OK — allowlist enforced, invalid rejected pre-DB, no-DB safe');
