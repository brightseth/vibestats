#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_HANDLE = 'brightseth';
const DEFAULT_ARCHETYPE = 'builder';
const DEFAULT_CLI_PACKAGE = '@lets-vibe/vibestats';
const NO_NPM_CLI = 'curl -fsSL https://vibestats.io/cli.sh | sh -s --';
const NO_NPM_STATUS = `${NO_NPM_CLI} status`;
const NO_NPM_REVEAL = `${NO_NPM_CLI} reveal`;
const NO_NPM_INSTALL = `${NO_NPM_CLI} install-claude-command`;
const RAW_LEAK_PATTERNS = ['rawJson', 'tool_usage', 'language_usage'];
const SECRET_NAME_PATTERNS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'NEON_DATABASE_URL',
  'GITHUB_CLIENT_SECRET',
  'VIBE_SESSION_SECRET',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    origin: process.env.VIBESTATS_URL || 'https://vibestats.io',
    handle: DEFAULT_HANDLE,
    archetype: DEFAULT_ARCHETYPE,
    expectReady: false,
    expectDeviceFlow: false,
    expectCliPackage: false,
    expectDigest: false,
    expectSshClaim: false,
    cliPackage: process.env.VIBESTATS_CLI_PACKAGE || DEFAULT_CLI_PACKAGE,
    cronSecret: process.env.CRON_SECRET || '',
    vercelDeployment: process.env.VERCEL_DEPLOYMENT_URL || '',
    vercelScope: process.env.VERCEL_SCOPE || 'lets-vibe',
  };
  let originProvided = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--origin') {
      options.origin = argv[++i];
      originProvided = true;
    } else if (arg.startsWith('--origin=')) {
      options.origin = arg.slice('--origin='.length);
      originProvided = true;
    }
    else if (arg === '--handle') options.handle = argv[++i];
    else if (arg.startsWith('--handle=')) options.handle = arg.slice('--handle='.length);
    else if (arg === '--archetype') options.archetype = argv[++i];
    else if (arg.startsWith('--archetype=')) options.archetype = arg.slice('--archetype='.length);
    else if (arg === '--expect-ready') options.expectReady = true;
    else if (arg === '--expect-device-flow') options.expectDeviceFlow = true;
    else if (arg === '--expect-cli-package') options.expectCliPackage = true;
    else if (arg === '--expect-ssh-claim') options.expectSshClaim = true;
    else if (arg === '--cli-package') options.cliPackage = argv[++i];
    else if (arg.startsWith('--cli-package=')) options.cliPackage = arg.slice('--cli-package='.length);
    else if (arg === '--expect-digest') options.expectDigest = true;
    else if (arg === '--vercel-deployment' || arg === '--deployment') options.vercelDeployment = argv[++i];
    else if (arg.startsWith('--vercel-deployment=')) options.vercelDeployment = arg.slice('--vercel-deployment='.length);
    else if (arg.startsWith('--deployment=')) options.vercelDeployment = arg.slice('--deployment='.length);
    else if (arg === '--vercel-scope' || arg === '--scope') options.vercelScope = argv[++i];
    else if (arg.startsWith('--vercel-scope=')) options.vercelScope = arg.slice('--vercel-scope='.length);
    else if (arg.startsWith('--scope=')) options.vercelScope = arg.slice('--scope='.length);
    else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.vercelDeployment = String(options.vercelDeployment || '').trim();
  if (options.vercelDeployment && !originProvided) options.origin = options.vercelDeployment;
  options.origin = normalizeOrigin(options.origin);
  if (options.vercelDeployment) options.vercelDeployment = normalizeOrigin(options.vercelDeployment);
  options.vercelScope = String(options.vercelScope || '').trim();
  options.cronSecret = String(options.cronSecret || '').trim();
  options.cliPackage = String(options.cliPackage || '').trim();
  options.handle = String(options.handle || '').trim().replace(/^@/, '');
  options.archetype = String(options.archetype || '').trim().toLowerCase();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(options.handle)) {
    throw new Error('--handle must be a GitHub-style handle');
  }
  if (!/^[a-z]+$/.test(options.archetype)) {
    throw new Error('--archetype must be a lowercase archetype key');
  }
  if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(options.cliPackage)) {
    throw new Error('--cli-package must be an npm package name');
  }
  return options;
}

function normalizeOrigin(value) {
  const url = new URL(String(value || '').trim());
  return url.origin;
}

function usage() {
  return `Usage: npm run audit:launch -- --origin https://vibestats.io --handle brightseth [--expect-ready] [--expect-device-flow] [--expect-cli-package] [--expect-ssh-claim] [--expect-digest]
       npm run audit:launch -- --deployment https://preview.vercel.app --scope lets-vibe --handle brightseth
       CRON_SECRET=... npm run audit:launch -- --origin https://vibestats.io --handle brightseth --expect-ready --expect-device-flow --expect-cli-package --expect-ssh-claim --expect-digest

Checks the deployed identity loop without printing secrets:
- /api/identity-status readiness and no-store headers
- CLI device-code auth start when --expect-ready is used; --expect-device-flow requires a live GitHub device code instead of browser fallback
- public npm CLI package visibility and runnable help when --expect-cli-package is used
- no-npm CLI bootstrap script, and SSH claim-session creation/status when --expect-ssh-claim is used
- public auth/session/sync failure responses do not expose internal config names
- reveal homepage command path, demo-first CTA, and stale onboarding-copy regression checks
- promises page privacy, derived-only, and anti-coercion public contract
- profile shell, saved profile JSON, derived credential JSON, profile JSON miss cache policy, unknown-profile fallback cache policy, embed, and badge surfaces
- card, wrapped, dashboard, profile recap, compare-first upload route, profile-backed pair route, pair preview route, browse, match, and leaderboard surfaces
- no-store headers on profile-derived JSON discovery APIs
- bounded match-intro event recording when profile saves are ready
- protected weekly digest dry run when --expect-digest is used with CRON_SECRET
- obvious raw-insights field leaks in public profile/share HTML/SVG responses`;
}

function hasRawLeak(text) {
  return RAW_LEAK_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

function hasSecretName(text) {
  return SECRET_NAME_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

function includesAll(text, needles = []) {
  return needles.every((needle) => String(text || '').includes(needle));
}

function includesNone(text, needles = []) {
  return needles.every((needle) => !String(text || '').includes(needle));
}

function readinessSummary(identity) {
  return JSON.stringify({
    profile_save_available: identity?.profile_save_available,
    weekly_digest_available: identity?.weekly_digest_available,
    missing: identity?.missing,
  });
}

function responseFromHeaders(status, headers) {
  return {
    status,
    headers: {
      get(name) {
        return headers.get(String(name || '').toLowerCase()) || null;
      },
    },
  };
}

function parseVercelCurlResponse(output) {
  const start = String(output || '').search(/^HTTP\//m);
  if (start === -1) throw new Error('vercel curl did not return HTTP headers');

  const raw = String(output).slice(start).replace(/\r\n/g, '\n');
  const split = raw.indexOf('\n\n');
  const headerText = split === -1 ? raw : raw.slice(0, split);
  const body = split === -1 ? '' : raw.slice(split + 2);
  const lines = headerText.split('\n').filter(Boolean);
  const status = Number(lines[0]?.match(/\s(\d{3})(?:\s|$)/)?.[1] || 0);
  const headers = new Map();

  for (const line of lines.slice(1)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }

  if (!status) throw new Error('vercel curl returned an invalid HTTP status');
  return { response: responseFromHeaders(status, headers), body };
}

async function fetchViaVercelCurl(options, path, url, requestOptions = {}) {
  const args = ['curl', path, '--deployment', options.vercelDeployment];
  if (options.vercelScope) args.push('--scope', options.vercelScope);
  args.push('--', '-s', '-i');
  if (requestOptions.method && requestOptions.method !== 'GET') {
    args.push('-X', requestOptions.method);
  }
  for (const [key, value] of Object.entries(requestOptions.headers || {})) {
    args.push('-H', `${key}: ${value}`);
  }
  if (requestOptions.body != null) args.push('--data', requestOptions.body);
  const { stdout } = await execFileAsync('vercel', args, { maxBuffer: 5 * 1024 * 1024 });
  const parsed = parseVercelCurlResponse(stdout);
  return { url: url.toString(), ...parsed };
}

async function fetchText(options, path, requestOptions = {}) {
  const { origin } = options;
  const url = new URL(path, origin);
  if (options.vercelDeployment) {
    return fetchViaVercelCurl(options, path, url, requestOptions);
  }

  const response = await fetch(url, {
    method: requestOptions.method || 'GET',
    headers: {
      Accept: 'text/html,application/json,image/svg+xml,*/*',
      ...(requestOptions.headers || {}),
    },
    body: requestOptions.body,
    redirect: 'manual',
  });
  const body = await response.text();
  return { url: url.toString(), response, body };
}

function createRecorder() {
  const results = [];
  return {
    results,
    ok(label, detail = '') {
      results.push({ ok: true, label, detail });
    },
    fail(label, detail = '') {
      results.push({ ok: false, label, detail });
    },
    check(condition, label, detail = '') {
      if (condition) this.ok(label, detail);
      else this.fail(label, detail);
    },
  };
}

async function auditCliPackage(options, recorder) {
  const packageSpec = options.cliPackage || DEFAULT_CLI_PACKAGE;
  try {
    const view = await execFileAsync('npm', ['view', packageSpec, 'name', 'version', 'bin', '--json'], {
      maxBuffer: 1024 * 1024,
    });
    const metadata = JSON.parse(view.stdout || '{}');
    recorder.check(metadata.name === packageSpec, 'public CLI package is visible on npm', metadata.name || '(missing)');
    recorder.check(Boolean(metadata.version), 'public CLI package has a version', metadata.version || '(missing)');
    recorder.check(metadata.bin?.vibestats === './bin/vibestats.js' || metadata.bin?.vibestats === 'bin/vibestats.js', 'public CLI package exposes vibestats bin', JSON.stringify(metadata.bin || {}));
  } catch (err) {
    const detail = String(err.stderr || err.message || '').split('\n').find(Boolean) || err.message;
    recorder.fail('public CLI package is visible on npm', detail);
    return;
  }

  try {
    const result = await execFileAsync('npm', ['exec', '--yes', '--package', packageSpec, '--', 'vibestats', '--help'], {
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...process.env,
        VIBESTATS_CLI_PACKAGE: packageSpec,
      },
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    recorder.check(output.includes('Current public claim command: npx --yes') && output.includes(packageSpec), 'public CLI help uses the package command', packageSpec);
    recorder.check(output.includes('vibestats share --handle HANDLE') && output.includes('Use reveal for a local result'), 'public CLI help exposes reveal and share flows');
    recorder.check(!hasRawLeak(output), 'public CLI help has no raw-insights field names');
    recorder.check(!hasSecretName(output), 'public CLI help does not expose secret env names');
  } catch (err) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}`;
    recorder.fail('public CLI package executes vibestats help', output.split('\n').find(Boolean) || err.message);
  }
}

async function auditSshClaim(options, recorder) {
  try {
    const manifest = await fetchText(options, '/api/ssh/manifest');
    const manifestCache = manifest.response.headers.get('cache-control') || '';
    const manifestType = manifest.response.headers.get('content-type') || '';
    const manifestBody = JSON.parse(manifest.body || '{}');
    recorder.check(manifest.response.status === 200, 'SSH shell manifest is reachable', `${manifest.response.status} ${manifest.url}`);
    recorder.check(manifestType.includes('application/json'), 'SSH shell manifest content type', manifestType || '(none)');
    recorder.check(manifestCache.includes('no-store'), 'SSH shell manifest disables public caching', manifestCache || '(none)');
    recorder.check(manifestBody.schema_version === 'vibestats.ssh_shell.v1' && manifestBody.status?.hosted_on_vercel_functions === false, 'SSH shell manifest names the external TCP service boundary');
    recorder.check(String(manifestBody.ssh?.command || '').startsWith('ssh ') && manifestBody.ssh?.apex_command_supported === false, 'SSH shell manifest exposes the dedicated SSH command');
    recorder.check(manifestBody.privacy?.ssh_host_reads_local_files === false && manifestBody.privacy?.local_helper_uploads === 'derived-only', 'SSH shell manifest preserves local-only extraction');
    recorder.check(Array.isArray(manifestBody.commands) && manifestBody.commands.some((item) => item.name === 'claim'), 'SSH shell manifest includes claim coordination command');
    recorder.check(String(manifestBody.claim_flow?.local_command_template || '').includes('/cli.sh') && String(manifestBody.claim_flow?.local_command_template || '').includes('{code}'), 'SSH shell manifest prints no-npm helper template');
    recorder.check(Array.isArray(manifestBody.viral_loops) && manifestBody.viral_loops.includes('compare_invite') && manifestBody.viral_loops.includes('terminal_share_kit'), 'SSH shell manifest drives comparison and terminal sharing');
    recorder.check(!hasRawLeak(manifest.body), 'SSH shell manifest has no raw-insights field names');
    recorder.check(!hasSecretName(manifest.body), 'SSH shell manifest does not expose secret env names');

    const start = await fetchText(options, '/api/ssh/claim-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const cache = start.response.headers.get('cache-control') || '';
    const type = start.response.headers.get('content-type') || '';
    const body = JSON.parse(start.body || '{}');
    recorder.check(start.response.status === 201, 'SSH claim start creates a session', `${start.response.status} ${start.url}`);
    recorder.check(type.includes('application/json'), 'SSH claim start content type', type || '(none)');
    recorder.check(cache.includes('no-store'), 'SSH claim start disables public caching', cache || '(none)');
    recorder.check(/^VIBE-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(body.code || ''), 'SSH claim start returns a bounded claim code', body.code || '(missing)');
    recorder.check(String(body.local_command || '').includes('/cli.sh') && String(body.local_command || '').includes(' claim '), 'SSH claim start prints no-npm local helper command', body.local_command || '(missing)');
    recorder.check(String(body.npx_command || '').includes('npx --yes') && String(body.npx_command || '').includes(' claim '), 'SSH claim start keeps npx fallback command', body.npx_command || '(missing)');
    recorder.check(body.privacy?.ssh_host_reads_raw_insights === false && body.privacy?.local_helper_uploads === 'derived-only', 'SSH claim start proves local-only extraction boundary');
    recorder.check(!hasRawLeak(start.body), 'SSH claim start has no raw-insights field names');
    recorder.check(!hasSecretName(start.body), 'SSH claim start does not expose secret env names');

    if (body.code) {
      const status = await fetchText(options, `/api/ssh/claim-status?code=${encodeURIComponent(body.code)}`);
      const statusCache = status.response.headers.get('cache-control') || '';
      const statusType = status.response.headers.get('content-type') || '';
      const statusBody = JSON.parse(status.body || '{}');
      recorder.check(status.response.status === 200, 'SSH claim status returns pending session', `${status.response.status} ${status.url}`);
      recorder.check(statusType.includes('application/json'), 'SSH claim status content type', statusType || '(none)');
      recorder.check(statusCache.includes('no-store'), 'SSH claim status disables public caching', statusCache || '(none)');
      recorder.check(statusBody.ok === true && ['pending', 'expired'].includes(statusBody.state), 'SSH claim status returns bounded state', status.body);
      recorder.check(!hasRawLeak(status.body), 'SSH claim status has no raw-insights field names');
      recorder.check(!hasSecretName(status.body), 'SSH claim status does not expose secret env names');
    }
  } catch (err) {
    recorder.fail('SSH claim-session audit failed', err.message);
  }
}

async function auditLaunch(options) {
  const recorder = createRecorder();
  const { origin, handle, archetype, expectReady, expectDeviceFlow, expectCliPackage, expectDigest, expectSshClaim } = options;
  const missingHandle = `audit-missing-${Date.now().toString(36)}`.slice(0, 39);
  const comparePath = `/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(archetype)}`;

  if (expectCliPackage) {
    await auditCliPackage(options, recorder);
  }

  if (expectSshClaim) {
    await auditSshClaim(options, recorder);
  }

  let identity = null;
  try {
    const status = await fetchText(options, '/api/identity-status');
    identity = JSON.parse(status.body);
    const cache = status.response.headers.get('cache-control') || '';
    recorder.check(status.response.status === 200, 'identity status returns 200', status.url);
    recorder.check(cache.includes('no-store'), 'identity status is not cached', cache || '(none)');
    recorder.check(typeof identity.profile_save_available === 'boolean', 'identity status exposes profile save readiness');
    recorder.check(typeof identity.weekly_digest_available === 'boolean', 'identity status exposes digest delivery readiness');
    recorder.check(Array.isArray(identity.missing), 'identity status serializes missing readiness groups');
    recorder.check(!hasSecretName(status.body), 'identity status does not expose secret env names');
    if (expectReady) {
      recorder.check(identity.profile_save_available === true, 'profile saves are ready', readinessSummary(identity));
      recorder.check(identity.missing.length === 0, 'identity status has no missing profile-save readiness groups', readinessSummary(identity));
    }
    if (expectReady || expectDeviceFlow) {
      try {
        const result = await fetchText(options, '/api/cli/device-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const cache = result.response.headers.get('cache-control') || '';
        const type = result.response.headers.get('content-type') || '';
        const body = JSON.parse(result.body || '{}');
        const starts = result.response.status === 200 && Boolean(body.device_code && body.user_code && body.verification_uri);
        const reportsDisabled = result.response.status === 400 && String(body.error || '').includes('Device Flow must be explicitly enabled');
        recorder.check(starts || (!expectDeviceFlow && reportsDisabled), 'CLI device auth start is reachable', `${result.response.status} ${result.url}`);
        recorder.check(type.includes('application/json'), 'CLI device auth start content type', type || '(none)');
        recorder.check(cache.includes('no-store'), 'CLI device auth start disables public caching', cache || '(none)');
        recorder.check(
          expectDeviceFlow ? starts : starts || reportsDisabled,
          expectDeviceFlow ? 'CLI device auth start returns live GitHub device code' : 'CLI device auth start returns GitHub instructions or explicit enablement action',
          expectDeviceFlow ? `${result.response.status} ${body.error || body.verification_uri || result.url}` : '',
        );
        recorder.check(!hasSecretName(result.body), 'CLI device auth start does not expose secret env names');
      } catch (err) {
        recorder.fail('CLI device auth start fetch failed', err.message);
      }
    }
    if (expectDigest) {
      recorder.check(identity.weekly_digest_available === true, 'weekly digest delivery is ready', readinessSummary(identity));
    }
  } catch (err) {
    recorder.fail('identity status fetch failed', err.message);
  }

  const failurePaths = [
    {
      label: 'session failure response',
      path: '/api/me',
      options: {
        headers: { Cookie: 'vibestats_auth=a.b.c' },
      },
      allowStatuses: [401, 500],
      expectedType: 'application/json',
    },
    {
      label: 'sync failure response',
      path: '/api/sync',
      options: {
        method: 'POST',
        headers: {
          Authorization: 'Bearer a.b.c',
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
      allowStatuses: [401, 500],
      expectedType: 'application/json',
    },
    {
      label: 'weekly digest cron guard',
      path: '/api/cron/weekly-digest?dryRun=1',
      allowStatuses: [401, 503],
      expectedType: 'application/json',
    },
    {
      label: 'OAuth callback failure response',
      path: '/api/auth/github/callback?code=a&state=b',
      allowStatuses: [400, 503],
      expectedType: 'text/html',
    },
  ];

  for (const item of failurePaths) {
    try {
      const result = await fetchText(options, item.path, item.options);
      const cache = result.response.headers.get('cache-control') || '';
      const type = result.response.headers.get('content-type') || '';
      recorder.check(item.allowStatuses.includes(result.response.status), `${item.label} status`, `${result.response.status} ${result.url}`);
      recorder.check(type.includes(item.expectedType), `${item.label} content type`, type || '(none)');
      recorder.check(cache.includes('no-store'), `${item.label} disables public caching`, cache || '(none)');
      recorder.check(!hasSecretName(result.body), `${item.label} does not expose secret env names`);
    } catch (err) {
      recorder.fail(`${item.label} fetch failed`, err.message);
    }
  }

  try {
    const result = await fetchText(options, '/api/match-intros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_handle: missingHandle,
        goal: 'pair-coding',
        seeker_archetype: archetype,
        target_archetype: archetype,
        action: 'compare_click',
        source: 'match',
      }),
    });
    const cache = result.response.headers.get('cache-control') || '';
    const type = result.response.headers.get('content-type') || '';
    const body = JSON.parse(result.body || '{}');
    recorder.check(expectReady ? result.response.status === 200 : [200, 202].includes(result.response.status), 'match intro event recording status', `${result.response.status} ${result.url}`);
    recorder.check(type.includes('application/json'), 'match intro event recording content type', type || '(none)');
    recorder.check(cache.includes('no-store'), 'match intro event recording disables public caching', cache || '(none)');
    recorder.check(body.ok === true && (body.recorded === true || (!expectReady && body.recorded === false)), 'match intro event recording reports bounded result', result.body);
    recorder.check(!hasRawLeak(result.body), 'match intro event recording has no raw-insights field names');
    recorder.check(!hasSecretName(result.body), 'match intro event recording does not expose secret env names');
  } catch (err) {
    recorder.fail('match intro event recording fetch failed', err.message);
  }

  if (expectDigest) {
    if (!options.cronSecret) {
      recorder.fail('weekly digest dry run has cron secret', 'set CRON_SECRET in the local environment');
    } else {
      try {
        const result = await fetchText(options, '/api/cron/weekly-digest?dryRun=1', {
          headers: { Authorization: `Bearer ${options.cronSecret}` },
        });
        const cache = result.response.headers.get('cache-control') || '';
        const type = result.response.headers.get('content-type') || '';
        recorder.check(result.response.status === 200, 'weekly digest dry run status', `${result.response.status} ${result.url}`);
        recorder.check(type.includes('application/json'), 'weekly digest dry run content type', type || '(none)');
        recorder.check(cache.includes('no-store'), 'weekly digest dry run disables public caching', cache || '(none)');
        const body = JSON.parse(result.body);
        const proofFields = [
          'profile_linked',
          'share_invite_linked',
          'leaderboard_linked',
          'match_linked',
          'settings_linked',
          'unsubscribe_included',
          'day_streak_included',
          'derived_only_notice',
        ];
        const proof = (body.results || []).find((item) => item?.proof);
        recorder.check(body.ok === true && body.dry_run === true && body.resend_ready === true, 'weekly digest dry run returns readiness payload');
        recorder.check(Number(body.considered || 0) > 0, 'weekly digest dry run has at least one candidate', `considered=${body.considered || 0}`);
        recorder.check(Boolean(proof), 'weekly digest dry run includes content proof');
        recorder.check(Boolean(proof) && proofFields.every((field) => proof.proof?.[field] === true), 'weekly digest dry run proves return-loop content');
        recorder.check(!hasSecretName(result.body), 'weekly digest dry run does not expose secret env names');
        recorder.check(!hasRawLeak(result.body), 'weekly digest dry run has no raw-insights field names');
      } catch (err) {
        recorder.fail('weekly digest dry run fetch failed', err.message);
      }
    }
  }

  let profileHasUpload = !expectReady;
  if (expectReady) {
    try {
      const result = await fetchText(options, `/api/u/${encodeURIComponent(handle)}`);
      const body = result.response.status === 200 ? JSON.parse(result.body) : null;
      const uploads = Array.isArray(body?.uploads) ? body.uploads : [];
      profileHasUpload = Boolean(uploads[0]?.archetype);
      recorder.check(result.response.status === 200, 'saved profile JSON exists', `${result.response.status} ${result.url}`);
      recorder.check(profileHasUpload, 'saved profile has minted signature upload', `uploads=${uploads.length}`);
    } catch (err) {
      recorder.fail('saved profile upload proof failed', err.message);
    }
  }

  const paths = [
    {
      label: 'no-npm CLI bootstrap',
      path: '/cli.sh',
      expectedType: 'text/x-shellscript',
      allowStatuses: [200],
      requireNoStore: true,
      mustInclude: ['codeload.github.com', 'node "$run_dir/bin/vibestats.js" "$@"', 'Raw /insights data has not left this machine'],
      mustNotInclude: ['npx --yes', 'npm install', 'GITHUB_CLIENT_SECRET'],
    },
    {
      label: 'reveal homepage',
      path: '/',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['What kind of coder are you? Claude Code already knows.', '<code>/insights</code>', 'Copy status preflight', NO_NPM_STATUS, 'Copy no-npm reveal command', NO_NPM_REVEAL, `${NO_NPM_CLI}</code>`, NO_NPM_INSTALL, 'Try the reveal demo', 'shouldAutoRunDemo()', 'No file hunting', 'Explore sample pairings without data', '/compare?a=orchestrator&b=shipper', 'Your profile starts unlisted.', '/settings#privacy-settings', 'Set match intent', 'View weekly board', 'Find matches'],
      mustNotInclude: ['agent-insights.json', 'npx vibestats sync'],
      checkRawLeaks: false,
    },
    {
      label: 'profile JSON miss',
      path: `/api/u/${encodeURIComponent(missingHandle)}`,
      expectedType: 'application/json',
      allowStatuses: expectReady ? [404] : [404, 503],
      requireNoStore: true,
    },
    {
      label: 'profile JSON',
      path: `/api/u/${encodeURIComponent(handle)}`,
      expectedType: 'application/json',
      allowStatuses: expectReady ? [200] : [200, 404, 503],
      requireNoStore: true,
      mustInclude: expectReady ? ['"uploads"', '"metric_visibility"', '"history"', '"leaderboard"', '"evolution"', '"streak"', '"match_interest"'] : null,
    },
    {
      label: 'promises page',
      path: '/promises',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['Raw Claude Code sessions stay local.', 'Only derived metrics sync.', 'Profiles start unlisted.', 'No single hireable score.', 'No employer people search', 'bounded match-intro/outcome events', 'No free-text goals or friction'],
      mustNotInclude: ['tool_usage', 'language_usage', 'rawJson'],
    },
    {
      label: 'profile credential',
      path: `/u/${encodeURIComponent(handle)}/credential.json`,
      expectedType: 'application/json',
      allowStatuses: expectReady ? [200] : [200, 404, 503],
      mustInclude: expectReady ? ['"schema_version":"vibestats.derived_profile.v1"', '"github_claimed":true', '"raw_claude_code_sessions":"local-only"', '"synced_profile_fields":"derived-only"', '"no_single_hireable_score":true', '"spec_url":"', '"/api/derived-profile-spec"', '"future_source_ready":true', '"content_hash":"sha256:', '"verification_url"'] : null,
    },
    {
      label: 'derived profile spec',
      path: '/api/derived-profile-spec',
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: ['"schema_version":"vibestats.derived_profile.v1"', '"trust_tier":"github_claimed_derived"', '"raw_data_boundary":"local-only"', '"future_sources"', '"codex"', '"bounded outcome events"', '"single hireable score"'],
      mustNotInclude: ['tool_usage', 'language_usage', 'rawJson'],
    },
    {
      label: 'profile page',
      path: `/u/${encodeURIComponent(handle)}`,
      expectedType: 'text/html',
      allowStatuses: expectReady ? [200] : [200, 404],
      mustInclude: ['id="readme-panel"', 'Copy README badge', 'id="launch-kit-panel"', 'Owner launch kit', 'Copy launch kit', 'Copy terminal commands', 'id="credential-panel"', 'Verified derived profile', 'Copy credential proof', 'id="reveal-panel"', 'What are you?', NO_NPM_STATUS, NO_NPM_REVEAL, 'STATUS_COMMAND', 'CLAIM_COMMAND', 'Copy status', 'Copy claim', 'Copy badge proof', 'Share badge', 'GitHub-claimed', 'derived-only', 'id="privacy-cta"', 'id="match-intent-cta"', 'id="digest-preview-cta"'],
    },
    {
      label: 'profile recap',
      path: `/u/${encodeURIComponent(handle)}/recap`,
      expectedType: 'text/html',
      allowStatuses: expectReady ? [200] : [200, 404],
      mustInclude: expectReady && profileHasUpload
        ? ['Copy recap', 'Copy sync command', `const SYNC_COMMAND = '${NO_NPM_CLI}';`, 'Copy /vibestats install', 'id="recipient-reveal"', 'What are you?', 'Copy status', 'Copy reveal', 'Copy claim', NO_NPM_INSTALL, 'facet shape', 'Run CLI sync after more Claude Code work', 'Raw Claude Code /insights data stays local']
        : ['A privacy-preserving weekly recap'],
    },
    {
      label: 'unknown profile fallback',
      path: `/u/${encodeURIComponent(missingHandle)}`,
      expectedType: 'text/html',
      allowStatuses: expectReady ? [404] : [200, 404],
      requireNoStore: true,
      mustInclude: ['profile unclaimed', 'Copy unclaimed profile', 'Run /insights', 'Copy status', 'Copy claim', 'Raw sessions stay on your machine'],
    },
    {
      label: 'profile embed',
      path: `/u/${encodeURIComponent(handle)}/embed`,
      expectedType: 'text/html',
      allowStatuses: expectReady ? [200] : [200, 404],
      mustInclude: expectReady && profileHasUpload ? ['Compare + reveal yours', 'Run /insights, check status, then reveal yours', '<span>signal</span>'] : null,
    },
    {
      label: 'profile badge',
      path: `/u/${encodeURIComponent(handle)}/badge.svg`,
      expectedType: 'image/svg+xml',
      allowStatuses: expectReady ? [200] : [200, 404],
      mustInclude: expectReady && profileHasUpload ? ['GitHub-claimed', 'derived-only signal'] : null,
    },
    {
      label: 'upload-to-compare route',
      path: comparePath,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: expectReady && profileHasUpload
        ? [`See how you'd pair with @${handle}`, 'Run /insights, check status, then reveal yours', '/api/og?']
        : ['compareArchetype', 'compareTo'],
      checkRawLeaks: false,
    },
    {
      label: 'pair preview route',
      path: `/compare?a=${encodeURIComponent(archetype)}&b=shipper`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['Open the pairing, then claim yours', 'STATUS_COMMAND', NO_NPM_STATUS, 'Copy status', 'CLAIM_COMMAND', 'Copy claim'],
    },
    {
      label: 'profile-backed pair route',
      path: `/u/${encodeURIComponent(handle)}/pair/${encodeURIComponent(archetype)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: expectReady && profileHasUpload
        ? ['Open the pairing, then claim yours', `@${handle}`, '/?compareTo=', 'STATUS_COMMAND', 'Copy status', 'CLAIM_COMMAND', 'Copy claim']
        : ['comparisonParamsFromLocation()', 'compareTo=${encodeURIComponent(profileSubject.handle)}', 'STATUS_COMMAND', 'Copy status', 'CLAIM_COMMAND', 'Copy claim'],
    },
    {
      label: 'profile-backed missing pair route',
      path: `/u/${encodeURIComponent(handle)}/pair/${encodeURIComponent(missingHandle)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: expectReady && profileHasUpload
        ? [`See how you'd pair with @${handle}`, 'That profile is not minted yet. Preview a pairing or reveal yours.', 'Run /insights, check status, then reveal your real pairing']
        : ['showPicker(knownSubject', 'Run /insights, check status, then reveal your real pairing'],
      checkRawLeaks: false,
    },
    {
      label: 'share card route',
      path: `/card?a=${encodeURIComponent(archetype)}&n=Launch&d=7&c=2&l=3&s=4`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: [`/?compareArchetype=${encodeURIComponent(archetype)}`, 'What are you?', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
      mustNotInclude: "What's YOUR personality?",
    },
    {
      label: 'wrapped share route',
      path: '/wrapped',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['wrappedCompareUrl', '?compareArchetype=orchestrator', 'What are you?', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
    },
    {
      label: 'dashboard share route',
      path: '/dashboard',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['?compareArchetype=orchestrator', 'How would you pair with an Orchestrator?', 'What are you?', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
      mustNotInclude: 'Claude Code Analytics',
    },
    {
      label: 'genome page',
      path: '/genome',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['The Coding Genome', 'What are you?', '/insights', 'Copy status preflight', 'Copy no-npm reveal command', 'Copy claim command', NO_NPM_STATUS, NO_NPM_REVEAL, NO_NPM_INSTALL, 'Raw Claude Code /insights data stays local', '/compare?a=orchestrator&b=shipper'],
      mustNotInclude: ['>Quiz</a>', 'agent-insights.json'],
    },
    {
      label: 'settings shell',
      path: '/settings',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['id="privacy-settings"', 'Unlisted profiles load by direct URL', 'id="match-settings"', 'id="weekly-digest-row"', 'id="preview-digest"', 'id="cli-sync"', 'terminal-first GitHub approval', 'install-claude-command'],
    },
    {
      label: 'browse page',
      path: `/browse?archetype=${encodeURIComponent(archetype)}&intent=active`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['raw insights JSON and language details stay out', 'Copy share', 'Share on X', 'compareTo=${encodeURIComponent(handle)}', 'twitter.com/intent/tweet', 'Try sample pairing', 'What are you?', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
    },
    {
      label: 'browse API',
      path: `/api/browse?archetype=${encodeURIComponent(archetype)}&intent=active`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
      requireNoStore: true,
    },
    {
      label: 'match page',
      path: `/match?goal=pair-coding&archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['match by goal', 'Copy intro', 'comparePath(entry, seekerArchetype)', 'Try sample pairing', '/settings#match-settings', 'Find your real match', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
    },
    {
      label: 'match API',
      path: `/api/match?goal=pair-coding&archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
      requireNoStore: true,
    },
    {
      label: 'leaderboard page',
      path: `/leaderboard/${encodeURIComponent(archetype)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['public leaderboard', 'Copy invite', 'Share on X', "See how you'd pair", 'twitter.com/intent/tweet', 'Try sample pairing', 'Where do you rank?', '/insights', NO_NPM_STATUS, 'Copy status', NO_NPM_REVEAL, 'Copy claim', NO_NPM_INSTALL],
    },
    {
      label: 'leaderboard API',
      path: `/api/leaderboard?archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
      requireNoStore: true,
    },
  ];

  for (const item of paths) {
    try {
      const result = await fetchText(options, item.path);
      const cache = result.response.headers.get('cache-control') || '';
      const type = result.response.headers.get('content-type') || '';
      recorder.check(item.allowStatuses.includes(result.response.status), `${item.label} status`, `${result.response.status} ${result.url}`);
      recorder.check(type.includes(item.expectedType), `${item.label} content type`, type || '(none)');
      if (item.requireNoStore) recorder.check(cache.includes('no-store'), `${item.label} disables public caching`, cache || '(none)');
      if (item.mustInclude) {
        const needles = Array.isArray(item.mustInclude) ? item.mustInclude : [item.mustInclude];
        recorder.check(includesAll(result.body, needles), `${item.label} contains expected viral-loop copy`);
      }
      if (item.mustNotInclude) {
        const needles = Array.isArray(item.mustNotInclude) ? item.mustNotInclude : [item.mustNotInclude];
        recorder.check(includesNone(result.body, needles), `${item.label} removed stale generic share copy`);
      }
      if (item.checkRawLeaks !== false) {
        recorder.check(!hasRawLeak(result.body), `${item.label} has no raw-insights field names`);
      }
    } catch (err) {
      recorder.fail(`${item.label} fetch failed`, err.message);
    }
  }

  return {
    ok: recorder.results.every((item) => item.ok),
    origin,
    vercelDeployment: options.vercelDeployment || '',
    identity,
    results: recorder.results,
  };
}

function printReport(report) {
  console.log(`Launch audit: ${report.origin}`);
  if (report.vercelDeployment) console.log(`deployment=${report.vercelDeployment}`);
  if (report.identity) {
    console.log(`profile_save_available=${report.identity.profile_save_available}`);
    console.log(`weekly_digest_available=${report.identity.weekly_digest_available}`);
    if (report.identity.missing?.length) console.log(`missing=${report.identity.missing.join(',')}`);
  }
  console.log('');
  for (const item of report.results) {
    console.log(`${item.ok ? 'ok' : 'fail'} ${item.label}${item.detail ? ` (${item.detail})` : ''}`);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs();
  } catch (err) {
    console.error(err.message);
    console.error(usage());
    process.exit(2);
  }
  if (options.help) {
    console.log(usage());
    return;
  }

  const report = await auditLaunch(options);
  printReport(report);
  if (!report.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}

export { auditLaunch, parseArgs, parseVercelCurlResponse };
