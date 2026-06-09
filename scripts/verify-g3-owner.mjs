#!/usr/bin/env node
// G3 verification harness: prove the /scoreboard OWNER view renders — the case that
// couldn't be verified headlessly before. Mints a REAL session token with the app's own
// auth code (createSessionToken + VIBE_SESSION_SECRET from .env.local), then invokes the
// REAL api/dashboard.js handler against the REAL database (read-only selects only).
//
// Cases: A) owner → 200 + funnel HTML   B) non-owner → 404, no data
//        C) anon → 401 sign-in (deny-path regression)
// Run from repo root: node scripts/verify-g3-owner.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// ---- load .env.local BEFORE importing app modules (they read env at call time) ----
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
assert.ok(process.env.VIBE_SESSION_SECRET, 'VIBE_SESSION_SECRET required');
assert.ok(process.env.DATABASE_URL || process.env.POSTGRES_URL, 'DATABASE_URL required');

const { createSessionToken, SESSION_COOKIE } = await import('../api/_lib/auth.js');
const { sql } = await import('../api/_lib/db.js');

// ---- find the real owner user (read-only) ----
const rows = await sql()`select id, gh_id, gh_handle from users where lower(gh_handle) = 'brightseth' limit 1`;
assert.ok(rows[0], 'owner user brightseth must exist in DB');
const owner = rows[0];
const token = createSessionToken(owner);

function makeReq(cookie) {
  return { method: 'GET', headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} };
}
function makeRes() {
  const headers = {};
  return {
    statusCode: 0,
    body: '',
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    removeHeader(k) { delete headers[k.toLowerCase()]; },
    end(b) { this.body = String(b ?? ''); this.done = true; },
    // json() helper path in _lib/http uses res.status().json() on vercel; emulate:
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = JSON.stringify(obj); this.done = true; },
  };
}

// ---- Case A: owner sees the scoreboard ----
const dashOwner = (await import('../api/dashboard.js?case=owner')).default;
const resA = makeRes();
await dashOwner(makeReq(token), resA);
assert.equal(resA.statusCode, 200, `owner expected 200, got ${resA.statusCode}: ${resA.body.slice(0, 120)}`);
assert.ok(resA.body.includes('Compare-intent funnel'), 'owner page must contain the funnel section');
assert.ok(resA.body.includes('@brightseth'), 'owner page must show the owner handle');
const liveData = resA.body.includes('Landed on a pairing link');
const gracefulNoTable = resA.body.includes('No funnel_events table yet');
assert.ok(liveData || gracefulNoTable, 'must render live funnel bars OR the graceful no-table card');
console.log(`CASE A PASS — owner 200 + funnel rendered (${liveData ? 'LIVE funnel_events data' : 'graceful no-table card'})`);

// ---- Case C: anon → 401 sign-in (same module instance is fine) ----
const resC = makeRes();
await dashOwner(makeReq(null), resC);
assert.equal(resC.statusCode, 401, `anon expected 401, got ${resC.statusCode}`);
assert.ok(resC.body.includes('Sign in required'), 'anon must see sign-in prompt');
assert.ok(!resC.body.includes('Compare-intent funnel'), 'anon must not see funnel data');
console.log('CASE C PASS — anon 401 + sign-in, no data leak');

// ---- Case B: same authenticated user, but NOT in the owner allowlist → 404 ----
process.env.VIBESTATS_OWNER_HANDLES = 'definitely-not-brightseth';
const dashNonOwner = (await import('../api/dashboard.js?case=nonowner')).default;
const resB = makeRes();
await dashNonOwner(makeReq(token), resB);
assert.equal(resB.statusCode, 404, `non-owner expected 404, got ${resB.statusCode}`);
assert.ok(!resB.body.includes('Compare-intent funnel'), 'non-owner must not see funnel data');
console.log('CASE B PASS — authenticated non-owner 404, no data leak');

console.log('verify-g3-owner: ALL PASS');
process.exit(0);
