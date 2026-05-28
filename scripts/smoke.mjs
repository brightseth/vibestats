import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret';

const htmlFiles = ['index.html', 'u.html', 'settings.html', 'compare.html', 'leaderboard.html'];
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
  '../api/cron/weekly-digest.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/signatures.js',
  '../api/_lib/digest.js',
  '../api/leaderboard.js',
  '../api/stats.js',
  '../api/card.js',
  '../api/badge.js',
  '../api/embed.js',
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

async function assertCompatBrowserModule() {
  const window = {};
  const compatSource = await readFile('lib/compat.js', 'utf8');
  const compat = new Function('window', `${compatSource}\nreturn window.VibeCompat;`)(window);
  assert(compat.getPairing('builder', 'shipper').name === 'Feature Factory', 'compat module should expose pair names');
  assert(compat.getPairing('shipper', 'builder').name === 'Feature Factory', 'compat module should normalize pair keys');
  assert(compat.profileCompatibility('builder', 'shipper', 'brightseth').score >= 90, 'profile compatibility should expose a strong score');
  console.log('ok shared compatibility browser module');
}

async function assertApiImports() {
  await Promise.all(apiModules.map((modulePath) => import(modulePath)));
  console.log(`ok api imports (${apiModules.length})`);
}

async function assertRoutes() {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const leaderboardApi = await readFile('api/leaderboard.js', 'utf8');
  const rewrites = config.rewrites || [];
  assert(
    rewrites.some((rewrite) => rewrite.source === '/u/:handle/pair/:other' && rewrite.destination === '/compare?a=:other&b=:handle'),
    'person-backed pair route should rewrite to compare',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/u/:handle/embed' && rewrite.destination === '/api/embed?handle=:handle'),
    'profile embed route should rewrite to embed API',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/leaderboard/:archetype' && rewrite.destination === '/leaderboard.html?archetype=:archetype'),
    'archetype leaderboard route should rewrite to leaderboard page',
  );
  const globalHeaders = (config.headers || []).find((entry) => entry.source === '/(.*)')?.headers || [];
  const headerKeys = new Set(globalHeaders.map((header) => header.key.toLowerCase()));
  const csp = globalHeaders.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value || '';
  assert(!headerKeys.has('x-frame-options'), 'global X-Frame-Options must stay off so the embed function can be frameable');
  assert(csp.includes("frame-ancestors 'none'"), 'global CSP should keep non-embed pages unframeable');
  assert(leaderboardApi.includes("date_trunc('week', now())"), 'leaderboard API should reset weekly');
  assert(leaderboardApi.includes('limit 25'), 'leaderboard API should cap weekly boards at top 25');
  assert((config.crons || []).some((cron) => cron.path === '/api/cron/weekly-digest'), 'weekly digest cron should be scheduled');
  console.log('ok route rewrites');
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

async function assertReadJsonLimit() {
  const { readJson } = await import('../api/_lib/http.js');
  const parsed = await readJson(Readable.from(['{"ok":true}']), { maxBytes: 32 });
  assert(parsed.ok === true, 'readJson should parse small JSON streams');

  let rejected = false;
  try {
    await readJson(Readable.from(['{"blob":"', 'x'.repeat(40), '"}']), { maxBytes: 32 });
  } catch (err) {
    rejected = err.statusCode === 413;
  }
  assert(rejected, 'readJson should reject oversized JSON streams');
  console.log('ok JSON body size guard');
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

async function assertDigestHelpers() {
  const { buildWeeklyDigest, uploadStreak } = await import('../api/_lib/digest.js');
  const uploads = [
    {
      archetype: 'builder',
      scores: { builder: 92, shipper: 82, orchestrator: 61, _percentiles: { builder: 4 } },
      metrics: { days: 31, commitsPerDay: 12.4, sessions: 88, languages: 6 },
      raw_meta: {
        signature: 'high-velocity Builder',
        signatureCombo: 'shipper+builder',
        signatureFingerprint: 'builder+shipper+orchestrator:90s',
        secondaryArchetype: 'shipper',
        rawJson: { should: 'not leak' },
      },
      uploaded_at: '2026-05-28T10:00:00.000Z',
    },
    {
      archetype: 'builder',
      scores: { builder: 88, shipper: 78 },
      metrics: { days: 24, commitsPerDay: 9.1, sessions: 61, languages: 5 },
      raw_meta: {},
      uploaded_at: '2026-05-23T10:00:00.000Z',
    },
  ];
  const digest = buildWeeklyDigest({
    user: { gh_handle: 'brightseth' },
    uploads,
    rarity: { count: 8, tier: 'rare' },
    leaderboard: { rank: 4, total: 25, label: 'builder' },
    origin: 'https://vibestats.io',
    now: new Date('2026-05-28T12:00:00.000Z'),
  });

  assert(uploadStreak(uploads) === 2, 'digest streak helper should count uploads within 7 days');
  assert(digest.subject.includes('week'), 'digest subject should include week label');
  assert(digest.text.includes('+4 points vs last upload'), 'digest text should include score movement');
  assert(digest.text.includes('#4 on the weekly Builder board'), 'digest text should include leaderboard position');
  assert(digest.html.includes('/api/og?'), 'digest HTML should include the profile card image');
  assert(!digest.html.includes('rawJson') && !digest.text.includes('rawJson'), 'digest must not leak raw metadata');
  console.log('ok weekly digest helpers render derived-only email');
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

async function assertEmbedFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/embed.js');
    let statusCode = 0;
    let contentType = '';
    let csp = '';
    let body = '';
    const req = {
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'content-security-policy') csp = value;
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
    assert(statusCode === 200, 'embed fallback should render HTTP 200 when DB is absent');
    assert(contentType.includes('text/html'), 'embed fallback should return HTML');
    assert(csp.includes('frame-ancestors https:'), 'embed CSP should allow HTTPS framing');
    assert(body.includes('@brightseth'), 'embed fallback should include handle');
    assert(body.includes('VIBESTATS PROFILE'), 'embed fallback should render a neutral profile card');
    console.log('ok embed fallback renders frameable profile card without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertLeaderboardFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/leaderboard.js');
    let statusCode = 0;
    let body = '';
    const req = {
      method: 'GET',
      query: { archetype: 'builder' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = JSON.stringify(value);
      },
      send(value) {
        body = String(value);
      },
    };

    await handler(req, res);
    const parsed = JSON.parse(body);
    assert(statusCode === 200, 'leaderboard fallback should render HTTP 200 when DB is absent');
    assert(parsed.archetype === 'builder', 'leaderboard fallback should preserve archetype');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'leaderboard fallback should return empty entries');
    assert(parsed.unavailable === true, 'leaderboard fallback should mark DB unavailable');
    console.log('ok leaderboard fallback keeps public board shell usable without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertDigestCronAuth() {
  const { default: handler } = await import('../api/cron/weekly-digest.js');
  const previousSecret = process.env.CRON_SECRET;
  const originalError = console.error;
  process.env.CRON_SECRET = 'smoke-cron-secret';
  console.error = () => {};
  const req = {
    method: 'GET',
    query: { dryRun: '1' },
    headers: { host: 'localhost:3000', authorization: 'Bearer wrong-secret' },
  };
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = JSON.stringify(value);
    },
  };

  try {
    await handler(req, res);
    const parsed = JSON.parse(body);
    assert(statusCode === 401, 'weekly digest cron should reject invalid bearer token');
    assert(parsed.error === 'Unauthorized', 'weekly digest cron should return unauthorized error');
    console.log('ok weekly digest cron requires bearer secret');
  } finally {
    console.error = originalError;
    if (previousSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  }
}

await assertHtmlScriptsParse();
await assertCompatBrowserModule();
await assertApiImports();
await assertRoutes();
await assertUploadSanitizer();
await assertSessionRoundTrip();
await assertSameOriginGuard();
await assertReadJsonLimit();
await assertProfileSettingsHelpers();
await assertSignatureHelpers();
await assertDigestHelpers();
await assertProfileFallback();
await assertBadgeFallback();
await assertEmbedFallback();
await assertLeaderboardFallback();
await assertDigestCronAuth();

console.log('smoke checks passed');
