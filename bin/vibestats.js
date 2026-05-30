#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publicMoments } from '../api/_lib/moments.js';
import { readInsightsInput } from '../lib/claude-insights-extractor.js';
import { derivedUploadPayloadFromInsights } from '../lib/insights-derived.js';

const DEFAULT_INSIGHTS_PATH = join(homedir(), '.claude', 'usage-data');
const DEFAULT_HOST = 'https://vibestats.io';
const DEFAULT_AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_CLI_PACKAGE = 'github:brightseth/vibestats#feat/wave-1-identity';
export const DEFAULT_NPX_SYNC_COMMAND = `npx --yes ${DEFAULT_CLI_PACKAGE}`;
const ARCHETYPE_LABELS = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

function usage() {
  return `Usage:
  vibestats [sync] [--file PATH] [--dir PATH] [--host URL] [--token TOKEN] [--no-open] [--dry-run]
  vibestats [sync] --dry-run --json

Environment:
  VIBESTATS_SYNC_TOKEN  optional signed sync token from vibestats settings
  VIBESTATS_URL         alternate host, defaults to ${DEFAULT_HOST}

The CLI reads Claude Code /insights output locally and sends only derived metrics.
By default it parses ${DEFAULT_INSIGHTS_PATH}/session-meta and ${DEFAULT_INSIGHTS_PATH}/facets.
It reveals your archetype locally before asking for approval to publish it.
Without --token it opens a browser approval flow against your GitHub-backed vibestats session.
Current public install command: ${DEFAULT_NPX_SYNC_COMMAND}
Use --dry-run to reveal locally without signing in or sending it.
Use --dry-run --json to print the exact derived payload for debugging.`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'sync';
  const options = {
    file: DEFAULT_INSIGHTS_PATH,
    host: process.env.VIBESTATS_URL || DEFAULT_HOST,
    token: process.env.VIBESTATS_SYNC_TOKEN || '',
    dryRun: false,
    json: false,
    openBrowser: true,
    authTimeoutMs: DEFAULT_AUTH_TIMEOUT_MS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { command: 'help', options };
    if (arg === '--file') options.file = args[++i] || '';
    else if (arg === '--dir') options.file = args[++i] || '';
    else if (arg === '--host') options.host = args[++i] || '';
    else if (arg === '--token') options.token = args[++i] || '';
    else if (arg === '--no-open') options.openBrowser = false;
    else if (arg === '--auth-timeout-ms') options.authTimeoutMs = Number(args[++i] || 0);
    else if (arg === '--dry-run' || arg === '--dryRun') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return { command, options };
}

export function normalizeHost(host) {
  const url = new URL(host || DEFAULT_HOST);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Host must be an http(s) URL.');
  url.pathname = '';
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

function apiUrl(host, value, fallbackPath = '') {
  const target = value || fallbackPath || '/';
  return new URL(target, `${normalizeHost(host)}/`).toString();
}

function profileHandle(profileUrl) {
  try {
    const parts = new URL(profileUrl).pathname.split('/').filter(Boolean);
    return parts[0] === 'u' && parts[1] ? decodeURIComponent(parts[1]) : '';
  } catch {
    return '';
  }
}

function randomNonce() {
  return randomBytes(24)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function htmlEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function successHtml(handle) {
  const label = handle ? `@${htmlEsc(handle)}` : 'your profile';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>vibestats CLI authorized</title></head><body><h1>vibestats CLI authorized</h1><p>You can return to the terminal. Sync will continue as ${label}.</p></body></html>`;
}

function formatInt(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function primaryScore(payload) {
  const score = Number(payload?.scores?.[payload?.archetype] || 0);
  return Number.isFinite(score) ? Math.round(score) : 0;
}

function revealLabel(payload) {
  return payload?.raw_meta?.signature || ARCHETYPE_LABELS[payload?.archetype] || payload?.archetype || 'vibecoder';
}

export function dryRunRevealText(payload = {}) {
  const archetype = ARCHETYPE_LABELS[payload.archetype] || payload.archetype || 'Unknown';
  const score = primaryScore(payload);
  const metrics = payload.metrics || {};
  const moments = publicMoments(payload.raw_meta?.moments || [], { exact: true });
  const metricLine = [
    `${formatInt(metrics.sessions)} sessions`,
    `${formatInt(metrics.days)} days`,
    `${formatInt(metrics.commitsPerDay)} commits/day`,
    `${formatInt(metrics.languages)} code languages`,
    `${formatInt(metrics.msgsPerSession)} messages/session`,
  ].join(' · ');
  const lines = [
    'vibestats local reveal',
    `Revealed: ${revealLabel(payload)}${score ? ` (${score}% ${archetype})` : ''}.`,
    `Pattern: ${metricLine}.`,
  ];

  if (moments.length) {
    lines.push('Behavioral moments:');
    for (const moment of moments) {
      lines.push(`- ${moment.label}: ${moment.value}`);
    }
  }

  lines.push(
    'Raw Claude Code /insights data stayed local. No profile was published.',
    'To claim your profile and share compare links, rerun without --dry-run.',
    'For machine-readable derived payload: add --json.',
  );

  return `${lines.join('\n')}\n`;
}

export function authUrlForLocalCallback(host, callback, nonce) {
  const params = new URLSearchParams({ callback, nonce });
  return `${normalizeHost(host)}/api/cli/local-token?${params.toString()}`;
}

export function openBrowser(url) {
  const commands = {
    darwin: ['open', [url]],
    win32: ['cmd', ['/c', 'start', '', url]],
    linux: ['xdg-open', [url]],
  };
  const [command, args] = commands[process.platform] || commands.linux;
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function requestSyncToken({
  host = DEFAULT_HOST,
  open = openBrowser,
  openBrowser: shouldOpenBrowser = true,
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  stdout = process.stdout,
} = {}) {
  const nonce = randomNonce();
  const normalizedHost = normalizeHost(host);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Not found');
        return;
      }
      if (url.searchParams.get('nonce') !== nonce) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Invalid vibestats CLI authorization response.');
        return;
      }
      if (url.searchParams.get('error')) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('vibestats CLI authorization failed.');
        finish(new Error(url.searchParams.get('error') || 'CLI authorization failed'));
        return;
      }

      const token = url.searchParams.get('token') || '';
      if (!token) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Missing vibestats sync token.');
        finish(new Error('CLI authorization failed: missing sync token'));
        return;
      }

      const responseHost = url.searchParams.get('host') || normalizedHost;
      const expiresAt = url.searchParams.get('expires_at') || '';
      const handle = url.searchParams.get('handle') || '';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(successHtml(handle));
      finish(null, { token, host: responseHost, expires_at: expiresAt, handle });
    });

    function finish(err, value) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        server.close();
      } catch {
        // The listen error path can reach cleanup before the server is fully open.
      }
      if (err) reject(err);
      else resolve(value);
    }

    server.on('error', (err) => finish(err));
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const callback = `http://127.0.0.1:${address.port}/callback`;
      const url = authUrlForLocalCallback(normalizedHost, callback, nonce);
      if (shouldOpenBrowser) {
        stdout.write('Opening browser to authorize vibestats CLI sync.\n');
        const opened = open(url);
        if (!opened) stdout.write('Browser did not open automatically.\n');
      } else {
        stdout.write('Browser opening skipped.\n');
      }
      stdout.write(`Authorize here: ${url}\n`);
    });

    timer = setTimeout(() => {
      finish(new Error('Timed out waiting for browser authorization. Run again with --no-open to copy the URL manually.'));
    }, Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_AUTH_TIMEOUT_MS);
    timer.unref?.();
  });
}

export async function sync(options) {
  if (!options.file) throw new Error('Missing insights file path.');

  const insights = await readInsightsInput(options.file);
  const payload = derivedUploadPayloadFromInsights(insights, { source: 'cli' });

  if (options.dryRun) {
    if (options.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else process.stdout.write(dryRunRevealText(payload));
    return { dry_run: true, payload };
  }

  const label = payload.raw_meta?.signature || ARCHETYPE_LABELS[payload.archetype] || payload.archetype;
  const score = Math.round(Number(payload.scores?.[payload.archetype] || 0));
  process.stdout.write(`Revealed: ${label}${score ? ` (${score}% ${ARCHETYPE_LABELS[payload.archetype] || payload.archetype})` : ''}.\n`);
  process.stdout.write('Raw Claude Code /insights data stayed local. Publishing only derived metrics.\n');

  let host = normalizeHost(options.host || DEFAULT_HOST);
  let token = options.token || '';
  if (!token) {
    const requestToken = options.requestToken || requestSyncToken;
    const auth = await requestToken({
      host,
      openBrowser: options.openBrowser !== false,
      timeoutMs: options.authTimeoutMs,
    });
    token = auth.token;
    if (auth.host) host = normalizeHost(auth.host);
    if (auth.handle) process.stdout.write(`Authorized CLI sync as @${auth.handle}.\n`);
  }

  const res = await fetch(`${host}/api/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibestats-cli',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Sync failed with HTTP ${res.status}`);

  const profileUrl = apiUrl(host, body.profile_url, '/');
  const profilePath = new URL(profileUrl).pathname;
  const compareUrl = apiUrl(host, body.compare_url, `/?compareArchetype=${encodeURIComponent(payload.archetype)}`);
  const recapUrl = apiUrl(host, body.recap_url, `${profilePath}/recap`);
  const badgeUrl = apiUrl(host, body.badge_url, `${profilePath}/badge.svg`);
  const handle = profileHandle(profileUrl) || 'me';
  const badgeMarkdown = `[![vibestats: @${handle}](${badgeUrl})](${compareUrl})`;
  process.stdout.write(`Synced ${payload.raw_meta.signature || payload.archetype} to ${profileUrl}\n`);
  process.stdout.write(`Invite people to compare: ${compareUrl}\n`);
  process.stdout.write(`Share your recap: ${recapUrl}\n`);
  process.stdout.write(`README badge Markdown: ${badgeMarkdown}\n`);
  return body;
}

export async function main() {
  const { command, options } = parseArgs(process.argv);
  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command !== 'sync') throw new Error(`Unknown command: ${command}`);
  await sync(options);
}

export function isDirectRun(entry = process.argv[1]) {
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.stderr.write(`\n${usage()}\n`);
    process.exitCode = 1;
  });
}
