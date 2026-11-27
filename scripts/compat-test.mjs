#!/usr/bin/env node
// Keystone test: the compare-intent landing depends on window.VibeCompat producing
// a valid pairing for every archetype combination. compat.js is a browser IIFE that
// attaches to `window`; we load it in a vm with a window shim, exactly as the page does.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../lib/compat.js', import.meta.url), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const VC = ctx.window.VibeCompat;

assert.ok(VC, 'window.VibeCompat must be attached');

const TYPES = ['orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder'];

let pairs = 0;
for (const a of TYPES) {
  for (const b of TYPES) {
    pairs += 1;
    // getPairing must always resolve to a named pairing (no "Unknown Pairing" leaking to UI).
    const pairing = VC.getPairing(a, b);
    assert.notEqual(pairing.name, 'Unknown Pairing', `getPairing(${a},${b}) returned Unknown`);

    // profileCompatibility(visitorType, hostType, handle) — the exact call the landing makes.
    const r = VC.profileCompatibility(a, b, 'somehandle');
    assert.ok(Number.isFinite(r.score), `score not finite for ${a} x ${b}`);
    assert.ok(r.score >= 55 && r.score <= 99, `score ${r.score} out of [55,99] for ${a} x ${b}`);
    assert.ok(typeof r.line === 'string' && r.line.length > 0, `empty line for ${a} x ${b}`);

    // With explicit facets (the richer path /api/u feeds), score must still be valid.
    const facets = [
      { id: 'shipping_velocity', value: 80 },
      { id: 'system_design', value: 40 },
      { id: 'deep_focus', value: 60 },
    ];
    const rf = VC.profileCompatibility(a, b, 'h', null, { facets });
    assert.ok(rf.score >= 55 && rf.score <= 99, `facet score ${rf.score} out of range for ${a} x ${b}`);
  }
}

assert.equal(pairs, 64, 'expected 64 ordered archetype pairs');
console.log(`compat-test: OK — ${pairs} pairs, all scores in [55,99], no Unknown Pairing`);
