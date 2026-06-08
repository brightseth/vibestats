#!/usr/bin/env node
// Privacy-gate test for the depth layer. Two non-negotiables:
//   1. aggregateFacetSignals counts the real fixtures EXACTLY (no silent miscount).
//   2. secret_leak — and every unrecognized/free-text key — NEVER crosses the
//      boundary, in either the local aggregate or the server-side sanitizer.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { aggregateFacetSignals, sanitizeFacetSignals, FACET_SIGNAL_TAXONOMY } from '../api/_lib/facet-signals.js';

function deepValues(obj, acc = []) {
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) { acc.push(k); deepValues(v, acc); }
  return acc;
}
function assertNoForbiddenKeys(signals) {
  const keys = deepValues(signals);
  assert.ok(!keys.includes('secret_leak'), 'secret_leak must never appear');
  const allowed = new Set([
    'sessions_analyzed', 'outcome_mix', 'helpfulness_mix', 'session_type_mix',
    'success_mix', 'satisfaction_mix', 'friction_taxonomy',
    ...Object.values(FACET_SIGNAL_TAXONOMY).flat(),
  ]);
  for (const k of keys) assert.ok(allowed.has(k), `unexpected key crossed the boundary: ${k}`);
}

// ---- 1. Fixture accuracy (uses the user's real /insights facets if present) ----
const facetDir = join(homedir(), '.claude/usage-data/facets');
if (existsSync(facetDir)) {
  const facets = readdirSync(facetDir).filter((f) => f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(readFileSync(join(facetDir, f), 'utf8')); } catch { return null; } })
    .filter(Boolean);
  const signals = aggregateFacetSignals(facets);
  assert.ok(signals, 'expected signals from real fixtures');
  assert.equal(signals.sessions_analyzed, facets.length, 'sessions_analyzed must equal facet count');

  // recompute friction independently from the raw files and compare bucket totals
  const TAXO = {
    wrong_approach: 'collaboration', misunderstood_request: 'collaboration', missed_context: 'collaboration',
    missing_context: 'collaboration', stale_context: 'collaboration', false_tool_claim: 'collaboration', user_rejected_action: 'collaboration',
    buggy_code: 'code',
    tool_unavailable: 'tooling', tool_misconfiguration: 'tooling', tool_timeout: 'tooling', missing_tools: 'tooling', missing_dependencies: 'tooling', environment_issue: 'tooling',
    api_error: 'platform', api_errors: 'platform', rate_limit_error: 'platform', rate_limit_errors: 'platform', api_rate_limit: 'platform', output_token_limit_exceeded: 'platform', slow_response: 'platform', network_issues: 'platform', external_blocker: 'platform',
  };
  const expectedFriction = {};
  let sawSecretLeak = false;
  for (const f of facets) for (const [k, v] of Object.entries(f.friction_counts || {})) {
    if (k === 'secret_leak') sawSecretLeak = true;
    const b = TAXO[k]; if (!b) continue;
    expectedFriction[b] = (expectedFriction[b] || 0) + (Number(v) || 0);
  }
  assert.deepEqual(signals.friction_taxonomy, expectedFriction, 'friction taxonomy totals must match hand-count');
  if (sawSecretLeak) console.log('  (fixtures contain secret_leak — confirming it is dropped)');
  assertNoForbiddenKeys(signals);
  console.log(`  fixture aggregate OK — ${facets.length} sessions, friction=${JSON.stringify(signals.friction_taxonomy)}`);
} else {
  console.log('  (no local facets fixtures — skipping fixture-accuracy check)');
}

// ---- 2. Synthetic accuracy (deterministic, no fixtures needed) ----
const synth = [
  { outcome: 'fully_achieved', claude_helpfulness: 'essential', session_type: 'multi_task', primary_success: 'proactive_help',
    user_satisfaction_counts: { likely_satisfied: 3, dissatisfied: 1 }, friction_counts: { wrong_approach: 2, buggy_code: 1, secret_leak: 5, totally_made_up_key: 9 } },
  { outcome: 'unclear_from_transcript', claude_helpfulness: 'very_helpful', session_type: 'iterative_refinement', primary_success: 'good_debugging',
    user_satisfaction_counts: { neutral: 2, happy: 1 }, friction_counts: { api_errors: 3, rate_limit_error: 1 } },
];
const s = aggregateFacetSignals(synth);
assert.equal(s.sessions_analyzed, 2);
assert.deepEqual(s.outcome_mix, { fully: 1, unclear: 1 });
assert.deepEqual(s.helpfulness_mix, { essential: 1, very_helpful: 1 });
assert.deepEqual(s.session_type_mix, { multi_task: 1, iterative: 1 });
assert.deepEqual(s.success_mix, { proactive_help: 1, good_debugging: 1 });
assert.deepEqual(s.satisfaction_mix, { positive: 4, neutral: 2, negative: 1 }); // likely_satisfied 3 + happy 1
assert.deepEqual(s.friction_taxonomy, { collaboration: 2, code: 1, platform: 4 }); // secret_leak + made_up dropped
assertNoForbiddenKeys(s);
console.log('  synthetic aggregate OK — unknown + secret_leak dropped');

// ---- 3. Server sanitizer rejects malicious / free-text input ----
const malicious = {
  sessions_analyzed: '43',
  outcome_mix: { fully: '10', hacker_label: 5, mostly: 7 },
  friction_taxonomy: { collaboration: 5, secret_leak: 99, 'rm -rf': 3, code: '2' },
  underlying_goal: 'launch the secret project for ClientName',
  junk: { nested: 1 },
};
const clean = sanitizeFacetSignals(malicious);
assert.equal(clean.sessions_analyzed, 43, 'numeric string coerced to int');
assert.deepEqual(clean.outcome_mix, { fully: 10, mostly: 7 }, 'unknown enum key dropped, strings coerced');
assert.deepEqual(clean.friction_taxonomy, { collaboration: 5, code: 2 }, 'secret_leak + injected key dropped');
assert.ok(!('underlying_goal' in clean) && !('junk' in clean), 'free-text and junk dropped');
assertNoForbiddenKeys(clean);
assert.equal(sanitizeFacetSignals(null), null);
assert.equal(sanitizeFacetSignals({}), null);
assert.equal(sanitizeFacetSignals({ outcome_mix: { hacker: 1 } }), null, 'all-invalid → null');

// ---- 4. Round trip: aggregate output passes the sanitizer unchanged ----
assert.deepEqual(sanitizeFacetSignals(s), s, 'clean aggregate must survive sanitize unchanged');

console.log('facet-signals-test: OK — counts exact, secret_leak + free-text never cross');
