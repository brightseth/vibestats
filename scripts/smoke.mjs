import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret';

const htmlFiles = ['index.html', 'u.html', 'settings.html', 'compare.html', 'leaderboard.html', 'match.html', 'browse.html'];
const apiModules = [
  '../api/profile.js',
  '../api/auth/github/start.js',
  '../api/auth/github/callback.js',
  '../api/auth/logout.js',
  '../api/me.js',
  '../api/uploads.js',
  '../api/sync.js',
  '../api/sync-token.js',
  '../api/u/[handle].js',
  '../api/settings.js',
  '../api/settings/export.js',
  '../api/cron/weekly-digest.js',
  '../api/_lib/evolution.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/public-profile.js',
  '../api/_lib/signatures.js',
  '../api/_lib/matchmaking.js',
  '../api/_lib/leaderboard-rank.js',
  '../api/_lib/digest.js',
  '../api/leaderboard.js',
  '../api/match.js',
  '../api/browse.js',
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
  const browseApi = await readFile('api/browse.js', 'utf8');
  const browseHtml = await readFile('browse.html', 'utf8');
  const matchApi = await readFile('api/match.js', 'utf8');
  const profileApi = await readFile('api/u/[handle].js', 'utf8');
  const profileHtmlApi = await readFile('api/profile.js', 'utf8');
  const embedApi = await readFile('api/embed.js', 'utf8');
  const badgeApi = await readFile('api/badge.js', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  const settingsHtml = await readFile('settings.html', 'utf8');
  const syncApi = await readFile('api/sync.js', 'utf8');
  const statsApi = await readFile('api/stats.js', 'utf8');
  const identityDoctor = await readFile('scripts/identity-doctor.mjs', 'utf8');
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
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
  assert(
    rewrites.some((rewrite) => rewrite.source === '/match' && rewrite.destination === '/match.html'),
    'match route should rewrite to match page',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/browse' && rewrite.destination === '/browse.html'),
    'browse route should rewrite to browse page',
  );
  const globalHeaders = (config.headers || []).find((entry) => entry.source === '/(.*)')?.headers || [];
  const headerKeys = new Set(globalHeaders.map((header) => header.key.toLowerCase()));
  const csp = globalHeaders.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value || '';
  assert(!headerKeys.has('x-frame-options'), 'global X-Frame-Options must stay off so the embed function can be frameable');
  assert(csp.includes("frame-ancestors 'none'"), 'global CSP should keep non-embed pages unframeable');
  assert(leaderboardApi.includes("date_trunc('week', now())"), 'leaderboard API should reset weekly');
  assert(leaderboardApi.includes('limit 25'), 'leaderboard API should cap weekly boards at top 25');
  assert(!leaderboardApi.includes('languages:'), 'leaderboard API should not expose public language counts');
  assert(!matchApi.includes('languages:'), 'match API should not expose public language counts');
  assert(matchApi.includes('seeker_archetype'), 'match API should preserve visitor archetype for goal-aware scoring');
  assert(matchApi.includes('goalFit({'), 'match API should use shared goal fit scoring');
  assert(browseApi.includes("u.privacy = 'public'"), 'browse API should include opt-in public profiles only');
  assert(!browseApi.includes('languages:'), 'browse API should not expose public language counts');
  assert(browseHtml.includes('raw insights JSON and language details stay out'), 'browse UI should state public browse privacy boundary');
  assert((await readFile('match.html', 'utf8')).includes('renderChips(\'archetypes\''), 'match UI should let visitors rank matches by their archetype');
  assert(profileApi.includes('weeklyLeaderboardRank'), 'profile API should include public weekly rank');
  assert(profileApi.includes('profileEvolution'), 'profile API should include derived evolution badge');
  assert(profileHtmlApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile HTML OG metadata must use visitor-safe metric visibility');
  assert(profileHtmlApi.includes("'private, no-store'"), 'private owner profile HTML must not be publicly cacheable');
  assert(embedApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile embed must use visitor-safe metric visibility');
  assert(embedApi.includes('publicUpload(latest, visibility, { isOwner: false })'), 'profile embed must not serialize owner-only upload fields');
  assert(embedApi.includes('compareTo=${encodeURIComponent(user.gh_handle)}'), 'profile embed should click through to upload-to-compare when an archetype exists');
  assert(embedApi.includes('Compare with @${user.gh_handle}'), 'profile embed should expose a comparison-oriented accessible action');
  assert(embedApi.includes("'private, no-store'"), 'private owner profile embed must not be publicly cacheable');
  assert(badgeApi.includes("'private, no-store'"), 'private owner profile badge must not be publicly cacheable');
  assert(syncApi.includes('requireSyncUser'), 'sync API should require signed CLI sync tokens');
  assert(!syncApi.includes('requireSameOrigin'), 'sync API should not require browser same-origin cookies');
  assert(statsApi.includes('readJson(req, { maxBytes: 16 * 1024 })'), 'community stats API should bound JSON parsing before accepting aggregate metrics');
  assert(
    statsApi.indexOf('readJson(req, { maxBytes: 16 * 1024 })') < statsApi.indexOf('const ip ='),
    'community stats API should parse and validate JSON before mutating rate-limit state',
  );
  assert(settingsHtml.includes('npx vibestats sync'), 'settings UI should expose CLI sync command generation');
  assert(packageJson.bin?.vibestats === './bin/vibestats.js', 'package should expose vibestats CLI bin');
  assert(identityDoctor.includes('POSTGRES_URL') && identityDoctor.includes('NEON_DATABASE_URL'), 'identity doctor should accept DB env aliases used by runtime');
  assert(identityDoctor.includes('AUTH_SECRET') && identityDoctor.includes('NEXTAUTH_SECRET'), 'identity doctor should accept session secret aliases used by runtime');
  assert(identityDoctor.includes('UPSTASH_REDIS_REST_URL') && identityDoctor.includes('UPSTASH_REDIS_REST_TOKEN'), 'identity doctor should report Redis env aliases');
  assert(identityDoctor.includes('CRON_SECRET') && identityDoctor.includes('RESEND_API_KEY') && identityDoctor.includes('DIGEST_FROM_EMAIL'), 'identity doctor should report weekly digest env readiness');
  assert((await readFile('match.html', 'utf8')).includes('&b=${encodeURIComponent(handle)}'), 'match compare links should preserve candidate profile identity');
  assert(profileHtml.includes('leaderboardText(profile.leaderboard)'), 'profile UI should render public weekly rank');
  assert(profileHtml.includes('evolution-pill'), 'profile UI should render evolution badge');
  assert(profileHtml.includes('/browse?archetype=${encodeURIComponent(hostArchetype)}'), 'profile UI should link to filtered directory');
  assert((config.crons || []).some((cron) => cron.path === '/api/cron/weekly-digest'), 'weekly digest cron should be scheduled');
  console.log('ok route rewrites');
}

async function assertProfileShareLoop() {
  const indexHtml = await readFile('index.html', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  assert(profileHtml.includes('compareTo=${encodeURIComponent(handle)}'), 'profile compare CTA should seed upload-to-compare');
  assert(profileHtml.includes('profileInviteText(handle, latest, profileUrl)'), 'profile copy action should use asymmetric invite text');
  assert(profileHtml.includes('https://twitter.com/intent/tweet?text='), 'profile UI should include X share intent');
  assert(profileHtml.includes('Copy invite'), 'profile share button should invite comparison');
  assert(indexHtml.includes("const PENDING_UPLOAD_KEY = 'vibestats_pending_upload'"), 'upload page should persist pending derived saves across auth');
  assert(indexHtml.includes('Only derived profile data is persisted here. Raw insights JSON is never stored.'), 'pending auth save must document derived-only storage');
  assert(indexHtml.includes('resumePendingProfileSave'), 'upload page should resume pending profile save after auth');
  assert(indexHtml.includes('/pair/${encodeURIComponent'), 'upload-to-compare should route to handle-backed pairing');
  assert(indexHtml.includes('digest-email-inline'), 'post-save profile flow should offer weekly digest opt-in');
  assert(indexHtml.includes('weekly_digest_opt_in: true'), 'inline digest opt-in should use settings API');
  assert(indexHtml.includes('<a class="auth-pill" href="/browse">Browse</a>'), 'upload page should expose public browse loop');
  assert(indexHtml.includes("See how you'd pair with this archetype:"), 'ephemeral share copy should drive card recipients into comparison');
  assert(indexHtml.includes('Compare with this archetype:'), 'ephemeral share variants should avoid passive homepage discovery copy');
  assert(!indexHtml.includes("What's YOUR personality?\\n${cardShareUrl}"), 'ephemeral share copy should not use old generic personality prompt');
  assert(!indexHtml.includes("What's yours?\\n${cardShareUrl}"), 'ephemeral share copy should not use old generic short prompt');
  console.log('ok profile share loop returns visitors to comparison');
}

async function assertCompareShareLoop() {
  const compareHtml = await readFile('compare.html', 'utf8');
  assert(compareHtml.includes('comparisonClaimAction(aSubject, bSubject)'), 'compare result should compute a profile-backed claim CTA');
  assert(compareHtml.includes('compareTo=${encodeURIComponent(profileSubject.handle)}'), 'compare result CTA should seed upload-to-profile comparison');
  assert(compareHtml.includes("See how you'd pair with @${profileSubject.handle}:"), 'profile-backed compare shares should use asymmetric invite copy');
  assert(compareHtml.includes('${esc(claimAction.label)} &rarr;'), 'compare result should render the computed claim CTA label');
  console.log('ok compare share loop claims profile-backed comparisons');
}

async function assertShareCardCta() {
  const { default: handler } = await import('../api/card.js');
  let statusCode = 0;
  let body = '';
  const req = {
    query: {
      a: 'deepdiver',
      n: 'Alex',
      d: '30',
      c: '8',
      l: '4',
      s: '120',
    },
  };
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    send(value) {
      body = String(value);
    },
  };

  handler(req, res);
  assert(statusCode === 200, 'share card should render HTTP 200');
  assert(body.includes('href="/compare?me=deepdiver"'), 'share card CTA should send visitors into archetype comparison');
  assert(body.includes('Compare with this archetype'), 'share card CTA should invite comparison instead of homepage upload');
  assert(!body.includes("What's YOUR personality?"), 'share card should not use the old generic homepage CTA');
  assert(body.includes('archetype=deepdiver'), 'share card /vibe CTA should use the sanitized archetype key');
  console.log('ok legacy share card routes visitors into comparison');
}

async function assertWrappedShareLoop() {
  const wrappedHtml = await readFile('wrapped.html', 'utf8');
  assert(wrappedHtml.includes('/compare?me=orchestrator'), 'wrapped CTA should route to archetype comparison');
  assert(wrappedHtml.includes("See how you'd pair with an Orchestrator"), 'wrapped share page should use comparison copy');
  assert(!wrappedHtml.includes("What's YOUR vibecoding personality?<br>"), 'wrapped page should not end on the old generic CTA');
  console.log('ok wrapped share page routes visitors into comparison');
}

async function assertMatchmakingHelpers() {
  const { cleanSeekerArchetype, goalFit } = await import('../api/_lib/matchmaking.js');
  assert(cleanSeekerArchetype('builder') === 'builder', 'match seeker archetype should normalize valid archetypes');
  assert(cleanSeekerArchetype('any') === null, 'match seeker archetype should allow unselected style');
  let rejected = false;
  try {
    cleanSeekerArchetype('growth-hacker');
  } catch (err) {
    rejected = err.statusCode === 400;
  }
  assert(rejected, 'invalid match seeker archetype should be rejected');
  const strong = goalFit({
    goal: 'pair-coding',
    lookingFor: 'pair-coding',
    candidateArchetype: 'shipper',
    seekerArchetype: 'builder',
    signal: 93,
  });
  const loose = goalFit({
    goal: 'pair-coding',
    lookingFor: 'mentor',
    candidateArchetype: 'deepdiver',
    seekerArchetype: 'sprinter',
    signal: 60,
  });
  assert(strong.score > loose.score, 'goal fit should reward matching intent and complementary archetypes');
  assert(strong.reason.includes('Builder + Shipper'), 'goal fit reason should name the visitor/candidate pairing');
  console.log('ok goal-driven matchmaking helpers');
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

async function assertCliDerivedPayload() {
  const { derivedUploadPayloadFromInsights } = await import('../lib/insights-derived.js');
  const payload = derivedUploadPayloadFromInsights({
    meta: { user: 'Alex Chen', date_range: '2025-12-01 to 2026-01-15' },
    metrics: {
      total_sessions: 280,
      total_messages: 3360,
      commits: 980,
      satisfaction_rate: 0.85,
      multi_clauding_rate: 0.03,
      buggy_code_events: 8,
      tool_usage: { bash: 6000, read: 4000, edit: 5500, write: 4200, grep: 300 },
      language_usage: { typescript: 45000, javascript: 8000, css: 2000 },
    },
  });
  assert(payload.archetype === 'shipper', 'CLI derived scoring should match browser shipper fixture');
  assert(payload.metrics.sessions === 280, 'CLI derived payload should include derived session count');
  assert(payload.raw_meta.source === 'cli', 'CLI derived payload should mark source as cli');
  assert(payload.raw_meta.signatureFingerprint, 'CLI derived payload should include rarity fingerprint');
  assert(!JSON.stringify(payload).includes('tool_usage'), 'CLI derived payload must not include raw tool usage');
  console.log('ok CLI sync derives browser-compatible private payload');
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

async function assertSyncTokenRoundTrip() {
  const { createSyncToken, verifySyncToken } = await import('../api/_lib/auth.js');
  const token = createSyncToken({
    id: '11111111-1111-1111-1111-111111111111',
    gh_handle: 'brightseth',
  });
  const session = verifySyncToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'sync token sub should round-trip');
  assert(session?.scope === 'sync', 'sync token should carry sync scope');
  assert(session?.typ === 'vibestats_sync', 'sync token should carry sync token type');
  console.log('ok signed CLI sync token round-trip');
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
  const { cleanContactUrl, cleanDigestEmail, cleanLookingFor, publicMatchSettings, publicProfileSettings } = await import('../api/_lib/profile-settings.js');
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
  assert(publicProfileSettings({ show_raw_counts: true, show_languages: true }).show_languages === true, 'metric visibility should serialize');
  assert(cleanLookingFor('pair-coding') === 'pair-coding', 'looking_for should accept valid values');
  assert(cleanContactUrl('https://x.com/brightseth') === 'https://x.com/brightseth', 'contact URL should normalize valid URL');
  let badLookingForRejected = false;
  try {
    cleanLookingFor('swiping');
  } catch (err) {
    badLookingForRejected = err.statusCode === 400;
  }
  assert(badLookingForRejected, 'invalid looking_for should be rejected');
  assert(publicMatchSettings({
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() + 10000).toISOString(),
    contact_url: 'https://x.com/brightseth',
  }).looking_for === 'pair-coding', 'active match settings should serialize');
  assert(publicMatchSettings({
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() - 10000).toISOString(),
    contact_url: 'https://x.com/brightseth',
  }).looking_for === 'idle', 'expired match settings should not serialize as active');
  console.log('ok profile settings helpers');
}

async function assertPublicProfileHelpers() {
  const { metricVisibility, publicUpload } = await import('../api/_lib/public-profile.js');
  const upload = {
    id: 'upload-1',
    archetype: 'builder',
    scores: { builder: 92, shipper: 80 },
    metrics: { days: 31, commitsPerDay: 12.4, sessions: 88, languages: 6, msgsPerSession: 9 },
    raw_meta: {
      signature: 'high-velocity Builder',
      signatureCombo: 'shipper+builder',
      signatureFingerprint: 'builder+shipper+orchestrator:90s',
      secondaryArchetype: 'shipper',
      dateRange: 'private range',
    },
    uploaded_at: '2026-05-28T10:00:00.000Z',
  };
  const privateView = publicUpload(upload, metricVisibility({}), { isOwner: false });
  assert(!privateView.id, 'visitor upload payload should not expose upload id');
  assert(Object.keys(privateView.metrics).length === 0, 'visitor upload payload should hide exact metrics by default');
  assert(privateView.activity.cadence === 'high-velocity cadence', 'visitor upload payload should include coarse activity');
  assert(privateView.raw_meta.signature === 'high-velocity Builder', 'visitor upload payload should keep signature metadata');
  assert(!('dateRange' in privateView.raw_meta), 'visitor upload payload should omit raw date metadata');
  const countsView = publicUpload(upload, metricVisibility({ show_raw_counts: true, show_languages: true }), { isOwner: false });
  assert(countsView.metrics.days === 31, 'opt-in public view should expose raw counts');
  assert(countsView.metrics.languages === 6, 'opt-in public view should expose language count');
  const ownerView = publicUpload(upload, metricVisibility({}, { isOwner: true }), { isOwner: true });
  assert(ownerView.id === 'upload-1', 'owner upload payload should retain upload id');
  assert(ownerView.raw_meta.dateRange === 'private range', 'owner upload payload should retain full derived metadata');
  console.log('ok public profile helpers hide visitor metrics by default');
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

async function assertEvolutionHelpers() {
  const { profileEvolution } = await import('../api/_lib/evolution.js');
  const uploads = [
    {
      archetype: 'builder',
      scores: { builder: 92, shipper: 82, orchestrator: 61 },
      raw_meta: { rawJson: { should: 'not leak' } },
      uploaded_at: '2026-05-28T10:00:00.000Z',
    },
    {
      archetype: 'builder',
      scores: { builder: 88, shipper: 86, debugger: 60 },
      raw_meta: { rawJson: { should: 'not leak' } },
      uploaded_at: '2026-05-23T10:00:00.000Z',
    },
  ];
  const evolution = profileEvolution(uploads);
  assert(evolution.label === '+4 Builder points', 'evolution helper should surface primary score movement');
  assert(evolution.detail === 'vs last upload', 'evolution helper should describe score delta');
  assert(!JSON.stringify(evolution).includes('rawJson'), 'evolution helper must not leak raw metadata');
  const shifted = profileEvolution([
    { archetype: 'orchestrator', scores: { orchestrator: 91, builder: 75 }, uploaded_at: '2026-05-28T10:00:00.000Z' },
    { archetype: 'builder', scores: { builder: 89, orchestrator: 72 }, uploaded_at: '2026-05-21T10:00:00.000Z' },
  ]);
  assert(shifted.label === 'Builder -> Orchestrator shift', 'evolution helper should surface archetype shifts');
  console.log('ok profile evolution helpers');
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

async function assertMatchFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/match.js');
    let statusCode = 0;
    let body = '';
    const req = {
      method: 'GET',
      query: { goal: 'mentor' },
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
    };

    await handler(req, res);
    const parsed = JSON.parse(body);
    assert(statusCode === 200, 'match fallback should render HTTP 200 when DB is absent');
    assert(parsed.goal === 'mentor', 'match fallback should preserve goal');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'match fallback should return empty entries');
    assert(parsed.unavailable === true, 'match fallback should mark DB unavailable');
    console.log('ok match fallback keeps match page usable without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertBrowseFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/browse.js');
    let statusCode = 0;
    let body = '';
    const req = {
      method: 'GET',
      query: { archetype: 'builder', intent: 'active' },
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
    };

    await handler(req, res);
    const parsed = JSON.parse(body);
    assert(statusCode === 200, 'browse fallback should render HTTP 200 when DB is absent');
    assert(parsed.filters.archetype === 'builder', 'browse fallback should preserve archetype filter');
    assert(parsed.filters.intent === 'active', 'browse fallback should preserve intent filter');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'browse fallback should return empty entries');
    assert(parsed.unavailable === true, 'browse fallback should mark DB unavailable');
    console.log('ok browse fallback keeps public directory shell usable without DB');
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
await assertProfileShareLoop();
await assertCompareShareLoop();
await assertShareCardCta();
await assertWrappedShareLoop();
await assertMatchmakingHelpers();
await assertUploadSanitizer();
await assertCliDerivedPayload();
await assertSessionRoundTrip();
await assertSyncTokenRoundTrip();
await assertSameOriginGuard();
await assertReadJsonLimit();
await assertProfileSettingsHelpers();
await assertPublicProfileHelpers();
await assertSignatureHelpers();
await assertEvolutionHelpers();
await assertDigestHelpers();
await assertProfileFallback();
await assertBadgeFallback();
await assertEmbedFallback();
await assertLeaderboardFallback();
await assertMatchFallback();
await assertBrowseFallback();
await assertDigestCronAuth();

console.log('smoke checks passed');
