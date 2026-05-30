import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';

process.env.VIBE_SESSION_SECRET ||= 'smoke-test-secret-with-at-least-32-bytes';
const execFileAsync = promisify(execFile);

const htmlFiles = ['home.html', 'u.html', 'settings.html', 'compare-template.html', 'genome.html', 'leaderboard.html', 'match.html', 'browse.html', 'recap.html'];
const apiModules = [
  '../api/home.js',
  '../api/compare-page.js',
  '../api/profile.js',
  '../api/recap.js',
  '../api/auth/github/start.js',
  '../api/auth/github/callback.js',
  '../api/auth/logout.js',
  '../api/identity-status.js',
  '../api/me.js',
  '../api/uploads.js',
  '../api/sync.js',
  '../api/sync-token.js',
  '../api/cli/local-token.js',
  '../api/cli/device-start.js',
  '../api/cli/device-poll.js',
  '../api/u/[handle].js',
  '../api/settings.js',
  '../api/settings/export.js',
  '../api/cron/weekly-digest.js',
  '../api/digest/preview.js',
  '../api/digest/unsubscribe.js',
  '../api/_lib/cache.js',
  '../api/_lib/evolution.js',
  '../api/_lib/export-upload.js',
  '../api/_lib/github-oauth.js',
  '../api/_lib/profile-links.js',
  '../api/_lib/profile-settings.js',
  '../api/_lib/achievements.js',
  '../api/_lib/public-profile.js',
  '../api/_lib/social-proof.js',
  '../api/_lib/signatures.js',
  '../api/_lib/streak.js',
  '../api/_lib/matchmaking.js',
  '../api/_lib/leaderboard-rank.js',
  '../api/_lib/facets.js',
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
  '../scripts/share-kit.mjs',
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
  const facetFit = compat.facetCompatibility(
    { type: 'builder', facets: [{ id: 'build_energy', value: 92 }, { id: 'system_design', value: 30 }, { id: 'debug_patience', value: 20 }] },
    { type: 'architect', facets: [{ id: 'system_design', value: 88 }, { id: 'build_energy', value: 42 }, { id: 'shipping_velocity', value: 30 }] },
  );
  assert(facetFit.score >= 80 && facetFit.line.includes('Facet read'), 'compat module should score derived facet fit');
  const profileFit = compat.profileCompatibility(
    'builder',
    'architect',
    'alex',
    { type: 'builder', facets: [{ id: 'build_energy', value: 92 }, { id: 'system_design', value: 30 }, { id: 'debug_patience', value: 20 }] },
    { type: 'architect', facets: [{ id: 'system_design', value: 88 }, { id: 'build_energy', value: 42 }, { id: 'shipping_velocity', value: 30 }] },
  );
  assert(profileFit.facet?.score >= 80 && profileFit.line.includes('Facet read'), 'profile compatibility should blend facet fit when profile facets exist');
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
  const compareHtml = await readFile('compare-template.html', 'utf8');
  const genomeHtml = await readFile('genome.html', 'utf8');
  const recapApi = await readFile('api/recap.js', 'utf8');
  const recapHtml = await readFile('recap.html', 'utf8');
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
  const digestPreviewApi = await readFile('api/digest/preview.js', 'utf8');
  const digestUnsubscribeApi = await readFile('api/digest/unsubscribe.js', 'utf8');
  const uploadsApi = await readFile('api/uploads.js', 'utf8');
  const syncTokenApi = await readFile('api/sync-token.js', 'utf8');
  const cliLocalTokenApi = await readFile('api/cli/local-token.js', 'utf8');
  const cliDeviceStartApi = await readFile('api/cli/device-start.js', 'utf8');
  const cliDevicePollApi = await readFile('api/cli/device-poll.js', 'utf8');
  const githubOauthHelper = await readFile('api/_lib/github-oauth.js', 'utf8');
  const syncApi = await readFile('api/sync.js', 'utf8');
  const profileLinksHelper = await readFile('api/_lib/profile-links.js', 'utf8');
  const statsApi = await readFile('api/stats.js', 'utf8');
  const cliBin = await readFile('bin/vibestats.js', 'utf8');
  const identityStatusApi = await readFile('api/identity-status.js', 'utf8');
  const identityReadiness = await readFile('api/_lib/identity-readiness.js', 'utf8');
  const indexHtml = await readFile('home.html', 'utf8');
  const homeApi = await readFile('api/home.js', 'utf8');
  const identityDoctor = await readFile('scripts/identity-doctor.mjs', 'utf8');
  const launchAudit = await readFile('scripts/launch-audit.mjs', 'utf8');
  const launchDoc = await readFile('docs/LAUNCH.md', 'utf8');
  const envExample = await readFile('.env.example', 'utf8');
  const npmIgnore = await readFile('.npmignore', 'utf8');
  const claudeCommand = await readFile('.claude/commands/vibestats.md', 'utf8');
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const rewrites = config.rewrites || [];
  assert(packageJson.scripts?.dev === 'vercel dev' && packageJson.scripts?.serve === 'vercel dev', 'local dev should use Vercel routing now that / is rendered by an API function');
  assert(packageJson.scripts?.['share:kit'] === 'node scripts/share-kit.mjs', 'package should expose the public profile share-kit generator');
  assert(
    rewrites.some((rewrite) => rewrite.source === '/' && rewrite.destination === '/api/home'),
    'homepage should rewrite to dynamic metadata renderer',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/u/:handle/pair/:other' && rewrite.destination === '/api/compare-page?a=:other&b=:handle'),
    'person-backed pair route should rewrite to dynamic compare page',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/u/:handle/recap' && rewrite.destination === '/api/recap?handle=:handle'),
    'profile recap route should rewrite to dynamic recap page',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/compare' && rewrite.destination === '/api/compare-page'),
    'compare route should rewrite to dynamic compare page',
  );
  assert(
    rewrites.some((rewrite) => rewrite.source === '/genome' && rewrite.destination === '/genome.html'),
    'genome route should be explicit because leaderboard links to it as a public viral surface',
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
  assert(leaderboardHtml.includes('function xShareUrl(entry, archetype)') && leaderboardHtml.includes('href="${esc(xShareUrl(entry, archetype))}"') && leaderboardHtml.includes('twitter.com/intent/tweet'), 'leaderboard rows should expose X sharing that clicks through to upload-to-compare');
  assert(leaderboardHtml.includes("document.execCommand('copy')"), 'leaderboard copy actions should fall back when Clipboard API is unavailable');
  assert(leaderboardHtml.includes("See how you'd pair:"), 'leaderboard invite text should drive recipients into comparison');
  assert(leaderboardHtml.includes('class="reveal-strip"') && leaderboardHtml.includes('Where do you rank?') && leaderboardHtml.includes('data-copy-command="/insights"') && leaderboardHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && leaderboardHtml.includes('Copy status') && leaderboardHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && leaderboardHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && leaderboardHtml.includes('install-claude-command'), 'leaderboard page should offer a direct terminal-first status, reveal, claim, and Claude Code install hook even when the board is populated');
  assert(leaderboardHtml.includes('Leaderboard database unavailable') && leaderboardHtml.includes('renderEntries(data.entries || [], Boolean(data.unavailable))'), 'leaderboard UI should distinguish unavailable DB from an empty board');
  assert(!matchApi.includes('languages:'), 'match API should not expose public language counts');
  assert(matchApi.includes('updated: uploadRecency(row.uploaded_at)'), 'match API should bucket public upload freshness');
  assert(matchApi.includes('seeker_archetype'), 'match API should preserve visitor archetype for goal-aware scoring');
  assert(matchApi.includes('goalFit({') && matchApi.includes('candidateFacets'), 'match API should use shared facet-aware goal fit scoring');
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
  assert(browseHtml.includes('function xShareUrl(entry)') && browseHtml.includes('href="${esc(xShareUrl(entry))}"') && browseHtml.includes('twitter.com/intent/tweet'), 'browse rows should expose X sharing that clicks through to upload-to-compare');
  assert(browseHtml.includes("document.execCommand('copy')"), 'browse copy actions should fall back when Clipboard API is unavailable');
  assert(browseHtml.includes('class="reveal-strip"') && browseHtml.includes('What are you?') && browseHtml.includes('data-copy-command="/insights"') && browseHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && browseHtml.includes('Copy status') && browseHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && browseHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && browseHtml.includes('install-claude-command'), 'browse page should offer a direct terminal-first status, reveal, claim, and Claude Code install hook even when the directory is populated');
  assert(browseHtml.includes('Profile database unavailable') && browseHtml.includes('renderEntries(data.entries || [], Boolean(data.unavailable))'), 'browse UI should distinguish unavailable DB from an empty directory');
  assert(matchHtml.includes('renderChips(\'archetypes\''), 'match UI should let visitors rank matches by their archetype');
  assert(matchHtml.includes('entry.facet_focus') && matchHtml.includes('Strongest goal facet'), 'match UI should expose facet-aware match reasons');
  assert(matchHtml.includes('const compareUrl = canonicalVibestatsUrl(comparePath(entry, seekerArchetype));'), 'match copied intros should canonicalize comparison URLs to vibestats.io');
  assert(matchHtml.includes('url=${encodeURIComponent(canonicalVibestatsUrl(comparePath(entry, seekerArchetype)))}'), 'match X share URLs should canonicalize to vibestats.io');
  assert(matchHtml.includes("document.execCommand('copy')"), 'match copy intro actions should fall back when Clipboard API is unavailable');
  assert(matchHtml.includes('class="reveal-strip"') && matchHtml.includes('Find your real match') && matchHtml.includes('data-copy-command="/insights"') && matchHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && matchHtml.includes('Copy status') && matchHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && matchHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && matchHtml.includes('install-claude-command'), 'match page should offer a direct terminal-first status, reveal, claim, and Claude Code install hook even when matches are populated');
  assert(matchHtml.includes('Match database unavailable') && matchHtml.includes('Boolean(data.unavailable)'), 'match UI should distinguish unavailable DB from no active matches');
  assert(genomeHtml.includes('What are you?') && genomeHtml.includes('data-copy-command="/insights"') && genomeHtml.includes('Copy status preflight') && genomeHtml.includes('Copy npx reveal command') && genomeHtml.includes('Copy claim command') && genomeHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && genomeHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && genomeHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && genomeHtml.includes('install-claude-command') && genomeHtml.includes('Raw Claude Code /insights data stays local'), 'genome page should convert community curiosity into status-first onboarding with claim and Claude Code install hooks');
  assert(genomeHtml.includes("document.execCommand('copy')"), 'genome reveal commands should fall back when Clipboard API is unavailable');
  assert(!genomeHtml.includes('>Quiz</a>'), 'genome nav should not use stale quiz framing');
  assert(profileApi.includes("methodNotAllowed(res, ['GET'], NO_STORE_HEADERS)"), 'profile JSON API method errors should not be cached');
  assert(profileApi.includes("json(res, 400, { error: 'Invalid handle' }, NO_STORE_HEADERS)"), 'profile JSON API invalid handles should not be cached');
  assert(profileApi.includes("json(res, 404, { error: 'Profile not found' }, { 'Cache-Control': PRIVATE_PROFILE_CACHE })"), 'profile JSON API unknown handles should not be cached before a profile is created');
  assert(profileApi.includes('weeklyLeaderboardRank'), 'profile API should include public weekly rank');
  assert(profileApi.includes('profileEvolution'), 'profile API should include derived evolution badge');
  assert(profileApi.includes('const streak = profileStreak(uploads, { isOwner })') && profileApi.includes('streak,'), 'profile API should include derived day-based streaks');
  assert(profileApi.includes('publicAchievements({'), 'profile API should include public-safe collectible achievements');
  assert(profileApi.includes('const visibleUploads = isOwner ? uploads : uploads.slice(0, 1)'), 'profile API should not expose full upload history to visitors');
  assert(profileApi.includes('total_uploads: isOwner ? uploads.length : null'), 'profile API should keep exact history count owner-only');
  assert(profileHtml.includes('latest public result'), 'profile UI should not imply full history is visible to visitors');
  assert(profileHtml.includes('GitHub-claimed') && profileHtml.includes('derived-only'), 'profile UI should visibly distinguish claimed GitHub identity from derived-only local profile data');
  assert(profileApi.includes("'Cache-Control': PRIVATE_PROFILE_CACHE"), 'profile JSON private 404 should not be cacheable');
  assert(profileHtmlApi.includes('metricVisibility(settingsRows[0] || {}, { isOwner: false })'), 'profile HTML OG metadata must use visitor-safe metric visibility');
  assert(profileHtmlApi.includes('profileShareCacheControl(user)'), 'profile HTML OG metadata should use shared profile cache policy');
  assert(profileHtmlApi.includes('sendGenericProfilePage(req, res, 404, handle)'), 'profile HTML unknown handles should render generic shell with explicit no-store cache policy');
  assert(profileHtmlApi.includes('sendPrivateNotFound(res)'), 'profile HTML private 404 should not be cacheable');
  assert(profileHtmlApi.includes('weeklyLeaderboardRank(user, latest)'), 'profile HTML OG metadata should include public leaderboard proof');
  assert(profileHtmlApi.includes('rarityForSignature(signature)'), 'profile HTML OG metadata should include signature scarcity proof');
  assert(profileHtmlApi.includes('profileDescription({'), 'profile HTML OG metadata should centralize comparison-oriented share copy');
  assert(recapApi.includes('recapDescription({') && recapApi.includes('profileShareProof({ rarity, leaderboard })'), 'profile recap metadata should include return-loop social proof');
  assert(recapApi.includes('readSession(req)') && recapApi.includes("user.privacy === 'private' && !isOwner"), 'profile recap should preserve private-profile access rules');
  assert(recapApi.includes('profileShareCacheControl(user)'), 'profile recap should use shared profile cache policy');
  assert(recapHtml.includes("fetch(`/api/u/${encodeURIComponent(handle)}`") && recapHtml.includes('Copy recap'), 'profile recap page should render from sanitized public profile JSON');
  assert(recapHtml.includes('Raw Claude Code /insights data stays local') && recapHtml.includes('facet shape'), 'profile recap should state derived-only privacy and facet proof');
  assert(recapHtml.includes('id="digest-cta"') && recapHtml.includes('profile.is_owner'), 'profile recap should give owners a path into digest consent');
  assert(recapHtml.includes('id="copy-sync"') && recapHtml.includes('Run CLI sync after more Claude Code work') && recapHtml.includes("const SYNC_COMMAND = 'npx --yes github:brightseth/vibestats#feat/wave-1-identity';"), 'profile recap should let owners refresh the return surface with one-command terminal-first CLI sync');
  assert(recapHtml.includes('id="copy-install"') && recapHtml.includes('install-claude-command'), 'profile recap should let owners install the Claude Code /vibestats return hook');
  assert(recapHtml.includes('id="recipient-reveal"') && recapHtml.includes('What are you?') && recapHtml.includes('Copy status') && recapHtml.includes('Copy reveal') && recapHtml.includes('Copy claim') && recapHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity status"') && recapHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && recapHtml.includes('data-copy-command="npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command"'), 'profile recap should convert share recipients into terminal-first status, reveal, claim, and install');
  assert(profileHtml.includes('id="recap-cta"') && profileHtml.includes('`${profilePath}/recap`'), 'profile page should link users into the recap return surface');
  assert(digestPreviewApi.includes('requireUser(req)') && digestPreviewApi.includes('buildWeeklyDigest({'), 'digest preview should be authenticated and reuse the weekly digest builder');
  assert(digestPreviewApi.includes('rarityForSignature(signature)') && digestPreviewApi.includes('weeklyLeaderboardRank(user, latest)'), 'digest preview should include scarcity and leaderboard proof');
  assert(digestPreviewApi.includes("res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control'])"), 'digest preview should disable public caching');
  assert(homeApi.includes('homeMetadataForInvite') && homeApi.includes('Run /insights, check status, then reveal yours against @${handle}'), 'homepage API should render compare-first share-recipient metadata with status preflight');
  assert(homeApi.includes("user.privacy === 'private'") && homeApi.includes('profileShareCacheControl(cacheUser)'), 'homepage API should avoid private profile previews and preserve profile cache policy');
  assert(homeApi.includes('profileShareProof({ rarity, leaderboard })') && homeApi.includes('rarityForSignature(signature)') && homeApi.includes('weeklyLeaderboardRank(user, latest)'), 'homepage API should include profile social proof in compare-first unfurls');
  assert(comparePageApi.includes('compareMetadataForSubjects'), 'compare page API should expose dynamic comparison metadata helpers');
  assert(!comparePageApi.includes('readSession'), 'compare page metadata must not personalize public cached previews by session');
  assert(comparePageApi.includes("user.privacy !== 'private'"), 'compare page metadata must not expose private profiles');
  assert(comparePageApi.includes('profileShareProof({ rarity: subject.rarity, leaderboard: subject.leaderboard })'), 'compare page metadata should include profile social proof');
  assert(comparePageApi.includes('Open the pairing, then claim yours from the terminal after /insights status passes'), 'compare page metadata should drive recipients to terminal claiming after status preflight');
  assert(comparePageApi.includes('sendPrivateMethodNotAllowed(res)'), 'compare page method guard should use private no-store profile cache policy');
  assert(compareHtml.includes('latest.facets || []') && compareHtml.includes('window.VibeCompat.profileCompatibility(aType, bType'), 'compare UI should use profile facet radar when computing pair fit');
  assert(compareHtml.includes('facet-match') && compareHtml.includes('Facet fit:'), 'compare UI should render facet-aware profile pairing proof');
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
  assert(profileLinksHelper.includes('compare_url') && profileLinksHelper.includes('compareArchetype') && profileLinksHelper.includes('recap_url'), 'profile links helper should expose compare-first and recap URLs');
  assert(profileLinksHelper.includes('privacy_url') && profileLinksHelper.includes('match_settings_url') && profileLinksHelper.includes('weekly_digest_preview_url') && profileLinksHelper.includes('leaderboard_url') && profileLinksHelper.includes('match_url'), 'profile links helper should expose opt-in discovery and return-loop URLs');
  assert(uploadsApi.includes('profileLinks(user, payload.archetype)'), 'browser profile saves should return compare-first profile links');
  assert(syncApi.includes('readSyncSession'), 'sync API should require signed CLI sync token sessions');
  assert(syncApi.includes('syncTokenIsRevoked'), 'sync API should reject owner-revoked CLI sync tokens');
  assert(!syncApi.includes('requireSameOrigin'), 'sync API should not require browser same-origin cookies');
  assert(syncApi.includes('profileLinks(user, payload.archetype)'), 'CLI sync saves should return compare-first profile links');
  assert(cliBin.includes('Minted GitHub-claimed, derived-only profile') && cliBin.includes('Invite people to compare:') && cliBin.includes('Copy/paste share:') && cliBin.includes('Share on X:') && cliBin.includes('Optional public discovery:') && cliBin.includes('Profiles stay unlisted unless you choose Public.') && cliBin.includes('Share your recap:') && cliBin.includes('README badge Markdown:') && cliBin.includes('Profile embed HTML:'), 'CLI sync success output should surface claimed identity, compare-first social share, opt-in discovery, recap, README badge, and embed hooks');
  assert(cliBin.includes('Install /vibestats for future reveals:') && cliBin.includes('Reserve weekly digest:') && cliBin.includes('Preview weekly digest:'), 'CLI sync success output should surface Claude Code and digest return hooks');
  assert(cliBin.includes('VIBESTATS_CLI_PACKAGE') && cliBin.includes('FALLBACK_CLI_PACKAGE'), 'CLI should allow printed npx commands to switch to a public package once one is published');
  assert(cliBin.includes("'.claude', 'usage-data'") && cliBin.includes('readInsightsInput(options.file)') && cliBin.includes('--dir PATH'), 'CLI sync should parse real Claude Code /insights directories by default');
  assert(cliBin.includes('requestSyncToken') && cliBin.includes('authUrlForLocalCallback') && cliBin.includes('127.0.0.1'), 'CLI sync should authorize through a local browser callback when browser auth is selected');
  assert(cliBin.includes('requestDeviceSyncToken') && cliBin.includes('/api/cli/device-start') && cliBin.includes('/api/cli/device-poll'), 'CLI join should support GitHub device-code authorization from the terminal');
  assert(cliBin.includes('--no-open') && cliBin.includes('Opening browser to authorize vibestats CLI sync'), 'CLI sync should support manual browser auth fallback');
  assert(cliBin.includes('printOnboardingStatus') && cliBin.includes('ready for reveal') && cliBin.includes('Status reads file names and counts only'), 'CLI should expose a privacy-preserving terminal onboarding preflight');
  assert(syncTokenApi.includes("if (!['POST', 'DELETE'].includes(req.method))"), 'sync token API should support generation and revocation');
  assert(syncTokenApi.includes('sync_token_invalidated_at'), 'sync token API should persist token revocation cutoff');
  assert(syncTokenApi.includes("github:brightseth/vibestats#feat/wave-1-identity") && syncTokenApi.includes('VIBESTATS_CLI_PACKAGE'), 'sync token API should avoid the occupied unscoped npm package name while allowing package override');
  assert(syncTokenApi.includes('${shellQuote(packageSpec)} --host') && !syncTokenApi.includes(' sync --host '), 'sync token API should generate the shorter one-command CLI form');
  assert(cliLocalTokenApi.includes("if (!['GET', 'POST'].includes(req.method))"), 'CLI browser auth endpoint should support approval page and token redirect');
  assert(cliLocalTokenApi.includes('allowedLocalCallback') && cliLocalTokenApi.includes('127.0.0.1') && cliLocalTokenApi.includes('localhost'), 'CLI browser auth endpoint should allow only local callbacks');
  assert(cliLocalTokenApi.includes('Authorize CLI sync') && cliLocalTokenApi.includes('requireSameOrigin(req)'), 'CLI browser auth endpoint should require same-origin browser approval before minting a token');
  assert(cliLocalTokenApi.includes('createSyncToken(user)') && cliLocalTokenApi.includes('syncTokenExpiresAt()'), 'CLI browser auth endpoint should mint expiring revocable sync tokens');
  assert(cliLocalTokenApi.includes('Raw Claude Code') && cliLocalTokenApi.includes('data stays on your machine'), 'CLI browser auth page should preserve the privacy promise');
  assert(cliDeviceStartApi.includes('requestGithubDeviceCode') && cliDeviceStartApi.includes("methodNotAllowed(res, ['POST']"), 'CLI device start endpoint should request GitHub device codes through a POST-only no-store API');
  assert(cliDevicePollApi.includes('pollGithubDeviceToken') && cliDevicePollApi.includes('fetchGithubUser') && cliDevicePollApi.includes('createSyncToken(user)'), 'CLI device poll endpoint should exchange GitHub approval for a revocable sync token');
  assert(githubOauthHelper.includes('GITHUB_DEVICE_GRANT_TYPE') && githubOauthHelper.includes('https://github.com/login/device/code') && githubOauthHelper.includes('https://github.com/login/oauth/access_token'), 'GitHub OAuth helper should implement the official device-code endpoints');
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
  assert(indexHtml.includes('What kind of coder are you? Claude Code already knows.') && indexHtml.includes('<code>/insights</code>') && indexHtml.includes('Copy status preflight') && indexHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && indexHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && indexHtml.includes('Claim when ready'), 'upload page should frame onboarding as a Claude Code status, reveal, and terminal-first claim path');
  assert(indexHtml.includes('function shouldAutoRunDemo()') && indexHtml.includes('setTimeout(runDemo, 120)'), 'demo-first URLs should auto-start the reveal instead of landing on manual upload');
  assert(indexHtml.includes('install-claude-command') && indexHtml.includes('Install /vibestats in Claude Code'), 'upload page should expose the installable Claude Code command path');
  assert(indexHtml.includes('Try the reveal demo') && indexHtml.includes('Copy npx reveal command') && indexHtml.includes('claim yours only when you want a public profile'), 'upload page should let cold visitors preview the reveal before asking them to publish');
  assert(indexHtml.includes('Explore sample pairings without data') && indexHtml.includes('href="/compare?a=orchestrator&b=shipper"'), 'upload page should give no-data visitors an archetype-pairing gallery path');
  assert(!indexHtml.includes('npx vibestats sync'), 'upload page should not advertise the occupied unscoped npm package name');
  assert(indexHtml.includes('No file hunting') && indexHtml.includes('checks the real ~/.claude/usage-data/ output with file counts first'), 'upload page should steer cold users away from manual file hunting');
  assert(indexHtml.includes('buildBehavioralMoments(insights)') && indexHtml.includes('longestSessionMinutes'), 'upload page should save derived behavioral moments from local reveal data');
  assert(indexHtml.includes('weekly_digest_available: body.weekly_digest_available === true'), 'upload page should preserve digest delivery readiness from identity status');
  assert(indexHtml.includes('identityStatus.weekly_digest_available === true'), 'upload page should preserve digest delivery readiness for inline copy');
  assert(indexHtml.includes('Reserve the Monday digest now; delivery starts when email infrastructure is enabled.'), 'upload page should capture digest consent before delivery is configured');
  assert(profileHtml.includes("fetch('/api/identity-status'"), 'profile page should check identity readiness before showing sign-in');
  assert(profileHtml.includes('function renderEmptyProfile') && profileHtml.includes('Signature mint pending'), 'profile page should render claimed-but-unminted profiles as a first-run state');
  assert(profileHtml.includes('function renderUnknownProfile') && profileHtml.includes('profile unclaimed') && profileHtml.includes('Copy unclaimed profile'), 'profile page should turn missing handles into reveal/claim landing states');
  assert(profileHtml.includes('renderUnknownProfile(me, profileHandle, identityStatus)') && profileHtml.includes('Only @${handle} can claim this exact URL with GitHub'), 'missing profile state should preserve GitHub-backed handle ownership');
  assert(profileHtml.includes('Raw sessions stay on your machine; only derived metrics save.'), 'missing profile state should preserve the raw-session privacy promise');
  assert(profileHtml.includes('sameHandle(me?.gh_handle, handle)') && profileHtml.includes("isOwner ? 'Reveal signature' : 'Mint yours'"), 'empty profile state should use owner-aware reveal actions');
  assert(profileHtml.includes('Raw insights stay in your browser; only derived metrics save.') && profileHtml.includes('Copy pending profile'), 'empty profile state should preserve the privacy promise and copyable profile loop');
  assert(profileHtml.includes('Profile saves pending'), 'profile page should avoid dead-end sign-in when identity is unavailable');
  assert(profileHtml.includes('Reveal yours vs @${handle}') && profileHtml.includes('What are you? Run /insights, check status, then reveal from your terminal.'), 'profile pages should act as share-recipient landing pages with the status and reveal commands');
  assert(profileHtml.includes('id="readme-panel"') && profileHtml.includes('Put your vibestats badge in a GitHub README') && profileHtml.includes('readmeBadgeMarkdown(handle, badgePath, uploadCompareUrl)'), 'owner profile should promote README badges as ambient compare-first distribution');
  assert(profileHtml.includes('id="moment-grid"') && profileHtml.includes('renderBehavioralMoments(latest)'), 'profile pages should render shareable derived behavioral moments');
  assert(settingsHtml.includes("fetch('/api/identity-status'"), 'settings page should check identity readiness before showing sign-in');
  assert(settingsHtml.includes('Profile saves are not configured on this deployment yet.'), 'settings page should explain unavailable identity instead of linking to dead-end auth');
  assert(settingsHtml.includes('id="settings-sign-in" role="button" aria-disabled="true"'), 'settings page should not render a live OAuth link before identity readiness is known');
  assert(settingsHtml.includes("signIn.removeAttribute('aria-disabled')"), 'settings page should enable sign-in only after identity readiness passes');
  assert(settingsHtml.includes('identityStatus.weekly_digest_available === true'), 'settings page should use digest delivery readiness for consent copy');
  assert(settingsHtml.includes('renderDigestControls(settings, identityStatus)'), 'settings page should centralize digest control readiness state');
  assert(settingsHtml.includes('Digest consent saved. Delivery starts when weekly email infrastructure is enabled.'), 'settings page should explain saved digest consent before delivery is configured');
  assert(settingsHtml.includes('checkbox.disabled = false') && settingsHtml.includes('save.disabled = false'), 'settings page should allow digest opt-ins before delivery is configured');
  assert(settingsHtml.includes('id="privacy-settings"'), 'settings page should expose a stable privacy opt-in anchor');
  assert(settingsHtml.includes('id="weekly-digest-row"'), 'settings page should expose a stable weekly digest anchor');
  assert(settingsHtml.includes('id="preview-digest"') && settingsHtml.includes('/api/digest/preview'), 'settings page should expose owner-only weekly digest preview');
  assert(!settingsHtml.includes('identityStatus.weekly_digest_available !== true && optIn'), 'settings page should not block new digest opt-ins when delivery is unavailable');
  assert(settingsHtml.includes("digest_email: optIn ? email : ''"), 'settings page should clear digest email when opt-in is turned off');
  assert(settingsHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && settingsHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && settingsHtml.includes('placeholder="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && settingsHtml.includes('terminal-first GitHub approval'), 'settings UI should expose terminal-first CLI status, reveal, and one-command sync generation');
  assert(settingsHtml.includes('install-claude-command'), 'settings UI should expose the installable Claude Code command path');
  assert(settingsHtml.includes('id="cli-sync"'), 'settings UI should expose a direct anchor for CLI sync setup');
  assert(settingsHtml.includes('id="match-settings"'), 'settings UI should expose a direct anchor for match intent setup');
  assert(settingsHtml.includes('Match intent saved, but your profile is still unlisted') && settingsHtml.includes("document.getElementById('privacy').focus()"), 'settings UI should preserve unlisted privacy when match intent is saved and prompt explicit public opt-in');
  assert(settingsHtml.includes('Visibility saved. Your active match intent can now appear in browse and /match.'), 'settings UI should confirm public visibility unlocks active match discovery');
  assert(settingsHtml.includes('id="revoke-sync-tokens"'), 'settings UI should expose CLI sync token revocation');
  assert(settingsHtml.includes('reveal` to preview locally'), 'settings UI should tell users how to preview CLI reveals locally');
  assert(settingsHtml.includes('reveal --json') && settingsHtml.includes('exact derived payload'), 'settings UI should reserve JSON mode for exact derived payload audits');
  assert(settingsHtml.includes('local Claude Code `/insights` directory') && settingsHtml.includes('keeps raw session data on disk'), 'settings UI should explain the CLI /insights extractor privacy boundary');
  assert(settingsHtml.includes("document.execCommand('copy')"), 'settings copy actions should fall back when Clipboard API is unavailable');
  assert(browseHtml.includes('emptyStateHtml({ unavailable') && browseHtml.includes('Try sample pairing') && browseHtml.includes('Reveal yours'), 'browse empty states should route visitors into reveal and comparison');
  assert(matchHtml.includes('emptyStateHtml({ unavailable') && matchHtml.includes('/settings#match-settings') && matchHtml.includes('Try sample pairing'), 'match empty states should route visitors into intent setup and comparison');
  assert(leaderboardHtml.includes('emptyStateHtml({ unavailable') && leaderboardHtml.includes('Try sample pairing') && leaderboardHtml.includes('Go public'), 'leaderboard empty states should route visitors into identity and comparison');
  assert(dashboardHtml.includes('url=https%3A%2F%2Fvibestats.io%2F%3FcompareArchetype%3Dorchestrator'), 'static dashboard X share should click through to Orchestrator comparison intake');
  assert(dashboardHtml.includes('href="/?compareArchetype=orchestrator"'), 'static dashboard final CTA should route to comparison intake');
  assert(dashboardHtml.includes('How would you pair with an Orchestrator?') && dashboardHtml.includes('What are you?'), 'static dashboard footer should use asymmetric comparison copy');
  assert(dashboardHtml.includes('/insights') && dashboardHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && dashboardHtml.includes('Copy status') && dashboardHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && dashboardHtml.includes('data-copy="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && dashboardHtml.includes('install-claude-command'), 'static dashboard should teach share recipients the terminal-first status, reveal, claim, and Claude Code install hooks directly');
  assert(dashboardHtml.includes("document.execCommand('copy')") && dashboardHtml.includes('[data-copy]'), 'static dashboard copy actions should fall back when Clipboard API is unavailable');
  assert(!dashboardHtml.includes('Claude Code Analytics'), 'static dashboard metadata should not revive the old analytics-first positioning');
  assert(settingsApi.includes('ownerProfileSettings'), 'authenticated settings API should use owner-only settings serializer');
  assert(settingsApi.includes('sync_token_invalidated_at'), 'authenticated settings API should preserve sync token revocation metadata');
  assert(settingsApi.includes('includeActivity: true'), 'authenticated settings API should retain owner activity timestamps');
  assert(!settingsApi.includes('Weekly digest delivery is not configured') && settingsApi.includes('email_consent_at'), 'settings API should save digest consent even before delivery env is configured');
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
  assert(packageJson.name === '@lets-vibe/vibestats' && packageJson.publishConfig?.access === 'public', 'package should be publish-ready under the public @lets-vibe scope');
  assert(packageJson.engines?.node === '>=20', 'package should declare the Node runtime needed by the ESM/fetch CLI');
  assert(JSON.parse(await readFile('package-lock.json', 'utf8')).packages?.['']?.name === '@lets-vibe/vibestats', 'package lock should match the scoped npm package name');
  assert(npmIgnore.includes('!bin/vibestats.js') && npmIgnore.includes('!lib/claude-insights-extractor.js') && npmIgnore.includes('!lib/insights-derived.js') && npmIgnore.includes('!api/_lib/moments.js') && npmIgnore.includes('!api/_lib/signatures.js'), 'npm package allowlist should include the CLI and derived scoring helpers');
  assert(npmIgnore.includes('!.claude/commands/vibestats.md'), 'npm package allowlist should include the installable Claude Code /vibestats command');
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
  assert(launchAudit.includes("label: 'reveal homepage'") && launchAudit.includes('Try the reveal demo') && launchAudit.includes('shouldAutoRunDemo()') && launchAudit.includes('agent-insights.json'), 'launch audit should prevent homepage onboarding regressions');
  assert(launchAudit.includes('install-claude-command'), 'launch audit should require the Claude Code command installer on the homepage');
  assert(launchAudit.includes('Explore sample pairings without data') && launchAudit.includes('/compare?a=orchestrator&b=shipper'), 'launch audit should verify the no-data archetype exploration path');
  assert(launchAudit.includes("label: 'profile JSON'") && launchAudit.includes('expectReady ? [200] : [200, 404, 503]'), 'launch audit should verify the saved profile JSON payload when identity is ready');
  assert(launchAudit.includes("label: 'profile page'") && launchAudit.includes('Copy README badge') && launchAudit.includes('id="reveal-panel"'), 'launch audit should verify the profile README-badge and share-recipient reveal surfaces');
  assert(launchAudit.includes("label: 'unknown profile fallback'") && launchAudit.includes('Copy unclaimed profile'), 'launch audit should verify missing profile reveal/claim fallback');
  assert(launchAudit.includes('"metric_visibility"') && launchAudit.includes('"leaderboard"') && launchAudit.includes('"evolution"') && launchAudit.includes('"streak"'), 'launch audit should require saved profile JSON to include public profile loop fields');
  assert(launchAudit.includes("label: 'profile embed'") && launchAudit.includes('Compare + reveal yours') && launchAudit.includes('Run /insights, check status, then reveal yours') && launchAudit.includes('<span>signal</span>'), 'launch audit should require saved profile embeds to expose comparison-oriented score proof and status-aware reveal copy');
  assert(launchAudit.includes("label: 'profile badge'") && launchAudit.includes('GitHub-claimed') && launchAudit.includes('derived-only'), 'launch audit should require saved profile badges to expose identity and derived-only credential proof');
  assert(launchAudit.includes("label: 'profile-backed pair route'") && launchAudit.includes('path: `/u/${encodeURIComponent(handle)}/pair/${encodeURIComponent(archetype)}`'), 'launch audit should cover profile-backed pair URLs');
  assert(launchAudit.includes("label: 'profile recap'") && launchAudit.includes('path: `/u/${encodeURIComponent(handle)}/recap`'), 'launch audit should cover profile recap return URLs');
  assert(launchAudit.includes('Copy sync command') && launchAudit.includes('Run CLI sync after more Claude Code work'), 'launch audit should verify recap-to-sync return action');
  assert(launchAudit.includes('Copy /vibestats install') && launchAudit.includes('install-claude-command'), 'launch audit should verify recap-to-Claude-command return action');
  assert(launchAudit.includes('Open the pairing, then claim yours') && launchAudit.includes('/?compareTo='), 'launch audit should verify dynamic pair metadata when identity is ready');
  assert(launchAudit.includes("See how you'd pair with @${handle}") && launchAudit.includes('Run /insights, check status, then reveal yours'), 'launch audit should verify compare-first homepage unfurl metadata');
  assert(launchAudit.includes('SECRET_NAME_PATTERNS') && launchAudit.includes('hasSecretName'), 'launch audit should avoid exposing secret env names');
  assert(launchAudit.includes("RAW_LEAK_PATTERNS = ['rawJson', 'tool_usage', 'language_usage']"), 'launch audit should scan public surfaces for raw-field markers');
  assert(launchAudit.includes("path: '/wrapped'") && launchAudit.includes("path: '/dashboard'") && launchAudit.includes("path: `/card?a="), 'launch audit should cover static and dynamic share surfaces');
  assert(launchAudit.includes("label: 'settings shell'") && launchAudit.includes('id="privacy-settings"') && launchAudit.includes('Unlisted profiles load by direct URL'), 'launch audit should verify settings anchors for CLI/public opt-in return loops');
  assert(
    launchAudit.includes("label: 'browse page'") && launchAudit.includes("label: 'match page'") && launchAudit.includes("label: 'leaderboard page'"),
    'launch audit should cover discovery, matchmaker, and scarcity surfaces',
  );
  assert(launchAudit.includes("label: 'browse page'") && launchAudit.includes("label: 'leaderboard page'") && launchAudit.includes('twitter.com/intent/tweet'), 'launch audit should verify direct X sharing on discovery surfaces');
  assert(launchAudit.includes('Try sample pairing') && launchAudit.includes('/settings#match-settings'), 'launch audit should verify productive empty states on discovery surfaces');
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
  assert(launchAudit.includes('--expect-ready') && launchAudit.includes('--expect-device-flow') && launchAudit.includes('--expect-digest'), 'launch audit should support strict production readiness gates');
  assert(launchAudit.includes('cronSecret: process.env.CRON_SECRET') && launchAudit.includes('weekly digest dry run has cron secret'), 'launch audit should run a protected digest dry run when strict digest readiness is expected');
  assert(launchAudit.includes('weekly digest dry run returns readiness payload') && launchAudit.includes('body.resend_ready === true'), 'launch audit should require digest dry-run readiness payload');
  assert(launchAudit.includes('weekly digest dry run has at least one candidate') && launchAudit.includes('weekly digest dry run proves return-loop content'), 'launch audit should require digest dry-run content proof');
  assert(launchAudit.includes('day_streak_included'), 'launch audit should require digest dry-run day-streak proof');
  assert(envExample.includes('POSTGRES_URL=') && envExample.includes('AUTH_SECRET=') && envExample.includes('VIBESTATS_CLI_PACKAGE='), '.env.example should document runtime env aliases and public CLI package override');
  assert((await readFile('db/migrations/0006_sync_token_revocation.sql', 'utf8')).includes('sync_token_invalidated_at'), 'migrations should support CLI sync token revocation');
  assert((await readFile('db/migrations/0007_https_contact_urls.sql', 'utf8')).includes("contact_url like 'https://%'"), 'migrations should enforce HTTPS public contact URLs for new rows');
  assert((await readFile('db/migrations/0008_privacy_not_null.sql', 'utf8')).includes("alter column privacy set not null"), 'migrations should enforce non-null profile privacy');
  assert((await readFile('db/migrations/0009_upload_archetype_canon.sql', 'utf8')).includes('uploads_archetype_check'), 'migrations should enforce the eight-archetype upload canon');
  assert((await readFile('db/migrations/0010_validate_contact_url_constraint.sql', 'utf8')).includes('validate constraint profile_settings_contact_url_protocol'), 'migrations should validate the HTTPS contact URL constraint');
  assert((await readFile('db/migrations/0011_upload_owner_not_null.sql', 'utf8')).includes('alter column user_id set not null'), 'migrations should prevent orphaned profile uploads');
  assert(githubOauthHelper.includes('gh_handle, avatar_url, privacy, last_seen_at') && githubOauthHelper.includes("'unlisted'"), 'GitHub OAuth should explicitly create unlisted profiles by default');
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
  assert(launchDoc.includes('profile/embed/badge/card/recap share surfaces') && launchDoc.includes('/u/<gh-handle>/recap'), 'launch checklist should include recap return surface proof');
  assert(launchDoc.includes('browse/match/leaderboard surfaces'), 'launch checklist should include discovery and scarcity launch surfaces');
  assert(launchDoc.includes('npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready'), 'launch checklist should require deployed viral-loop audit');
  assert(launchDoc.includes('requires more than a GitHub-created user row') && launchDoc.includes('at least one saved derived upload'), 'launch checklist should explain the first-upload gate for strict readiness');
  assert(launchDoc.includes('--expect-ready --expect-device-flow') && launchDoc.includes('Enable Device Flow'), 'launch checklist should document the strict terminal-first device-flow gate');
  assert(launchDoc.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity share --handle <saved-gh-handle>') && launchDoc.includes('npm run share:kit -- --handle <saved-gh-handle>'), 'launch checklist should document terminal and maintainer first-profile share kits');
  assert(launchDoc.includes('unscoped `vibestats` package is owned by another publisher') && launchDoc.includes('npm pack --dry-run') && launchDoc.includes('npm publish --access public'), 'launch checklist should document the scoped npm publish gate');
  assert(launchDoc.includes('VIBESTATS_CLI_PACKAGE') && launchDoc.includes('scoped package') && launchDoc.includes('static onboarding snippets'), 'launch checklist should document the public npm package command switchover');
  assert(launchDoc.includes('CRON_SECRET=<cron-secret> npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready --expect-device-flow --expect-digest'), 'launch checklist should require strict device-flow and digest audit once email is configured');
  assert(launchDoc.includes('protected weekly digest dry run') && launchDoc.includes('does not print the secret value'), 'launch checklist should document strict digest dry-run proof');
  assert(launchDoc.includes('Digest consent can be captured before delivery env is present'), 'launch checklist should document digest consent capture before delivery readiness');
  assert(launchDoc.includes('at least one saved profile must be opted in') && launchDoc.includes('day-based streak') && launchDoc.includes('derived-only privacy copy'), 'launch checklist should require a real digest candidate for strict proof');
  assert(launchDoc.includes('Profile JSON includes evolution, day-based streak, rarity, and leaderboard fields.'), 'launch checklist should require profile return-loop JSON proof');
  assert(launchDoc.includes('Profile embed and badge show comparison-oriented scored credential proof.'), 'launch checklist should require scored portable credential proof');
  assert(badgeApi.includes('return sendSvg(res, 404, badgeSvg({'), 'badge endpoint should return SVG for missing/private profile badges');
  assert(launchDoc.includes('Identity is not production-ready until GitHub OAuth is added') && launchDoc.includes('preview identity audits will still fail until a strong session secret is also added to Preview'), 'launch checklist should record current identity env blockers');
  assert(launchDoc.includes('includes one-click unsubscribe'), 'launch checklist should require digest unsubscribe proof');
  const readme = await readFile('README.md', 'utf8');
  assert(readme.includes('A successful sync mints a GitHub-claimed, derived-only profile') && readme.includes('profile URL, compare-first invite URL, copy/paste share line, X share URL'), 'README should document CLI compare-first sync output');
  assert(readme.includes('real Claude Code `/insights` output directory') && readme.includes('session-meta/*.json') && readme.includes('facets/*.json'), 'README should document the real Claude Code /insights extractor');
  assert(readme.includes('Terminal-first onboarding is intentionally short') && readme.includes('`status` is the local preflight') && readme.includes('`reveal` is the local, no-sign-in result') && readme.includes('No website upload is required') && readme.includes('Use `sync` or `join --yes` for explicit non-interactive publishing'), 'README should document terminal-first CLI status, reveal, consent, and sync without manual website upload');
  assert(readme.includes('This repo is packaged as `@lets-vibe/vibestats`') && readme.includes('npm pack --dry-run') && readme.includes('npm publish --access public'), 'README should document scoped npm package publication before broad sharing');
  assert(readme.includes('VIBESTATS_CLI_PACKAGE') && readme.includes('GitHub branch fallback'), 'README should document the public CLI package override before broad npm sharing');
  assert(readme.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity share --handle <saved-gh-handle>') && readme.includes('npm run share:kit -- --handle <saved-gh-handle>'), 'README should document terminal and maintainer copy-ready share kits for minted profiles');
  assert(readme.includes('Use `share --handle <saved-gh-handle>`') && readme.includes('privacy proof without opening the website'), 'README should document the CLI share command for terminal-only distribution');
  assert(readme.includes('Use `reveal` to show the derived result locally') && readme.includes('archetype-only compare link, a pasteable terminal card, copy-ready reveal text, X share URL') && readme.includes('`reveal --json` to inspect the exact derived payload') && readme.includes('`--dry-run` remains a legacy alias'), 'README should document human CLI reveal before payload JSON');
  assert(readme.includes('GitHub-claimed, derived-only profile'), 'README should describe the terminal-created profile credential accurately');
  assert(readme.includes('Collectible profile badges') && readme.includes('public-safe rarity'), 'README should document collectible public achievement badges');
  assert(readme.includes('README badge Markdown, and profile embed HTML'), 'README should document post-sync portable distribution snippets');
  assert(readme.includes('A facet radar') && readme.includes('not just one label'), 'README should document the derived facet radar');
  assert(readme.includes('Facet-aware comparisons and matches') && readme.includes('not only the top archetype'), 'README should document facet-aware social scoring');
  assert(readme.includes('A profile recap surface') && readme.includes('/u/<handle>/recap'), 'README should document profile recaps as a return surface');
  assert(readme.includes('.claude/commands/vibestats.md') && readme.includes('install-claude-command') && readme.includes('~/.claude/commands/vibestats.md'), 'README should document the installable Claude Code /vibestats activation path');
  assert((await readFile('.npmignore', 'utf8')).includes('!lib/share-kit.js'), 'npm package should include the shared CLI share-kit helper');
  assert(claudeCommand.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && claudeCommand.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && claudeCommand.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity sync') && !claudeCommand.includes('feat/wave-1-identity join') && claudeCommand.includes('Only after the user agrees'), 'Claude Code command should preflight, reveal locally, then explicit sync after human consent');
  assert(claudeCommand.includes('no manual website upload is required') && claudeCommand.includes('GitHub-backed, derived-only profile') && claudeCommand.includes('README badge, embed, or recap links'), 'Claude Code command should keep terminal-only onboarding explicit after the reveal');
  assert(claudeCommand.includes('Use the local reveal output directly') && claudeCommand.includes('pasteable terminal card') && claudeCommand.includes('copy-ready reveal text, X share URL') && claudeCommand.includes('archetype-only compare link') && claudeCommand.includes('/vibestats` install command') && claudeCommand.includes('reveal --json'), 'Claude Code command should treat JSON as an explicit audit path');
  assert(claudeCommand.includes('Do not `cat`, summarize, paste, upload, or quote files under `~/.claude/usage-data/session-meta/`'), 'Claude Code command should preserve raw session privacy');
  assert(claudeCommand.includes('Do not mention `agent-insights.json` as the normal path'), 'Claude Code command should explicitly avoid the dead agent-insights path');
  assert((await readFile('match.html', 'utf8')).includes('&b=${encodeURIComponent(handle)}'), 'match compare links should preserve candidate profile identity');
  assert(profileHtml.includes('leaderboardText(profile.leaderboard)'), 'profile UI should render public weekly rank');
  assert(profileHtml.includes('evolution-pill'), 'profile UI should render evolution badge');
  assert(profileHtml.includes('const streak = profile.streak || null') && profileHtml.includes('${esc(streak.label)}'), 'profile UI should render server-derived day streaks');
  assert(!profileHtml.includes('function uploadStreak(uploads)'), 'profile UI should not recompute hidden history streaks from visitor uploads');
  assert(profileHtml.includes('/browse?archetype=${encodeURIComponent(hostArchetype)}'), 'profile UI should link to filtered directory');
  assert(profileHtml.includes('id="facet-panel"') && profileHtml.includes('renderFacetRadar(latest)'), 'profile UI should render a derived facet radar');
  assert(profileHtml.includes('derived from public archetype scores') && profileHtml.includes('raw /insights data stays local'), 'profile facet radar should state its privacy boundary');
  assert(profileHtml.includes('id="achievement-panel"') && profileHtml.includes('renderAchievements(profile)'), 'profile UI should render collectible achievement badges');
  assert(profileHtml.includes('Collectible profile badges') && profileHtml.includes('copyable scarcity proof') && profileHtml.includes('raw /insights data stays local'), 'profile achievements should state their derived-data boundary');
  assert(profileHtml.includes('achievementShareText(handle, latest, badge, compareUrl)') && profileHtml.includes('Copy badge proof') && profileHtml.includes('Share badge') && profileHtml.includes('data-copy-achievement') && profileHtml.includes('achievementXShareUrl(share, compareUrl)'), 'profile achievements should be copyable share objects that route recipients into comparison');
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
  const parsedStrict = parseArgs(['--origin', 'https://vibestats.io', '--handle', 'brightseth', '--expect-ready', '--expect-device-flow', '--expect-digest']);
  assert(parsedStrict.expectReady === true && parsedStrict.expectDeviceFlow === true && parsedStrict.expectDigest === true, 'launch audit should parse strict ready, device-flow, and digest gates independently');

  const parsedCurl = parseVercelCurlResponse(`Retrieving project...\nHTTP/2 200\r\ncache-control: no-store\r\ncontent-type: application/json; charset=utf-8\r\n\r\n{"ok":true}`);
  assert(parsedCurl.response.status === 200, 'vercel curl parser should read HTTP status');
  assert(parsedCurl.response.headers.get('cache-control') === 'no-store', 'vercel curl parser should expose response headers');
  assert(parsedCurl.body === '{"ok":true}', 'vercel curl parser should isolate the response body');
  assert(launchAuditSource.includes("path: '/api/sync'") && launchAuditSource.includes("Authorization: 'Bearer a.b.c'"), 'launch audit should probe public sync failure without exposing env names');
  assert(launchAuditSource.includes("'/api/cli/device-start'") && launchAuditSource.includes('CLI device auth start is reachable') && launchAuditSource.includes('CLI device auth start returns live GitHub device code'), 'launch audit should verify terminal-first device auth readiness or explicit enablement action');
  assert(launchAuditSource.includes("path: '/api/me'") && launchAuditSource.includes("Cookie: 'vibestats_auth=a.b.c'"), 'launch audit should probe session failure without exposing env names');
  assert(launchAuditSource.includes("label: 'weekly digest cron guard'"), 'launch audit should probe the weekly digest cron guard without exposing env names');
  console.log('ok launch audit supports protected Vercel previews');
}

async function assertUpdateCliCommandScript() {
  const { FALLBACK_COMMAND, TARGET_FILES, parseArgs, updateCliCommand } = await import('../scripts/update-cli-command.mjs');
  const parsed = parseArgs(['--package', '@lets-vibe/vibestats', '--write']);
  assert(parsed.packageSpec === '@lets-vibe/vibestats' && parsed.write === true, 'CLI command update script should parse package and write mode');
  const report = await updateCliCommand({ packageSpec: '@lets-vibe/vibestats', write: false });
  const home = report.files.find((item) => item.file === 'home.html');
  const audit = report.files.find((item) => item.file === 'scripts/launch-audit.mjs');
  assert(report.write === false && report.from === FALLBACK_COMMAND && report.to === 'npx --yes @lets-vibe/vibestats', 'CLI command update script should default to dry-run replacement reporting');
  assert(report.replacements > 0 && home?.count > 0 && audit?.count > 0, 'CLI command update script should cover public static snippets and launch audit expectations');
  assert(TARGET_FILES.includes('README.md') && TARGET_FILES.includes('settings.html') && TARGET_FILES.includes('.claude/commands/vibestats.md'), 'CLI command update script should cover docs, settings, and Claude Code install command');
  console.log('ok CLI command update script supports npm package switchover');
}

async function assertShareKitScript() {
  const { buildShareKit, fetchProfile, parseArgs, shareKitText } = await import('../scripts/share-kit.mjs');
  const parsed = parseArgs(['--origin', 'https://vibestats.example/path', '--handle', '@alex', '--json']);
  assert(parsed.origin === 'https://vibestats.example' && parsed.handle === 'alex' && parsed.json === true, 'share kit should parse origin, handle, and JSON mode');

  const profile = {
    user: { gh_handle: 'alex', avatar_url: 'https://example.invalid/avatar.png' },
    uploads: [{
      archetype: 'shipper',
      raw_meta: {
        signature: 'prolific Shipper',
        signatureCombo: 'shipper+builder',
      },
      scores: { shipper: 92 },
      metrics: {},
    }],
    rarity: { count: 2, tier: 'rare', window_days: 30 },
    achievements: [{ id: 'rarity-rare', label: 'Rare signature' }],
  };
  const kit = buildShareKit(profile, { origin: 'https://vibestats.example', handle: 'alex' });
  assert(kit.urls.profile === 'https://vibestats.example/u/alex', 'share kit should include the public profile URL');
  assert(kit.urls.compare === 'https://vibestats.example/?compareTo=alex&compareArchetype=shipper', 'share kit should route the primary invite into compare-first onboarding');
  assert(kit.copy.share_text.includes('@alex is prolific Shipper') && kit.copy.share_text.includes('Raw /insights stayed local'), 'share kit should generate privacy-aware copy text');
  assert(kit.copy.x_share_url.startsWith('https://twitter.com/intent/tweet?') && new URL(kit.copy.x_share_url).searchParams.get('url') === kit.urls.compare, 'share kit should generate an X intent URL that clicks into compare');
  assert(kit.copy.readme_badge_markdown.includes('/u/alex/badge.svg') && kit.copy.readme_badge_markdown.includes(kit.urls.compare), 'share kit should generate compare-first README badge markdown');
  assert(kit.copy.embed_html.includes('/u/alex/embed') && kit.copy.embed_html.includes('title="@alex on vibestats"'), 'share kit should generate a portable embed snippet');
  assert(kit.copy.terminal_onboarding.includes('/insights') && kit.copy.terminal_onboarding.some((line) => line.includes('status')), 'share kit should include terminal onboarding commands');
  assert(kit.privacy_proof.public_payload_has_no_raw_usage_fields === true, 'share kit should prove public profile payload has no raw usage fields');
  const text = shareKitText(kit);
  assert(text.includes('vibestats share kit: @alex') && text.includes('Compare invite: https://vibestats.example/?compareTo=alex&compareArchetype=shipper') && text.includes('Privacy proof:'), 'share kit text should be copy-ready and include privacy proof');

  const fetched = await fetchProfile({
    origin: 'https://vibestats.example',
    handle: 'alex',
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      async json() {
        return { ok: true, url };
      },
    }),
  });
  assert(fetched.ok === true && fetched.url === 'https://vibestats.example/api/u/alex', 'share kit should fetch public profile JSON by handle');
  let failed = false;
  try {
    await fetchProfile({
      origin: 'https://vibestats.example',
      handle: 'missing',
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        async json() {
          return { error: 'Profile unavailable' };
        },
      }),
    });
  } catch (err) {
    failed = String(err.message).includes('Profile unavailable');
  }
  assert(failed, 'share kit should fail clearly when the public profile API is unavailable');
  console.log('ok share kit script generates privacy-safe launch assets');
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

async function assertCliDeviceAuthHelpers() {
  const {
    GITHUB_DEVICE_GRANT_TYPE,
    fetchGithubUser,
    pollGithubDeviceToken,
    requestGithubDeviceCode,
  } = await import('../api/_lib/github-oauth.js');
  const { default: startHandler } = await import('../api/cli/device-start.js');
  const { default: pollHandler } = await import('../api/cli/device-poll.js');
  const keys = ['GITHUB_CLIENT_ID'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.GITHUB_CLIENT_ID = 'github-client-id';
    let deviceRequest = null;
    const device = await requestGithubDeviceCode({
      fetchImpl: async (url, options = {}) => {
        deviceRequest = { url, options };
        return {
          ok: true,
          async json() {
            return {
              device_code: 'device-code',
              user_code: 'ABCD-1234',
              verification_uri: 'https://github.com/login/device',
              expires_in: 900,
              interval: 5,
            };
          },
        };
      },
    });
    assert(device.user_code === 'ABCD-1234' && device.verification_uri === 'https://github.com/login/device', 'GitHub device helper should return terminal display fields');
    assert(deviceRequest.url === 'https://github.com/login/device/code', 'GitHub device helper should request the official device code endpoint');
    assert(JSON.parse(deviceRequest.options.body).client_id === 'github-client-id', 'GitHub device helper should use the configured OAuth client id');

    let pollRequest = null;
    const pending = await pollGithubDeviceToken('device-code', {
      fetchImpl: async (url, options = {}) => {
        pollRequest = { url, options };
        return {
          ok: true,
          async json() {
            return { error: 'authorization_pending' };
          },
        };
      },
    });
    assert(pending.error === 'authorization_pending', 'GitHub device poll helper should expose pending authorization states');
    const pollBody = JSON.parse(pollRequest.options.body);
    assert(pollRequest.url === 'https://github.com/login/oauth/access_token' && pollBody.grant_type === GITHUB_DEVICE_GRANT_TYPE, 'GitHub device poll helper should use the official device grant');

    let userRequest = null;
    const user = await fetchGithubUser('github-access-token', {
      fetchImpl: async (url, options = {}) => {
        userRequest = { url, options };
        return {
          ok: true,
          async json() {
            return { id: 123, login: 'alex', avatar_url: 'https://example.invalid/avatar.png' };
          },
        };
      },
    });
    assert(user.login === 'alex', 'GitHub user helper should return the authorized GitHub identity');
    assert(userRequest.url === 'https://api.github.com/user' && userRequest.options.headers.Authorization === 'Bearer github-access-token', 'GitHub user helper should fetch identity with the device access token');

    const startMethodRes = mockRes();
    await startHandler({ method: 'GET', headers: { host: 'localhost:3000' } }, startMethodRes);
    assert(startMethodRes.statusCode === 405 && startMethodRes.headers.Allow === 'POST', 'CLI device start endpoint should reject non-POST methods');
    assertNoStore(startMethodRes, 'CLI device start method guard');

    const pollMethodRes = mockRes();
    await pollHandler({ method: 'GET', headers: { host: 'localhost:3000' } }, pollMethodRes);
    assert(pollMethodRes.statusCode === 405 && pollMethodRes.headers.Allow === 'POST', 'CLI device poll endpoint should reject non-POST methods');
    assertNoStore(pollMethodRes, 'CLI device poll method guard');
  } finally {
    for (const key of keys) {
      if (previous[key] == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
  console.log('ok CLI device auth helpers support terminal-first GitHub login');
}

async function assertProfileShareLoop() {
  const indexHtml = await readFile('home.html', 'utf8');
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
  assert(profileHtml.includes('id="privacy-cta"') && profileHtml.includes('/settings#privacy-settings'), 'owner profile should expose explicit public discovery opt-in');
  assert(profileHtml.includes('id="match-intent-cta"') && profileHtml.includes('/settings#match-settings'), 'owner profile should expose match intent setup');
  assert(profileHtml.includes('Your profile is unlisted. Share direct links freely'), 'owner profile should preserve unlisted privacy while offering public discovery');
  assert(profileHtml.includes('id="sync-cta"') && profileHtml.includes('sync from the CLI'), 'owner profile should expose return-loop CLI sync setup');
  assert(profileHtml.includes('id="digest-cta"') && profileHtml.includes('id="digest-preview-cta"') && profileHtml.includes('preview the weekly email'), 'owner profile should expose return-loop weekly email setup and preview');
  assert(profileHtml.includes('readmeBadgeMarkdown(handle, badgePath, uploadCompareUrl)') && profileHtml.includes('](${compareUrl})'), 'profile badge markdown should click through to upload-to-compare');
  assert(profileHtml.includes('id="reveal-panel"') && profileHtml.includes('renderRevealPanel(me, profile, latest)'), 'profile pages should show share recipients a direct reveal panel');
  assert(profileHtml.includes('Claude Code has already captured your build fingerprint') && profileHtml.includes('STATUS_COMMAND') && profileHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && profileHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal'), 'profile reveal panel should carry the terminal-first status and reveal command path without sending visitors hunting');
  assert(profileHtml.includes('CLAIM_COMMAND') && profileHtml.includes('Copy claim') && profileHtml.includes('Copy status') && profileHtml.includes('INSTALL_CLAUDE_COMMAND') && profileHtml.includes('install-claude-command'), 'profile reveal surfaces should let share recipients preflight, claim from terminal, and install the Claude Code command');
  assert(profileHtml.includes("document.execCommand('copy')"), 'profile copy actions should fall back when Clipboard API is unavailable');
  assert(profileHtml.includes('profileProofLine(profile)'), 'profile share copy should include scarcity or leaderboard social proof');
  assert(profileHtml.includes("Raw /insights stayed local. See how you'd pair:"), 'achievement share copy should preserve the privacy promise while driving comparison');
  assert(profileHtml.includes('GitHub-claimed, derived-only profile'), 'profile share copy should carry credential and privacy proof');
  assert(indexHtml.includes("const PENDING_UPLOAD_KEY = 'vibestats_pending_upload'"), 'upload page should persist pending derived saves across auth');
  assert(indexHtml.includes('Only derived profile data is persisted here. Raw insights JSON is never stored.'), 'pending auth save must document derived-only storage');
  assert(indexHtml.includes('resumePendingProfileSave'), 'upload page should resume pending profile save after auth');
  assert(indexHtml.includes('/pair/${encodeURIComponent'), 'upload-to-compare should route to handle-backed pairing');
  assert(indexHtml.includes('digest-email-inline'), 'post-save profile flow should offer weekly digest opt-in');
  assert(indexHtml.includes('weekly_digest_opt_in: true'), 'inline digest opt-in should use settings API');
  assert(indexHtml.includes('postSaveInviteText(profilePath, comparePath, archetype, scores)'), 'post-save save state should copy asymmetric profile invite text');
  assert(indexHtml.includes('comparePathFromSave(result.compare_url, archetype)'), 'post-save invite copy should use compare-first URL returned by save APIs');
  assert(indexHtml.includes("pathFromSaveUrl(result.privacy_url, '/settings#privacy-settings')") && indexHtml.includes('Your profile starts unlisted.'), 'post-save save state should preserve unlisted-by-default privacy while offering public discovery opt-in');
  assert(indexHtml.includes("pathFromSaveUrl(result.match_settings_url, '/settings#match-settings')") && indexHtml.includes('Set match intent'), 'post-save save state should route owners into match intent setup');
  assert(indexHtml.includes('pathFromSaveUrl(result.leaderboard_url') && indexHtml.includes('View weekly board'), 'post-save save state should route owners back to their leaderboard');
  assert(indexHtml.includes('pathFromSaveUrl(result.match_url') && indexHtml.includes('Find matches'), 'post-save save state should route owners into goal-driven matches');
  assert(indexHtml.includes('return `${parsed.pathname}${parsed.search}${parsed.hash}`'), 'post-save save state must preserve query params from API compare URLs');
  assert(indexHtml.includes('Profile: ${canonicalVibestatsUrl(profilePath)}'), 'post-save invite copy should retain the profile credential link');
  assert(indexHtml.includes("document.execCommand('copy')"), 'upload/post-save copy actions should fall back when Clipboard API is unavailable');
  assert(indexHtml.includes('url=${encodeURIComponent(shareClickUrl)}'), 'archetype result X share should click through directly to comparison');
  assert(indexHtml.includes("copyShareLink(this, '${shareClickUrl}')"), 'archetype result copy button should copy the comparison entry point');
  assert(indexHtml.includes('Profile: ${profileShareUrl}'), 'saved result X share should retain the profile as credential context');
  assert(indexHtml.includes('Card: ${cardShareUrl}'), 'ephemeral result X share should retain the share card as credential context');
  assert(indexHtml.includes('id="copy-saved-badge"'), 'post-save save state should expose portable badge copy');
  assert(indexHtml.includes('Put the README badge in your GitHub repos') && indexHtml.includes('Copy README badge'), 'post-save profile flow should push README badges as an ambient distribution loop');
  assert(indexHtml.includes('readmeBadgeMarkdown(handle, badgePath, canonicalCompare)') && indexHtml.includes('](${compareUrl})'), 'post-save badge markdown should click through to upload-to-compare');
  assert(indexHtml.includes('id="copy-saved-embed"'), 'post-save save state should expose portable embed copy');
  assert(indexHtml.includes('id="copy-saved-profile"'), 'post-save save state should expose profile URL copy');
  assert(indexHtml.includes('href="/settings#cli-sync"'), 'post-save save state should route owners into CLI sync setup');
  assert(indexHtml.includes('id="copy-saved-install"') && indexHtml.includes('INSTALL_CLAUDE_COMMAND'), 'post-save save state should expose the Claude Code /vibestats install hook');
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
  assert(compareHtml.includes("showPicker(knownSubject, { intent: 'claim', missingHandle })"), 'compare route should preserve a known profile when the other side is unminted');
  assert(compareHtml.includes('That profile is not minted yet. Preview a pairing or reveal yours.'), 'compare route should make missing profile pair links productive');
  assert(compareHtml.includes('Run /insights, check status, then reveal your real pairing'), 'compare picker should teach the status and reveal flow for share recipients');
  assert(compareHtml.includes('STATUS_COMMAND') && compareHtml.includes('copyCommand(STATUS_COMMAND, this)') && compareHtml.includes("copyCommand('/insights', this)") && compareHtml.includes('copyCommand(REVEAL_COMMAND, this)') && compareHtml.includes('copyCommand(CLAIM_COMMAND, this)') && compareHtml.includes('INSTALL_CLAUDE_COMMAND') && compareHtml.includes('Copy install'), 'compare picker should expose copy buttons for status, reveal, claim, and the Claude Code install return hook');
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
  assert(body.includes('What are you?') && body.includes('/insights') && body.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && body.includes('Copy status') && body.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && body.includes('data-copy="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && body.includes('Copy claim'), 'share card should teach recipients the terminal-first status, reveal, and claim commands without another hop');
  assert(body.includes('data-copy=') && body.includes("document.execCommand('copy')"), 'share card reveal commands should be copyable with clipboard fallback');
  assert(body.includes('install-claude-command'), 'share card should expose the installable Claude Code /vibestats command');
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
  assert(wrappedHtml.includes('copyText(wrappedCompareUrl)'), 'wrapped copy link should copy the upload-to-compare target');
  assert(wrappedHtml.includes('Card: ${wrappedUrl}'), 'wrapped share text should retain the card as credential context');
  assert(wrappedHtml.includes("See how you'd pair with an Orchestrator"), 'wrapped share page should use comparison copy');
  assert(wrappedHtml.includes('What are you?') && wrappedHtml.includes('/insights') && wrappedHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity status') && wrappedHtml.includes('Copy status') && wrappedHtml.includes('npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal') && wrappedHtml.includes('data-copy="npx --yes github:brightseth/vibestats#feat/wave-1-identity"') && wrappedHtml.includes('install-claude-command'), 'wrapped share page should teach recipients the terminal-first status, reveal, claim, and Claude Code install hooks directly');
  assert(wrappedHtml.includes("document.execCommand('copy')") && wrappedHtml.includes('[data-copy]'), 'wrapped reveal and compare copy actions should fall back when Clipboard API is unavailable');
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
    candidateFacets: [
      { id: 'shipping_velocity', value: 92 },
      { id: 'build_energy', value: 88 },
      { id: 'debug_patience', value: 70 },
    ],
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
  assert(strong.facet_focus?.id && strong.reason.includes('Facet fit'), 'goal fit should use derived facet radar signals');
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

async function assertFacetRadar() {
  const { publicFacetRadar } = await import('../api/_lib/facets.js');
  const facets = publicFacetRadar({
    builder: 999,
    shipper: 80,
    sprinter: 70,
    architect: 50,
    orchestrator: -10,
    debugger: 35,
    polyglot: 20,
    deepdiver: 60,
    rawJson: 100,
  });
  assert(facets.length === 7, 'facet radar should expose the seven derived axes');
  assert(facets.every((facet) => Number.isInteger(facet.value) && facet.value >= 0 && facet.value <= 100), 'facet radar values should be clamped public scores');
  assert(facets.some((facet) => facet.id === 'shipping_velocity' && facet.value > 70), 'facet radar should derive shipping velocity from public scores');
  assert(!JSON.stringify(facets).includes('rawJson'), 'facet radar must not echo unknown score fields');
  console.log('ok facet radar stays derived from public scores');
}

async function assertPublicAchievements() {
  const { publicAchievements } = await import('../api/_lib/achievements.js');
  const achievements = publicAchievements({
    upload: {
      raw_meta: {
        moments: [
          { id: 'terminal_commands', value: 2450, prompt: 'private prompt should drop' },
          { id: 'unknown', value: 99999 },
        ],
      },
    },
    publicUpload: {
      archetype: 'builder',
      scores: { builder: 92 },
      facets: [
        { id: 'build_energy', label: 'Build energy', value: 81, detail: 'Builds' },
        { id: 'deep_focus', label: 'Deep focus', value: 42, detail: 'Focus' },
      ],
    },
    signature: { label: 'high-velocity Builder' },
    rarity: { count: 8, tier: 'rare', window_days: 30 },
    leaderboard: { rank: 4, label: 'builder' },
    streak: { active: true, days: 14, upload_count: 3, label: '14-day streak', detail: '3 saved results in this streak' },
    evolution: { type: 'score-gain', label: '+6 Builder points', detail: 'vs last upload' },
  });
  assert(achievements.length <= 5, 'public achievements should keep a tight collectible set');
  assert(achievements[0].id === 'rarity-rare', 'public achievements should prioritize rare signature scarcity');
  assert(achievements.some((badge) => badge.id === 'facet-build_energy' && badge.value === '81%'), 'public achievements should include the strongest derived facet');
  assert(achievements.some((badge) => badge.id === 'moment-terminal_commands' && badge.value === '1k+ commands'), 'public achievements should bucket derived moments');
  assert(!JSON.stringify(achievements).includes('2450'), 'public achievements should not expose exact moment counts by default');
  assert(!JSON.stringify(achievements).includes('private prompt'), 'public achievements must not echo arbitrary moment text');
  console.log('ok public achievements stay collectible and privacy-safe');
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

  const { DEFAULT_CLAUDE_COMMAND_PATH, DEFAULT_INSTALL_COMMAND, DEFAULT_NPX_JOIN_COMMAND, DEFAULT_NPX_REVEAL_COMMAND, DEFAULT_NPX_STATUS_COMMAND, DEFAULT_NPX_SYNC_COMMAND, authUrlForLocalCallback, cliErrorMessage, cliRevealShareText, cliRevealTerminalCard, cliRevealXShareUrl, cliShareText, cliXShareUrl, confirmPublish, dryRunRevealText, installClaudeCommand, isDirectRun, isSyncCommand, normalizeHost, onboardingStatus, onboardingStatusText, parseArgs, printOnboardingStatus, printProfileShareKit, requestDeviceSyncToken, requestSyncToken, sync } = await import('../bin/vibestats.js');
  const parsed = parseArgs(['node', 'vibestats', 'sync', '--dry-run']);
  assert(parsed.options.dryRun === true, 'CLI sync should parse dry-run mode');
  assert(parsed.options.file.endsWith(join('.claude', 'usage-data')), 'CLI sync should default to the real Claude Code /insights output directory');
  assert(DEFAULT_CLAUDE_COMMAND_PATH.endsWith(join('.claude', 'commands', 'vibestats.md')), 'CLI should default Claude command installs to the user Claude commands directory');
  const parsedDefault = parseArgs(['node', 'vibestats']);
  assert(parsedDefault.command === 'onboard' && parsedDefault.options.authMode === 'device' && parsedDefault.options.promptToPublish === true, 'CLI should default to consented terminal-first onboarding so the copied npx command needs no subcommand');
  const parsedDefaultDryRun = parseArgs(['node', 'vibestats', '--dry-run']);
  assert(parsedDefaultDryRun.command === 'onboard' && parsedDefaultDryRun.options.dryRun === true && parsedDefaultDryRun.options.promptToPublish === false, 'CLI should keep dry-run as a no-subcommand reveal alias');
  const parsedReveal = parseArgs(['node', 'vibestats', 'reveal']);
  assert(parsedReveal.command === 'reveal' && parsedReveal.options.dryRun === true && isSyncCommand(parsedReveal.command), 'CLI should accept reveal as the first-class local dry-run command');
  const parsedStatus = parseArgs(['node', 'vibestats', 'status', '--json']);
  assert(parsedStatus.command === 'status' && parsedStatus.options.json === true && !isSyncCommand(parsedStatus.command), 'CLI should accept status as a terminal preflight without publishing');
  const parsedShare = parseArgs(['node', 'vibestats', 'share', '--handle', '@alex', '--host=https://vibestats.example', '--json']);
  assert(parsedShare.command === 'share' && parsedShare.options.handle === 'alex' && parsedShare.options.host === 'https://vibestats.example' && parsedShare.options.json === true && !isSyncCommand(parsedShare.command), 'CLI should accept share as a terminal profile distribution command without publishing');
  const parsedJoin = parseArgs(['node', 'vibestats', 'join', '--dry-run']);
  const parsedOnboard = parseArgs(['node', 'vibestats', 'onboard', '--dry-run']);
  assert(parsedJoin.command === 'join' && isSyncCommand(parsedJoin.command) && parsedJoin.options.authMode === 'device', 'CLI should accept join as a terminal-first device-auth sync alias');
  assert(parsedOnboard.command === 'onboard' && isSyncCommand(parsedOnboard.command) && parsedOnboard.options.authMode === 'device', 'CLI should accept onboard as a terminal-first device-auth sync alias');
  const parsedYes = parseArgs(['node', 'vibestats', 'join', '--yes']);
  assert(parsedYes.options.assumeYes === true && parsedYes.options.promptToPublish === true, 'CLI join should support explicit yes for non-interactive terminal publishing');
  const parsedBrowser = parseArgs(['node', 'vibestats', 'join', '--browser']);
  const parsedDevice = parseArgs(['node', 'vibestats', 'sync', '--device']);
  assert(parsedBrowser.options.authMode === 'browser' && parsedDevice.options.authMode === 'device' && parsedDevice.options.promptToPublish === false, 'CLI should let users choose browser or device auth explicitly');
  const parsedJson = parseArgs(['node', 'vibestats', '--dry-run', '--json']);
  assert(parsedJson.options.dryRun === true && parsedJson.options.json === true, 'CLI dry-run should offer a JSON escape hatch for payload audits');
  const parsedRevealJson = parseArgs(['node', 'vibestats', 'reveal', '--json']);
  assert(parsedRevealJson.options.dryRun === true && parsedRevealJson.options.json === true, 'CLI reveal should offer a JSON escape hatch for payload audits');
  const parsedInstall = parseArgs(['node', 'vibestats', 'install-claude-command', '--force', '--path', '/tmp/vibestats.md']);
  assert(parsedInstall.command === 'install-claude-command' && parsedInstall.options.force === true && parsedInstall.options.path === '/tmp/vibestats.md', 'CLI should parse Claude command installation options');
  assert(DEFAULT_NPX_SYNC_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity', 'CLI should expose the current GitHub-backed npx command');
  assert(DEFAULT_NPX_REVEAL_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal', 'CLI should expose the current terminal-first reveal command');
  assert(DEFAULT_NPX_STATUS_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity status', 'CLI should expose the current terminal readiness preflight command');
  assert(DEFAULT_NPX_JOIN_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity join', 'CLI should expose the current terminal-first join command');
  assert(DEFAULT_INSTALL_COMMAND === 'npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command', 'CLI should expose a copyable Claude Code command installer');
  const { stdout: overrideHelp } = await execFileAsync(process.execPath, ['bin/vibestats.js', '--help'], {
    env: { ...process.env, VIBESTATS_CLI_PACKAGE: '@lets-vibe/vibestats' },
  });
  assert(overrideHelp.includes('Current public claim command: npx --yes @lets-vibe/vibestats') && overrideHelp.includes('Current public status command: npx --yes @lets-vibe/vibestats status'), 'CLI should honor VIBESTATS_CLI_PACKAGE in printed follow-up commands');
  assert(cliSource.includes('Use status to check local /insights readiness without reading raw session JSON') && cliSource.includes('It reveals your archetype locally before asking for approval to publish it.') && cliSource.includes('Run without a subcommand for the terminal-first participation flow') && cliSource.includes('Use reveal for a local result with no sign-in and no network publish') && cliSource.includes('Use join/onboard as explicit aliases') && cliSource.includes('GitHub device code by default') && cliSource.includes('Use --yes with join/onboard to publish after reveal without prompting'), 'CLI help should frame the no-subcommand path as status, reveal-before-publish terminal onboarding');
  assert(cliSource.includes('vibestats share --handle HANDLE [--host URL] [--json]') && cliSource.includes('Use share to fetch a public profile'), 'CLI help should expose terminal profile share-kit generation');
  assert(cliSource.includes('install-claude-command [--force] [--path PATH]') && cliSource.includes('Install the Claude Code /vibestats command'), 'CLI help should expose Claude Code command installation');
  assert(cliSource.includes('Current public claim command: ${DEFAULT_NPX_SYNC_COMMAND}') && cliSource.includes('Current public reveal command: ${DEFAULT_NPX_REVEAL_COMMAND}') && cliSource.includes('Use --dry-run as a legacy alias for reveal') && cliSource.includes('Use reveal --json to print the exact derived payload'), 'CLI help should separate one-command claim, human reveal, and payload JSON');
  const missingAdvice = cliErrorMessage(new Error(`No Claude Code /insights session metadata found in ${join('~', '.claude', 'usage-data')}.`));
  assert(missingAdvice.includes('Terminal onboarding:') && missingAdvice.includes('/insights') && missingAdvice.includes(DEFAULT_NPX_STATUS_COMMAND) && missingAdvice.includes(DEFAULT_NPX_REVEAL_COMMAND) && missingAdvice.includes(DEFAULT_NPX_SYNC_COMMAND), 'CLI missing-insights errors should recover into a terminal onboarding checklist');
  const cliShare = cliShareText({ label: 'prolific Shipper', compareUrl: 'https://vibestats.example/?compareTo=alex&compareArchetype=shipper' });
  assert(cliShare.includes('prolific Shipper') && cliShare.includes('Raw /insights stayed local') && cliShare.includes('What are you?') && cliShare.includes('compareTo=alex'), 'CLI share text should be copy-ready, privacy-aware, and compare-first');
  const cliXShare = cliXShareUrl({ label: 'prolific Shipper', compareUrl: 'https://vibestats.example/?compareTo=alex&compareArchetype=shipper' });
  const parsedCliXShare = new URL(cliXShare);
  assert(parsedCliXShare.origin === 'https://twitter.com' && parsedCliXShare.pathname === '/intent/tweet' && parsedCliXShare.searchParams.get('text')?.includes('What are you?') && parsedCliXShare.searchParams.get('url')?.includes('compareTo=alex'), 'CLI X share URL should send recipients into compare-first onboarding');
  const revealShare = cliRevealShareText({ label: 'prolific Shipper', compareUrl: 'https://vibestats.example/?compareArchetype=shipper' });
  assert(revealShare.includes('prolific Shipper') && revealShare.includes('Raw /insights stayed on my machine') && revealShare.includes('compareArchetype=shipper') && !revealShare.includes('compareTo='), 'CLI reveal share text should be copy-ready without claiming identity');
  const revealXShare = cliRevealXShareUrl({ label: 'prolific Shipper', compareUrl: 'https://vibestats.example/?compareArchetype=shipper' });
  const parsedRevealXShare = new URL(revealXShare);
  assert(parsedRevealXShare.origin === 'https://twitter.com' && parsedRevealXShare.searchParams.get('url')?.includes('compareArchetype=shipper') && !parsedRevealXShare.searchParams.get('url')?.includes('compareTo='), 'CLI reveal X share URL should use archetype-only comparison before claiming');
  const revealTerminalCard = cliRevealTerminalCard(payload, { host: 'https://vibestats.example' });
  assert(revealTerminalCard.includes('[vibestats]') && revealTerminalCard.includes('prolific Shipper') && revealTerminalCard.includes('280 sessions |') && revealTerminalCard.includes('commits/day |') && revealTerminalCard.includes('Raw /insights stayed local. What are you?') && revealTerminalCard.includes('https://vibestats.example/?compareArchetype=shipper'), 'CLI reveal terminal card should be compact, pasteable, privacy-aware, and compare-first');
  assert(revealTerminalCard.includes('Moments:') && revealTerminalCard.includes('Terminal heavy') && revealTerminalCard.includes('Code movement') && !revealTerminalCard.includes('tool_usage') && !revealTerminalCard.includes('language_usage'), 'CLI reveal terminal card should include only public-safe derived moments');
  const revealText = dryRunRevealText(payload);
  assert(revealText.includes('vibestats local reveal') && revealText.includes('Revealed: prolific Shipper'), 'CLI dry-run reveal should be human-readable');
  assert(revealText.includes('Share without claiming: https://vibestats.io/?compareArchetype=shipper'), 'CLI dry-run reveal should print an archetype-only compare link before publishing');
  assert(revealText.includes('Pasteable terminal card:\n[vibestats]\nprolific Shipper'), 'CLI dry-run reveal should print a compact terminal card before publishing');
  assert(revealText.includes('Copy/paste reveal: I just revealed my Claude Code build profile locally: prolific Shipper. Raw /insights stayed on my machine. What are you? Compare with my archetype: https://vibestats.io/?compareArchetype=shipper'), 'CLI dry-run reveal should print copy-ready share text before publishing');
  assert(revealText.includes('Share reveal on X: https://twitter.com/intent/tweet?'), 'CLI dry-run reveal should print one-click X share before publishing');
  assert(revealText.includes('Preview a Shipper x Debugger pairing: https://vibestats.io/compare?a=shipper&b=debugger'), 'CLI dry-run reveal should print a complementary pairing preview before publishing');
  assert(revealText.includes('Raw Claude Code /insights data stayed local. No profile was published.'), 'CLI dry-run reveal should preserve the privacy and no-publish boundary');
  assert(revealText.includes('No website upload required.') && revealText.includes(DEFAULT_NPX_SYNC_COMMAND), 'CLI dry-run reveal should hand off to exact one-command terminal-first claim command');
  assert(revealText.includes(`Install /vibestats for future reveals: ${DEFAULT_INSTALL_COMMAND}`), 'CLI dry-run reveal should print the Claude Code command installer as a return hook');
  assert(revealText.includes(`Refresh after more Claude Code work: run /insights, then ${DEFAULT_NPX_STATUS_COMMAND}, then ${DEFAULT_NPX_REVEAL_COMMAND}`), 'CLI dry-run reveal should print the status-aware repeat reveal loop');
  assert(revealText.includes('For machine-readable derived payload: add --json to the reveal command.'), 'CLI dry-run reveal should point auditors to JSON mode');
  assert(!revealText.includes('tool_usage') && !revealText.includes('language_usage'), 'CLI dry-run reveal must not print raw usage maps');
  const parsedNoOpen = parseArgs(['node', 'vibestats', 'sync', '--no-open', '--auth-timeout-ms', '1000']);
  assert(parsedNoOpen.options.openBrowser === false && parsedNoOpen.options.authTimeoutMs === 1000, 'CLI sync should parse manual browser auth options');
  assert(normalizeHost('https://vibestats.example/path?q=1#x') === 'https://vibestats.example', 'CLI sync should normalize host URLs before auth and sync');
  const localAuthUrl = authUrlForLocalCallback('https://vibestats.example/', 'http://127.0.0.1:49152/callback', 'abcdefghijklmnopqrstuvwxyz');
  assert(localAuthUrl === 'https://vibestats.example/api/cli/local-token?callback=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&nonce=abcdefghijklmnopqrstuvwxyz', 'CLI sync should build browser auth URLs for localhost callbacks');
  const confirmOutput = [];
  const skippedPublish = await confirmPublish({
    input: { isTTY: false },
    stdout: {
      write(chunk) {
        confirmOutput.push(String(chunk));
        return true;
      },
    },
  });
  assert(skippedPublish === false && confirmOutput.join('').includes('Profile not published because this terminal is non-interactive'), 'CLI onboarding should not publish from non-interactive terminals without explicit consent');
  const assumedPublish = await confirmPublish({ assumeYes: true, input: { isTTY: false }, stdout: { write() { return true; } } });
  assert(assumedPublish === true, 'CLI onboarding should let automation opt into publishing explicitly');

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

    const readyStatus = await onboardingStatus({ file: usageDir });
    assert(readyStatus.ready === true && readyStatus.session_meta_files === 2 && readyStatus.facet_files === 1 && readyStatus.report_html === true, 'CLI status should count /insights readiness without parsing raw session contents');
    const readyStatusText = onboardingStatusText(readyStatus);
    assert(readyStatusText.includes('Status: ready for reveal') && readyStatusText.includes(DEFAULT_NPX_REVEAL_COMMAND) && readyStatusText.includes(DEFAULT_NPX_SYNC_COMMAND), 'CLI status text should hand ready users into reveal and claim commands');
    assert(!readyStatusText.includes('private prompt') && !readyStatusText.includes('/private/project') && !readyStatusText.includes('underlying_goal'), 'CLI status text must not print raw /insights contents');
    output.length = 0;
    await printOnboardingStatus({ file: usageDir }, {
      stdout: {
        write(chunk) {
          output.push(String(chunk));
          return true;
        },
      },
    });
    assert(output.join('').includes('Found: 2 session-meta JSON files, 1 facet JSON file, report.html present.'), 'CLI status command should print privacy-safe readiness counts');
    output.length = 0;
    await printOnboardingStatus({ file: join(dir, 'missing-usage-data'), json: true }, {
      stdout: {
        write(chunk) {
          output.push(String(chunk));
          return true;
        },
      },
    });
    const missingStatus = JSON.parse(output.join(''));
    assert(missingStatus.ready === false && missingStatus.next_steps.some((step) => step.includes('/insights')) && missingStatus.status_command === DEFAULT_NPX_STATUS_COMMAND, 'CLI status JSON should recover missing users into the /insights terminal checklist');

    const publicProfile = {
      user: { gh_handle: 'alex', avatar_url: 'https://example.invalid/avatar.png' },
      uploads: [{
        archetype: 'shipper',
        raw_meta: { signature: 'prolific Shipper', signatureCombo: 'shipper+builder' },
        scores: { shipper: 92 },
        metrics: {},
      }],
      rarity: { count: 2, tier: 'rare', window_days: 30 },
    };
    output.length = 0;
    const shareKit = await printProfileShareKit({
      host: 'https://vibestats.example',
      handle: '@alex',
    }, {
      stdout: {
        write(chunk) {
          output.push(String(chunk));
          return true;
        },
      },
      fetchImpl: async (url) => {
        assert(url === 'https://vibestats.example/api/u/alex', 'CLI share should fetch public profile JSON by handle');
        return {
          ok: true,
          status: 200,
          async json() {
            return publicProfile;
          },
        };
      },
    });
    assert(shareKit.urls.compare === 'https://vibestats.example/?compareTo=alex&compareArchetype=shipper', 'CLI share should build a compare-first invite URL from the public profile');
    assert(output.join('').includes('vibestats share kit: @alex') && output.join('').includes('README badge: [![vibestats: @alex]') && output.join('').includes(DEFAULT_NPX_REVEAL_COMMAND), 'CLI share should print the copy-ready share kit and terminal reveal command');
    assert(output.join('').includes('Privacy proof: raw /insights stays local; public payload has no raw usage fields: yes'), 'CLI share should print privacy proof from the public payload');
    assert(!output.join('').includes('tool_usage') && !output.join('').includes('language_usage'), 'CLI share output must not print raw usage fields');
    output.length = 0;
    await printProfileShareKit({
      host: 'https://vibestats.example',
      handle: 'alex',
      json: true,
    }, {
      stdout: {
        write(chunk) {
          output.push(String(chunk));
          return true;
        },
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          return publicProfile;
        },
      }),
    });
    const shareKitJson = JSON.parse(output.join(''));
    assert(shareKitJson.copy.readme_badge_markdown.includes('/u/alex/badge.svg') && shareKitJson.copy.terminal_onboarding.includes(DEFAULT_INSTALL_COMMAND), 'CLI share JSON should expose portable distribution snippets and the Claude Code install hook');
    output.length = 0;

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
    assert(output.join('').includes('vibestats local reveal') && output.join('').includes('Revealed: prolific Shipper'), 'CLI dry-run should print a local reveal before auth');
    assert(output.join('').includes('Share without claiming: https://example.invalid/?compareArchetype=shipper'), 'CLI dry-run should respect the selected host for local compare links');
    assert(output.join('').includes('Pasteable terminal card:\n[vibestats]\nprolific Shipper') && output.join('').includes('https://example.invalid/?compareArchetype=shipper'), 'CLI dry-run should print a host-aware pasteable terminal card');
    assert(output.join('').includes('Copy/paste reveal: I just revealed my Claude Code build profile locally: prolific Shipper. Raw /insights stayed on my machine. What are you? Compare with my archetype: https://example.invalid/?compareArchetype=shipper'), 'CLI dry-run should respect the selected host for copy-ready reveal text');
    assert(output.join('').includes('Share reveal on X: https://twitter.com/intent/tweet?'), 'CLI dry-run should print one-click X sharing for local reveal');
    assert(output.join('').includes('Preview a Shipper x Debugger pairing: https://example.invalid/compare?a=shipper&b=debugger'), 'CLI dry-run should respect the selected host for local pairing previews');
    assert(output.join('').includes('Install /vibestats for future reveals: npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command'), 'CLI dry-run should print the Claude Code command installer');
    assert(output.join('').includes('Refresh after more Claude Code work: run /insights, then npx --yes github:brightseth/vibestats#feat/wave-1-identity status, then npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal'), 'CLI dry-run should print the status-aware repeat reveal loop');
    assert(!output.join('').includes('"archetype": "shipper"'), 'CLI dry-run should not dump payload JSON by default');
    assert(!output.join('').includes('tool_usage'), 'CLI dry-run output must not print raw tool usage');
    assert(!output.join('').includes('private prompt') && !output.join('').includes('/private/project'), 'CLI dry-run output must not print raw Claude Code session details');

    output.length = 0;
    const skippedOnboard = await sync({
      file,
      host: 'https://example.invalid',
      token: '',
      dryRun: false,
      promptToPublish: true,
      input: { isTTY: false },
    });
    assert(skippedOnboard.published === false, 'CLI default onboarding should stop before auth/publish when consent cannot be collected');
    assert(output.join('').includes('vibestats local reveal') && output.join('').includes('Profile not published because this terminal is non-interactive'), 'CLI default onboarding should reveal locally before refusing non-consented publishing');
    assert(output.join('').includes('Claim later with: npx --yes github:brightseth/vibestats#feat/wave-1-identity sync'), 'CLI default onboarding should give non-interactive users an explicit publish command');
    assert(!output.join('').includes('Opening browser') && !output.join('').includes('Authorize vibestats with GitHub device login'), 'CLI default onboarding should not start auth before publish consent');

    output.length = 0;
    const jsonResult = await sync({ file, host: 'https://example.invalid', token: '', dryRun: true, json: true });
    assert(jsonResult.payload.archetype === 'shipper', 'CLI dry-run JSON mode should return the same derived payload');
    assert(output.join('').includes('"archetype": "shipper"'), 'CLI dry-run JSON mode should print derived payload JSON');
    assert(!output.join('').includes('tool_usage'), 'CLI dry-run JSON output must not print raw tool usage');

    output.length = 0;
    const commandPath = join(dir, 'claude', 'commands', 'vibestats.md');
    const installResult = await installClaudeCommand({
      path: commandPath,
      stdout: {
        write(chunk) {
          output.push(String(chunk));
          return true;
        },
      },
    });
    const installedCommand = await readFile(commandPath, 'utf8');
    assert(installResult.path === commandPath && installResult.replaced === false, 'CLI should install the Claude Code command without replacing by default');
    assert(installedCommand.includes('description: Reveal and optionally publish') && installedCommand.includes('Only after the user agrees'), 'installed Claude Code command should preserve reveal-before-publish instructions');
    assert(output.join('').includes('Installed Claude Code /vibestats command') && output.join('').includes('Raw Claude Code /insights data stays on disk'), 'Claude command installer should explain installation and privacy');
    let refusedOverwrite = false;
    try {
      await installClaudeCommand({ path: commandPath });
    } catch (err) {
      refusedOverwrite = String(err.message).includes('--force');
    }
    assert(refusedOverwrite, 'Claude command installer should refuse overwriting without --force');
    const forcedInstall = await installClaudeCommand({ path: commandPath, force: true, stdout: { write() { return true; } } });
    assert(forcedInstall.replaced === true, 'Claude command installer should support explicit replacement with --force');

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

    const deviceOutput = [];
    const deviceCalls = [];
    const deviceAuth = await requestDeviceSyncToken({
      host: 'https://vibestats.example',
      timeoutMs: 5000,
      sleepImpl: async () => {},
      stdout: {
        write(chunk) {
          deviceOutput.push(String(chunk));
          return true;
        },
      },
      fetchImpl: async (url, options = {}) => {
        deviceCalls.push({ url, options });
        if (String(url).endsWith('/api/cli/device-start')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                device_code: 'device-code',
                user_code: 'ABCD-1234',
                verification_uri: 'https://github.com/login/device',
                expires_in: 900,
                interval: 1,
              };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              token: 'device-sync-token',
              host: 'https://vibestats.example',
              expires_at: '2026-06-01T00:00:00.000Z',
              handle: 'alex',
            };
          },
        };
      },
    });
    assert(deviceAuth.token === 'device-sync-token' && deviceAuth.handle === 'alex', 'CLI device auth should resolve a sync token after GitHub approval');
    assert(deviceCalls[0].url === 'https://vibestats.example/api/cli/device-start' && deviceCalls[1].url === 'https://vibestats.example/api/cli/device-poll', 'CLI device auth should use vibestats device start and poll APIs');
    assert(deviceOutput.join('').includes('Open: https://github.com/login/device') && deviceOutput.join('').includes('Enter code: ABCD-1234'), 'CLI device auth should print the terminal-friendly GitHub code instructions');
    assert(!deviceOutput.join('').includes('device-sync-token'), 'CLI device auth output must not print the sync token');

    const fallbackOutput = [];
    const fallbackPromise = requestDeviceSyncToken({
      host: 'https://vibestats.example',
      openBrowser: false,
      timeoutMs: 5000,
      stdout: {
        write(chunk) {
          fallbackOutput.push(String(chunk));
          return true;
        },
      },
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        async json() {
          return { error: 'Device Flow must be explicitly enabled for this App' };
        },
      }),
    });
    for (let i = 0; i < 20 && !fallbackOutput.join('').includes('Authorize here: '); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const fallbackAuthUrlText = fallbackOutput.join('').match(/Authorize here: (https?:\/\/\S+)/)?.[1] || '';
    assert(fallbackAuthUrlText, 'CLI device auth should fall back to browser auth when the GitHub app has Device Flow disabled');
    const parsedFallbackAuthUrl = new URL(fallbackAuthUrlText);
    const fallbackCallbackUrl = new URL(parsedFallbackAuthUrl.searchParams.get('callback'));
    const fallbackNonce = parsedFallbackAuthUrl.searchParams.get('nonce');
    const fallbackCallbackParams = new URLSearchParams({
      token: 'fallback-browser-sync-token',
      host: 'https://vibestats.example',
      expires_at: '2026-06-01T00:00:00.000Z',
      handle: 'alex',
      nonce: fallbackNonce,
    });
    const fallbackCallbackRes = await fetch(`${fallbackCallbackUrl.toString()}?${fallbackCallbackParams.toString()}`);
    assert(fallbackCallbackRes.ok, 'CLI device auth browser fallback should accept the matching local callback nonce');
    const fallbackAuth = await fallbackPromise;
    assert(fallbackAuth.token === 'fallback-browser-sync-token', 'CLI device auth fallback should return the browser sync token');
    assert(fallbackOutput.join('').includes('Falling back to browser approval.'), 'CLI device auth fallback should explain the temporary production config gap');
    assert(!fallbackOutput.join('').includes('fallback-browser-sync-token'), 'CLI device auth fallback output must not print the sync token');

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
            recap_url: '/u/alex/recap',
            badge_url: '/u/alex/badge.svg',
            embed_url: '/u/alex/embed',
            privacy_url: '/settings#privacy-settings',
            match_settings_url: '/settings#match-settings',
            weekly_digest_url: '/settings#weekly-digest-row',
            weekly_digest_preview_url: '/api/digest/preview',
            leaderboard_url: '/leaderboard/shipper',
            match_url: '/match?goal=pair-coding&archetype=shipper',
          };
        },
      };
    };
    const syncResult = await sync({ file, host: 'https://vibestats.example', token: 'sync-token', dryRun: false });
    assert(syncResult.compare_url.includes('compareTo=alex'), 'CLI sync should receive compare-first URL from API');
    assert(output.join('').includes('Revealed: prolific Shipper'), 'CLI sync should print the local reveal before publishing');
    assert(output.join('').includes('Raw Claude Code /insights data stayed local. Publishing only derived metrics.'), 'CLI sync should state the privacy boundary before publishing');
    assert(output.join('').includes('Invite people to compare: https://vibestats.example/?compareTo=alex&compareArchetype=shipper'), 'CLI sync should print compare-first invite URL');
    assert(output.join('').includes('Minted GitHub-claimed, derived-only profile. Raw /insights stayed local.'), 'CLI sync should print claimed identity and derived-only proof after publishing');
    assert(output.join('').includes("Copy/paste share: I just claimed my Claude Code build profile: prolific Shipper. Raw /insights stayed local. What are you? See how you'd pair with me: https://vibestats.example/?compareTo=alex&compareArchetype=shipper"), 'CLI sync should print a copy-ready privacy-aware compare-first share line');
    const printedXShare = output.join('').match(/Share on X: (https:\/\/twitter\.com\/intent\/tweet\?\S+)/)?.[1] || '';
    assert(printedXShare && new URL(printedXShare).searchParams.get('url')?.includes('compareTo=alex'), 'CLI sync should print a one-click X share URL');
    assert(output.join('').includes('Optional public discovery: https://vibestats.example/settings#privacy-settings'), 'CLI sync should print the opt-in public discovery settings URL');
    assert(output.join('').includes('Profiles stay unlisted unless you choose Public.'), 'CLI sync should preserve unlisted-by-default privacy copy');
    assert(output.join('').includes('Set match intent: https://vibestats.example/settings#match-settings'), 'CLI sync should print the match intent setup URL');
    assert(output.join('').includes('View your weekly board: https://vibestats.example/leaderboard/shipper'), 'CLI sync should print the archetype leaderboard return URL');
    assert(output.join('').includes('Find complementary builders: https://vibestats.example/match?goal=pair-coding&archetype=shipper'), 'CLI sync should print the matchmaker return URL');
    assert(output.join('').includes('Share your recap: https://vibestats.example/u/alex/recap'), 'CLI sync should print recap return URL');
    assert(output.join('').includes('README badge Markdown: [![vibestats: @alex](https://vibestats.example/u/alex/badge.svg)](https://vibestats.example/?compareTo=alex&compareArchetype=shipper)'), 'CLI sync should print copyable README badge Markdown');
    assert(output.join('').includes('Profile embed HTML: <iframe src="https://vibestats.example/u/alex/embed" width="600" height="320" loading="lazy" title="@alex on vibestats"'), 'CLI sync should print copyable profile embed HTML');
    assert(output.join('').includes('Install /vibestats for future reveals: npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command'), 'CLI sync should print the Claude Code command installer as a return hook');
    assert(output.join('').includes('Reserve weekly digest: https://vibestats.example/settings#weekly-digest-row'), 'CLI sync should print the weekly digest setup link as a return hook');
    assert(output.join('').includes('Preview weekly digest: https://vibestats.example/api/digest/preview'), 'CLI sync should print the weekly digest preview as an immediate return hook');
    assert(!postedBody.includes('tool_usage') && !postedBody.includes('language_usage'), 'CLI sync request must not post raw usage maps');

    output.length = 0;
    const consentedOnboardResult = await sync({
      file,
      host: 'https://vibestats.example',
      token: 'sync-token',
      dryRun: false,
      promptToPublish: true,
      assumeYes: true,
    });
    assert(consentedOnboardResult.ok === true, 'CLI default onboarding should publish after explicit yes consent');
    assert(output.join('').includes('vibestats local reveal') && output.join('').includes('Publishing the derived profile now. Raw Claude Code /insights data stays local.'), 'CLI default onboarding should print the full local reveal before consented publishing');
    assert(output.join('').includes('Minted GitHub-claimed, derived-only profile. Raw /insights stayed local.'), 'CLI default onboarding should keep the claimed profile proof after publishing');

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
  assert(privateView.facets?.length === 7, 'visitor upload payload should include derived facet radar axes');
  assert(privateView.facets.every((facet) => facet.value >= 0 && facet.value <= 100), 'visitor facet radar should use clamped public score values');
  assert(!JSON.stringify(privateView.facets).includes('rawJson'), 'visitor facet radar must not echo unknown score fields');
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
  assert(ownerView.facets?.length === 7, 'owner upload payload should include the same derived facet radar');
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
  assert(proof.includes('GitHub-claimed, derived-only profile'), 'profile metadata proof should identify claimed identity without implying raw-data storage');
  assert(description.includes('GitHub-claimed, derived-only profile'), 'profile metadata should include credential and privacy proof');
  assert(description.includes("Compare your vibecoding personality with @brightseth."), 'profile metadata should preserve comparison CTA');
  assert(!description.includes('rawJson'), 'profile metadata must not leak raw JSON fields');
  console.log('ok profile metadata helpers include social proof without raw JSON');
}

async function assertRecapMetadataHelpers() {
  const { recapDescription } = await import('../api/recap.js');
  const description = recapDescription({
    handle: 'brightseth',
    signature: 'high-velocity Deep Diver',
    arch: { name: 'THE DEEP DIVER' },
    rarity: { count: 1, tier: 'rare' },
    leaderboard: { rank: 3, total: 12, label: 'deepdiver' },
  });

  assert(description.includes('high-velocity Deep Diver'), 'recap metadata should include the profile signature');
  assert(description.includes('rare combo: 1 of 1 saved profile this month'), 'recap metadata should include scarcity proof');
  assert(description.includes("See how you'd pair with @brightseth."), 'recap metadata should preserve comparison CTA');
  assert(description.includes('Raw insights stay local'), 'recap metadata should state the privacy boundary');
  assert(!description.includes('rawJson'), 'recap metadata must not leak raw JSON fields');
  console.log('ok recap metadata helpers include return-loop proof without raw JSON');
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
  const { default: handler, canExposeCompareMetadata, compareInviteMetadata, compareMetadataForSubjects } = await import('../api/compare-page.js');
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
  const inviteMeta = compareInviteMetadata(
    {
      type: 'deepdiver',
      handle: 'brightseth',
      signature: 'high-velocity Deep Diver',
      rarity: { count: 1, tier: 'rare' },
    },
    'https://vibestats.io',
  );
  assert(inviteMeta.title.includes("See how you'd pair with @brightseth"), 'one-sided compare metadata should preserve the known profile');
  assert(inviteMeta.description.includes('Run /insights, check status, then reveal yours against @brightseth'), 'one-sided compare metadata should teach the status and reveal path');
  assert(inviteMeta.description.includes('Raw Claude Code sessions stay local'), 'one-sided compare metadata should carry the privacy promise');
  assert(inviteMeta.url === 'https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver', 'one-sided compare metadata should route into upload-to-compare');
  assert(inviteMeta.image.includes('/api/og?mode=pair'), 'one-sided compare metadata should use a dynamic pair image');
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

async function assertHomeMetadataHelpers() {
  const { default: handler, archetypeInviteMetadata, homeMetadataForInvite } = await import('../api/home.js');
  const profileMeta = homeMetadataForInvite(
    {
      handle: 'brightseth',
      archetype: 'deepdiver',
      signature: 'high-velocity Deep Diver',
      rarity: { count: 1, tier: 'rare' },
      leaderboard: { rank: 1, total: 3, label: 'deepdiver' },
      metrics: { days: 14, commitsPerDay: 8.5, languages: 6, sessions: 22 },
    },
    'https://vibestats.io',
  );
  assert(profileMeta.title.includes("See how you'd pair with @brightseth"), 'homepage metadata should make compare-first links personal before the click');
  assert(profileMeta.description.includes('high-velocity Deep Diver'), 'homepage metadata should include profile signature proof');
  assert(profileMeta.description.includes('rare combo: 1 of 1 saved profile this month'), 'homepage metadata should include rarity proof');
  assert(profileMeta.description.includes('#1 of 3 on weekly Deep Diver board'), 'homepage metadata should include leaderboard proof');
  assert(profileMeta.description.includes('Run /insights, check status, then reveal yours against @brightseth'), 'homepage metadata should carry the status-aware reveal command frame');
  assert(profileMeta.url === 'https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver', 'homepage metadata should preserve compare-first query params');
  assert(profileMeta.image.includes('/api/og?a=deepdiver') && profileMeta.image.includes('n=%40brightseth'), 'homepage metadata should use a profile-specific OG image');
  assert(!profileMeta.description.includes('rawJson'), 'homepage metadata must not leak raw JSON fields');

  const archetypeMeta = archetypeInviteMetadata('shipper', 'https://vibestats.io');
  assert(archetypeMeta.title.includes('Compare with a Shipper'), 'homepage metadata should handle archetype-only compare links');
  assert(archetypeMeta.url === 'https://vibestats.io/?compareArchetype=shipper', 'homepage metadata should preserve archetype-only query params');

  const res = mockRes();
  await handler({
    method: 'GET',
    query: {},
    headers: { host: 'localhost:3000' },
  }, res);
  assert(res.statusCode === 200, 'homepage API should render HTTP 200 without requiring database access');
  assert(String(res.headers['Content-Type']).includes('text/html'), 'homepage API should return HTML');
  assert(res.headers['Cache-Control'] === 'private, no-store', 'homepage API should avoid caching generic dynamic shells');
  assert(String(res.body).includes("What's your vibecoding personality? | vibestats"), 'homepage API should preserve generic reveal metadata');

  const headRes = mockRes();
  await handler({
    method: 'HEAD',
    query: {},
    headers: { host: 'localhost:3000' },
  }, headRes);
  assert(headRes.statusCode === 200, 'homepage API should support HEAD requests for link inspectors');
  assert(String(headRes.headers['Content-Type']).includes('text/html'), 'homepage HEAD should return HTML headers');

  const methodRes = mockRes();
  await handler({ method: 'POST', query: {}, headers: { host: 'localhost:3000' } }, methodRes);
  assert(methodRes.statusCode === 405, 'homepage API should guard unsupported methods');
  assert(methodRes.headers['Cache-Control'] === 'private, no-store', 'homepage API method guard should not be cacheable');
  console.log('ok homepage metadata renders compare-first reveal previews');
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
    assert(scored.includes('100% GitHub-claimed, derived-only signal - BUILDER'), 'badge SVG should render clamped primary score as identity and privacy credential proof');
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
    assert(body.includes('Run /insights, check status, then reveal to mint this profile.') && body.includes('Open profile'), 'embed fallback should teach the terminal status and reveal path for unminted profiles');
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
      label: 'profile recap method guard',
      module: '../api/recap.js',
      req: { method: 'POST', query: { handle: 'brightseth' }, headers: { host: 'localhost:3000' } },
      status: 405,
      allow: 'GET',
    },
    {
      label: 'profile recap invalid handle',
      module: '../api/recap.js',
      req: { method: 'GET', query: { handle: 'bad_handle' }, headers: { host: 'localhost:3000' } },
      status: 404,
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
        label: '/api/digest/preview unauthenticated',
        module: '../api/digest/preview.js',
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
        label: '/api/digest/preview secret failure',
        module: '../api/digest/preview.js',
        req: { method: 'GET', query: {}, headers: { host: 'localhost:3000', cookie } },
        status: 500,
        error: 'Digest preview failed',
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
await assertUpdateCliCommandScript();
await assertShareKitScript();
await assertIdentityReadiness();
await assertOAuthReturnHandling();
await assertCliLocalTokenEndpoint();
await assertCliDeviceAuthHelpers();
await assertProfileShareLoop();
await assertCompareShareLoop();
await assertShareCardCta();
await assertOgFallback();
await assertStatsApiGuards();
await assertWrappedShareLoop();
await assertMatchmakingHelpers();
await assertBehavioralMoments();
await assertFacetRadar();
await assertPublicAchievements();
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
await assertRecapMetadataHelpers();
await assertProfileCacheHelpers();
await assertCompareMetadataHelpers();
await assertHomeMetadataHelpers();
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
