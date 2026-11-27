#!/usr/bin/env node
// G2a verification harness: facet_signals must survive the REAL CLI→browser→server path.
//
//   CLI encoder (bin/vibestats.js localWebPreviewUrl, real local /insights data)
//     → home.html hash decode + runAnalysis in a REAL headless browser
//     → user clicks "Claim this profile" (real UI wiring)
//     → POST /api/uploads intercepted at the network layer
//     → captured body fed through the REAL server boundary (sanitizeUploadPayload)
//     → publicUpload visitor view asserted percent-mode
//
// Also executes the negative (injected secret_leak/junk dropped) and legacy
// (no facet_signals) cases. Run from repo root: node scripts/verify-g2a-roundtrip.mjs
// Requires: ~/.claude/usage-data with facets, a playwright install (env PW_MODULE /
// PW_CHROMIUM override the defaults), and a free port 3041.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { localWebPreviewUrl } from '../bin/vibestats.js';
import { readInsightsInput } from '../lib/claude-insights-extractor.js';
import { sanitizeUploadPayload } from '../api/_lib/uploads.js';
import { publicUpload } from '../api/_lib/public-profile.js';

const PW_MODULE = process.env.PW_MODULE || '/Users/sethgoldstein/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.js';
const PW_CHROMIUM = process.env.PW_CHROMIUM || '/Users/sethgoldstein/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const PORT = 3041;
const ROOT = process.cwd();

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

// ---- build the three preview hashes ----
const usage = join(homedir(), '.claude/usage-data');
assert.ok(existsSync(usage), 'needs ~/.claude/usage-data');
const data = await readInsightsInput(usage);
assert.ok(data.metrics.facet_signals, 'extractor must produce facet_signals from real data');

const realUrl = localWebPreviewUrl(data, { host: `http://localhost:${PORT}` });
const realHash = '#' + realUrl.split('#')[1];
assert.ok(JSON.parse(Buffer.from(realHash.split('=')[1], 'base64url').toString()).insights.metrics.facet_signals,
  'CRITERION 1: CLI preview encodes facet_signals');
console.log('C1 PASS — CLI preview URL encodes facet_signals');

// tampered: inject forbidden keys into the encoded preview
const tampered = JSON.parse(Buffer.from(realHash.split('=')[1], 'base64url').toString());
tampered.insights.metrics.facet_signals.friction_taxonomy.secret_leak = 99;
tampered.insights.metrics.facet_signals.outcome_mix.evil_injected = 7;
tampered.insights.metrics.facet_signals.underlying_goal = 'secret project for ClientName';
const tamperedHash = '#vibestatsPreview=' + b64urlJson(tampered);

// legacy: strip facet_signals entirely
const legacy = JSON.parse(Buffer.from(realHash.split('=')[1], 'base64url').toString());
delete legacy.insights.metrics.facet_signals;
const legacyHash = '#vibestatsPreview=' + b64urlJson(legacy);

// ---- static server ----
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = req.url.split('?')[0].split('#')[0];
  const file = join(ROOT, path === '/' ? 'home.html' : path.slice(1));
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('nope');
  }
});
await new Promise((r) => server.listen(PORT, r));

// ---- browser ----
const { chromium } = (await import(PW_MODULE)).default ?? await import(PW_MODULE);
const browser = await chromium.launch({ executablePath: PW_CHROMIUM });

const ARCH_KEYS = ['orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder'];
const archJs = 'window.VIBESTATS_ARCHETYPES=' + JSON.stringify(Object.fromEntries(ARCH_KEYS.map((k) => [k, {
  name: 'THE ' + k.toUpperCase(), tagline: 't', glyph: '>>', color: '#6B8FFF', gradient: '#6B8FFF', borderGradient: 'linear-gradient(90deg,#6B8FFF,#a78bfa)',
}]))) + ';';

async function claimViaBrowser(hash, label) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let captured = null;
  await page.route('**/api/archetype-identity', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: archJs }));
  await page.route('**/api/stats', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"total":847,"archetypes":{}}' }));
  await page.route('**/api/identity-status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"profile_save_available":true}' }));
  await page.route('**/api/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { gh_handle: 'brightseth', avatar_url: '' } }) }));
  await page.route('**/api/event', (r) => r.fulfill({ status: 202, body: '{}' }));
  await page.route('**/api/uploads', (r) => {
    captured = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true,"profile_url":"/u/brightseth"}' });
  });
  await page.goto(`http://localhost:${PORT}/home.html${hash}`, { waitUntil: 'networkidle' });
  // runAnalysis has ~1.5s of staged animation before the claim UI exists
  await page.waitForSelector('#claim-local-preview', { timeout: 12000, state: 'attached' });
  await page.evaluate(() => document.getElementById('claim-local-preview').click());
  await page.waitForFunction(() => window.__uploadsDone !== undefined, { timeout: 5000 }).catch(() => {});
  // give the fetch a beat to fire through the route
  for (let i = 0; i < 20 && !captured; i++) await new Promise((r) => setTimeout(r, 150));
  await page.close();
  assert.ok(captured, `${label}: claim POST must be captured`);
  assert.equal(errors.length, 0, `${label}: no page errors (${errors[0] || ''})`);
  return captured;
}

// ---- case 1: real data ----
const body = await claimViaBrowser(realHash, 'real');
assert.ok(body.metrics?.facet_signals, 'CRITERION 3: claim POST body carries metrics.facet_signals');
console.log('C2+C3 PASS — browser decoded hash and claim POST carries facet_signals:',
  Object.keys(body.metrics.facet_signals).join(','));

const stored = sanitizeUploadPayload(body, { source: 'browser' });
assert.ok(stored.metrics.facet_signals, 'CRITERION 4: server boundary keeps sanitized facet_signals');
const visitor = publicUpload({ ...stored, uploaded_at: new Date() }, { show_raw_counts: false }, { isOwner: false });
assert.equal(visitor.facet_signals?.mode, 'percent', 'CRITERION 4: visitor view is percent-mode');
assert.ok(!('sessions_analyzed' in visitor.facet_signals), 'CRITERION 4: no session totals for visitors');
console.log('C4 PASS — server-sanitized + visitor percent-mode');

// ---- case 2: tampered ----
const tamperedBody = await claimViaBrowser(tamperedHash, 'tampered');
const tamperedStored = sanitizeUploadPayload(tamperedBody, { source: 'browser' });
const flat = JSON.stringify(tamperedStored);
assert.ok(!flat.includes('secret_leak'), 'CRITERION 5: secret_leak never stored');
assert.ok(!flat.includes('evil_injected'), 'CRITERION 5: junk enum key never stored');
assert.ok(!flat.includes('ClientName'), 'CRITERION 5: free text never stored');
console.log('C5 PASS — injected secret_leak/junk/free-text dropped at the boundary');

// ---- case 3: legacy (no facet_signals) ----
const legacyBody = await claimViaBrowser(legacyHash, 'legacy');
assert.ok(!legacyBody.metrics?.facet_signals, 'legacy preview must not invent facet_signals');
const legacyStored = sanitizeUploadPayload(legacyBody, { source: 'browser' });
assert.ok(legacyStored.archetype, 'CRITERION 6: legacy preview still saves cleanly');
console.log('C6 PASS — legacy preview (no facet_signals) round-trips without error');

await browser.close();
server.close();
console.log('verify-g2a-roundtrip: ALL PASS');
