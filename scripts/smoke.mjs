import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret-with-at-least-32-bytes';

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
  '../api/cli/local-token.js',
  '../api/u/[handle].js',
  '../api/settings.js',
  '../api/settings/export.js',
  '../api/cron/weekly-digest.js',
  '../api/digest/unsubscribe.js',
  '../api/_lib/cache.js',
  '../api/_lib/evolution.js',
  '../api/_lib/export-upload.js',
  '../api/_lib/profile-links.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/public-profile.js',
  '../api/_lib/social-proof.js',
  '../api/_lib/signatures.js',
  '../api/_lib/streak.js',
  '../api/_lib/matchmaking.js',
  '../api/_lib/leaderboard-rank.js',
  '../api/_lib/moments.js',
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
    end(value = '') {
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

function assertNoInternalConfigMarkers(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const marker of ['VIBE_SESSION_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET', 'DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL']) {
    assert(!text.includes(marker), `${label} should not expose ${marker}`);
  }
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
  const leaderboardHtml = await readFile('leaderboard.html', 'utf8');
  const leaderboardRankHelper = await readFile('api/_lib/leaderboard-rank.js', 'utf8');
  const browseApi = await readFile('api/browse.js', 'utf8');
  const browseHtml = await readFile('browse.html', 'utf8');
  const matchApi = await readFile('api/match.js', 'utf8');
  const matchHtml = await readFile('match.html', 'utf8');
  const profileApi = await readFile('api/u/[handle].js', 'utf8');
  const comparePageApi = await readFile('api/compare-page.js', 'utf8');
  const ogApi = await readFile('api/og.js', 'utf8');
  const cacheHelper = await readFile('api/_lib/cache.js', 'utf8');
  const publicProfileHelper = await readFile('api/_lib/public-profile.js', 'utf8');
  const profileHtmlApi = await readFile('api/profile.js', 'utf8');
  const authCallbackApi = await readFile('api/auth/github/callback.js', 'utf8');
  const embedApi = await readFile('api/embed.js', 'utf8');
  const badgeApi = await readFile('api/badge.js', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  const settingsHtml = await readFile('settings.html', 'utf8');
  const dashboardHtml = await readFile('dashboard.html', 'utf8');
  const settingsApi = await readFile('api/settings.js', 'utf8');
  const settingsExportApi = await readFile('api/settings/export.js', 'utf8');
  const weeklyDigestApi = await readFile('api/cron/weekly-digest.js', 'utf8');
  const digestUnsubscribeApi = await readFile('api/digest/unsubscribe.js', 'utf8');
  const uploadsApi = await readFile('api/uploads.js', 'utf8');
  const syncTokenApi = await readFile('api/sync-token.js', 'utf8');
  const cliLocalTokenApi = await readFile('api/cli/local-token.js', 'utf8');
  const syncApi = await readFile('api/sync.js', 'utf8');
  const profileLinksHelper = await readFile('api/_lib/profile-links.js', 'utf8');
  const statsApi = await readFile('api/stats.js', 'utf8');
  const cliBin = await readFile('bin/vibestats.js', 'utf8');
  const identityStatusApi = await readFile('api/identity-status.js', 'utf8');
  const identityReadiness = await readFile('api/_lib/identity-readiness.js', 'utf8');
  const indexHtml = await readFile('index.html', 'utf8');
  const identityDoctor = await readFile('scripts/identity-doctor.mjs', 'utf8');
  const launchAudit = await readFile('scripts/launch-audit.mjs', 'utf8');
  const launchDoc = await readFile('docs/LAUNCH.md', 'utf8');
  const envExample = await readFile('.env.example', 'utf8');
  const npmIgnore = await readFile('.npmignore', 'utf8');
  const claudeSkill = await readFile('.claude/skills/vibestats/SKILL.md', 'utf8');
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
    rewrites.some((rewrite) => rewrite.source === '/leaderboard/:archetype' && rewrite.destination === '/leaderboard?archetype=:archetype'),
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
  assert(leaderboardApi.includes('updated: uploadRecency(row.uploaded_at)'), 'leaderboard API should bucket public upload freshness');
  assert(leaderboardApi.includes("methodNotAllowed(res, ['GET'], NO_STORE_HEADERS)"), 'leaderboard API method errors should not be cached');
  assert(leaderboardApi.includes("json(res, 400, { error: 'Invalid archetype' }, NO_STORE_HEADERS)"), 'leaderboard API invalid filters should not be cached');
  assert(!leaderboardApi.includes('s-maxage='), 'leaderboard API profile lists should not be publicly cached');
  assert(leaderboardApi.includes('public_score') && leaderboardApi.includes('least(greatest((scores->>${archetype})::numeric, 0), 100)'), 'leaderboard API should order by clamped public scores');
  assert(!leaderboardApi.includes('coalesce((scores->>${archetype})::numeric'), 'leaderboard API should not order by raw stored scores');
  assert(leaderboardRankHelper.includes('weekly_uploads') && leaderboardRankHelper.includes('least(greatest((latest.scores->>latest.archetype)::numeric, 0), 100)'), 'weekly rank helper should rank by clamped public scores');
  assert(!leaderboardRankHelper.includes('coalesce((latest.scores->>${latest.archetype})::numeric'), 'weekly rank helper should not rank by raw stored scores');
  assert(leaderboardHtml.includes('compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(entry.archetype || archetype)}'), 'leaderboard rows should route discovery into upload-to-compare');
  assert(leaderboardHtml.includes('const compareUrl = canonicalVibestatsUrl(`/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(entry.archetype || archetype)}`)'), 'leaderboard copied invites should canonicalize to vibestats.io');
  assert(leaderboardHtml.includes('data-invite="${esc(inviteText(entry, archetype))}"'), 'leaderboard rows should expose copyable rank invite text');
  assert(leaderboardHtml.includes("document.execCommand('copy')"), 'leaderboard copy actions should fall back when Clipboard API is unavailable');
  assert(leaderboardHtml.includes("See how you'd pair:"), 'leaderboard invite text should drive recipients into comparison');
  assert(leaderboardHtml.includes('Leaderboard database unavailable') && leaderboardHtml.includes('renderEntries(data.entries || [], Boolean(data.unavailable))'), 'leaderboard UI should distinguish unavailable DB from an empty board');
  assert(!matchApi.includes('languages:'), 'match API should not expose public language counts');
  assert(matchApi.includes('updated: uploadRecency(row.uploaded_at)'), 'match API should bucket public upload freshness');
  assert(matchApi.includes('seeker_archetype'), 'match API should preserve visitor archetype for goal-aware scoring');
  assert(matchApi.includes('goalFit({'), 'match API should use shared goal fit scoring');
  assert(matchApi.includes("methodNotAllowed(res, ['GET'], NO_STORE_HEADERS)"), 'match API method errors should not be cached');
  assert(!matchApi.includes('s-maxage='), 'match API profile lists should not be publicly cached');
  assert(browseApi.includes("u.privacy = 'public'"), 'browse API should include opt-in public profiles only');
  assert(!browseApi.includes('languages:'), 'browse API should not expose public language counts');
  assert(browseApi.includes('updated: uploadRecency(row.uploaded_at)'), 'browse API should bucket public upload freshness');
  assert(browseApi.includes("methodNotAllowed(res, ['GET'], NO_STORE_HEADERS)"), 'browse API method errors should not be cached');
  assert(!browseApi.includes('s-maxage='), 'browse API profile lists should not be publicly cached');
  assert(browseApi.includes('public_score') && browseApi.includes('least(greatest((scores->>archetype)::numeric, 0), 100)'), 'browse API signal sort should use clamped public scores');
  assert(!browseApi.includes('coalesce((scores->>archetype)::numeric'), 'browse API should not sort by raw stored scores');
  assert(browseHtml.includes('raw insights JSON and language details stay out'), 'browse UI should state public browse privacy boundary');
  assert(browseHtml.includes('compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(entry.archetype)}'), 'browse share copy should drive recipients into upload-to-compare');
  assert(browseHtml.includes('const compareUrl = canonicalVibestatsUrl(`/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(entry.archetype)}`)'), 'browse copied invites should canonicalize to vibestats.io');
  assert(browseHtml.includes("document.execCommand('copy')"), 'browse copy actions should fall back when Clipboard API is unavailable');
  assert(browseHtml.includes('Profile database unavailable') && browseHtml.includes('renderEntries(data.entries || [], Boolean(data.unavailable))'), 'browse UI should distinguish unavailable DB from an empty directory');
  assert(matchHtml.includes('renderChips(\'archetypes\''), 'match UI should let visitors rank matches by their archetype');
  assert(matchHtml.includes('const compareUrl = canonicalVibestatsUrl(comparePath(entry, seekerArchetype));'), 'match copied intros should canonicalize comparison URLs to vibestats.io');
  assert(matchHtml.includes('url=${encodeURIComponent(canonicalVibestatsUrl(comparePath(entry, seekerArchetype)))}'), 'match X share URLs should canonicalize to vibestats.io');
  assert(matchHtml.includes("document.execCommand('copy')"), 'match copy intro actions should fall back when Clipboard API is unavailable');
  assert(matchHtml.includes('Match database unavailable') && matchHtml.includes('Boolean(data.unavailable)'), 'match UI should distinguish unavailable DB from no active matches');
  assert(profileApi.includes("methodNotAllowed(res, ['GET'], NO_STORE_HEADERS)"), 'profile JSON API method errors should not be cached');
  assert(profileApi.includes("json(res, 400, { error: 'Invalid handle' }, NO_STORE_HEADERS)"), 'profile JSON API invalid handles should not be cached');
  assert(profileApi.includes("json(res, 404, { error: 'Profile not found' }, { 'Cache-Control': PRIVATE_PROFILE_CACHE })"), 'profile JSON API unknown handles should not be cached before a profile is created');
  assert(profileApi.includes('weeklyLeaderboardRank'), 'profile API should include public weekly rank');
  assert(profileApi.includes('profileEvolution'), 'profile API should include derived evolution badge');
  assert(profileApi.includes('profileStreak') && profileApi.includes('streak: profileStreak(uploads, { isOwner })'), 'profile API should include derived day-based streaks');
  assert(profileApi.includes('const visibleUploads = isOwner ? uploads : uploads.slice(0, 1)'), 'profile API should not expose full upload history to visitors');
  assert(profileApi.includes('total_uploads: isOwner ? uploads.length : null'), 'profile API should keep exact history count owner-only');
  assert(profileHtml.includes('latest public result'), 'profile UI should not imply full history is visible to visitors');
  assert(profileApi.includes("'Cache-Control': PRIVATE_PROFILE_CACHE"), 'profile JSON private 404 should not be cacheable');
  assert(profileHtmlApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile HTML OG metadata must use visitor-safe metric visibility');
  assert(profileHtmlApi.includes('profileShareCacheControl(user)'), 'profile HTML OG metadata should use shared profile cache policy');
  assert(profileHtmlApi.includes('sendGenericProfilePage(req, res, 404, handle)'), 'profile HTML unknown handles should render generic shell with explicit no-store cache policy');
  assert(profileHtmlApi.includes('sendPrivateNotFound(res)'), 'profile HTML private 404 should not be cacheable');
  assert(profileHtmlApi.includes('weeklyLeaderboardRank(user, latest)'), 'profile HTML OG metadata should include public leaderboard proof');
  assert(profileHtmlApi.includes('rarityForSignature(signature)'), 'profile HTML OG metadata should include signature scarcity proof');
  assert(profileHtmlApi.includes('profileDescription({'), 'profile HTML OG metadata should centralize comparison-oriented share copy');
  assert(comparePageApi.includes('compareMetadataForSubjects'), 'compare page API should expose dynamic comparison metadata helpers');
  assert(!comparePageApi.includes('readSession'), 'compare page metadata must not personalize public cached previews by session');
  assert(comparePageApi.includes("user.privacy !== 'private'"), 'compare page metadata must not expose private profiles');
  assert(comparePageApi.includes('profileShareProof({ rarity: subject.rarity, leaderboard: subject.leaderboard })'), 'compare page metadata should include profile social proof');
  assert(comparePageApi.includes('Open the pairing, then claim yours'), 'compare page metadata should drive recipients to claim their profile');
  assert(comparePageApi.includes('sendPrivateMethodNotAllowed(res)'), 'compare page method guard should use private no-store profile cache policy');
  assert(ogApi.includes("mode === 'pair'"), 'OG API should support pair-specific share images');
  assert(ogApi.includes('CLAUDE CODE PAIRING'), 'pair OG image should frame shared comparisons as Claude Code pairings');
  assert(ogApi.includes('sendFallbackOg(res)'), 'OG API should return a static fallback image on generation failure');
  assert(!ogApi.includes('e.stack'), 'OG API must not return stack traces to share-card crawlers');
  assert(cacheHelper.includes("user?.privacy === 'public'"), 'profile cache helper should cache only explicit public profiles');
  assert(cacheHelper.includes('sendPrivateMethodNotAllowed'), 'profile cache helper should cover method errors on dynamic share surfaces');
  assert(embedApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile embed must use visitor-safe metric visibility');
  assert(embedApi.includes('publicUpload(latest, visibility, { isOwner: false })'), 'profile embed must not serialize owner-only upload fields');
  assert(publicProfileHelper.includes('if (isOwner) out.uploaded_at = upload.uploaded_at'), 'profile upload serializer should keep exact upload timestamps owner-only');
  assert(profileHtml.includes('uploadDateLabel(upload)'), 'profile UI should render bucketed visitor freshness labels');
  assert(embedApi.includes('compareTo=${encodeURIComponent(user.gh_handle)}'), 'profile embed should click through to upload-to-compare when an archetype exists');
  assert(embedApi.includes('Compare with @${user.gh_handle}'), 'profile embed should expose a comparison-oriented accessible action');
  assert(embedApi.includes('profileShareCacheControl(user)'), 'profile embed should use shared profile cache policy');
  assert(badgeApi.includes('profileShareCacheControl(user)'), 'profile badge should use shared profile cache policy');
  assert(badgeApi.includes('publicScores(latest.scores || {})[latest.archetype]'), 'profile badge should render the derived primary score');
  assert(badgeApi.includes('select archetype, scores, raw_meta'), 'profile badge should fetch only derived badge fields');
  assert(embedApi.includes('sendPrivateNotFound(res)'), 'profile embed private 404 should not be cacheable');
  assert(badgeApi.includes('function sendBadgeNotFound') && badgeApi.includes('profileShareCacheControl(null)'), 'profile badge private 404 should not be cacheable');
  assert(profileLinksHelper.includes('compare_url') && profileLinksHelper.includes('compareArchetype'), 'profile links helper should expose compare-first URLs');
  assert(uploadsApi.includes('profileLinks(user, payload.archetype)'), 'browser profile saves should return compare-first profile links');
  assert(syncApi.includes('readSyncSession'), 'sync API should require signed CLI sync token sessions');
  assert(syncApi.includes('syncTokenIsRevoked'), 'sync API should reject owner-revoked CLI sync tokens');
  assert(!syncApi.includes('requireSameOrigin'), 'sync API should not require browser same-origin cookies');
  assert(syncApi.includes('profileLinks(user, payload.archetype)'), 'CLI sync saves should return compare-first profile links');
  assert(cliBin.includes('Invite people to compare:'), 'CLI sync success output should surface compare-first invite URL');
  assert(cliBin.includes("'.claude', 'usage-data'") && cliBin.includes('readInsightsInput(options.file)') && cliBin.includes('--dir PATH'), 'CLI sync should parse real Claude Code /insights directories by default');
  assert(cliBin.includes('requestSyncToken') && cliBin.includes('authUrlForLocalCallback') && cliBin.includes('127.0.0.1'), 'CLI sync should authorize through a local browser callback when no token is supplied');
  assert(cliBin.includes('--no-open') && cliBin.includes('Opening browser to authorize vibestats CLI sync'), 'CLI sync should support manual browser auth fallback');
  assert(syncTokenApi.includes("if (!['POST', 'DELETE'].includes(req.method))"), 'sync token API should support generation and revocation');
  assert(syncTokenApi.includes('sync_token_invalidated_at'), 'sync token API should persist token revocation cutoff');
  assert(syncTokenApi.includes("github:brightseth/vibestats#feat/wave-1-identity") && syncTokenApi.includes('VIBESTATS_CLI_PACKAGE'), 'sync token API should avoid the occupied unscoped npm package name while allowing package override');
  assert(cliLocalTokenApi.includes("if (!['GET', 'POST'].includes(req.method))"), 'CLI browser auth endpoint should support approval page and token redirect');
  assert(cliLocalTokenApi.includes('allowedLocalCallback') && cliLocalTokenApi.includes('127.0.0.1') && cliLocalTokenApi.includes('localhost'), 'CLI browser auth endpoint should allow only local callbacks');
  assert(cliLocalTokenApi.includes('Authorize CLI sync') && cliLocalTokenApi.includes('requireSameOrigin(req)'), 'CLI browser auth endpoint should require same-origin browser approval before minting a token');
  assert(cliLocalTokenApi.includes('createSyncToken(user)') && cliLocalTokenApi.includes('syncTokenExpiresAt()'), 'CLI browser auth endpoint should mint expiring revocable sync tokens');
  assert(cliLocalTokenApi.includes('Raw Claude Code') && cliLocalTokenApi.includes('data stays on your machine'), 'CLI browser auth page should preserve the privacy promise');
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
  assert(identityReadiness.includes('weekly_digest_available'), 'identity readiness should expose non-secret weekly digest delivery readiness');
  assert(indexHtml.includes("fetch('/api/identity-status'"), 'upload page should check identity readiness before fetching session state');
  assert(indexHtml.includes('identityStatus.profile_save_available'), 'upload page should gate profile saves on identity readiness');
  assert(indexHtml.includes('Profile saves are not configured on this deployment yet. Your result stayed local.'), 'upload page should explain local-only behavior when identity is unavailable');
  assert(!indexHtml.includes('agent-insights.json'), 'upload page should not teach the dead Claude Code agent-insights.json path');
  assert(indexHtml.includes('What kind of coder are you? Claude Code already knows.') && indexHtml.includes('<code>/insights</code>') && indexHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity sync'), 'upload page should frame onboarding as a Claude Code reveal with the real /insights to npx path');
  assert(!indexHtml.includes('npx vibestats sync'), 'upload page should not advertise the occupied unscoped npm package name');
  assert(indexHtml.includes('No file hunting') && indexHtml.includes('real ~/.claude/usage-data/ output'), 'upload page should steer cold users away from manual file hunting');
  assert(indexHtml.includes('buildBehavioralMoments(insights)') && indexHtml.includes('longestSessionMinutes'), 'upload page should save derived behavioral moments from local reveal data');
  assert(indexHtml.includes('weekly_digest_available: body.weekly_digest_available === true'), 'upload page should preserve digest delivery readiness from identity status');
  assert(indexHtml.includes('identityStatus.weekly_digest_available === true'), 'upload page should only show inline digest opt-in when delivery is configured');
  assert(indexHtml.includes('Weekly digest delivery is not configured on this deployment yet. Raw insights JSON never leaves your browser.'), 'upload page should explain pending digest delivery without offering a dead opt-in');
  assert(profileHtml.includes("fetch('/api/identity-status'"), 'profile page should check identity readiness before showing sign-in');
  assert(profileHtml.includes('function renderEmptyProfile') && profileHtml.includes('Signature mint pending'), 'profile page should render claimed-but-unminted profiles as a first-run state');
  assert(profileHtml.includes('sameHandle(me?.gh_handle, handle)') && profileHtml.includes("isOwner ? 'Upload insights' : 'Mint yours'"), 'empty profile state should use owner-aware minting actions');
  assert(profileHtml.includes('Raw insights stay in your browser; only derived metrics save.') && profileHtml.includes('Copy pending profile'), 'empty profile state should preserve the privacy promise and copyable profile loop');
  assert(profileHtml.includes('Profile saves pending'), 'profile page should avoid dead-end sign-in when identity is unavailable');
  assert(profileHtml.includes('Reveal yours vs @${handle}') && profileHtml.includes('What are you? Run /insights, then the npx reveal command on the homepage'), 'profile pages should act as share-recipient landing pages with the reveal command');
  assert(profileHtml.includes('id="moment-grid"') && profileHtml.includes('renderBehavioralMoments(latest)'), 'profile pages should render shareable derived behavioral moments');
  assert(settingsHtml.includes("fetch('/api/identity-status'"), 'settings page should check identity readiness before showing sign-in');
  assert(settingsHtml.includes('Profile saves are not configured on this deployment yet.'), 'settings page should explain unavailable identity instead of linking to dead-end auth');
  assert(settingsHtml.includes('id="settings-sign-in" role="button" aria-disabled="true"'), 'settings page should not render a live OAuth link before identity readiness is known');
  assert(settingsHtml.includes("signIn.removeAttribute('aria-disabled')"), 'settings page should enable sign-in only after identity readiness passes');
  assert(settingsHtml.includes('identityStatus.weekly_digest_available === true'), 'settings page should gate digest controls on delivery readiness');
  assert(settingsHtml.includes('renderDigestControls(settings, identityStatus)'), 'settings page should centralize digest control readiness state');
  assert(settingsHtml.includes('checkbox.disabled = !digestReady && !digestOptIn') && settingsHtml.includes('save.disabled = !digestReady && !digestOptIn'), 'settings page should allow saved digest opt-outs when delivery is unavailable');
  assert(settingsHtml.includes('identityStatus.weekly_digest_available !== true && optIn'), 'settings page should block new digest opt-ins when delivery is unavailable');
  assert(settingsHtml.includes("digest_email: optIn ? email : ''"), 'settings page should clear digest email when opt-in is turned off');
  assert(settingsHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity sync'), 'settings UI should expose CLI sync command generation');
  assert(settingsHtml.includes('id="cli-sync"'), 'settings UI should expose a direct anchor for CLI sync setup');
  assert(settingsHtml.includes('id="revoke-sync-tokens"'), 'settings UI should expose CLI sync token revocation');
  assert(settingsHtml.includes('--dry-run'), 'settings UI should tell users how to preview CLI payloads locally');
  assert(settingsHtml.includes('local Claude Code `/insights` directory') && settingsHtml.includes('keeps raw session data on disk'), 'settings UI should explain the CLI /insights extractor privacy boundary');
  assert(settingsHtml.includes("document.execCommand('copy')"), 'settings copy actions should fall back when Clipboard API is unavailable');
  assert(dashboardHtml.includes('url=https%3A%2F%2Fvibestats.io%2F%3FcompareArchetype%3Dorchestrator'), 'static dashboard X share should click through to Orchestrator comparison intake');
  assert(dashboardHtml.includes('href="/?compareArchetype=orchestrator"'), 'static dashboard final CTA should route to comparison intake');
  assert(dashboardHtml.includes('How would you pair with an Orchestrator?'), 'static dashboard footer should use asymmetric comparison copy');
  assert(settingsApi.includes('ownerProfileSettings'), 'authenticated settings API should use owner-only settings serializer');
  assert(settingsApi.includes('sync_token_invalidated_at'), 'authenticated settings API should preserve sync token revocation metadata');
  assert(settingsApi.includes('includeActivity: true'), 'authenticated settings API should retain owner activity timestamps');
  assert(settingsApi.includes('publicIdentityReadiness') && settingsApi.includes('Weekly digest delivery is not configured'), 'settings API should reject new digest opt-ins when delivery env is missing');
  assert(settingsApi.includes('const email = optIn') && settingsApi.includes(': null;'), 'settings API should clear digest email whenever digest opt-in is off');
  assert(settingsExportApi.includes('ownerProfileSettings'), 'settings export should use owner-only settings serializer');
  assert(settingsExportApi.includes('uploads.map(exportableUpload)'), 'settings export should sanitize stored uploads through a derived-field allowlist');
  assert(weeklyDigestApi.includes('createDigestUnsubscribeToken'), 'weekly digest should include one-click unsubscribe tokens');
  assert(weeklyDigestApi.includes("'List-Unsubscribe'"), 'weekly digest sender should advertise unsubscribe headers');
  assert(weeklyDigestApi.includes('digestDryRunProof'), 'weekly digest dry run should expose non-secret content proof');
  assert(weeklyDigestApi.includes('weeklyDigestErrorMessage'), 'weekly digest cron should centralize public error serialization');
  assert(digestUnsubscribeApi.includes('weekly_digest_opt_in = false'), 'digest unsubscribe should turn off weekly emails');
  assert(digestUnsubscribeApi.includes('digest_email = null'), 'digest unsubscribe should clear stored digest email');
  assert(packageJson.bin?.vibestats === './bin/vibestats.js', 'package should expose vibestats CLI bin');
  assert(npmIgnore.includes('!bin/vibestats.js') && npmIgnore.includes('!lib/claude-insights-extractor.js') && npmIgnore.includes('!lib/insights-derived.js') && npmIgnore.includes('!api/_lib/moments.js') && npmIgnore.includes('!api/_lib/signatures.js'), 'npm package allowlist should include the CLI and derived scoring helpers');
  assert(packageJson.scripts?.['audit:launch'] === 'node scripts/launch-audit.mjs', 'package should expose launch audit script');
  assert(identityDoctor.includes('POSTGRES_URL') && identityDoctor.includes('NEON_DATABASE_URL'), 'identity doctor should accept DB env aliases used by runtime');
  assert(identityDoctor.includes('AUTH_SECRET') && identityDoctor.includes('NEXTAUTH_SECRET'), 'identity doctor should accept session secret aliases used by runtime');
  assert(identityDoctor.includes('MIN_SESSION_SECRET_BYTES = 32'), 'identity doctor should require a strong session secret');
  assert(identityDoctor.includes('weak ${group.label}'), 'identity doctor should fail weak session secrets without printing values');
  assert(identityDoctor.includes('UPSTASH_REDIS_REST_URL') && identityDoctor.includes('UPSTASH_REDIS_REST_TOKEN'), 'identity doctor should report Redis env aliases');
  assert(identityDoctor.includes('CRON_SECRET') && identityDoctor.includes('RESEND_API_KEY') && identityDoctor.includes('DIGEST_FROM_EMAIL'), 'identity doctor should report weekly digest env readiness');
  assert(identityDoctor.includes('--schema') && identityDoctor.includes('checkIdentitySchema'), 'identity doctor should expose an explicit DB schema readiness check');
  assert(identityDoctor.includes('information_schema.columns') && identityDoctor.includes('schema_migrations'), 'identity doctor schema check should verify columns and applied migrations');
  assert(identityDoctor.includes('users.privacy default unlisted and not null'), 'identity doctor schema check should verify the profile privacy default');
  assert(identityDoctor.includes('uploads.user_id not null'), 'identity doctor schema check should verify uploads cannot be orphaned');
  assert(identityDoctor.includes('users_privacy_check'), 'identity doctor schema check should verify the profile privacy enum');
  assert(identityDoctor.includes('uploads_archetype_check'), 'identity doctor schema check should verify the saved upload archetype canon');
  assert(identityDoctor.includes('profile_settings_looking_for_check'), 'identity doctor schema check should verify match intent enum constraint');
  assert(identityDoctor.includes('profile_settings_contact_url_len'), 'identity doctor schema check should verify contact URL length constraint');
  assert(identityDoctor.includes('profile_settings_contact_url_protocol'), 'identity doctor schema check should verify HTTPS contact URL constraint');
  assert(identityDoctor.includes('convalidated'), 'identity doctor schema check should reject unvalidated constraints');
  assert(identityDoctor.includes('sync_token_invalidated_at'), 'identity doctor schema check should verify sync-token revocation schema');
  assert(identityDoctor.includes('schema foreign key uploads.user_id cascades to users'), 'identity doctor schema check should verify upload deletion cascades');
  assert(identityDoctor.includes('schema foreign key profile_settings.user_id cascades to users'), 'identity doctor schema check should verify settings deletion cascades');
  assert(identityDoctor.includes('confdeltype'), 'identity doctor schema check should inspect foreign key delete behavior');
  assert(!identityDoctor.includes("{ label: 'app origin', any: ['VIBESTATS_URL'] }"), 'identity doctor should not hard-require VIBESTATS_URL when runtime can infer host origin');
  assert(launchAudit.includes('/api/identity-status') && launchAudit.includes('profile_save_available') && launchAudit.includes('weekly_digest_available'), 'launch audit should verify deployed identity readiness');
  assert(launchAudit.includes('profileHasUpload') && launchAudit.includes('saved profile has minted signature upload'), 'launch audit should distinguish configured identity from a minted signature profile');
  assert(launchAudit.includes('--vercel-deployment') && launchAudit.includes('vercel curl'), 'launch audit should support protected Vercel preview verification');
  assert(launchAudit.includes("args.push('--', '-s', '-i')"), 'launch audit should collect status and headers through vercel curl');
  assert(launchAudit.includes("label: 'OAuth callback failure response'") && launchAudit.includes("path: '/api/auth/github/callback?code=a&state=b'"), 'launch audit should verify OAuth callback failure responses');
  assert(launchAudit.includes("label: 'profile JSON miss'") && launchAudit.includes('expectedType: \'application/json\''), 'launch audit should verify profile JSON miss cache policy');
  assert(launchAudit.includes("label: 'profile JSON'") && launchAudit.includes('expectReady ? [200] : [200, 404, 503]'), 'launch audit should verify the saved profile JSON payload when identity is ready');
  assert(launchAudit.includes('"metric_visibility"') && launchAudit.includes('"leaderboard"') && launchAudit.includes('"evolution"') && launchAudit.includes('"streak"'), 'launch audit should require saved profile JSON to include public profile loop fields');
  assert(launchAudit.includes("label: 'profile embed'") && launchAudit.includes('Compare with me') && launchAudit.includes('<span>signal</span>'), 'launch audit should require saved profile embeds to expose comparison-oriented score proof');
  assert(launchAudit.includes("label: 'profile badge'") && launchAudit.includes('Claude Code signal'), 'launch audit should require saved profile badges to expose scored credential proof');
  assert(launchAudit.includes("label: 'profile-backed pair route'") && launchAudit.includes('path: `/u/${encodeURIComponent(handle)}/pair/${encodeURIComponent(archetype)}`'), 'launch audit should cover profile-backed pair URLs');
  assert(launchAudit.includes('Open the pairing, then claim yours') && launchAudit.includes('/?compareTo='), 'launch audit should verify dynamic pair metadata when identity is ready');
  assert(launchAudit.includes('SECRET_NAME_PATTERNS') && launchAudit.includes('hasSecretName'), 'launch audit should avoid exposing secret env names');
  assert(launchAudit.includes("RAW_LEAK_PATTERNS = ['rawJson', 'tool_usage', 'language_usage']"), 'launch audit should scan public surfaces for raw-field markers');
  assert(launchAudit.includes("path: '/wrapped'") && launchAudit.includes("path: '/dashboard'") && launchAudit.includes("path: `/card?a="), 'launch audit should cover static and dynamic share surfaces');
  assert(
    launchAudit.includes("label: 'browse page'") && launchAudit.includes("label: 'match page'") && launchAudit.includes("label: 'leaderboard page'"),
    'launch audit should cover discovery, matchmaker, and scarcity surfaces',
  );
  assert(
    launchAudit.includes("path: `/api/browse?") && launchAudit.includes("path: `/api/match?") && launchAudit.includes("path: `/api/leaderboard?"),
    'launch audit should cover public discovery JSON APIs',
  );
  assert(
    /label: 'browse API'[\s\S]*?requireNoStore: true/.test(launchAudit)
      && /label: 'match API'[\s\S]*?requireNoStore: true/.test(launchAudit)
      && /label: 'leaderboard API'[\s\S]*?requireNoStore: true/.test(launchAudit),
    'launch audit should verify discovery API cache policy',
  );
  assert(launchAudit.includes('checkRawLeaks: false'), 'launch audit should not fail the upload page for local raw-parser field names');
  assert(launchAudit.includes('--expect-ready') && launchAudit.includes('--expect-digest'), 'launch audit should support strict production readiness gates');
  assert(launchAudit.includes('cronSecret: process.env.CRON_SECRET') && launchAudit.includes('weekly digest dry run has cron secret'), 'launch audit should run a protected digest dry run when strict digest readiness is expected');
  assert(launchAudit.includes('weekly digest dry run returns readiness payload') && launchAudit.includes('body.resend_ready === true'), 'launch audit should require digest dry-run readiness payload');
  assert(launchAudit.includes('weekly digest dry run has at least one candidate') && launchAudit.includes('weekly digest dry run proves return-loop content'), 'launch audit should require digest dry-run content proof');
  assert(launchAudit.includes('day_streak_included'), 'launch audit should require digest dry-run day-streak proof');
  assert(envExample.includes('POSTGRES_URL=') && envExample.includes('AUTH_SECRET='), '.env.example should document runtime env aliases');
  assert((await readFile('db/migrations/0006_sync_token_revocation.sql', 'utf8')).includes('sync_token_invalidated_at'), 'migrations should support CLI sync token revocation');
  assert((await readFile('db/migrations/0007_https_contact_urls.sql', 'utf8')).includes("contact_url like 'https://%'"), 'migrations should enforce HTTPS public contact URLs for new rows');
  assert((await readFile('db/migrations/0008_privacy_not_null.sql', 'utf8')).includes("alter column privacy set not null"), 'migrations should enforce non-null profile privacy');
  assert((await readFile('db/migrations/0009_upload_archetype_canon.sql', 'utf8')).includes('uploads_archetype_check'), 'migrations should enforce the eight-archetype upload canon');
  assert((await readFile('db/migrations/0010_validate_contact_url_constraint.sql', 'utf8')).includes('validate constraint profile_settings_contact_url_protocol'), 'migrations should validate the HTTPS contact URL constraint');
  assert((await readFile('db/migrations/0011_upload_owner_not_null.sql', 'utf8')).includes('alter column user_id set not null'), 'migrations should prevent orphaned profile uploads');
  assert(authCallbackApi.includes('gh_handle, avatar_url, privacy, last_seen_at') && authCallbackApi.includes("'unlisted'"), 'GitHub OAuth should explicitly create unlisted profiles by default');
  assert(authCallbackApi.includes('identityReadiness, identityUnavailableMessage'), 'GitHub OAuth callback should use the shared identity readiness gate');
  assert(authCallbackApi.indexOf('identityReadiness().available') < authCallbackApi.indexOf('const statePayload = decodeStatePayload'), 'GitHub OAuth callback should fail closed before reading signed state when identity is unavailable');
  assert(launchDoc.includes('vercel env ls --scope lets-vibe') && launchDoc.includes('npm run migrate'), 'launch checklist should cover Vercel env and migration gates');
  assert(launchDoc.includes('Env scope matters.') && launchDoc.includes('attached to Preview as well as Production') && launchDoc.includes('vercel env add VIBE_SESSION_SECRET production preview development --scope lets-vibe'), 'launch checklist should prevent production-only env scope mistakes');
  assert(launchDoc.includes('https://vibestats.io/api/auth/github/callback') && launchDoc.includes('separate preview OAuth app'), 'launch checklist should document production and preview GitHub OAuth callback handling');
  assert(launchDoc.includes('npm run doctor:identity -- --schema'), 'launch checklist should require post-migration schema proof');
  assert(launchDoc.includes('sync-token revocation column') && launchDoc.includes('non-null upload ownership') && launchDoc.includes('unlisted-by-default privacy column') && launchDoc.includes('8-archetype upload canon') && launchDoc.includes('match-intent enum') && launchDoc.includes('validated contact URL length/HTTPS constraints'), 'launch checklist should name schema gates for privacy and sync hardening');
  assert(launchDoc.includes('foreign-key delete cascades') && launchDoc.includes('cascading deletion of uploads/profile settings'), 'launch checklist should name schema gates for account deletion privacy');
  assert(launchDoc.includes('"commandForIgnoringBuildStep": null'), 'launch checklist should require Vercel ignored-build setting to be disabled');
  assert(launchDoc.includes('vercel ls vibestats --scope lets-vibe'), 'launch checklist should require checking canonical Vercel preview status');
  assert(launchDoc.includes('vercel curl /api/identity-status --deployment <preview-url> --scope lets-vibe'), 'launch checklist should document protected-preview runtime proof');
  assert(launchDoc.includes('npm run audit:launch -- --deployment <preview-url> --scope lets-vibe --handle <saved-gh-handle>'), 'launch checklist should document protected-preview launch audit');
  assert(launchDoc.includes('browse/match/leaderboard surfaces'), 'launch checklist should include discovery and scarcity launch surfaces');
  assert(launchDoc.includes('npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready'), 'launch checklist should require deployed viral-loop audit');
  assert(launchDoc.includes('requires more than a GitHub-created user row') && launchDoc.includes('at least one saved derived upload'), 'launch checklist should explain the first-upload gate for strict readiness');
  assert(launchDoc.includes('CRON_SECRET=<cron-secret> npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready --expect-digest'), 'launch checklist should require strict digest audit once email is configured');
  assert(launchDoc.includes('protected weekly digest dry run') && launchDoc.includes('does not print the secret value'), 'launch checklist should document strict digest dry-run proof');
  assert(launchDoc.includes('at least one saved profile must be opted in') && launchDoc.includes('day-based streak') && launchDoc.includes('derived-only privacy copy'), 'launch checklist should require a real digest candidate for strict proof');
  assert(launchDoc.includes('Profile JSON includes evolution, day-based streak, rarity, and leaderboard fields.'), 'launch checklist should require profile return-loop JSON proof');
  assert(launchDoc.includes('Profile embed and badge show comparison-oriented scored credential proof.'), 'launch checklist should require scored portable credential proof');
  assert(badgeApi.includes('return sendSvg(res, 404, badgeSvg({'), 'badge endpoint should return SVG for missing/private profile badges');
  assert(launchDoc.includes('Identity is not production-ready until GitHub OAuth is added') && launchDoc.includes('preview identity audits will still fail until a strong session secret is also added to Preview'), 'launch checklist should record current identity env blockers');
  assert(launchDoc.includes('includes one-click unsubscribe'), 'launch checklist should require digest unsubscribe proof');
  const readme = await readFile('README.md', 'utf8');
  assert(readme.includes('A successful sync prints both the profile URL and a compare-first invite URL.'), 'README should document CLI compare-first sync output');
  assert(readme.includes('real Claude Code `/insights` output directory') && readme.includes('session-meta/*.json') && readme.includes('facets/*.json'), 'README should document the real Claude Code /insights extractor');
  assert(readme.includes('.claude/skills/vibestats/SKILL.md') && readme.includes('project-local `/vibestats` skill'), 'README should document the Claude Code /vibestats activation path');
  assert(claudeSkill.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity sync --dry-run') && claudeSkill.includes('Only after the user agrees'), 'Claude Code skill should reveal locally before publishing');
  assert(claudeSkill.includes('Do not `cat`, summarize, paste, upload, or quote files under `~/.claude/usage-data/session-meta/`'), 'Claude Code skill should preserve raw session privacy');
  assert(claudeSkill.includes('Do not mention `agent-insights.json` as the normal path'), 'Claude Code skill should explicitly avoid the dead agent-insights path');
  assert((await readFile('match.html', 'utf8')).includes('&b=${encodeURIComponent(handle)}'), 'match compare links should preserve candidate profile identity');
  assert(profileHtml.includes('leaderboardText(profile.leaderboard)'), 'profile UI should render public weekly rank');
  assert(profileHtml.includes('evolution-pill'), 'profile UI should render evolution badge');
  assert(profileHtml.includes('const streak = profile.streak || null') && profileHtml.includes('${esc(streak.label)}'), 'profile UI should render server-derived day streaks');
  assert(!profileHtml.includes('function uploadStreak(uploads)'), 'profile UI should not recompute hidden history streaks from visitor uploads');
  assert(profileHtml.includes('/browse?archetype=${encodeURIComponent(hostArchetype)}'), 'profile UI should link to filtered directory');
  assert(profileHtml.includes('owner history private'), 'profile UI should not render a fake history chart for visitors');
  assert(profileHtml.includes("historyVisible ? `${uploads.length} total` : 'latest only'"), 'profile UI should label visitor timeline as latest-only');
  assert((config.crons || []).some((cron) => cron.path === '/api/cron/weekly-digest'), 'weekly digest cron should be scheduled');
  console.log('ok route rewrites');
}

async function assertLaunchAuditHelpers() {
  const { parseArgs, parseVercelCurlResponse } = await import('../scripts/launch-audit.mjs');
  const launchAuditSource = await readFile('scripts/launch-audit.mjs', 'utf8');
  const parsed = parseArgs(['--deployment', 'https://preview.vercel.app', '--scope', 'lets-vibe', '--handle', '@brightseth']);
  assert(parsed.origin === 'https://preview.vercel.app', 'launch audit should default origin to the protected deployment URL');
  assert(parsed.vercelDeployment === 'https://preview.vercel.app', 'launch audit should normalize vercel deployment URL');
  assert(parsed.vercelScope === 'lets-vibe', 'launch audit should parse vercel scope');
  assert(parsed.handle === 'brightseth', 'launch audit should normalize handle while parsing deployment mode');

  const parsedCurl = parseVercelCurlResponse(`Retrieving project...\nHTTP/2 200\r\ncache-control: no-store\r\ncontent-type: application/json; charset=utf-8\r\n\r\n{"ok":true}`);
  assert(parsedCurl.response.status === 200, 'vercel curl parser should read HTTP status');
  assert(parsedCurl.response.headers.get('cache-control') === 'no-store', 'vercel curl parser should expose response headers');
  assert(parsedCurl.body === '{"ok":true}', 'vercel curl parser should isolate the response body');
  assert(launchAuditSource.includes("path: '/api/sync'") && launchAuditSource.includes("Authorization: 'Bearer a.b.c'"), 'launch audit should probe public sync failure without exposing env names');
  assert(launchAuditSource.includes("path: '/api/me'") && launchAuditSource.includes("Cookie: 'vibestats_auth=a.b.c'"), 'launch audit should probe session failure without exposing env names');
  assert(launchAuditSource.includes("label: 'weekly digest cron guard'"), 'launch audit should probe the weekly digest cron guard without exposing env names');
  console.log('ok launch audit supports protected Vercel previews');
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
    'CRON_SECRET',
    'RESEND_API_KEY',
    'DIGEST_FROM_EMAIL',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const { identityReadiness, hasStrongSessionSecret } = await import('../api/_lib/identity-readiness.js');
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
    assert(hasStrongSessionSecret() === false, 'identity readiness should reject short session secrets');
    response = callStatusEndpoint();
    assert(response.body.profile_save_available === false, 'identity status endpoint should stay unavailable with a weak session secret');

    process.env.AUTH_SECRET = 'session-secret-with-at-least-32-bytes';
    response = callStatusEndpoint();
    assert(response.body.profile_save_available === true, 'identity status endpoint should report available profile saves with required env');
    assert(response.body.weekly_digest_available === false, 'identity status endpoint should not claim digest delivery without digest env');
    assert(response.body.message === null, 'identity status endpoint should not show unavailable copy when ready');
    process.env.CRON_SECRET = 'cron-secret';
    process.env.RESEND_API_KEY = 'resend-secret';
    process.env.DIGEST_FROM_EMAIL = 'digest@example.com';
    response = callStatusEndpoint();
    assert(response.body.weekly_digest_available === true, 'identity status endpoint should report digest delivery when digest env is configured');
    console.log('ok identity readiness endpoint reports deployment state without secrets');
  } finally {
    restoreEnv();
  }
}

async function assertOAuthReturnHandling() {
  const { default: startHandler, returnToFromRequest } = await import('../api/auth/github/start.js');
  const { default: callbackHandler } = await import('../api/auth/github/callback.js');
  const { OAUTH_STATE_COOKIE, decodeStatePayload } = await import('../api/_lib/auth.js');
  const { safeReturnTo } = await import('../api/_lib/http.js');
  assert(returnToFromRequest({
    query: { returnTo: '/u/brightseth?from=card' },
    headers: { host: 'localhost:3000' },
  }) === '/u/brightseth?from=card', 'OAuth start should honor safe explicit returnTo with query');
  assert(returnToFromRequest({
    query: {},
    headers: {
      host: 'localhost:3000',
      referer: 'http://localhost:3000/?compareTo=brightseth&compareArchetype=builder',
    },
  }) === '/?compareTo=brightseth&compareArchetype=builder', 'OAuth start should preserve same-origin comparison query from referer');
  assert(returnToFromRequest({
    query: {},
    headers: {
      host: 'localhost:3000',
      referer: 'https://attacker.example/?compareTo=brightseth',
    },
  }) === '/', 'OAuth start should ignore cross-origin referer fallback');
  assert(returnToFromRequest({
    query: { returnTo: 'https://attacker.example/' },
    headers: {
      host: 'localhost:3000',
      referer: 'http://localhost:3000/settings',
    },
  }) === '/settings', 'OAuth start should reject unsafe explicit returnTo and fall back to same-origin referer');
  assert(safeReturnTo('/api/me', '/') === '/', 'OAuth return handling should still reject generic API return targets');
  assert(
    safeReturnTo('/api/cli/local-token?callback=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&nonce=abcdefghijklmnopqrstuvwxyz', '/') === '/api/cli/local-token?callback=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&nonce=abcdefghijklmnopqrstuvwxyz',
    'OAuth return handling should allow the CLI local-token approval endpoint',
  );

  const keys = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'VIBE_SESSION_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.POSTGRES_URL = 'postgres://user:password@example.invalid/db';
    process.env.GITHUB_CLIENT_ID = 'github-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.AUTH_SECRET = 'smoke-test-secret-with-at-least-32-bytes';
    const res = mockRes();
    startHandler({
      method: 'GET',
      query: {},
      headers: {
        host: 'localhost:3000',
        referer: 'http://localhost:3000/?compareTo=brightseth&compareArchetype=builder',
      },
    }, res);
    const cookie = Array.isArray(res.headers['Set-Cookie']) ? res.headers['Set-Cookie'][0] : res.headers['Set-Cookie'];
    const encodedValue = String(cookie || '').match(new RegExp(`${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1] || '';
    const statePayload = decodeStatePayload(decodeURIComponent(encodedValue));
    assert(res.statusCode === 302, 'OAuth start handler should redirect when identity env is ready');
    assert(String(res.body).startsWith('https://github.com/login/oauth/authorize?'), 'OAuth start handler should redirect to GitHub');
    const redirectUrl = new URL(String(res.body));
    assert(redirectUrl.searchParams.get('scope') === '', 'OAuth start should request identity-only GitHub access with no repo, email, or commit scopes');
    assert(statePayload?.returnTo === '/?compareTo=brightseth&compareArchetype=builder', 'OAuth start handler should persist comparison returnTo in state cookie');
    assert(decodeStatePayload(decodeURIComponent(encodedValue).replace(/\.[^.]+$/, '.tampered')) === null, 'OAuth state cookie should reject signature tampering');
    assert(decodeStatePayload(Buffer.from(JSON.stringify({ state: 'fake', returnTo: '/settings' })).toString('base64url')) === null, 'OAuth state cookie should reject unsigned legacy payloads');

    const callbackRes = mockRes();
    await callbackHandler({
      method: 'GET',
      query: { code: 'oauth-code', state: 'mismatched-state' },
      headers: { host: 'localhost:3000' },
    }, callbackRes);
    assert(callbackRes.statusCode === 400, 'OAuth callback should reject invalid state when identity env is ready');
    assert(callbackRes.body === 'Invalid GitHub OAuth state', 'OAuth callback should keep invalid-state failures generic');
    assertNoStore(callbackRes, 'OAuth callback invalid state');
  } finally {
    for (const key of keys) {
      if (previous[key] == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
  console.log('ok OAuth return handling preserves viral intent safely');
}

async function assertCliLocalTokenEndpoint() {
  const {
    default: handler,
    allowedLocalCallback,
    isValidCliNonce,
    localTokenPath,
    localTokenRedirectUrl,
  } = await import('../api/cli/local-token.js');
  const callback = 'http://127.0.0.1:49152/callback';
  const nonce = 'abcdefghijklmnopqrstuvwxyz';

  assert(allowedLocalCallback(callback)?.hostname === '127.0.0.1', 'CLI local token endpoint should accept 127.0.0.1 callbacks');
  assert(allowedLocalCallback('http://localhost:49152/callback')?.hostname === 'localhost', 'CLI local token endpoint should accept localhost callbacks');
  assert(!allowedLocalCallback('https://127.0.0.1:49152/callback'), 'CLI local token endpoint should reject https callbacks because the CLI server is local http');
  assert(!allowedLocalCallback('http://attacker.example:49152/callback'), 'CLI local token endpoint should reject non-local callbacks');
  assert(!allowedLocalCallback('http://127.0.0.1:49152/other'), 'CLI local token endpoint should reject unexpected callback paths');
  assert(!allowedLocalCallback('http://127.0.0.1:49152/callback?next=https://attacker.example'), 'CLI local token endpoint should reject prefilled callback query strings');
  assert(isValidCliNonce(nonce) && !isValidCliNonce('short'), 'CLI local token endpoint should require high-entropy nonce shape');

  const returnPath = localTokenPath(callback, nonce);
  assert(returnPath.startsWith('/api/cli/local-token?'), 'CLI local token return path should stay same-origin');
  assert(returnPath.includes('callback=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback'), 'CLI local token return path should preserve callback URL');
  const redirect = new URL(localTokenRedirectUrl({
    callback,
    token: 'sync-token',
    host: 'https://vibestats.io',
    expiresAt: '2026-06-01T00:00:00.000Z',
    handle: 'brightseth',
    nonce,
  }));
  assert(redirect.origin === 'http://127.0.0.1:49152', 'CLI token redirect should return to the local callback origin');
  assert(redirect.searchParams.get('token') === 'sync-token', 'CLI token redirect should carry the sync token only to localhost');
  assert(redirect.searchParams.get('host') === 'https://vibestats.io', 'CLI token redirect should tell the CLI which vibestats host minted the token');
  assert(redirect.searchParams.get('nonce') === nonce, 'CLI token redirect should echo the nonce');

  const invalidRes = mockRes();
  await handler({
    method: 'GET',
    query: { callback: 'https://attacker.example/callback', nonce },
    headers: { host: 'localhost:3000' },
  }, invalidRes);
  assert(invalidRes.statusCode === 400, 'CLI local token endpoint should reject invalid callbacks before auth');
  assertNoStore(invalidRes, 'CLI local token invalid callback');

  const unauthRes = mockRes();
  await handler({
    method: 'GET',
    query: { callback, nonce },
    headers: { host: 'localhost:3000' },
  }, unauthRes);
  assert(unauthRes.statusCode === 302, 'CLI local token endpoint should route unauthenticated users to GitHub OAuth');
  assert(String(unauthRes.body).startsWith('/api/auth/github/start?returnTo='), 'CLI local token OAuth redirect should preserve the local approval return path');
  assertNoStore(unauthRes, 'CLI local token unauthenticated redirect');

  const methodRes = mockRes();
  await handler({
    method: 'PUT',
    query: { callback, nonce },
    headers: { host: 'localhost:3000' },
  }, methodRes);
  assert(methodRes.statusCode === 405 && methodRes.headers.Allow === 'GET, POST', 'CLI local token endpoint should guard unsupported methods');
  assertNoStore(methodRes, 'CLI local token method guard');
  console.log('ok CLI browser auth endpoint guards local token minting');
}

async function assertProfileShareLoop() {
  const indexHtml = await readFile('index.html', 'utf8');
  const profileHtml = await readFile('u.html', 'utf8');
  assert(profileHtml.includes('compareTo=${encodeURIComponent(handle)}'), 'profile compare CTA should seed upload-to-compare');
  assert(profileHtml.includes("return new URL(pathOrUrl || '/', 'https://vibestats.io').toString();"), 'profile outgoing share URLs should canonicalize to vibestats.io');
  assert(profileHtml.includes('const uploadCompareUrl = canonicalVibestatsUrl(uploadComparePath);'), 'profile copied invites should use canonical compare URLs');
  assert(profileHtml.includes('profileInviteText(handle, latest, profileUrl, uploadCompareUrl, profile)'), 'profile copy action should use direct asymmetric compare invite text');
  assert(profileHtml.includes('Profile: ${profileUrl}'), 'profile invite copy should retain the profile as credential context');
  assert(profileHtml.includes('https://twitter.com/intent/tweet?text='), 'profile UI should include X share intent');
  assert(profileHtml.includes('url=${encodeURIComponent(uploadCompareUrl)}'), 'profile X share should click through directly to upload-to-compare');
  assert(profileHtml.includes('Profile: ${profileUrl}'), 'profile X share should retain the profile as credential context');
  assert(profileHtml.includes('Copy invite'), 'profile share button should invite comparison');
  assert(profileHtml.includes('id="sync-cta"') && profileHtml.includes('set up CLI sync for weekly profile updates'), 'owner profile should expose return-loop CLI sync setup');
  assert(profileHtml.includes('](${uploadCompareUrl})'), 'profile badge markdown should click through to upload-to-compare');
  assert(profileHtml.includes('id="reveal-panel"') && profileHtml.includes('renderRevealPanel(me, profile, latest)'), 'profile pages should show share recipients a direct reveal panel');
  assert(profileHtml.includes('Claude Code has already captured your build fingerprint') && profileHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity sync'), 'profile reveal panel should carry the command path without sending visitors hunting');
  assert(profileHtml.includes("document.execCommand('copy')"), 'profile copy actions should fall back when Clipboard API is unavailable');
  assert(profileHtml.includes('profileProofLine(profile)'), 'profile share copy should include scarcity or leaderboard social proof');
  assert(indexHtml.includes("const PENDING_UPLOAD_KEY = 'vibestats_pending_upload'"), 'upload page should persist pending derived saves across auth');
  assert(indexHtml.includes('Only derived profile data is persisted here. Raw insights JSON is never stored.'), 'pending auth save must document derived-only storage');
  assert(indexHtml.includes('resumePendingProfileSave'), 'upload page should resume pending profile save after auth');
  assert(indexHtml.includes('/pair/${encodeURIComponent'), 'upload-to-compare should route to handle-backed pairing');
  assert(indexHtml.includes('digest-email-inline'), 'post-save profile flow should offer weekly digest opt-in');
  assert(indexHtml.includes('weekly_digest_opt_in: true'), 'inline digest opt-in should use settings API');
  assert(indexHtml.includes('postSaveInviteText(profilePath, comparePath, archetype, scores)'), 'post-save save state should copy asymmetric profile invite text');
  assert(indexHtml.includes('comparePathFromSave(result.compare_url, archetype)'), 'post-save invite copy should use compare-first URL returned by save APIs');
  assert(indexHtml.includes('return `${parsed.pathname}${parsed.search}${parsed.hash}`'), 'post-save save state must preserve query params from API compare URLs');
  assert(indexHtml.includes('Profile: ${canonicalVibestatsUrl(profilePath)}'), 'post-save invite copy should retain the profile credential link');
  assert(indexHtml.includes("document.execCommand('copy')"), 'upload/post-save copy actions should fall back when Clipboard API is unavailable');
  assert(indexHtml.includes('url=${encodeURIComponent(shareClickUrl)}'), 'archetype result X share should click through directly to comparison');
  assert(indexHtml.includes("copyShareLink(this, '${shareClickUrl}')"), 'archetype result copy button should copy the comparison entry point');
  assert(indexHtml.includes('Profile: ${profileShareUrl}'), 'saved result X share should retain the profile as credential context');
  assert(indexHtml.includes('Card: ${cardShareUrl}'), 'ephemeral result X share should retain the share card as credential context');
  assert(indexHtml.includes('id="copy-saved-badge"'), 'post-save save state should expose portable badge copy');
  assert(indexHtml.includes('](${canonicalCompare})'), 'post-save badge markdown should click through to upload-to-compare');
  assert(indexHtml.includes('id="copy-saved-embed"'), 'post-save save state should expose portable embed copy');
  assert(indexHtml.includes('id="copy-saved-profile"'), 'post-save save state should expose profile URL copy');
  assert(indexHtml.includes('href="/settings#cli-sync"'), 'post-save save state should route owners into CLI sync setup');
  assert(indexHtml.includes('Create pairing link'), 'post-save save state should prompt owners to create pairing links');
  assert(indexHtml.includes('<a class="auth-pill" href="/browse">Browse</a>'), 'upload page should expose public browse loop');
  assert(indexHtml.includes("See how you'd pair with this archetype:"), 'ephemeral share copy should drive card recipients into comparison');
  assert(indexHtml.includes('Compare with this archetype:'), 'ephemeral share variants should avoid passive homepage discovery copy');
  assert(indexHtml.includes("return { kind: 'archetype', archetype }"), 'upload page should support archetype-only comparison intake');
  assert(indexHtml.includes('Compare with The ${archetypeDisplayName(intent.archetype)}'), 'archetype-only intake should frame upload as comparison');
  assert(indexHtml.includes('comparisonTargetLabel(intent)'), 'upload-to-compare save status should label profile and archetype comparison targets');
  assert(!indexHtml.includes('Opening your pairing with @${comparisonIntent().handle}'), 'upload-to-compare save status must not render @undefined for archetype comparisons');
  assert(indexHtml.includes('const compareHref = comparisonIntent()'), 'result card compare button should honor upload-to-compare intake');
  assert(indexHtml.includes('/compare?a=${encodeURIComponent(archetype)}&b=${encodeURIComponent(intent.handle)}'), 'anonymous upload-to-profile comparison links should preserve the host profile identity');
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
  assert(compareHtml.includes('comparisonInviteText(aSubject, bSubject, compat, shareUrl)'), 'compare result should build portable invite copy');
  assert(compareHtml.includes('const claimUrl = absoluteUrl(claimAction.href)'), 'compare result X share should derive a direct claim URL');
  assert(compareHtml.includes('url=${encodeURIComponent(claimUrl)}'), 'compare result X share should click through to the comparison claim target');
  assert(compareHtml.includes('copyComparisonInvite(this)'), 'compare result should copy invite text, not just a bare URL');
  assert(compareHtml.includes("document.execCommand('copy')"), 'compare invite copy should fall back when Clipboard API is unavailable');
  assert(compareHtml.includes('Copy invite'), 'compare result copy action should be framed as an invite');
  assert(compareHtml.includes('${esc(claimAction.label)} &rarr;'), 'compare result should render the computed claim CTA label');
  console.log('ok compare share loop claims profile-backed comparisons');
}

async function assertShareCardCta() {
  const { default: handler, sanitizeCardQuery } = await import('../api/card.js');
  const sanitized = sanitizeCardQuery({
    a: 'growth-hacker',
    n: `${'A'.repeat(80)}\n<script>`,
    d: '9000',
    c: '<script>',
    l: '201',
    s: '100001',
    sat: '101',
    p: '0',
    secret: 'raw-json-should-not-propagate',
  });
  assert(sanitized.archetypeKey === 'builder', 'share card should default unknown archetypes to the canon');
  assert(sanitized.name.length <= 42 && !sanitized.name.includes('<script>'), 'share card should bound and sanitize display names');
  assert(sanitized.days === '5000', 'share card should clamp day counts');
  assert(sanitized.commits === '?', 'share card should reject invalid commit metrics');
  assert(sanitized.langs === '200', 'share card should clamp language counts');
  assert(sanitized.sessions === '100000', 'share card should clamp session counts');
  assert(sanitized.satisfaction === '100', 'share card should clamp satisfaction');
  assert(sanitized.percentile === '1', 'share card should clamp percentile');
  assert(!sanitized.queryString.includes('secret') && !sanitized.queryString.includes('raw-json'), 'share card should not propagate unknown query params into metadata URLs');

  let statusCode = 0;
  let body = '';
  const req = {
    method: 'GET',
    query: {
      a: 'deepdiver',
      n: 'Alex',
      d: '30',
      c: '8',
      l: '4',
      s: '120',
      secret: 'raw-json-should-not-propagate',
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
  assert(!body.includes('raw-json-should-not-propagate'), 'share card HTML should only use sanitized allowlisted query params');

  const methodRes = mockRes();
  handler({ method: 'POST', query: {}, headers: { host: 'localhost:3000' } }, methodRes);
  assert(methodRes.statusCode === 405, 'share card should reject non-GET methods');
  assert(methodRes.headers.Allow === 'GET', 'share card should advertise GET-only access');
  assertNoStore(methodRes, 'share card method guard');
  console.log('ok legacy share card routes visitors into comparison');
}

async function assertOgFallback() {
  const { default: handler, sanitizeOgQuery, sendFallbackOg } = await import('../api/og.js');
  const archetype = sanitizeOgQuery({
    mode: '<script>',
    a: 'growth-hacker',
    n: '<script>\nAlexAlexAlexAlexAlexAlexAlexAlexAlexAlexAlex',
    d: '9000',
    c: 'not-a-number',
    l: '201',
    s: '100001',
  });
  assert(archetype.mode === 'archetype', 'OG sanitizer should ignore unknown modes');
  assert(archetype.aKey === 'builder', 'OG sanitizer should default unknown archetypes to the canon');
  assert(archetype.name.length <= 42 && !archetype.name.includes('<'), 'OG sanitizer should bound and clean names');
  assert(archetype.days === '5000', 'OG sanitizer should clamp day counts');
  assert(archetype.commits === '?', 'OG sanitizer should reject invalid commit metrics');
  assert(archetype.langs === '200', 'OG sanitizer should clamp language counts');
  assert(archetype.sessions === '100000', 'OG sanitizer should clamp session counts');
  const pair = sanitizeOgQuery({
    mode: 'pair',
    a: 'builder',
    b: 'growth-hacker',
    an: '<img src=x onerror=alert(1)>',
    bn: '',
  });
  assert(pair.mode === 'pair', 'OG sanitizer should preserve pair mode');
  assert(pair.aKey === 'builder' && pair.bKey === 'shipper', 'OG sanitizer should default invalid pair archetypes');
  assert(!pair.aLabel.includes('<') && !pair.aLabel.includes('>'), 'OG sanitizer should clean pair labels');
  assert(pair.bLabel === 'SHIPPER', 'OG sanitizer should use archetype fallback labels for blank pair labels');

  let statusCode = 0;
  let contentType = '';
  let cacheControl = '';
  let body = null;
  const originalError = console.error;
  console.error = () => {};
  try {
    sendFallbackOg({
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'cache-control') cacheControl = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      send(value) {
        body = value;
      },
    });
  } finally {
    console.error = originalError;
  }

  assert(statusCode === 200, 'OG fallback should preserve successful image responses');
  assert(contentType === 'image/png', 'OG fallback should return PNG content');
  assert(cacheControl.includes('s-maxage=60'), 'OG fallback should use short cache');
  assert(Buffer.isBuffer(body) && body.length > 1000, 'OG fallback should send the static share image');
  const methodRes = mockRes();
  await handler({ method: 'POST', query: {}, headers: { host: 'localhost:3000' } }, methodRes);
  assert(methodRes.statusCode === 405, 'OG image endpoint should reject non-GET methods');
  assert(methodRes.headers.Allow === 'GET', 'OG image endpoint should advertise GET-only access');
  assertNoStore(methodRes, 'OG image method guard');
  console.log('ok OG image inputs are bounded and failures fall back without stack traces');
}

async function assertStatsApiGuards() {
  const { default: handler } = await import('../api/stats.js');

  const optionsRes = mockRes();
  await handler({ method: 'OPTIONS', query: {}, headers: { host: 'localhost:3000' } }, optionsRes);
  assert(optionsRes.statusCode === 200, 'stats preflight should return HTTP 200');
  assertNoStore(optionsRes, 'stats preflight');

  const methodRes = mockRes();
  await handler({ method: 'DELETE', query: {}, headers: { host: 'localhost:3000' } }, methodRes);
  assert(methodRes.statusCode === 405, 'stats API should reject unsupported methods');
  assert(methodRes.headers.Allow === 'GET, POST, OPTIONS', 'stats API should advertise supported methods');
  assertNoStore(methodRes, 'stats method guard');

  const originRes = mockRes();
  await handler({
    method: 'POST',
    query: {},
    headers: {
      host: 'localhost:3000',
      origin: 'https://attacker.example',
    },
  }, originRes);
  assert(originRes.statusCode === 403, 'stats POST should reject cross-origin mutations');
  assertNoStore(originRes, 'stats cross-origin mutation');
  console.log('ok stats API mutations and method guards are no-store');
}

async function assertWrappedShareLoop() {
  const wrappedHtml = await readFile('wrapped.html', 'utf8');
  assert(wrappedHtml.includes('/?compareArchetype=orchestrator'), 'wrapped CTA should route to upload-to-compare');
  assert(wrappedHtml.includes('wrappedCompareUrl'), 'wrapped page should centralize the compare-first share target');
  assert(wrappedHtml.includes("'&url=' + encodeURIComponent(wrappedCompareUrl)"), 'wrapped X share should click through directly to upload-to-compare');
  assert(wrappedHtml.includes('navigator.clipboard.writeText(wrappedCompareUrl)'), 'wrapped copy link should copy the upload-to-compare target');
  assert(wrappedHtml.includes('Card: ${wrappedUrl}'), 'wrapped share text should retain the card as credential context');
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

async function assertBehavioralMoments() {
  const { buildBehavioralMoments, publicMoments, sanitizeMoments } = await import('../api/_lib/moments.js');
  const moments = buildBehavioralMoments({
    metrics: {
      longest_session_minutes: 640,
      files_modified: 88,
      lines_changed: 12000,
      task_agent_sessions: 5,
      buggy_code_events: 7,
      tool_usage: { bash: 2450, read: 99 },
    },
  });
  assert(moments.length === 3, 'behavioral moments should keep the top three derived moments');
  assert(moments.some((moment) => moment.id === 'longest_session_minutes'), 'behavioral moments should include marathon sessions');
  assert(!JSON.stringify(moments).includes('read') && !JSON.stringify(moments).includes('tool_usage'), 'behavioral moments must not expose raw tool maps');
  const sanitized = sanitizeMoments([
    { id: 'terminal_commands', value: 2450, prompt: 'private prompt' },
    { id: 'unknown', value: 999999 },
    { id: 'files_modified', value: -10 },
    { id: 'longest_session_minutes', value: 999999 },
  ]);
  assert(sanitized.length === 2, 'moment sanitizer should keep only known thresholded moment ids');
  assert(sanitized[1].value === 4320, 'moment sanitizer should clamp extreme values');
  assert(!JSON.stringify(sanitized).includes('private prompt'), 'moment sanitizer must not echo arbitrary text');
  const publicView = publicMoments([{ id: 'terminal_commands', value: 2450 }]);
  const exactView = publicMoments([{ id: 'terminal_commands', value: 2450 }], { exact: true });
  assert(publicView[0].value === '1k+ commands', 'public moments should bucket values by default');
  assert(exactView[0].value === '2,450 Bash commands', 'owner/raw-count moments should expose exact derived values');
  console.log('ok behavioral moments stay derived and bucketed');
}

async function assertUploadSanitizer() {
  const { sanitizeUploadPayload } = await import('../api/_lib/uploads.js');
  const payload = sanitizeUploadPayload({
    archetype: 'architect',
    scores: {
      builder: 200,
      shipper: 80,
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
      messages: 999999,
      messagesPerDay: 999,
      commandsPerDay: 888,
      satisfaction: 95,
      multiClauding: 12,
      frictionEvents: 4,
      topLang: 'typescript',
      raw: { should: 'drop' },
    },
    raw_meta: {
      dateRange: '2026-01-01 to 2026-01-09',
      source: 'rawJson',
      version: 'rawJson',
      moments: [
        { id: 'terminal_commands', value: 2450, prompt: 'private prompt should drop' },
        { id: 'unknown', value: 99999 },
      ],
      signature: 'rawJson Builder',
      signatureCombo: 'rawJson+builder',
      signatureFingerprint: 'rawJson:90s',
      secondaryArchetype: 'rawJson',
      rawJson: { should: 'drop' },
    },
  });

  assert(payload.scores.builder === 100, 'scores should clamp to 100');
  assert(payload.scores.orchestrator === 0, 'scores should clamp to 0');
  assert(payload.archetype === 'builder', 'profile save archetype should be derived from sanitized scores');
  assert(payload.metrics.languages === 4, 'derived languages metric should persist');
  assert(Object.keys(payload.metrics).sort().join(',') === 'commitsPerDay,days,languages,msgsPerSession,sessions', 'profile saves should persist only the five Wave 1 metrics');
  assert(!('raw' in payload.metrics), 'raw metric payload must be dropped');
  assert(!('topLang' in payload.metrics), 'profile saves should not persist language detail');
  assert(!('messages' in payload.metrics), 'profile saves should not persist extended private counters');
  assert(payload.raw_meta.signature === 'high-velocity Builder', 'signature metadata should be derived from sanitized scores');
  assert(payload.raw_meta.signatureCombo === 'shipper+builder', 'signature combo should be derived from sanitized scores');
  assert(payload.raw_meta.signatureFingerprint === 'builder+shipper+orchestrator:90s', 'signature fingerprint should be derived from sanitized scores');
  assert(payload.raw_meta.secondaryArchetype === 'shipper', 'secondary archetype metadata should be derived from sanitized scores');
  assert(payload.raw_meta.moments?.[0]?.id === 'terminal_commands' && payload.raw_meta.moments[0].value === 2450, 'upload sanitizer should keep only safe derived behavioral moment ids and values');
  assert(payload.raw_meta.source === 'browser', 'browser upload source should be assigned by the endpoint sanitizer');
  assert(payload.raw_meta.version === 'wave-1', 'upload metadata version should be assigned by the endpoint sanitizer');
  assert(!('rawJson' in payload.raw_meta), 'raw_meta allowlist must drop unknown fields');
  assert(!JSON.stringify(payload.raw_meta).includes('private prompt'), 'upload sanitizer must not echo arbitrary moment text');
  assert(!JSON.stringify(payload.raw_meta).includes('rawJson'), 'upload sanitizer must not trust client-supplied signature metadata');

  const cliPayload = sanitizeUploadPayload({ ...payload, raw_meta: { source: 'browser' } }, { source: 'cli' });
  assert(cliPayload.raw_meta.source === 'cli', 'CLI upload source should be assigned by the sync endpoint sanitizer');
  assert(cliPayload.archetype === 'builder', 'CLI upload archetype should use the same canonical score-derived primary');
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
      orchestrator: 61,
      rawJson: { should: 'drop' },
      _percentiles: { builder: 4, rawJson: 1 },
    },
    metrics: {
      days: 31,
      commitsPerDay: 12.4,
      sessions: 88,
      messages: 999999,
      messagesPerDay: 999,
      commandsPerDay: 888,
      satisfaction: 95,
      multiClauding: 12,
      frictionEvents: 4,
      topLang: ' typescript ',
      raw: { should: 'drop' },
      tool_usage: { bash: 9000 },
    },
    raw_meta: {
      dateRange: '2026-05-01 to 2026-05-28',
      source: 'browser',
      signature: 'spoofed Builder',
      signatureCombo: 'architect+builder',
      signatureFingerprint: 'architect+builder+shipper:90s',
      secondaryArchetype: 'architect',
      moments: [
        { id: 'terminal_commands', value: 2450, prompt: 'private prompt should drop' },
        { id: 'unknown', value: 99999 },
      ],
      rawJson: { should: 'drop' },
      language_usage: { typescript: 9000 },
    },
    uploaded_at: '2026-05-28T10:00:00.000Z',
  });

  assert(upload.id === 'upload-1', 'export upload should retain upload id for the owner archive');
  assert(upload.scores.builder === 92, 'export upload should retain derived archetype scores');
  assert(upload.scores._percentiles.builder === 4, 'export upload should retain derived percentiles');
  assert(!('topLang' in upload.metrics), 'export upload should not include language detail');
  assert(!('messages' in upload.metrics), 'export upload should not include extended private counters');
  assert(upload.raw_meta.signature === 'high-velocity Builder', 'export upload should derive signature metadata from scores');
  assert(upload.raw_meta.signatureCombo === 'shipper+builder', 'export upload should derive signature combos from scores');
  assert(upload.raw_meta.signatureFingerprint === 'builder+shipper+orchestrator:90s', 'export upload should derive signature fingerprints from scores');
  assert(upload.raw_meta.secondaryArchetype === 'shipper', 'export upload should derive secondary archetype from scores');
  assert(upload.raw_meta.moments?.[0]?.id === 'terminal_commands', 'export upload should retain sanitized derived behavioral moments');
  assert(!JSON.stringify(upload.raw_meta).includes('private prompt'), 'export upload must not echo arbitrary moment text');
  assert(!JSON.stringify(upload).includes('spoofed'), 'export upload must not echo stored spoofed signature text');
  assert(!JSON.stringify(upload).includes('tool_usage'), 'export upload must not include raw tool usage');
  assert(!JSON.stringify(upload).includes('language_usage'), 'export upload must not include raw language usage');
  assert(!JSON.stringify(upload).includes('rawJson'), 'export upload must not include raw JSON fields');
  console.log('ok settings export upload sanitizer preserves derived-only archive');
}

async function assertCliDerivedPayload() {
  const cliSource = await readFile('bin/vibestats.js', 'utf8');
  const { derivedUploadPayloadFromInsights } = await import('../lib/insights-derived.js');
  const { insightsFromClaudeUsageDirectory } = await import('../lib/claude-insights-extractor.js');
  const insights = {
    meta: { user: 'Alex Chen', date_range: '2025-12-01 to 2026-01-15' },
    metrics: {
      total_sessions: 280,
      total_messages: 3360,
      commits: 980,
      satisfaction_rate: 0.85,
      multi_clauding_rate: 0.03,
      buggy_code_events: 8,
      longest_session_minutes: 640,
      files_modified: 88,
      lines_changed: 12000,
      task_agent_sessions: 9,
      tool_usage: { bash: 6000, read: 4000, edit: 5500, write: 4200, grep: 300 },
      language_usage: { typescript: 45000, javascript: 8000, css: 2000 },
    },
  };
  const payload = derivedUploadPayloadFromInsights(insights);
  assert(payload.archetype === 'shipper', 'CLI derived scoring should match browser shipper fixture');
  assert(payload.metrics.sessions === 280, 'CLI derived payload should include derived session count');
  assert(payload.raw_meta.source === 'cli', 'CLI derived payload should mark source as cli');
  assert(payload.raw_meta.signatureFingerprint, 'CLI derived payload should include rarity fingerprint');
  assert(payload.raw_meta.moments?.length === 3, 'CLI derived payload should include top derived behavioral moments');
  assert(payload.raw_meta.moments.some((moment) => moment.id === 'longest_session_minutes'), 'CLI derived payload should include marathon-session moments');
  assert(!JSON.stringify(payload).includes('tool_usage'), 'CLI derived payload must not include raw tool usage');

  const { DEFAULT_NPX_SYNC_COMMAND, authUrlForLocalCallback, isDirectRun, normalizeHost, parseArgs, requestSyncToken, sync } = await import('../bin/vibestats.js');
  const parsed = parseArgs(['node', 'vibestats', 'sync', '--dry-run']);
  assert(parsed.options.dryRun === true, 'CLI sync should parse dry-run mode');
  assert(parsed.options.file.endsWith(join('.claude', 'usage-data')), 'CLI sync should default to the real Claude Code /insights output directory');
  assert(DEFAULT_NPX_SYNC_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity sync', 'CLI should expose the current GitHub-backed npx command');
  assert(cliSource.includes('It reveals your archetype locally before asking for approval to publish it.'), 'CLI help should frame sync as reveal-before-publish');
  const parsedNoOpen = parseArgs(['node', 'vibestats', 'sync', '--no-open', '--auth-timeout-ms', '1000']);
  assert(parsedNoOpen.options.openBrowser === false && parsedNoOpen.options.authTimeoutMs === 1000, 'CLI sync should parse manual browser auth options');
  assert(normalizeHost('https://vibestats.example/path?q=1#x') === 'https://vibestats.example', 'CLI sync should normalize host URLs before auth and sync');
  const localAuthUrl = authUrlForLocalCallback('https://vibestats.example/', 'http://127.0.0.1:49152/callback', 'abcdefghijklmnopqrstuvwxyz');
  assert(localAuthUrl === 'https://vibestats.example/api/cli/local-token?callback=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&nonce=abcdefghijklmnopqrstuvwxyz', 'CLI sync should build browser auth URLs for localhost callbacks');

  const dir = await mkdtemp(join(tmpdir(), 'vibestats-cli-'));
  const file = join(dir, 'agent-insights.json');
  const usageDir = join(dir, 'usage-data');
  const binSymlink = join(dir, 'vibestats-bin');
  const originalWrite = process.stdout.write;
  const originalFetch = globalThis.fetch;
  const output = [];
  process.stdout.write = (chunk) => {
    output.push(String(chunk));
    return true;
  };
  try {
    await symlink(resolve('bin/vibestats.js'), binSymlink);
    assert(isDirectRun(binSymlink), 'CLI main guard should recognize npm .bin symlinks as direct execution');

    await mkdir(join(usageDir, 'session-meta'), { recursive: true });
    await mkdir(join(usageDir, 'facets'), { recursive: true });
    await writeFile(join(usageDir, 'session-meta', 'one.json'), JSON.stringify({
      session_id: 'one',
      project_path: '/private/project-a',
      start_time: '2026-05-01T10:00:00.000Z',
      user_message_count: 3,
      assistant_message_count: 7,
      tool_counts: { Bash: 10, Read: 4, Write: 3, Edit: 2, Grep: 1, ToolSearch: 99 },
      languages: { TypeScript: 12, Markdown: 4 },
      git_commits: 2,
      uses_task_agent: true,
      duration_minutes: 180,
      files_modified: 12,
      lines_added: 900,
      lines_removed: 150,
      first_prompt: 'private prompt should never leave disk',
    }), 'utf8');
    await writeFile(join(usageDir, 'session-meta', 'two.json'), JSON.stringify({
      session_id: 'two',
      project_path: '/private/project-b',
      start_time: '2026-05-03T10:00:00.000Z',
      user_message_count: 2,
      assistant_message_count: 4,
      tool_counts: { Bash: 2, Read: 6, MultiEdit: 5, Glob: 3 },
      languages: { JavaScript: 8, JSON: 5 },
      git_commits: 1,
      uses_task_agent: false,
      duration_minutes: 55,
      files_modified: 4,
      lines_added: 200,
      lines_removed: 50,
      first_prompt: 'another private prompt',
    }), 'utf8');
    await writeFile(join(usageDir, 'facets', 'one.json'), JSON.stringify({
      session_id: 'one',
      underlying_goal: 'private goal should never leave disk',
      friction_counts: { buggy_code: 2 },
    }), 'utf8');
    await writeFile(join(usageDir, 'report.html'), '<p>16 messages across 2 sessions | 2026-05-01 to 2026-05-03</p>', 'utf8');

    const extracted = await insightsFromClaudeUsageDirectory(usageDir);
    assert(extracted.meta.date_range === '2026-05-01 to 2026-05-03', 'Claude /insights extractor should derive the session date range');
    assert(extracted.metrics.total_sessions === 2, 'Claude /insights extractor should count session-meta files');
    assert(extracted.metrics.total_messages === 16, 'Claude /insights extractor should derive total messages');
    assert(extracted.metrics.commits === 3, 'Claude /insights extractor should derive git commits');
    assert(extracted.metrics.tool_usage.bash === 12 && extracted.metrics.tool_usage.read === 10 && extracted.metrics.tool_usage.edit === 7 && extracted.metrics.tool_usage.grep === 4, 'Claude /insights extractor should normalize tool counts');
    assert(extracted.metrics.language_usage.typescript === 12 && extracted.metrics.language_usage.javascript === 8, 'Claude /insights extractor should normalize language counts');
    assert(extracted.metrics.multi_clauding_rate === 0.5, 'Claude /insights extractor should derive task-agent session rate');
    assert(extracted.metrics.task_agent_sessions === 1, 'Claude /insights extractor should count task-agent sessions for derived moments');
    assert(extracted.metrics.longest_session_minutes === 180, 'Claude /insights extractor should derive longest session length');
    assert(extracted.metrics.files_modified === 16, 'Claude /insights extractor should derive files-modified count');
    assert(extracted.metrics.lines_changed === 1300, 'Claude /insights extractor should derive line-change count');
    assert(extracted.metrics.buggy_code_events === 2, 'Claude /insights extractor should derive friction counts from facets');

    await writeFile(file, JSON.stringify(insights), 'utf8');
    const result = await sync({ file, host: 'https://example.invalid', token: '', dryRun: true });
    assert(result.dry_run === true, 'CLI dry-run should not require a sync token');
    assert(output.join('').includes('"archetype": "shipper"'), 'CLI dry-run should print derived payload JSON');
    assert(!output.join('').includes('tool_usage'), 'CLI dry-run output must not print raw tool usage');
    assert(!output.join('').includes('private prompt') && !output.join('').includes('/private/project'), 'CLI dry-run output must not print raw Claude Code session details');

    output.length = 0;
    const usageResult = await sync({ file: usageDir, host: 'https://example.invalid', token: '', dryRun: true });
    assert(usageResult.payload.metrics.sessions === 2, 'CLI dry-run should parse real /insights directories');
    assert(usageResult.payload.raw_meta.moments?.some((moment) => moment.id === 'longest_session_minutes'), 'CLI dry-run from /insights directory should derive behavioral moments');
    assert(!output.join('').includes('tool_usage') && !output.join('').includes('underlying_goal'), 'CLI dry-run from /insights directory must not print raw usage maps or facet details');

    const authOutput = [];
    const authPromise = requestSyncToken({
      host: 'https://vibestats.example',
      openBrowser: false,
      timeoutMs: 5000,
      stdout: {
        write(chunk) {
          authOutput.push(String(chunk));
          return true;
        },
      },
    });
    for (let i = 0; i < 20 && !authOutput.join('').includes('Authorize here: '); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const authUrlText = authOutput.join('').match(/Authorize here: (https?:\/\/\S+)/)?.[1] || '';
    assert(authUrlText, 'CLI browser auth should print a manual authorization URL');
    const parsedAuthUrl = new URL(authUrlText);
    const callbackUrl = new URL(parsedAuthUrl.searchParams.get('callback'));
    const nonce = parsedAuthUrl.searchParams.get('nonce');
    const callbackParams = new URLSearchParams({
      token: 'browser-sync-token',
      host: 'https://vibestats.example',
      expires_at: '2026-06-01T00:00:00.000Z',
      handle: 'alex',
      nonce,
    });
    const callbackRes = await fetch(`${callbackUrl.toString()}?${callbackParams.toString()}`);
    assert(callbackRes.ok, 'CLI local callback should accept the matching nonce from browser auth');
    const authResult = await authPromise;
    assert(authResult.token === 'browser-sync-token' && authResult.handle === 'alex', 'CLI browser auth should resolve the sync token without printing it');
    assert(!authOutput.join('').includes('browser-sync-token'), 'CLI browser auth output must not print the sync token');

    output.length = 0;
    let postedBody = '';
    globalThis.fetch = async (url, options = {}) => {
      postedBody = String(options.body || '');
      assert(url === 'https://vibestats.example/api/sync', 'CLI sync should post to the selected host');
      assert(['Bearer sync-token', 'Bearer browser-token'].includes(options.headers?.Authorization), 'CLI sync should send bearer token auth');
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            profile_url: '/u/alex',
            compare_url: '/?compareTo=alex&compareArchetype=shipper',
          };
        },
      };
    };
    const syncResult = await sync({ file, host: 'https://vibestats.example', token: 'sync-token', dryRun: false });
    assert(syncResult.compare_url.includes('compareTo=alex'), 'CLI sync should receive compare-first URL from API');
    assert(output.join('').includes('Revealed: prolific Shipper'), 'CLI sync should print the local reveal before publishing');
    assert(output.join('').includes('Raw Claude Code /insights data stayed local. Publishing only derived metrics.'), 'CLI sync should state the privacy boundary before publishing');
    assert(output.join('').includes('Invite people to compare: https://vibestats.example/?compareTo=alex&compareArchetype=shipper'), 'CLI sync should print compare-first invite URL');
    assert(!postedBody.includes('tool_usage') && !postedBody.includes('language_usage'), 'CLI sync request must not post raw usage maps');

    output.length = 0;
    const browserAuthSyncResult = await sync({
      file,
      host: 'https://vibestats.example',
      token: '',
      dryRun: false,
      openBrowser: false,
      requestToken: async ({ host }) => ({ token: 'browser-token', host, handle: 'alex' }),
    });
    assert(browserAuthSyncResult.ok === true, 'CLI sync should use browser authorization when no token is supplied');
    assert(output.join('').includes('Authorized CLI sync as @alex.'), 'CLI sync should confirm browser-authorized handle without printing the token');
  } finally {
    process.stdout.write = originalWrite;
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
  console.log('ok CLI sync derives browser-compatible private payload and prints compare invite');
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
  const { SESSION_COOKIE, createSyncToken, readSession, syncTokenIsRevoked, verifySyncToken } = await import('../api/_lib/auth.js');
  const token = createSyncToken({
    id: '11111111-1111-1111-1111-111111111111',
    gh_handle: 'brightseth',
  });
  const session = verifySyncToken(token);
  assert(session?.sub === '11111111-1111-1111-1111-111111111111', 'sync token sub should round-trip');
  assert(session?.scope === 'sync', 'sync token should carry sync scope');
  assert(session?.typ === 'vibestats_sync', 'sync token should carry sync token type');
  assert(Number.isFinite(session?.iat_ms), 'sync token should carry millisecond issue time for revocation');
  assert(syncTokenIsRevoked(session, new Date(Number(session.iat_ms) - 1)) === false, 'sync token should survive older revocation cutoffs');
  assert(syncTokenIsRevoked(session, new Date(Number(session.iat_ms))) === true, 'sync token should be rejected at or before revocation cutoff');
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
    sync_token_invalidated_at: '2026-05-28T10:00:00.000Z',
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
  assert(ownerSettings.sync_token_invalidated_at === '2026-05-28T10:00:00.000Z', 'owner settings should serialize sync token revocation time');
  assert(ownerSettings.contact_url === 'https://x.com/brightseth', 'owner settings should preserve configured contact URL');
  assert(!Object.hasOwn(publicSettings, 'digest_email'), 'public settings must not serialize digest email');
  assert(!Object.hasOwn(publicSettings, 'weekly_digest_opt_in'), 'public settings must not serialize digest opt-in');
  assert(publicSettings.contact_url === null, 'public settings must hide expired match contact URL');
  assert(publicProfileSettings({ show_raw_counts: true, show_languages: true }).show_languages === true, 'metric visibility should serialize');
  assert(cleanLookingFor('pair-coding') === 'pair-coding', 'looking_for should accept valid values');
  assert(cleanContactUrl('https://x.com/brightseth') === 'https://x.com/brightseth', 'contact URL should normalize valid URL');
  let insecureContactRejected = false;
  try {
    cleanContactUrl('http://x.com/brightseth');
  } catch (err) {
    insecureContactRejected = err.statusCode === 400;
  }
  assert(insecureContactRejected, 'public contact URL should require HTTPS');
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
  assert(publicMatchSettings({
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() + 10000).toISOString(),
    contact_url: 'http://x.com/brightseth',
  }).contact_url === null, 'public match settings should hide legacy insecure contact URLs');
  console.log('ok profile settings helpers');
}

async function assertPublicProfileHelpers() {
  const { metricVisibility, publicScores, publicUpload, uploadRecency } = await import('../api/_lib/public-profile.js');
  const recentUploadAt = new Date().toISOString();
  const upload = {
    id: 'upload-1',
    archetype: 'builder',
    scores: {
      builder: 192,
      shipper: 80,
      orchestrator: 61,
      rawJson: { should: 'drop' },
      _percentiles: { builder: 4, rawJson: 1 },
    },
    metrics: { days: 31, commitsPerDay: 12.4, sessions: 88, languages: 6, msgsPerSession: 9 },
    raw_meta: {
      signature: 'spoofed Builder',
      signatureCombo: 'architect+builder',
      signatureFingerprint: 'architect+builder+shipper:90s',
      secondaryArchetype: 'architect',
      dateRange: 'private range',
      source: 'browser',
      version: 'wave-1',
      moments: [
        { id: 'terminal_commands', value: 2450, prompt: 'private prompt should drop' },
        { id: 'unknown', value: 99999 },
      ],
      rawJson: { should: 'drop' },
      tool_usage: { bash: 9000 },
      language_usage: { typescript: 5000 },
    },
    uploaded_at: recentUploadAt,
  };
  const privateView = publicUpload(upload, metricVisibility({}), { isOwner: false });
  assert(!privateView.id, 'visitor upload payload should not expose upload id');
  assert(privateView.scores.builder === 100, 'visitor upload payload should clamp public archetype scores');
  assert(privateView.scores._percentiles.builder === 4, 'visitor upload payload should retain canonical percentiles');
  assert(!JSON.stringify(privateView.scores).includes('rawJson'), 'visitor upload payload must not echo unknown score fields');
  assert(Object.keys(privateView.metrics).length === 0, 'visitor upload payload should hide exact metrics by default');
  assert(privateView.activity.cadence === 'high-velocity cadence', 'visitor upload payload should include coarse activity');
  assert(privateView.raw_meta.signature === 'high-velocity Builder', 'visitor upload payload should derive signature metadata from scores');
  assert(privateView.raw_meta.signatureCombo === 'shipper+builder', 'visitor upload payload should derive signature combos from scores');
  assert(privateView.raw_meta.secondaryArchetype === 'shipper', 'visitor upload payload should derive secondary archetype from scores');
  assert(!('signatureFingerprint' in privateView.raw_meta), 'visitor upload payload should hide internal rarity fingerprint');
  assert(privateView.raw_meta.moments?.[0]?.value === '1k+ commands', 'visitor upload payload should expose bucketed behavioral moments');
  assert(!JSON.stringify(privateView.raw_meta.moments).includes('2450'), 'visitor behavioral moments should hide exact counts by default');
  assert(!Object.hasOwn(privateView, 'uploaded_at'), 'visitor upload payload must not expose exact upload timestamp');
  assert(privateView.updated.label === 'updated this week', 'visitor upload payload should expose bucketed freshness');
  assert(!('dateRange' in privateView.raw_meta), 'visitor upload payload should omit raw date metadata');
  assert(!JSON.stringify(privateView).includes('tool_usage'), 'visitor upload payload must not expose raw tool usage');
  assert(!JSON.stringify(privateView).includes('language_usage'), 'visitor upload payload must not expose raw language usage');
  const countsView = publicUpload(upload, metricVisibility({ show_raw_counts: true, show_languages: true }), { isOwner: false });
  assert(countsView.metrics.days === 31, 'opt-in public view should expose raw counts');
  assert(countsView.metrics.languages === 6, 'opt-in public view should expose language count');
  assert(countsView.raw_meta.moments?.[0]?.value === '2,450 Bash commands', 'opt-in public raw counts should expose exact derived moment values');
  const ownerView = publicUpload(upload, metricVisibility({}, { isOwner: true }), { isOwner: true });
  assert(ownerView.id === 'upload-1', 'owner upload payload should retain upload id');
  assert(!JSON.stringify(ownerView.scores).includes('rawJson'), 'owner upload payload must not echo unknown score fields');
  assert(ownerView.uploaded_at === recentUploadAt, 'owner upload payload should retain exact upload timestamp');
  assert(ownerView.raw_meta.dateRange === 'private range', 'owner upload payload should retain full derived metadata');
  assert(ownerView.raw_meta.signatureFingerprint === 'builder+shipper+orchestrator:90s', 'owner upload payload should retain internal rarity fingerprint');
  assert(ownerView.raw_meta.source === 'browser' && ownerView.raw_meta.version === 'wave-1', 'owner upload payload should retain derived source metadata');
  assert(ownerView.raw_meta.moments?.[0]?.value === '2,450 Bash commands', 'owner upload payload should retain exact derived behavioral moments');
  assert(!JSON.stringify(ownerView.raw_meta).includes('spoofed'), 'owner upload payload must not echo stored spoofed signature text');
  assert(!JSON.stringify(ownerView.raw_meta).includes('private prompt'), 'owner upload payload must not echo arbitrary stored moment text');
  assert(!JSON.stringify(ownerView).includes('tool_usage'), 'owner upload payload must not echo raw tool usage from stored metadata');
  assert(!JSON.stringify(ownerView).includes('language_usage'), 'owner upload payload must not echo raw language usage from stored metadata');
  assert(!JSON.stringify(ownerView).includes('rawJson'), 'owner upload payload must not echo raw JSON fields from stored metadata');
  assert(Object.keys(publicScores({ growth: 99, rawJson: 1 })).length === 0, 'public score serializer should keep the eight-archetype canon');
  assert(uploadRecency(null).bucket === 'unknown', 'public upload recency should tolerate missing timestamps');
  assert(uploadRecency('2026-04-28T10:00:00.000Z', new Date('2026-05-28T10:00:00.000Z')).bucket === 'this-quarter', 'public upload recency should bucket older timestamps');
  console.log('ok public profile helpers hide visitor metrics by default');
}

async function assertPublicUserSerializer() {
  const { publicUser } = await import('../api/_lib/db.js');
  const user = {
    gh_handle: 'brightseth',
    avatar_url: 'https://example.com/avatar.png',
    privacy: 'unlisted',
    created_at: '2026-05-01T00:00:00.000Z',
    last_seen_at: '2026-05-29T00:00:00.000Z',
  };
  const visitor = publicUser(user);
  assert(visitor.gh_handle === 'brightseth', 'public user serializer should expose handle');
  assert(!Object.hasOwn(visitor, 'created_at'), 'visitor user serializer must not expose account creation timestamp');
  assert(!Object.hasOwn(visitor, 'last_seen_at'), 'visitor user serializer must not expose last seen timestamp');
  const owner = publicUser(user, { includePrivacy: true, includeActivity: true });
  assert(owner.privacy === 'unlisted', 'owner user serializer should expose privacy');
  assert(owner.created_at === user.created_at, 'owner user serializer should expose account creation timestamp');
  assert(owner.last_seen_at === user.last_seen_at, 'owner user serializer should expose last seen timestamp');
  console.log('ok user serializer keeps activity timestamps owner-only');
}

async function assertProfileApiPayloadHelpers() {
  const { profileRarityPayload } = await import('../api/u/[handle].js');
  const signature = { fingerprint: 'builder+shipper+orchestrator:90s' };
  const visitorRarity = profileRarityPayload(signature, 8);
  const ownerRarity = profileRarityPayload(signature, 8, { isOwner: true });
  assert(visitorRarity.count === 8 && visitorRarity.tier === 'rare', 'visitor profile rarity should retain public scarcity proof');
  assert(!Object.hasOwn(visitorRarity, 'fingerprint'), 'visitor profile rarity must not expose internal signature fingerprint');
  assert(ownerRarity.fingerprint === 'builder+shipper+orchestrator:90s', 'owner profile rarity can retain internal signature fingerprint');
  console.log('ok profile API payload helpers keep rarity fingerprints owner-only');
}

async function assertDiscoveryEntrySerializers() {
  const { leaderboardEntry } = await import('../api/leaderboard.js');
  const { browseEntry } = await import('../api/browse.js');
  const { matchEntry } = await import('../api/match.js');
  const row = {
    gh_handle: 'brightseth',
    avatar_url: 'https://example.com/avatar.png',
    archetype: 'builder',
    scores: {
      builder: 999,
      shipper: 80,
      orchestrator: 61,
      rawJson: { should: 'drop' },
      _percentiles: { builder: 0, rawJson: 1 },
    },
    metrics: { days: 31, commitsPerDay: 12.4, sessions: 88, languages: 6 },
    raw_meta: {
      signature: 'spoofed Builder',
      signatureCombo: 'architect+builder',
      signatureFingerprint: 'architect+builder+shipper:90s',
      rawJson: { should: 'drop' },
    },
    looking_for: 'pair-coding',
    looking_for_expires_at: new Date(Date.now() + 10000).toISOString(),
    contact_url: 'https://x.com/brightseth',
    uploaded_at: new Date().toISOString(),
  };
  for (const entry of [
    leaderboardEntry(row, 0),
    browseEntry(row),
    matchEntry(row, 'pair-coding', 'shipper'),
  ]) {
    assert(entry.score === 100, 'public discovery entries should clamp stored archetype scores');
    assert(entry.signature?.label === 'high-velocity Builder', 'public discovery entries should derive signature labels from scores');
    assert(!JSON.stringify(entry).includes('rawJson'), 'public discovery entries must not echo unknown stored fields');
    assert(!JSON.stringify(entry).includes('signatureFingerprint'), 'public discovery entries must not expose rarity fingerprints');
    assert(!JSON.stringify(entry).includes('spoofed'), 'public discovery entries must not echo stored spoofed signature text');
  }
  console.log('ok discovery entry serializers clamp public scores');
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
  const validStored = signatureFromUpload({
    ...upload,
    raw_meta: {
      signature: ' saved Builder ',
      signatureCombo: 'architect+builder',
      signatureFingerprint: 'architect+builder+shipper:90s',
      secondaryArchetype: 'architect',
    },
  });
  assert(validStored.label === 'high-velocity Builder', 'signature helper should ignore stored signature labels');
  assert(validStored.combo === 'shipper+builder', 'signature helper should derive combos from scores');
  assert(validStored.fingerprint === 'builder+shipper+orchestrator:90s', 'signature helper should derive fingerprints from scores');
  const malformed = signatureFromUpload({
    ...upload,
    raw_meta: {
      signature: { rawJson: 'leak' },
      signatureCombo: 'rawJson+builder',
      signatureFingerprint: 'rawJson:90s',
      secondaryArchetype: 'growth-hacker',
    },
  });
  assert(malformed.label === 'high-velocity Builder', 'signature helper should ignore malformed saved labels');
  assert(malformed.combo === 'shipper+builder', 'signature helper should fall back from malformed combos');
  assert(malformed.fingerprint === 'builder+shipper+orchestrator:90s', 'signature helper should fall back from malformed fingerprints');
  assert(!JSON.stringify(malformed).includes('rawJson'), 'signature helper must not echo raw-shaped metadata');
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
  assert(evolution.previous_uploaded_at === '2026-05-23T10:00:00.000Z', 'owner evolution should retain previous upload timestamp');
  assert(!Object.hasOwn(profileEvolution(uploads, { isOwner: false }), 'previous_uploaded_at'), 'visitor evolution must not expose previous upload timestamp');
  assert(!JSON.stringify(evolution).includes('rawJson'), 'evolution helper must not leak raw metadata');
  const shifted = profileEvolution([
    { archetype: 'orchestrator', scores: { orchestrator: 91, builder: 75 }, uploaded_at: '2026-05-28T10:00:00.000Z' },
    { archetype: 'builder', scores: { builder: 89, orchestrator: 72 }, uploaded_at: '2026-05-21T10:00:00.000Z' },
  ]);
  assert(shifted.label === 'Builder -> Orchestrator shift', 'evolution helper should surface archetype shifts');
  const bounded = profileEvolution([
    { archetype: 'builder', scores: { builder: 999 }, uploaded_at: '2026-05-28T10:00:00.000Z' },
    { archetype: 'builder', scores: { builder: -10 }, uploaded_at: '2026-05-21T10:00:00.000Z' },
  ]);
  assert(bounded.label === '+100 Builder points', 'evolution helper should clamp impossible stored scores');
  console.log('ok profile evolution helpers');
}

async function assertStreakHelpers() {
  const { profileStreak } = await import('../api/_lib/streak.js');
  const uploads = [
    { uploaded_at: '2026-05-28T10:00:00.000Z' },
    { uploaded_at: '2026-05-23T10:00:00.000Z' },
    { uploaded_at: '2026-05-16T10:00:00.000Z' },
    { uploaded_at: '2026-05-08T10:00:00.000Z' },
  ];
  const streak = profileStreak(uploads, { now: new Date('2026-05-29T10:00:00.000Z') });
  assert(streak.active === true, 'streak helper should mark recent streaks active');
  assert(streak.days === 13, 'streak helper should report day span across uploads within the 7-day cadence');
  assert(streak.upload_count === 3, 'streak helper should stop before uploads more than 7 days apart');
  assert(streak.label === '13-day streak', 'streak helper should label day-based streaks');
  assert(!Object.hasOwn(streak, 'started_at'), 'public streak payload should not expose exact streak start timestamp');
  assert(!Object.hasOwn(streak, 'latest_uploaded_at'), 'public streak payload should not expose exact latest upload timestamp');

  const ownerStreak = profileStreak(uploads, { now: new Date('2026-05-29T10:00:00.000Z'), isOwner: true });
  assert(ownerStreak.started_at === '2026-05-16T10:00:00.000Z', 'owner streak payload should retain exact start timestamp');
  assert(ownerStreak.latest_uploaded_at === '2026-05-28T10:00:00.000Z', 'owner streak payload should retain exact latest timestamp');

  const paused = profileStreak(uploads, { now: new Date('2026-06-10T10:00:00.000Z') });
  assert(paused.active === false, 'streak helper should mark stale streaks paused');
  assert(paused.label === '13-day streak paused', 'streak helper should preserve last streak span when paused');
  assert(profileStreak([]) === null, 'streak helper should tolerate empty upload lists');
  console.log('ok profile streak helpers');
}

async function assertDigestHelpers() {
  const { buildWeeklyDigest, uploadStreak } = await import('../api/_lib/digest.js');
  const { digestCronResult, digestDryRunProof, resendDigestPayload } = await import('../api/cron/weekly-digest.js');
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
  assert(digest.streak.days === 6 && digest.streak.upload_count === 2, 'digest payload should expose day-based streak proof');
  assert(digest.subject.includes('week'), 'digest subject should include week label');
  assert(digest.text.includes('+4 points vs last upload'), 'digest text should include score movement');
  assert(digest.text.includes('Streak: 6-day streak (2 uploads)'), 'digest text should include a day-based streak');
  assert(digest.text.includes('#4 on the weekly Builder board'), 'digest text should include leaderboard position');
  assert(digest.text.includes('Share invite: https://vibestats.io/?compareTo=brightseth&compareArchetype=builder'), 'digest text should include compare-first share invite');
  assert(digest.text.includes('Find matches: https://vibestats.io/match?goal=pair-coding&archetype=builder'), 'digest text should include goal-aware match link');
  assert(digest.text.includes('Manage digest: https://vibestats.io/settings'), 'digest text should include settings management link');
  assert(digest.text.includes('Raw Claude Code insights JSON never leaves your browser'), 'digest text should include the privacy promise');
  assert(digest.text.includes('saved derived metrics'), 'digest text should say it uses derived metrics');
  assert(digest.text.includes('Unsubscribe: https://vibestats.io/api/digest/unsubscribe?token=unsubscribe-token'), 'digest text should include one-click unsubscribe link');
  assert(digest.html.includes('/api/og?'), 'digest HTML should include the profile card image');
  assert(digest.html.includes('Share invite') && digest.html.includes('twitter.com/intent/tweet'), 'digest HTML should include a social share CTA');
  assert(digest.html.includes('6-day streak (2 uploads)'), 'digest HTML should include day-based streak copy');
  assert(digest.html.includes('Find matches'), 'digest HTML should include a return CTA into matching');
  assert(digest.html.includes('Manage digest settings'), 'digest HTML should include settings management link');
  assert(digest.html.includes('unsubscribe'), 'digest HTML should include one-click unsubscribe link');
  assert(digest.match_url === 'https://vibestats.io/match?goal=pair-coding&archetype=builder', 'digest payload should expose goal-aware match URL');
  assert(digest.share_url === 'https://vibestats.io/?compareTo=brightseth&compareArchetype=builder', 'digest payload should expose compare-first share URL');
  assert(digest.x_share_url.includes('twitter.com/intent/tweet') && decodeURIComponent(digest.x_share_url).includes('compareTo=brightseth'), 'digest payload should expose X share URL');
  assert(digest.settings_url === 'https://vibestats.io/settings', 'digest payload should expose settings URL');
  assert(digest.unsubscribe_url === 'https://vibestats.io/api/digest/unsubscribe?token=unsubscribe-token', 'digest payload should expose unsubscribe URL');
  const boundedDigest = buildWeeklyDigest({
    user: { gh_handle: 'brightseth' },
    uploads: [
      { archetype: 'builder', scores: { builder: 999, _percentiles: { builder: 0 } }, metrics: {}, raw_meta: {}, uploaded_at: '2026-05-28T10:00:00.000Z' },
      { archetype: 'builder', scores: { builder: -10 }, metrics: {}, raw_meta: {}, uploaded_at: '2026-05-21T10:00:00.000Z' },
    ],
    origin: 'https://vibestats.io',
  });
  assert(boundedDigest.score === 100, 'digest helper should clamp impossible stored scores');
  assert(boundedDigest.delta === 100, 'digest helper should compute deltas from clamped scores');
  assert(boundedDigest.text.includes('Current signal: 100%'), 'digest text should not show impossible signal scores');
  const resendPayload = resendDigestPayload({ to: 'seth@example.com', digest });
  assert(resendPayload.headers['List-Unsubscribe'] === '<https://vibestats.io/api/digest/unsubscribe?token=unsubscribe-token>', 'digest email should include List-Unsubscribe header');
  assert(resendPayload.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'digest email should include one-click unsubscribe header');
  const dryRunResult = digestCronResult({
    user: { gh_handle: 'brightseth', digest_email: 'seth@example.com' },
    digest,
    dryRun: true,
  });
  assert(dryRunResult.digest_email_configured === true, 'digest cron result should report configured recipient without echoing it');
  assert(Object.values(dryRunResult.proof).every(Boolean), 'digest dry-run result should prove return-loop content without exposing URLs');
  assert(!Object.hasOwn(dryRunResult, 'to'), 'digest cron result must not expose recipient email field');
  assert(!JSON.stringify(dryRunResult).includes('seth@example.com'), 'digest cron result must not leak recipient email address');
  assert(!JSON.stringify(dryRunResult).includes('unsubscribe-token'), 'digest cron result must not leak unsubscribe token');
  assert(dryRunResult.sent === false && dryRunResult.dry_run === true, 'digest cron result should preserve delivery status');
  assert(Object.values(digestDryRunProof(digest)).every(Boolean), 'digest dry-run proof helper should verify all required content markers');
  assert(!digest.html.includes('rawJson') && !digest.text.includes('rawJson'), 'digest must not leak raw metadata');

  const privateDigest = buildWeeklyDigest({
    user: { gh_handle: 'privatehandle', privacy: 'private' },
    uploads,
    origin: 'https://vibestats.io',
    now: new Date('2026-05-28T12:00:00.000Z'),
  });
  assert(privateDigest.share_url === 'https://vibestats.io/?compareArchetype=builder', 'private digest share URL should use archetype-only comparison');
  assert(!privateDigest.share_url.includes('compareTo=privatehandle'), 'private digest share URL should not expose handle-backed comparison');
  assert(!decodeURIComponent(privateDigest.x_share_url).includes('@privatehandle'), 'private digest X share text should not expose the hidden handle');
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
  const { profileShareCacheControl, sendPrivateMethodNotAllowed, sendPrivateNotFound } = await import('../api/_lib/cache.js');
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
  const methodRes = mockRes();
  sendPrivateMethodNotAllowed(methodRes);
  assert(methodRes.statusCode === 405, 'private method helper should return 405');
  assert(methodRes.headers.Allow === 'GET', 'private method helper should advertise allowed methods');
  assert(methodRes.headers['Cache-Control'] === 'private, no-store', 'private method helper should disable caching');
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
  let cache = '';
  let body = '';
  await handler({
    method: 'GET',
    query: { a: 'builder', b: 'shipper' },
    headers: { host: 'localhost:3000' },
  }, {
    setHeader(name, value) {
      if (name.toLowerCase() === 'content-type') contentType = value;
      if (name.toLowerCase() === 'cache-control') cache = value;
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
  assert(cache === 'private, no-store', 'compare page API should not publicly cache dynamic metadata');
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
    let cache = '';
    let body = '';
    const req = {
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'cache-control') cache = value;
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
    assert(cache === 'private, no-store', 'profile fallback should not publicly cache unknown privacy state');
    assert(body.includes('@brightseth on vibestats'), 'profile fallback should include handle metadata');
    assert(body.includes('og:image'), 'profile fallback should include share metadata');
    console.log('ok profile fallback renders shareable shell without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertProfileJsonFallback() {
  const { default: handler } = await import('../api/u/[handle].js');
  const originalError = console.error;
  const envKeys = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  console.error = () => {};
  try {
    const res = mockRes();
    await handler({
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    }, res);
    assert(res.statusCode === 503, 'profile JSON fallback should report unavailable when DB is absent');
    assert(res.body.error === 'Profile unavailable', 'profile JSON fallback should not leak DB internals');
    assertNoStore(res, 'profile JSON fallback');
    console.log('ok profile JSON fallback hides internals without caching');
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

async function assertBadgeFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler, badgeSvg } = await import('../api/badge.js');
    const scored = badgeSvg({
      handle: 'brightseth',
      label: 'high-velocity Builder',
      archetype: 'BUILDER',
      color: '#22c55e',
      score: 999,
    });
    assert(scored.includes('100% Claude Code signal - BUILDER'), 'badge SVG should render clamped primary score as credential proof');
    assert(scored.includes('>100%</text>'), 'badge SVG should show the score pill');
    assert(!scored.includes('rawJson') && !scored.includes('tool_usage') && !scored.includes('language_usage'), 'badge SVG should not include raw insight markers');

    let statusCode = 0;
    let contentType = '';
    let cache = '';
    let body = '';
    const req = {
      method: 'GET',
      query: { handle: 'brightseth' },
      headers: { host: 'localhost:3000' },
    };
    const res = {
      setHeader(name, value) {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'cache-control') cache = value;
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
    assert(cache === 'private, no-store', 'badge fallback should not publicly cache unknown privacy state');
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
    let cache = '';
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
        if (name.toLowerCase() === 'cache-control') cache = value;
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
    assert(cache === 'private, no-store', 'embed fallback should not publicly cache unknown privacy state');
    assert(csp.includes('frame-ancestors https:'), 'embed CSP should allow HTTPS framing');
    assert(body.includes('@brightseth'), 'embed fallback should include handle');
    assert(body.includes('VIBESTATS PROFILE'), 'embed fallback should render a neutral profile card');
    console.log('ok embed fallback renders frameable profile card without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertProfileShareSurfaceGuards() {
  const endpoints = [
    {
      label: 'profile HTML method guard',
      module: '../api/profile.js',
      req: { method: 'POST', query: { handle: 'brightseth' }, headers: { host: 'localhost:3000' } },
      status: 405,
      allow: 'GET',
    },
    {
      label: 'profile HTML invalid handle',
      module: '../api/profile.js',
      req: { method: 'GET', query: { handle: 'bad_handle' }, headers: { host: 'localhost:3000' } },
      status: 404,
    },
    {
      label: 'compare page method guard',
      module: '../api/compare-page.js',
      req: { method: 'POST', query: { a: 'builder', b: 'shipper' }, headers: { host: 'localhost:3000' } },
      status: 405,
      allow: 'GET',
    },
    {
      label: 'profile badge method guard',
      module: '../api/badge.js',
      req: { method: 'POST', query: { handle: 'brightseth' }, headers: { host: 'localhost:3000' } },
      status: 405,
      allow: 'GET',
    },
    {
      label: 'profile badge invalid handle',
      module: '../api/badge.js',
      req: { method: 'GET', query: { handle: 'bad_handle' }, headers: { host: 'localhost:3000' } },
      status: 404,
    },
    {
      label: 'profile embed method guard',
      module: '../api/embed.js',
      req: { method: 'POST', query: { handle: 'brightseth' }, headers: { host: 'localhost:3000' } },
      status: 405,
      allow: 'GET',
    },
    {
      label: 'profile embed invalid handle',
      module: '../api/embed.js',
      req: { method: 'GET', query: { handle: 'bad_handle' }, headers: { host: 'localhost:3000' } },
      status: 404,
    },
  ];

  for (const endpoint of endpoints) {
    const { default: handler } = await import(endpoint.module);
    const res = mockRes();
    await handler(endpoint.req, res);
    assert(res.statusCode === endpoint.status, `${endpoint.label} should return HTTP ${endpoint.status}`);
    assert(res.headers['Cache-Control'] === 'private, no-store', `${endpoint.label} should use private no-store caching`);
    if (endpoint.allow) {
      assert(res.headers.Allow === endpoint.allow, `${endpoint.label} should advertise allowed methods`);
    }
  }

  console.log('ok profile share surface guards disable caching');
}

async function assertLeaderboardFallback() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { default: handler } = await import('../api/leaderboard.js');
    const req = {
      method: 'GET',
      query: { archetype: 'builder' },
      headers: { host: 'localhost:3000' },
    };
    const res = mockRes();

    await handler(req, res);
    const parsed = res.body;
    assert(res.statusCode === 200, 'leaderboard fallback should render HTTP 200 when DB is absent');
    assert(parsed.archetype === 'builder', 'leaderboard fallback should preserve archetype');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'leaderboard fallback should return empty entries');
    assert(parsed.unavailable === true, 'leaderboard fallback should mark DB unavailable');
    assertNoStore(res, 'leaderboard fallback');
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
    const req = {
      method: 'GET',
      query: { goal: 'mentor' },
      headers: { host: 'localhost:3000' },
    };
    const res = mockRes();

    await handler(req, res);
    const parsed = res.body;
    assert(res.statusCode === 200, 'match fallback should render HTTP 200 when DB is absent');
    assert(parsed.goal === 'mentor', 'match fallback should preserve goal');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'match fallback should return empty entries');
    assert(parsed.unavailable === true, 'match fallback should mark DB unavailable');
    assert(parsed.error === 'Match unavailable', 'match fallback should not leak DB internals');
    assertNoStore(res, 'match fallback');
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
    const req = {
      method: 'GET',
      query: { archetype: 'builder', intent: 'active' },
      headers: { host: 'localhost:3000' },
    };
    const res = mockRes();

    await handler(req, res);
    const parsed = res.body;
    assert(res.statusCode === 200, 'browse fallback should render HTTP 200 when DB is absent');
    assert(parsed.filters.archetype === 'builder', 'browse fallback should preserve archetype filter');
    assert(parsed.filters.intent === 'active', 'browse fallback should preserve intent filter');
    assert(Array.isArray(parsed.entries) && parsed.entries.length === 0, 'browse fallback should return empty entries');
    assert(parsed.unavailable === true, 'browse fallback should mark DB unavailable');
    assert(parsed.error === 'Browse unavailable', 'browse fallback should not leak DB internals');
    assertNoStore(res, 'browse fallback');
    console.log('ok browse fallback keeps public directory shell usable without DB');
  } finally {
    console.error = originalError;
  }
}

async function assertDiscoveryApiNoStoreGuards() {
  const originalError = console.error;
  console.error = () => {};
  try {
    const cases = [
      {
        label: 'browse method guard',
        module: '../api/browse.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 405,
        allow: 'GET',
      },
      {
        label: 'browse invalid filter',
        module: '../api/browse.js',
        req: { method: 'GET', query: { archetype: 'bad' }, headers: { host: 'localhost:3000' } },
        status: 400,
      },
      {
        label: 'match method guard',
        module: '../api/match.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 405,
        allow: 'GET',
      },
      {
        label: 'match invalid goal',
        module: '../api/match.js',
        req: { method: 'GET', query: { goal: 'idle' }, headers: { host: 'localhost:3000' } },
        status: 400,
      },
      {
        label: 'leaderboard method guard',
        module: '../api/leaderboard.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 405,
        allow: 'GET',
      },
      {
        label: 'leaderboard invalid filter',
        module: '../api/leaderboard.js',
        req: { method: 'GET', query: { archetype: 'bad' }, headers: { host: 'localhost:3000' } },
        status: 400,
      },
    ];

    for (const testCase of cases) {
      const { default: handler } = await import(testCase.module);
      const res = mockRes();
      await handler(testCase.req, res);
      assert(res.statusCode === testCase.status, `${testCase.label} should return HTTP ${testCase.status}`);
      assertNoStore(res, testCase.label);
      if (testCase.allow) {
        assert(res.headers.Allow === testCase.allow, `${testCase.label} should advertise allowed methods`);
      }
    }

    console.log('ok discovery API guards disable caching');
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
        label: '/api/auth/github/callback unavailable',
        module: '../api/auth/github/callback.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000' } },
        status: 503,
        body: 'Profile saves are not configured on this deployment yet.',
        noInternal: true,
      },
      {
        label: '/api/auth/github/callback method guard',
        module: '../api/auth/github/callback.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000' } },
        status: 405,
        allow: 'GET',
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
      if (endpoint.body) {
        assert(res.body === endpoint.body, `${endpoint.label} should return stable public failure copy`);
      }
      if (endpoint.noInternal) {
        assertNoInternalConfigMarkers(res.body, endpoint.label);
      }
      if (endpoint.allow) {
        assert(res.headers.Allow === endpoint.allow, `${endpoint.label} should advertise allowed methods`);
      }
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

async function assertPublicApiErrorsHideInternalConfig() {
  const originalError = console.error;
  const secretKeys = ['VIBE_SESSION_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET'];
  const previous = Object.fromEntries(secretKeys.map((key) => [key, process.env[key]]));
  console.error = () => {};
  for (const key of secretKeys) delete process.env[key];

  try {
    const cookie = 'vibestats_auth=a.b.c';
    const endpoints = [
      {
        label: '/api/me secret failure',
        module: '../api/me.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Session failed',
      },
      {
        label: '/api/uploads secret failure',
        module: '../api/uploads.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Upload failed',
      },
      {
        label: '/api/settings secret failure',
        module: '../api/settings.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Settings failed',
      },
      {
        label: '/api/settings/export secret failure',
        module: '../api/settings/export.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Export failed',
      },
      {
        label: '/api/sync-token secret failure',
        module: '../api/sync-token.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Sync token failed',
      },
      {
        label: '/api/sync secret failure',
        module: '../api/sync.js',
        req: { method: 'POST', query: {}, headers: { host: 'localhost:3000', authorization: 'Bearer a.b.c' } },
        status: 500,
        error: 'Sync failed',
      },
    ];

    for (const endpoint of endpoints) {
      const { default: handler } = await import(endpoint.module);
      const res = mockRes();
      await handler(endpoint.req, res);
      assert(res.statusCode === endpoint.status, `${endpoint.label} should return HTTP ${endpoint.status}`);
      assert(res.body?.error === endpoint.error, `${endpoint.label} should return generic error copy`);
      assertNoInternalConfigMarkers(res.body, endpoint.label);
      assertNoStore(res, endpoint.label);
    }

    const { default: unsubscribeHandler } = await import('../api/digest/unsubscribe.js');
    const unsubscribeRes = mockRes();
    await unsubscribeHandler({
      method: 'GET',
      query: { token: 'a.b.c' },
      headers: { host: 'localhost:3000' },
    }, unsubscribeRes);
    assert(unsubscribeRes.statusCode === 500, 'digest unsubscribe secret failure should return HTTP 500');
    assert(String(unsubscribeRes.body).includes('Digest unsubscribe failed.'), 'digest unsubscribe should show generic failure copy');
    assertNoInternalConfigMarkers(unsubscribeRes.body, 'digest unsubscribe secret failure');
    assertNoStore(unsubscribeRes, 'digest unsubscribe secret failure');

    console.log('ok public API failures hide internal config names');
  } finally {
    console.error = originalError;
    for (const key of secretKeys) {
      if (previous[key] == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

async function assertDigestCronAuth() {
  const { default: handler, weeklyDigestErrorMessage } = await import('../api/cron/weekly-digest.js');
  const previousSecret = process.env.CRON_SECRET;
  const originalError = console.error;
  console.error = () => {};

  try {
    assert(
      weeklyDigestErrorMessage(Object.assign(new Error('Resend failed: 502 seth@example.com'), { statusCode: 502 })) === 'Weekly digest failed',
      'weekly digest cron should not expose provider failure details',
    );
    assert(
      weeklyDigestErrorMessage(Object.assign(new Error('Unauthorized'), { statusCode: 401 })) === 'Unauthorized',
      'weekly digest cron should preserve unauthorized responses',
    );

    delete process.env.CRON_SECRET;
    const missingRes = mockRes();
    await handler({
      method: 'GET',
      query: { dryRun: '1' },
      headers: { host: 'localhost:3000' },
    }, missingRes);
    assert(missingRes.statusCode === 503, 'weekly digest cron should reject missing bearer configuration');
    assert(missingRes.body.error === 'Weekly digest delivery is not configured', 'weekly digest cron should not expose missing secret env names');
    assert(!JSON.stringify(missingRes.body).includes('CRON_SECRET'), 'weekly digest cron missing config response should not name secret env vars');
    assertNoStore(missingRes, 'weekly digest cron missing config');

    process.env.CRON_SECRET = 'smoke-cron-secret';
    const unauthorizedRes = mockRes();
    await handler({
      method: 'GET',
      query: { dryRun: '1' },
      headers: { host: 'localhost:3000', authorization: 'Bearer wrong-secret' },
    }, unauthorizedRes);
    assert(unauthorizedRes.statusCode === 401, 'weekly digest cron should reject invalid bearer token');
    assert(unauthorizedRes.body.error === 'Unauthorized', 'weekly digest cron should return unauthorized error');
    assertNoStore(unauthorizedRes, 'weekly digest cron unauthorized');
    console.log('ok weekly digest cron requires bearer secret without leaking config');
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
await assertLaunchAuditHelpers();
await assertIdentityReadiness();
await assertOAuthReturnHandling();
await assertProfileShareLoop();
await assertCompareShareLoop();
await assertShareCardCta();
await assertOgFallback();
await assertStatsApiGuards();
await assertWrappedShareLoop();
await assertMatchmakingHelpers();
await assertBehavioralMoments();
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
await assertPublicUserSerializer();
await assertProfileApiPayloadHelpers();
await assertDiscoveryEntrySerializers();
await assertSignatureHelpers();
await assertEvolutionHelpers();
await assertStreakHelpers();
await assertDigestHelpers();
await assertProfileMetadataHelpers();
await assertProfileCacheHelpers();
await assertCompareMetadataHelpers();
await assertProfileFallback();
await assertProfileJsonFallback();
await assertBadgeFallback();
await assertEmbedFallback();
await assertProfileShareSurfaceGuards();
await assertDiscoveryApiNoStoreGuards();
await assertLeaderboardFallback();
await assertMatchFallback();
await assertBrowseFallback();
await assertPrivateApiNoStore();
await assertPublicApiErrorsHideInternalConfig();
await assertDigestCronAuth();

console.log('smoke checks passed');
