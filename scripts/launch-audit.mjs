#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_HANDLE = 'brightseth';
const DEFAULT_ARCHETYPE = 'builder';
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
    expectDigest: false,
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
  options.handle = String(options.handle || '').trim().replace(/^@/, '');
  options.archetype = String(options.archetype || '').trim().toLowerCase();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(options.handle)) {
    throw new Error('--handle must be a GitHub-style handle');
  }
  if (!/^[a-z]+$/.test(options.archetype)) {
    throw new Error('--archetype must be a lowercase archetype key');
  }
  return options;
}

function normalizeOrigin(value) {
  const url = new URL(String(value || '').trim());
  return url.origin;
}

function usage() {
  return `Usage: npm run audit:launch -- --origin https://vibestats.io --handle brightseth [--expect-ready] [--expect-digest]
       npm run audit:launch -- --deployment https://preview.vercel.app --scope lets-vibe --handle brightseth

Checks the deployed identity loop without printing secrets:
- /api/identity-status readiness and no-store headers
- profile shell, profile JSON miss cache policy, unknown-profile fallback cache policy, embed, and badge surfaces
- card, wrapped, dashboard, compare-first upload route, pair preview route, browse, match, and leaderboard surfaces
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

async function fetchViaVercelCurl(options, path, url) {
  const args = ['curl', path, '--deployment', options.vercelDeployment];
  if (options.vercelScope) args.push('--scope', options.vercelScope);
  args.push('--', '-s', '-i');
  const { stdout } = await execFileAsync('vercel', args, { maxBuffer: 5 * 1024 * 1024 });
  const parsed = parseVercelCurlResponse(stdout);
  return { url: url.toString(), ...parsed };
}

async function fetchText(options, path) {
  const { origin } = options;
  const url = new URL(path, origin);
  if (options.vercelDeployment) {
    return fetchViaVercelCurl(options, path, url);
  }

  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/json,image/svg+xml,*/*' },
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

async function auditLaunch(options) {
  const recorder = createRecorder();
  const { origin, handle, archetype, expectReady, expectDigest } = options;
  const missingHandle = `audit-missing-${Date.now().toString(36)}`.slice(0, 39);
  const comparePath = `/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(archetype)}`;

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
    if (expectDigest) {
      recorder.check(identity.weekly_digest_available === true, 'weekly digest delivery is ready', readinessSummary(identity));
    }
  } catch (err) {
    recorder.fail('identity status fetch failed', err.message);
  }

  const paths = [
    {
      label: 'profile JSON miss',
      path: `/api/u/${encodeURIComponent(missingHandle)}`,
      expectedType: 'application/json',
      allowStatuses: expectReady ? [404] : [404, 503],
      requireNoStore: true,
    },
    {
      label: 'profile page',
      path: `/u/${encodeURIComponent(handle)}`,
      expectedType: 'text/html',
      allowStatuses: [200, 404],
    },
    {
      label: 'unknown profile fallback',
      path: `/u/${encodeURIComponent(missingHandle)}`,
      expectedType: 'text/html',
      allowStatuses: expectReady ? [404] : [200, 404],
      requireNoStore: true,
    },
    {
      label: 'profile embed',
      path: `/u/${encodeURIComponent(handle)}/embed`,
      expectedType: 'text/html',
      allowStatuses: [200, 404],
    },
    {
      label: 'profile badge',
      path: `/u/${encodeURIComponent(handle)}/badge.svg`,
      expectedType: 'image/svg+xml',
      allowStatuses: [200, 404],
    },
    {
      label: 'upload-to-compare route',
      path: comparePath,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['compareArchetype', 'compareTo'],
      checkRawLeaks: false,
    },
    {
      label: 'pair preview route',
      path: `/compare?a=${encodeURIComponent(archetype)}&b=shipper`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: 'Open the pairing, then claim yours',
    },
    {
      label: 'share card route',
      path: `/card?a=${encodeURIComponent(archetype)}&n=Launch&d=7&c=2&l=3&s=4`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: `/?compareArchetype=${encodeURIComponent(archetype)}`,
      mustNotInclude: "What's YOUR personality?",
    },
    {
      label: 'wrapped share route',
      path: '/wrapped',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['wrappedCompareUrl', '?compareArchetype=orchestrator'],
    },
    {
      label: 'dashboard share route',
      path: '/dashboard',
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['?compareArchetype=orchestrator', 'How would you pair with an Orchestrator?'],
    },
    {
      label: 'browse page',
      path: `/browse?archetype=${encodeURIComponent(archetype)}&intent=active`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['raw insights JSON and language details stay out', 'Copy share', 'compareTo=${encodeURIComponent(handle)}'],
    },
    {
      label: 'browse API',
      path: `/api/browse?archetype=${encodeURIComponent(archetype)}&intent=active`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
    },
    {
      label: 'match page',
      path: `/match?goal=pair-coding&archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['match by goal', 'Copy intro', 'comparePath(entry, seekerArchetype)'],
    },
    {
      label: 'match API',
      path: `/api/match?goal=pair-coding&archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
    },
    {
      label: 'leaderboard page',
      path: `/leaderboard/${encodeURIComponent(archetype)}`,
      expectedType: 'text/html',
      allowStatuses: [200],
      mustInclude: ['public leaderboard', 'Copy invite', "See how you'd pair"],
    },
    {
      label: 'leaderboard API',
      path: `/api/leaderboard?archetype=${encodeURIComponent(archetype)}`,
      expectedType: 'application/json',
      allowStatuses: [200],
      mustInclude: '"entries"',
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
