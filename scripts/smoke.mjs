import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret';

const htmlFiles = ['index.html', 'u.html', 'settings.html', 'compare-template.html', 'leaderboard.html', 'match.html', 'browse.html'];
const apiModules = [
  '../api/compare-page.js',
  '../api/profile.js',
  '../api/auth/github/start.js',
  '../api/auth/github/callback.js',
  '../api/auth/logout.js',
  '../api/identity-status.js',
  '../api/me.js',
  '../api/uploads.js',
  '../api/sync.js',
  '../api/sync-token.js',
  '../api/u/[handle].js',
  '../api/settings.js',
  '../api/settings/export.js',
  '../api/cron/weekly-digest.js',
  '../api/digest/unsubscribe.js',
  '../api/_lib/cache.js',
  '../api/_lib/evolution.js',
  '../api/_lib/export-upload.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/public-profile.js',
  '../api/_lib/social-proof.js',
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

function mockRes() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    redirect(code, value) {
      this.statusCode = code;
      this.body = value;
      return this;
    },
  };
}

function assertNoStore(res, label) {
  assert(res.headers['Cache-Control'] === 'no-store', `${label} should disable response caching`);
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
  const comparePageApi = await readFile('api/compare-page.js', 'utf8');
  const ogApi = await readFile('api/og.js', 'utf8');
  const cacheHelper = await readFile('api/_lib/cache.js', 'utf8');
  const profileHtmlApi = await readFile('api/profile.js', 'utf8');
  const embedApi = await readFile('api/embed.js', 'utf8');
  const badgeApi = await readFile('api/badge.js', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  const settingsHtml = await readFile('settings.html', 'utf8');
  const settingsApi = await readFile('api/settings.js', 'utf8');
  const settingsExportApi = await readFile('api/settings/export.js', 'utf8');
  const weeklyDigestApi = await readFile('api/cron/weekly-digest.js', 'utf8');
  const digestUnsubscribeApi = await readFile('api/digest/unsubscribe.js', 'utf8');
  const syncApi = await readFile('api/sync.js', 'utf8');
  const statsApi = await readFile('api/stats.js', 'utf8');
  const identityStatusApi = await readFile('api/identity-status.js', 'utf8');
  const identityReadiness = await readFile('api/_lib/identity-readiness.js', 'utf8');
  const indexHtml = await readFile('index.html', 'utf8');
  const identityDoctor = await readFile('scripts/identity-doctor.mjs', 'utf8');
  const launchDoc = await readFile('docs/LAUNCH.md', 'utf8');
  const envExample = await readFile('.env.example', 'utf8');
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const rewrites = config.rewrites || [];
  assert(
    rewrites.some((rewrite) => rewrite.source === '/u/:handle/pair/:other' && rewrite.destination === '/api/compare-page?a=:other&b=:handle'),
    'person-backed pair route should rewrite to dynamic compare page',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/compare' && rewrite.destination === '/api/compare-page'),
    'compare route should rewrite to dynamic compare page',
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
  assert(profileApi.includes("'Cache-Control': PRIVATE_PROFILE_CACHE"), 'profile JSON private 404 should not be cacheable');
  assert(profileHtmlApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile HTML OG metadata must use visitor-safe metric visibility');
  assert(profileHtmlApi.includes('profileShareCacheControl(user)'), 'profile HTML OG metadata should use shared profile cache policy');
  assert(profileHtmlApi.includes('sendPrivateNotFound(res)'), 'profile HTML private 404 should not be cacheable');
  assert(profileHtmlApi.includes('weeklyLeaderboardRank(user, latest)'), 'profile HTML OG metadata should include public leaderboard proof');
  assert(profileHtmlApi.includes('rarityForSignature(signature)'), 'profile HTML OG metadata should include signature scarcity proof');
  assert(profileHtmlApi.includes('profileDescription({'), 'profile HTML OG metadata should centralize comparison-oriented share copy');
  assert(comparePageApi.includes('compareMetadataForSubjects'), 'compare page API should expose dynamic comparison metadata helpers');
  assert(!comparePageApi.includes('readSession'), 'compare page metadata must not personalize public cached previews by session');
  assert(comparePageApi.includes("user.privacy !== 'private'"), 'compare page metadata must not expose private profiles');
  assert(comparePageApi.includes('profileShareProof({ rarity: subject.rarity, leaderboard: subject.leaderboard })'), 'compare page metadata should include profile social proof');
  assert(comparePageApi.includes('Open the pairing, then claim yours'), 'compare page metadata should drive recipients to claim their profile');
  assert(comparePageApi.includes("res.setHeader('Cache-Control', 'private, no-store')"), 'compare page metadata should not be publicly cached');
  assert(ogApi.includes("mode === 'pair'"), 'OG API should support pair-specific share images');
  assert(ogApi.includes('CLAUDE CODE PAIRING'), 'pair OG image should frame shared comparisons as Claude Code pairings');
  assert(cacheHelper.includes("user?.privacy === 'public'"), 'profile cache helper should cache only explicit public profiles');
  assert(embedApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile embed must use visitor-safe metric visibility');
  assert(embedApi.includes('publicUpload(latest, visibility, { isOwner: false })'), 'profile embed must not serialize owner-only upload fields');
  assert(embedApi.includes('compareTo=${encodeURIComponent(user.gh_handle)}'), 'profile embed should click through to upload-to-compare when an archetype exists');
  assert(embedApi.includes('Compare with @${user.gh_handle}'), 'profile embed should expose a comparison-oriented accessible action');
  assert(embedApi.includes('profileShareCacheControl(user)'), 'profile embed should use shared profile cache policy');
  assert(badgeApi.includes('profileShareCacheControl(user)'), 'profile badge should use shared profile cache policy');
  assert(embedApi.includes('sendPrivateNotFound(res)'), 'profile embed private 404 should not be cacheable');
  assert(badgeApi.includes('sendPrivateNotFound(res)'), 'profile badge private 404 should not be cacheable');
  assert(syncApi.includes('requireSyncUser'), 'sync API should require signed CLI sync tokens');
  assert(!syncApi.includes('requireSameOrigin'), 'sync API should not require browser same-origin cookies');
  assert(statsApi.includes('readJson(req, { maxBytes: 16 * 1024 })'), 'community stats API should bound JSON parsing before accepting aggregate metrics');
  assert(
    statsApi.indexOf('readJson(req, { maxBytes: 16 * 1024 })') < statsApi.indexOf('const ip ='),
    'community stats API should parse and validate JSON before mutating rate-limit state',
  );
  assert(identityStatusApi.includes('publicIdentityReadiness'), 'identity status API should use public readiness serialization');
  assert(identityStatusApi.includes('NO_STORE_HEADERS'), 'identity status API should not be cached');
  assert(identityReadiness.includes("missing.push('database')"), 'identity readiness should report missing database readiness');
  assert(identityReadiness.includes("missing.push('github_oauth')"), 'identity readiness should report missing GitHub OAuth readiness');
  assert(identityReadiness.includes("missing.push('session_secret')"), 'identity readiness should report missing session secret readiness');
  assert(indexHtml.includes("fetch('/api/identity-status'"), 'upload page should check identity readiness before fetching session state');
  assert(indexHtml.includes('identityStatus.profile_save_available'), 'upload page should gate profile saves on identity readiness');
  assert(indexHtml.includes('Profile saves are not configured on this deployment yet. Your result stayed local.'), 'upload page should explain local-only behavior when identity is unavailable');
  assert(profileHtml.includes("fetch('/api/identity-status'"), 'profile page should check identity readiness before showing sign-in');
  assert(profileHtml.includes('Profile saves pending'), 'profile page should avoid dead-end sign-in when identity is unavailable');
  assert(settingsHtml.includes("fetch('/api/identity-status'"), 'settings page should check identity readiness before showing sign-in');
  assert(settingsHtml.includes('Profile saves are not configured on this deployment yet.'), 'settings page should explain unavailable identity instead of linking to dead-end auth');
  assert(settingsHtml.includes('id="settings-sign-in" role="button" aria-disabled="true"'), 'settings page should not render a live OAuth link before identity readiness is known');
  assert(settingsHtml.includes("signIn.removeAttribute('aria-disabled')"), 'settings page should enable sign-in only after identity readiness passes');
  assert(settingsHtml.includes('npx vibestats sync'), 'settings UI should expose CLI sync command generation');
  assert(settingsApi.includes('ownerProfileSettings'), 'authenticated settings API should use owner-only settings serializer');
  assert(settingsExportApi.includes('ownerProfileSettings'), 'settings export should use owner-only settings serializer');
  assert(settingsExportApi.includes('uploads.map(exportableUpload)'), 'settings export should sanitize stored uploads through a derived-field allowlist');
  assert(weeklyDigestApi.includes('createDigestUnsubscribeToken'), 'weekly digest should include one-click unsubscribe tokens');
  assert(digestUnsubscribeApi.includes('weekly_digest_opt_in = false'), 'digest unsubscribe should turn off weekly emails');
  assert(digestUnsubscribeApi.includes('digest_email = null'), 'digest unsubscribe should clear stored digest email');
  assert(packageJson.bin?.vibestats === './bin/vibestats.js', 'package should expose vibestats CLI bin');
  assert(identityDoctor.includes('POSTGRES_URL') && identityDoctor.includes('NEON_DATABASE_URL'), 'identity doctor should accept DB env aliases used by runtime');
  assert(identityDoctor.includes('AUTH_SECRET') && identityDoctor.includes('NEXTAUTH_SECRET'), 'identity doctor should accept session secret aliases used by runtime');
  assert(identityDoctor.includes('UPSTASH_REDIS_REST_URL') && identityDoctor.includes('UPSTASH_REDIS_REST_TOKEN'), 'identity doctor should report Redis env aliases');
  assert(identityDoctor.includes('CRON_SECRET') && identityDoctor.includes('RESEND_API_KEY') && identityDoctor.includes('DIGEST_FROM_EMAIL'), 'identity doctor should report weekly digest env readiness');
  assert(!identityDoctor.includes("{ label: 'app origin', any: ['VIBESTATS_URL'] }"), 'identity doctor should not hard-require VIBESTATS_URL when runtime can infer host origin');
  assert(envExample.includes('POSTGRES_URL=') && envExample.includes('AUTH_SECRET='), '.env.example should document runtime env aliases');
  assert(launchDoc.includes('vercel env ls') && launchDoc.includes('npm run migrate'), 'launch checklist should cover Vercel env and migration gates');
  assert(launchDoc.includes('"commandForIgnoringBuildStep": null'), 'launch checklist should require Vercel ignored-build setting to be disabled');
  assert(launchDoc.includes('vercel ls vibestats --scope lets-vibe'), 'launch checklist should require checking canonical Vercel preview status');
  assert(launchDoc.includes('vercel curl /api/identity-status --deployment <preview-url> --scope lets-vibe'), 'launch checklist should document protected-preview runtime proof');
  assert(launchDoc.includes('Identity is not production-ready until the database, GitHub OAuth, and session secret variables are added.'), 'launch checklist should record current production env blocker');
  assert(launchDoc.includes('includes one-click unsubscribe'), 'launch checklist should require digest unsubscribe proof');
  assert((await readFile('match.html', 'utf8')).includes('&b=${encodeURIComponent(handle)}'), 'match compare links should preserve candidate profile identity');
  assert(profileHtml.includes('leaderboardText(profile.leaderboard)'), 'profile UI should render public weekly rank');
  assert(profileHtml.includes('evolution-pill'), 'profile UI should render evolution badge');
  assert(profileHtml.includes('/browse?archetype=${encodeURIComponent(hostArchetype)}'), 'profile UI should link to filtered directory');
  assert((config.crons || []).some((cron) => cron.path === '/api/cron/weekly-digest'), 'weekly digest cron should be scheduled');
  console.log('ok route rewrites');
}

async function assertIdentityReadiness() {
  const keys = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'NEON_DATABASE_URL',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'VIBE_SESSION_SECRET',
    'AUTH_SECRET',
    'NEXTAUTH_SECRET',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const { identityReadiness } = await import('../api/_lib/identity-readiness.js');
  const { default: handler } = await import('../api/identity-status.js');

  function restoreEnv() {
    for (const key of keys) {
      if (previous[key] == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }

  function callStatusEndpoint() {
    let statusCode = 0;
    let body = null;
    const headers = {};
    handler({ method: 'GET' }, {
      setHeader(key, value) {
        headers[key] = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    });
    return { statusCode, body, headers };
  }

  try {
    for (const key of keys) delete process.env[key];
    const missing = identityReadiness();
    assert(missing.available === false, 'identity readiness should be unavailable with no identity env');
    assert(missing.missing.includes('database'), 'identity readiness should report missing database');
    assert(missing.missing.includes('github_oauth'), 'identity readiness should report missing GitHub OAuth');
    assert(missing.missing.includes('session_secret'), 'identity readiness should report missing session secret');

    let response = callStatusEndpoint();
    assert(response.statusCode === 200, 'identity status endpoint should render HTTP 200 when unavailable');
    assert(response.headers['Cache-Control'] === 'no-store', 'identity status endpoint should disable caching');
    assert(response.body.profile_save_available === false, 'identity status endpoint should report unavailable profile saves');
    assert(response.body.message === 'Profile saves are not configured on this deployment yet.', 'identity status endpoint should explain unavailable profile saves');
    assert(!JSON.stringify(response.body).includes('secret-value'), 'identity status endpoint must not leak env values');

    process.env.POSTGRES_URL = 'postgres://user:password@example.invalid/db';
    process.env.GITHUB_CLIENT_ID = 'client-id';
    process.env.GITHUB_CLIENT_SECRET = 'secret-value';
    process.env.AUTH_SECRET = 'session-secret';
    response = callStatusEndpoint();
    assert(response.body.profile_save_available === true, 'identity status endpoint should report available profile saves with required env');
    assert(response.body.message === null, 'identity status endpoint should not show unavailable copy when ready');
    console.log('ok identity readiness endpoint reports deployment state without secrets');
  } finally {
    restoreEnv();
  }
}

async function assertProfileShareLoop() {
  const indexHtml = await readFile('index.html', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  assert(profileHtml.includes('compareTo=${encodeURIComponent(handle)}'), 'profile compare CTA should seed upload-to-compare');
  assert(profileHtml.includes('profileInviteText(handle, latest, profileUrl, profile)'), 'profile copy action should use asymmetric invite text');
  assert(profileHtml.includes('https://twitter.com/intent/tweet?text='), 'profile UI should include X share intent');
  assert(profileHtml.includes('Copy invite'), 'profile share button should invite comparison');
  assert(profileHtml.includes('profileProofLine(profile)'), 'profile share copy should include scarcity or leaderboard social proof');
  assert(indexHtml.includes("const PENDING_UPLOAD_KEY = 'vibestats_pending_upload'"), 'upload page should persist pending derived saves across auth');
  assert(indexHtml.includes('Only derived profile data is persisted here. Raw insights JSON is never stored.'), 'pending auth save must document derived-only storage');
  assert(indexHtml.includes('resumePendingProfileSave'), 'upload page should resume pending profile save after auth');
  assert(indexHtml.includes('/pair/${encodeURIComponent'), 'upload-to-compare should route to handle-backed pairing');
  assert(indexHtml.includes('digest-email-inline'), 'post-save profile flow should offer weekly digest opt-in');
  assert(indexHtml.includes('weekly_digest_opt_in: true'), 'inline digest opt-in should use settings API');
  assert(indexHtml.includes('postSaveInviteText(profilePath, archetype, scores)'), 'post-save save state should copy asymmetric profile invite text');
  assert(indexHtml.includes('id="copy-saved-badge"'), 'post-save save state should expose portable badge copy');
  assert(indexHtml.includes('id="copy-saved-embed"'), 'post-save save state should expose portable embed copy');
  assert(indexHtml.includes('Create pairing link'), 'post-save save state should prompt owners to create pairing links');
  assert(indexHtml.includes('<a class="auth-pill" href="/browse">Browse</a>'), 'upload page should expose public browse loop');
  assert(indexHtml.includes("See how you'd pair with this archetype:"), 'ephemeral share copy should drive card recipients into comparison');
  assert(indexHtml.includes('Compare with this archetype:'), 'ephemeral share variants should avoid passive homepage discovery copy');
  assert(indexHtml.includes("return { kind: 'archetype', archetype }"), 'upload page should support archetype-only comparison intake');
  assert(indexHtml.includes('Compare with The ${archetypeDisplayName(intent.archetype)}'), 'archetype-only intake should frame upload as comparison');
  assert(indexHtml.includes('const compareHref = comparisonIntent()'), 'result card compare button should honor upload-to-compare intake');
  assert(indexHtml.includes('/compare?a=${encodeURIComponent(user.gh_handle)}&b=${encodeURIComponent(intent.archetype)}'), 'saved archetype-only intake should compare from the user profile identity');
  assert(!indexHtml.includes("What's YOUR personality?\\n${cardShareUrl}"), 'ephemeral share copy should not use old generic personality prompt');
  assert(!indexHtml.includes("What's yours?\\n${cardShareUrl}"), 'ephemeral share copy should not use old generic short prompt');
  console.log('ok profile share loop returns visitors to comparison');
}

async function assertCompareShareLoop() {
  const compareHtml = await readFile('compare-template.html', 'utf8');
  assert(compareHtml.includes('comparisonParamsFromLocation()'), 'compare page should parse pretty /u/host/pair/visitor links');
  assert(compareHtml.includes('comparisonClaimAction(aSubject, bSubject)'), 'compare result should compute a profile-backed claim CTA');
  assert(compareHtml.includes('compareTo=${encodeURIComponent(profileSubject.handle)}'), 'compare result CTA should seed upload-to-profile comparison');
  assert(compareHtml.includes('compareArchetype=${encodeURIComponent(archetypeSubject.type)}'), 'anonymous compare result CTA should seed upload-to-archetype comparison');
  assert(compareHtml.includes('Compare with The ${archetypeInviteLabel(archetypeSubject)}'), 'anonymous compare result CTA should name the shared archetype');
  assert(compareHtml.includes('rarity: profile.rarity || null'), 'profile-backed compare should preserve scarcity proof from profile API');
  assert(compareHtml.includes('leaderboard: profile.leaderboard || null'), 'profile-backed compare should preserve leaderboard proof from profile API');
  assert(compareHtml.includes('subjectProofLine(profileSubject)'), 'profile-backed compare shares should include profile social proof');
  assert(!compareHtml.includes("href: '/', label: \"What's YOUR archetype?\""), 'anonymous compare result should not fall back to generic homepage upload');
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
  assert(body.includes('href="/?compareArchetype=deepdiver"'), 'share card CTA should send visitors into upload-to-compare');
  assert(body.includes('Compare with this archetype'), 'share card CTA should invite comparison instead of homepage upload');
  assert(!body.includes("What's YOUR personality?"), 'share card should not use the old generic homepage CTA');
  assert(body.includes('archetype=deepdiver'), 'share card /vibe CTA should use the sanitized archetype key');
  console.log('ok legacy share card routes visitors into comparison');
}

async function assertWrappedShareLoop() {
  const wrappedHtml = await readFile('wrapped.html', 'utf8');
  assert(wrappedHtml.includes('/?compareArchetype=orchestrator'), 'wrapped CTA should route to upload-to-compare');
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

async function assertExportUploadSanitizer() {
  const { exportableUpload } = await import('../api/_lib/export-upload.js');
  const upload = exportableUpload({
    id: 'upload-1',
    archetype: 'builder',
    scores: {
      builder: 92,
      shipper: 81,
      rawJson: { should: 'drop' },
      _percentiles: { builder: 4, rawJson: 1 },
    },
    metrics: {
      days: 31,
      commitsPerDay: 12.4,
      sessions: 88,
      topLang: ' typescript ',
      raw: { should: 'drop' },
      tool_usage: { bash: 9000 },
    },
    raw_meta: {
      dateRange: '2026-05-01 to 2026-05-28',
      source: 'browser',
      signature: 'high-velocity Builder',
      signatureCombo: 'shipper+builder',
      signatureFingerprint: 'builder+shipper+orchestrator:90s',
      secondaryArchetype: 'shipper',
      rawJson: { should: 'drop' },
      language_usage: { typescript: 9000 },
    },
    uploaded_at: '2026-05-28T10:00:00.000Z',
  });

  assert(upload.id === 'upload-1', 'export upload should retain upload id for the owner archive');
  assert(upload.scores.builder === 92, 'export upload should retain derived archetype scores');
  assert(upload.scores._percentiles.builder === 4, 'export upload should retain derived percentiles');
  assert(upload.metrics.topLang === 'typescript', 'export upload should retain sanitized derived top language');
  assert(upload.raw_meta.signature === 'high-velocity Builder', 'export upload should retain signature metadata');
  assert(!JSON.stringify(upload).includes('tool_usage'), 'export upload must not include raw tool usage');
  assert(!JSON.stringify(upload).includes('language_usage'), 'export upload must not include raw language usage');
  assert(!JSON.stringify(upload).includes('rawJson'), 'export upload must not include raw JSON fields');
  console.log('ok settings export upload sanitizer preserves derived-only archive');
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
  const { SESSION_COOKIE, createSessionToken, readSession, verifySessionToken } = await import('../api/_lib/auth.js');
  const token = createSessionToken({
    id: '11111111-1111-1111-1111-111111111111',
    gh_id: 123,
    gh_handle: 'brightseth',
    avatar_url: null,
  });
  const session = verifySessionToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'session sub should round-trip');
  assert(session?.gh_handle === 'brightseth', 'session handle should round-trip');
  assert(session?.typ === 'vibestats_session', 'browser session token should carry session type');
  assert(readSession({ headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } })?.sub === session.sub, 'typed browser session cookie should read back');
  console.log('ok signed session round-trip');
}

async function assertSyncTokenRoundTrip() {
  const { SESSION_COOKIE, createSyncToken, readSession, verifySyncToken } = await import('../api/_lib/auth.js');
  const token = createSyncToken({
    id: '11111111-1111-1111-1111-111111111111',
    gh_handle: 'brightseth',
  });
  const session = verifySyncToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'sync token sub should round-trip');
  assert(session?.scope === 'sync', 'sync token should carry sync scope');
  assert(session?.typ === 'vibestats_sync', 'sync token should carry sync token type');
  assert(readSession({ headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } }) === null, 'sync token must not authenticate as browser session');
  console.log('ok signed CLI sync token round-trip');
}

async function assertDigestUnsubscribeTokenRoundTrip() {
  const {
    SESSION_COOKIE,
    createDigestUnsubscribeToken,
    readSession,
    verifyDigestUnsubscribeToken,
    verifySyncToken,
  } = await import('../api/_lib/auth.js');
  const token = createDigestUnsubscribeToken({
    id: '11111111-1111-1111-1111-111111111111',
  });
  const session = verifyDigestUnsubscribeToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'digest unsubscribe token sub should round-trip');
  assert(session?.scope === 'digest:unsubscribe', 'digest unsubscribe token should carry unsubscribe scope');
  assert(session?.typ === 'vibestats_digest_unsubscribe', 'digest unsubscribe token should carry token type');
  assert(verifySyncToken(token) === null, 'digest unsubscribe token must not authenticate as CLI sync token');
  assert(readSession({ headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` } }) === null, 'digest unsubscribe token must not authenticate as browser session');
  console.log('ok signed digest unsubscribe token round-trip');
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
  const {
    cleanContactUrl,
    cleanDigestEmail,
    cleanLookingFor,
    ownerProfileSettings,
    publicMatchSettings,
    publicProfileSettings,
  } = await import('../api/_lib/profile-settings.js');
  assert(cleanDigestEmail('  SETH@EXAMPLE.COM ') === 'seth@example.com', 'digest email should normalize');
  assert(cleanDigestEmail('') === null, 'empty digest email should clear');
  let rejected = false;
  try {
    cleanDigestEmail('not-an-email');
  } catch (err) {
    rejected = err.statusCode === 400;
  }
  assert(rejected, 'invalid digest email should be rejected');
  const ownerSettings = ownerProfileSettings({
    weekly_digest_opt_in: true,
    digest_email: 'seth@example.com',
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() - 10000).toISOString(),
    contact_url: 'https://x.com/brightseth',
  });
  const publicSettings = publicProfileSettings({
    weekly_digest_opt_in: true,
    digest_email: 'seth@example.com',
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() - 10000).toISOString(),
    contact_url: 'https://x.com/brightseth',
    show_raw_counts: true,
    show_languages: true,
  });
  assert(ownerSettings.weekly_digest_opt_in === true, 'owner settings should serialize digest opt-in');
  assert(ownerSettings.digest_email === 'seth@example.com', 'owner settings should serialize digest email');
  assert(ownerSettings.contact_url === 'https://x.com/brightseth', 'owner settings should preserve configured contact URL');
  assert(!Object.hasOwn(publicSettings, 'digest_email'), 'public settings must not serialize digest email');
  assert(!Object.hasOwn(publicSettings, 'weekly_digest_opt_in'), 'public settings must not serialize digest opt-in');
  assert(publicSettings.contact_url === null, 'public settings must hide expired match contact URL');
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
    unsubscribeToken: 'unsubscribe-token',
  });

  assert(uploadStreak(uploads) === 2, 'digest streak helper should count uploads within 7 days');
  assert(digest.subject.includes('week'), 'digest subject should include week label');
  assert(digest.text.includes('+4 points vs last upload'), 'digest text should include score movement');
  assert(digest.text.includes('#4 on the weekly Builder board'), 'digest text should include leaderboard position');
  assert(digest.text.includes('Manage digest: https://vibestats.io/settings'), 'digest text should include settings management link');
  assert(digest.text.includes('Unsubscribe: https://vibestats.io/api/digest/unsubscribe?token=unsubscribe-token'), 'digest text should include one-click unsubscribe link');
  assert(digest.html.includes('/api/og?'), 'digest HTML should include the profile card image');
  assert(digest.html.includes('Manage digest settings'), 'digest HTML should include settings management link');
  assert(digest.html.includes('unsubscribe'), 'digest HTML should include one-click unsubscribe link');
  assert(digest.settings_url === 'https://vibestats.io/settings', 'digest payload should expose settings URL');
  assert(digest.unsubscribe_url === 'https://vibestats.io/api/digest/unsubscribe?token=unsubscribe-token', 'digest payload should expose unsubscribe URL');
  assert(!digest.html.includes('rawJson') && !digest.text.includes('rawJson'), 'digest must not leak raw metadata');
  console.log('ok weekly digest helpers render derived-only email');
}

async function assertProfileMetadataHelpers() {
  const { profileDescription } = await import('../api/profile.js');
  const { profileShareProof } = await import('../api/_lib/social-proof.js');
  const rarity = { count: 8, tier: 'rare' };
  const leaderboard = { rank: 4, total: 25, label: 'builder' };
  const proof = profileShareProof({ rarity, leaderboard });
  const description = profileDescription({
    signature: 'high-velocity Builder',
    arch: { tagline: "You build things that didn't exist before." },
    metrics: {},
    handle: 'brightseth',
    rarity,
    leaderboard,
  });

  assert(proof.includes('rare combo: 1 of 8 saved profiles this month'), 'profile metadata proof should include scarcity');
  assert(proof.includes('#4 of 25 on weekly Builder board'), 'profile metadata proof should include leaderboard rank');
  assert(description.includes("Compare your vibecoding personality with @brightseth."), 'profile metadata should preserve comparison CTA');
  assert(!description.includes('rawJson'), 'profile metadata must not leak raw JSON fields');
  console.log('ok profile metadata helpers include social proof without raw JSON');
}

async function assertProfileCacheHelpers() {
  const { profileShareCacheControl, sendPrivateNotFound } = await import('../api/_lib/cache.js');
  assert(profileShareCacheControl({ privacy: 'public' }).includes('s-maxage=300'), 'public profiles should allow short shared cache');
  assert(profileShareCacheControl({ privacy: 'unlisted' }) === 'private, no-store', 'unlisted profile share surfaces should not be publicly cached');
  assert(profileShareCacheControl({ privacy: 'private' }) === 'private, no-store', 'private profile share surfaces should not be publicly cached');
  assert(profileShareCacheControl(null) === 'private, no-store', 'unknown profile share surfaces should not be publicly cached');
  const res = {
    headers: {},
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
  sendPrivateNotFound(res);
  assert(res.statusCode === 404, 'private not found helper should return 404');
  assert(res.headers['Cache-Control'] === 'private, no-store', 'private not found helper should disable caching');
  console.log('ok profile share cache helper keeps unlisted/private surfaces uncacheable');
}

async function assertCompareMetadataHelpers() {
  const { default: handler, canExposeCompareMetadata, compareMetadataForSubjects } = await import('../api/compare-page.js');
  const metadata = compareMetadataForSubjects(
    {
      type: 'builder',
      handle: 'brightseth',
      signature: 'high-velocity Builder',
      rarity: { count: 8, tier: 'rare' },
      leaderboard: { rank: 4, total: 25, label: 'builder' },
    },
    { type: 'shipper', param: 'shipper' },
    'https://vibestats.io',
  );

  assert(metadata.title.includes('@brightseth + Shipper = Feature Factory'), 'compare metadata should name the resolved pairing');
  assert(metadata.description.includes('high-velocity Builder'), 'compare metadata should include profile signature proof');
  assert(metadata.description.includes('rare combo: 1 of 8 saved profiles this month'), 'compare metadata should include scarcity proof');
  assert(metadata.description.includes('Open the pairing, then claim yours'), 'compare metadata should drive profile claiming');
  assert(metadata.image.includes('/api/og?mode=pair'), 'compare metadata should use pair-specific dynamic OG cards');
  assert(metadata.image.includes('an=%40brightseth') && metadata.image.includes('bn=Shipper'), 'compare metadata should pass pair labels into the OG image');
  assert(!metadata.description.includes('rawJson'), 'compare metadata must not leak raw JSON fields');
  const profilePair = compareMetadataForSubjects(
    { type: 'builder', handle: 'alice' },
    { type: 'shipper', handle: 'bob' },
    'https://vibestats.io',
  );
  assert(profilePair.url === 'https://vibestats.io/u/bob/pair/alice', 'compare metadata should preserve pretty profile pair URLs');
  assert(canExposeCompareMetadata({ privacy: 'public' }) === true, 'compare metadata should expose public profiles');
  assert(canExposeCompareMetadata({ privacy: 'unlisted' }) === true, 'compare metadata should expose unlisted share profiles');
  assert(canExposeCompareMetadata({ privacy: 'private' }) === false, 'compare metadata must not expose private profiles');

  let statusCode = 0;
  let contentType = '';
  let body = '';
  await handler({
    method: 'GET',
    query: { a: 'builder', b: 'shipper' },
    headers: { host: 'localhost:3000' },
  }, {
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
  });
  assert(statusCode === 200, 'compare page API should render HTTP 200');
  assert(contentType.includes('text/html'), 'compare page API should return HTML');
  assert(body.includes('@brightseth + Shipper = Feature Factory') || body.includes('Builder + Shipper = Feature Factory'), 'compare page API should inject dynamic pairing title');
  assert(body.includes('Open the pairing, then claim yours'), 'compare page API should inject claim-oriented metadata');
  console.log('ok compare metadata helpers render dynamic pair previews');
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

async function assertPrivateApiNoStore() {
  const originalError = console.error;
  console.error = () => {};
  const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];

  try {
    const endpoints = [
      {
        label: '/api/me unauthenticated',
        module: '../api/me.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/settings unauthenticated',
        module: '../api/settings.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/settings/export unauthenticated',
        module: '../api/settings/export.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/uploads unauthenticated',
        module: '../api/uploads.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/sync invalid token',
        module: '../api/sync.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/sync-token unauthenticated',
        module: '../api/sync-token.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 401,
      },
      {
        label: '/api/auth/logout',
        module: '../api/auth/logout.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 200,
      },
      {
        label: '/api/auth/github/start unavailable',
        module: '../api/auth/github/start.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 503,
      },
      {
        label: '/api/auth/github/callback invalid state',
        module: '../api/auth/github/callback.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 400,
      },
      {
        label: '/api/identity-status method guard',
        module: '../api/identity-status.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 405,
      },
      {
        label: '/api/cron/weekly-digest unauthorized',
        module: '../api/cron/weekly-digest.js',
        req: { method: 'GET', query: { dryRun: '1' }, headers: { host: 'localhost:3000' } },
        status: 503,
      },
      {
        label: '/api/digest/unsubscribe missing token',
        module: '../api/digest/unsubscribe.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 400,
      },
    ];

    for (const endpoint of endpoints) {
      const { default: handler } = await import(endpoint.module);
      const res = mockRes();
      await handler(endpoint.req, res);
      assert(res.statusCode === endpoint.status, `${endpoint.label} should return HTTP ${endpoint.status}`);
      assertNoStore(res, endpoint.label);
    }
    console.log('ok private APIs consistently disable caching');
  } finally {
    console.error = originalError;
    for (const key of envKeys) {
      if (previous[key] == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
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
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
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
    assertNoStore(res, 'weekly digest cron unauthorized');
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
await assertIdentityReadiness();
await assertProfileShareLoop();
await assertCompareShareLoop();
await assertShareCardCta();
await assertWrappedShareLoop();
await assertMatchmakingHelpers();
await assertUploadSanitizer();
await assertExportUploadSanitizer();
await assertCliDerivedPayload();
await assertSessionRoundTrip();
await assertSyncTokenRoundTrip();
await assertDigestUnsubscribeTokenRoundTrip();
await assertSameOriginGuard();
await assertReadJsonLimit();
await assertProfileSettingsHelpers();
await assertPublicProfileHelpers();
await assertSignatureHelpers();
await assertEvolutionHelpers();
await assertDigestHelpers();
await assertProfileMetadataHelpers();
await assertProfileCacheHelpers();
await assertCompareMetadataHelpers();
await assertProfileFallback();
await assertBadgeFallback();
await assertEmbedFallback();
await assertLeaderboardFallback();
await assertMatchFallback();
await assertBrowseFallback();
await assertPrivateApiNoStore();
await assertDigestCronAuth();

console.log('smoke checks passed');
