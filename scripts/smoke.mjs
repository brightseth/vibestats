import { readFile } from 'node:fs/promises';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret';

const htmlFiles = ['index.html', 'u.html', 'settings.html', 'compare.html'];
const apiModules = [
  '../api/profile.js',
  '../api/auth/github/start.js',
  '../api/auth/github/callback.js',
  '../api/auth/logout.js',
  '../api/me.js',
  '../api/uploads.js',
  '../api/u/[handle].js',
  '../api/settings.js',
  '../api/settings/export.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/signatures.js',
  '../api/stats.js',
  '../api/card.js',
  '../api/badge.js',
  '../api/og.js',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertHtmlScriptsParse() {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)) {
      new Function(match[1]);
    }
  }
  console.log(`ok html scripts parse (${htmlFiles.length})`);
}

async function assertApiImports() {
  await Promise.all(apiModules.map((modulePath) => import(modulePath)));
  console.log(`ok api imports (${apiModules.length})`);
}

async function assertUploadSanitizer() {
  const { sanitizeUploadPayload } = await import('../api/_lib/uploads.js');
  const payload = sanitizeUploadPayload({
    archetype: 'builder',
    scores: {
      builder: 200,
      orchestrator: -10,
      _percentiles: { builder: 3 },
      rawJson: { should: 'drop' },
    },
    metrics: {
      commitsPerDay: 2,
      sessions: 12,
      languages: 4,
      msgsPerSession: 7,
      days: 9,
      raw: { should: 'drop' },
    },
    raw_meta: {
      dateRange: '2026-01-01 to 2026-01-09',
      source: 'browser',
      signature: 'high-velocity Builder',
      signatureCombo: 'shipper+builder',
      signatureFingerprint: 'builder+shipper+orchestrator:90s',
      secondaryArchetype: 'shipper',
      rawJson: { should: 'drop' },
    },
  });

  assert(payload.scores.builder === 100, 'scores should clamp to 100');
  assert(payload.scores.orchestrator === 0, 'scores should clamp to 0');
  assert(payload.metrics.languages === 4, 'derived languages metric should persist');
  assert(!('raw' in payload.metrics), 'raw metric payload must be dropped');
  assert(payload.raw_meta.signature === 'high-velocity Builder', 'signature metadata should persist');
  assert(payload.raw_meta.signatureFingerprint === 'builder+shipper+orchestrator:90s', 'signature fingerprint should persist');
  assert(payload.raw_meta.secondaryArchetype === 'shipper', 'secondary archetype metadata should persist');
  assert(!('rawJson' in payload.raw_meta), 'raw_meta allowlist must drop unknown fields');
  console.log('ok upload sanitizer preserves privacy boundary');
}

async function assertSessionRoundTrip() {
  const { createSessionToken, verifySessionToken } = await import('../api/_lib/auth.js');
  const token = createSessionToken({
    id: '11111111-1111-1111-1111-111111111111',
    gh_id: 123,
    gh_handle: 'brightseth',
    avatar_url: null,
  });
  const session = verifySessionToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'session sub should round-trip');
  assert(session?.gh_handle === 'brightseth', 'session handle should round-trip');
  console.log('ok signed session round-trip');
}

async function assertSameOriginGuard() {
  const { requireSameOrigin } = await import('../api/_lib/http.js');
  const sameOriginReq = {
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  };
  const missingOriginReq = {
    headers: {
      host: 'localhost:3000',
    },
  };
  const crossOriginReq = {
    headers: {
      host: 'localhost:3000',
      origin: 'https://attacker.example',
    },
  };

  requireSameOrigin(sameOriginReq);
  requireSameOrigin(missingOriginReq);

  let blocked = false;
  try {
    requireSameOrigin(crossOriginReq);
  } catch (err) {
    blocked = err.statusCode === 403;
  }
  assert(blocked, 'cross-origin browser mutations should be blocked');
  console.log('ok same-origin mutation guard');
}

async function assertProfileSettingsHelpers() {
  const { cleanDigestEmail, publicProfileSettings } = await import('../api/_lib/profile-settings.js');
  assert(cleanDigestEmail('  SETH@EXAMPLE.COM ') === 'seth@example.com', 'digest email should normalize');
  assert(cleanDigestEmail('') === null, 'empty digest email should clear');
  let rejected = false;
  try {
    cleanDigestEmail('not-an-email');
  } catch (err) {
    rejected = err.statusCode === 400;
  }
  assert(rejected, 'invalid digest email should be rejected');
  assert(publicProfileSettings({ weekly_digest_opt_in: true }).weekly_digest_opt_in === true, 'digest opt-in should serialize');
  console.log('ok profile settings helpers');
}

async function assertSignatureHelpers() {
  const { rarityTier, signatureFingerprint, signatureFromUpload } = await import('../api/_lib/signatures.js');
  const upload = {
    archetype: 'builder',
    scores: { builder: 92, shipper: 82, orchestrator: 61, architect: 20 },
    raw_meta: {},
  };
  const signature = signatureFromUpload(upload);
  assert(signature.label === 'high-velocity Builder', 'signature helper should infer label');
  assert(signature.fingerprint === 'builder+shipper+orchestrator:90s', 'signature helper should fingerprint top scores');
  assert(signatureFingerprint(upload.scores, 'builder') === signature.fingerprint, 'fingerprint helper should match upload helper');
  assert(rarityTier(8) === 'rare' && rarityTier(40) === 'uncommon' && rarityTier(90) === 'common', 'rarity tiers should classify counts');
  console.log('ok signature rarity helpers');
}

async function assertProfileFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/profile.js');
    let statusCode = 0;
    let contentType = '';
    let body = '';
    const req = {
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      send(value) {
        body = String(value);
      },
    };

    await handler(req, res);
    assert(statusCode === 200, 'profile fallback should render HTTP 200 when DB is absent');
    assert(contentType.includes('text/html'), 'profile fallback should return HTML');
    assert(body.includes('@brightseth on vibestats'), 'profile fallback should include handle metadata');
    assert(body.includes('og:image'), 'profile fallback should include share metadata');
    console.log('ok profile fallback renders shareable shell without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertBadgeFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/badge.js');
    let statusCode = 0;
    let contentType = '';
    let body = '';
    const req = {
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      send(value) {
        body = String(value);
      },
    };

    await handler(req, res);
    assert(statusCode === 200, 'badge fallback should render HTTP 200 when DB is absent');
    assert(contentType.includes('image/svg+xml'), 'badge fallback should return SVG');
    assert(body.includes('@brightseth'), 'badge fallback should include handle');
    console.log('ok badge fallback renders portable SVG without DB');
  } finally {
    console.error = originalError;
  }
}

await assertHtmlScriptsParse();
await assertApiImports();
await assertUploadSanitizer();
await assertSessionRoundTrip();
await assertSameOriginGuard();
await assertProfileSettingsHelpers();
await assertSignatureHelpers();
await assertProfileFallback();
await assertBadgeFallback();

console.log('smoke checks passed');
