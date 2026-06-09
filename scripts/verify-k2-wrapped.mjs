#!/usr/bin/env node
// K2 verification: /wrapped?handle= hydrates from the public payload; sample stays
// without a handle; VISITOR MODE MUST NOT leak raw counts (the API omits them — this
// asserts the page can't resurrect them). Run: node scripts/verify-k2-wrapped.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';

const PW_MODULE = process.env.PW_MODULE || '/Users/sethgoldstein/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.js';
const PW_CHROMIUM = process.env.PW_CHROMIUM || '/Users/sethgoldstein/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT = 3042;
const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const file = join(ROOT, req.url.split('?')[0] === '/' ? 'wrapped-template.html' : req.url.split('?')[0].slice(1));
  try { res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'text/plain' }); res.end(readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const { chromium } = (await import(PW_MODULE)).default ?? await import(PW_MODULE);
const browser = await chromium.launch({ executablePath: PW_CHROMIUM });
const KEYS = ['orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder'];
const archJs = 'window.VIBESTATS_ARCHETYPES=' + JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, { name: 'THE ' + k.toUpperCase(), tagline: 'tag', glyph: '>>', color: '#6B8FFF' }]))) + ';';

const CANARY = 31337; // raw count present ONLY in owner payload
function payload({ raw }) {
  return {
    user: { gh_handle: 'tester' },
    rarity: { tier: 'rare', count: 1, window_days: 30 },
    uploads: [{
      archetype: 'deepdiver',
      scores: { deepdiver: 90 },
      activity: { days: '7-29 days tracked', cadence: 'steady cadence', depth: 'seasoned history' },
      metrics: raw ? { sessions: CANARY, commitsPerDay: 6, languages: 5, days: 29 } : {},
      raw_meta: {
        signature: 'high-velocity Deep Diver',
        moments: [{ id: 'x', label: 'Marathon session', value: raw ? '72h' : '24h+ session' }],
      },
      facet_signals: raw
        ? { mode: 'counts', sessions_analyzed: 43, outcome_mix: { fully: 13, mostly: 17, partially: 5, not_achieved: 3, unclear: 5 }, helpfulness_mix: { essential: 6, very_helpful: 22, moderately_helpful: 10 }, friction_taxonomy: { collaboration: 18, code: 10, tooling: 6, platform: 33 } }
        : { mode: 'percent', outcome_mix: { fully: 30, mostly: 40, partially: 12, not_achieved: 7, unclear: 12 }, helpfulness_mix: { essential: 14, very_helpful: 51, moderately_helpful: 23 }, friction_taxonomy: { collaboration: 27, code: 15, tooling: 9, platform: 49 } },
    }],
  };
}

async function load(url, apiBody, apiStatus = 200) {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/archetype-identity', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: archJs }));
  await page.route('**/api/u/**', (r) => r.fulfill({ status: apiStatus, contentType: 'application/json', body: JSON.stringify(apiBody || { error: 'x' }) }));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const text = await page.evaluate(() => document.body.textContent); // textContent includes non-active (hidden) slides
  const html = await page.content();
  const segs = await page.$$eval('.progress-seg', (els) => els.length);
  const slides = await page.$$eval('.slide', (els) => els.length);
  await page.close();
  return { text, html, segs, slides, errors };
}

const base = `http://localhost:${PORT}/wrapped-template.html`;

// 1. sample mode
const s = await load(base, null, 404);
assert.ok(s.text.includes('Seth Goldstein'), 'sample keeps its narrative');
assert.ok(s.html.includes('wrapped-own-footer'), 'sample shows reveal-your-own footer');
assert.equal(s.errors.length, 0, 'no page errors: ' + s.errors[0]);
console.log('PASS sample — narrative intact + footer, slides:', s.slides);

// 2. owner-mode hydration
const o = await load(`${base}?handle=tester`, payload({ raw: true }));
assert.ok(o.text.includes('@tester'), 'hydrated handle shown');
assert.ok(o.text.includes('high-velocity Deep Diver'), 'signature shown');
assert.ok(o.text.includes(String(CANARY)), 'owner sees raw counts');
assert.ok(o.text.includes('72h'), 'owner sees exact moment');
assert.ok(o.html.includes('compareTo=tester'), 'share routes to the pairing invite');
assert.equal(o.segs, o.slides, 'progress matches deck size');
assert.ok(!o.text.includes('Seth Goldstein'), 'sample narrative fully replaced');
assert.equal(o.errors.length, 0, 'no page errors: ' + o.errors[0]);
console.log('PASS owner — deck:', o.slides, 'slides, raw counts visible');

// 3. visitor mode: NO raw counts can leak
const v = await load(`${base}?handle=tester`, payload({ raw: false }));
assert.ok(v.text.includes('@tester'), 'visitor hydration works');
assert.ok(!v.text.includes(String(CANARY)), 'VISITOR MUST NOT see raw session count');
assert.ok(!v.text.includes('72h'), 'visitor sees bucketed moment, not exact');
assert.ok(v.text.includes('24h+ session'), 'bucketed moment shown');
assert.ok(v.text.includes('7-29 days tracked'), 'bucketed activity shown');
assert.equal(v.errors.length, 0, 'no page errors: ' + v.errors[0]);
console.log('PASS visitor — bucketed only, zero raw-count leak');

// 4. bogus handle → sample fallback
const b = await load(`${base}?handle=no-such-user`, { error: 'Profile not found' }, 404);
assert.ok(b.text.includes('Seth Goldstein'), '404 falls back to sample');
assert.ok(b.html.includes('wrapped-own-footer'), 'fallback shows footer');
console.log('PASS fallback — 404 keeps sample + footer');

await browser.close();
server.close();
console.log('verify-k2-wrapped: ALL PASS');
