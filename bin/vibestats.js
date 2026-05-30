#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publicMoments } from '../api/_lib/moments.js';
import { readInsightsInput } from '../lib/claude-insights-extractor.js';
import { derivedUploadPayloadFromInsights } from '../lib/insights-derived.js';
import { buildShareKit, fetchProfile, shareKitText } from '../lib/share-kit.js';

const DEFAULT_INSIGHTS_PATH = join(homedir(), '.claude', 'usage-data');
export const DEFAULT_CLAUDE_COMMAND_PATH = join(homedir(), '.claude', 'commands', 'vibestats.md');
const DEFAULT_HOST = 'https://vibestats.io';
const DEFAULT_AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const FALLBACK_CLI_PACKAGE = 'github:brightseth/vibestats#feat/wave-1-identity';
const DEFAULT_CLI_PACKAGE = process.env.VIBESTATS_CLI_PACKAGE || FALLBACK_CLI_PACKAGE;
export const DEFAULT_NPX_SYNC_COMMAND = `npx --yes ${DEFAULT_CLI_PACKAGE}`;
export const DEFAULT_NPX_REVEAL_COMMAND = `${DEFAULT_NPX_SYNC_COMMAND} reveal`;
export const DEFAULT_NPX_STATUS_COMMAND = `${DEFAULT_NPX_SYNC_COMMAND} status`;
export const DEFAULT_NPX_JOIN_COMMAND = `${DEFAULT_NPX_SYNC_COMMAND} join`;
export const DEFAULT_INSTALL_COMMAND = `${DEFAULT_NPX_SYNC_COMMAND} install-claude-command`;
export function localHelperCommand(command = '', { host = DEFAULT_HOST } = {}) {
  const suffix = String(command || '').trim();
  return `curl -fsSL ${normalizeHost(host)}/cli.sh | sh -s --${suffix ? ` ${suffix}` : ''}`;
}
export const DEFAULT_LOCAL_SYNC_COMMAND = localHelperCommand();
export const DEFAULT_LOCAL_REVEAL_COMMAND = localHelperCommand('reveal');
export const DEFAULT_LOCAL_STATUS_COMMAND = localHelperCommand('status');
export const DEFAULT_LOCAL_INSTALL_COMMAND = localHelperCommand('install-claude-command');
const CLAUDE_COMMAND_SOURCE = new URL('../.claude/commands/vibestats.md', import.meta.url);
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
const COMPLEMENTARY_ARCHETYPES = {
  orchestrator: 'deepdiver',
  shipper: 'debugger',
  architect: 'builder',
  debugger: 'shipper',
  polyglot: 'builder',
  sprinter: 'architect',
  deepdiver: 'orchestrator',
  builder: 'architect',
};

function usage() {
  return `Usage:
  vibestats [--file PATH] [--dir PATH] [--host URL] [--token TOKEN] [--device|--browser] [--no-open]
  vibestats status [--file PATH] [--dir PATH] [--json]
  vibestats reveal [--file PATH] [--dir PATH] [--json]
  vibestats claim CODE [--file PATH] [--dir PATH] [--host URL] [--token TOKEN] [--device|--browser] [--no-open] [--yes]
  vibestats share --handle HANDLE [--host URL] [--json]
  vibestats intent <pair-coding|co-founder|hire|mentor|mentee|idle> [--contact-url URL] [--public] [--host URL] [--token TOKEN] [--device|--browser] [--no-open]
  vibestats [sync|join|onboard] [--file PATH] [--dir PATH] [--host URL] [--token TOKEN] [--claim CODE] [--device|--browser] [--no-open] [--dry-run] [--yes]
  vibestats [sync|join|onboard] --dry-run --json
  vibestats install-claude-command [--force] [--path PATH]

Environment:
  VIBESTATS_SYNC_TOKEN  optional signed sync token from vibestats settings
  VIBESTATS_URL         alternate host, defaults to ${DEFAULT_HOST}
  VIBESTATS_CLI_PACKAGE alternate npx package spec for printed follow-up commands

The CLI reads Claude Code /insights output locally and sends only derived metrics.
By default it parses ${DEFAULT_INSIGHTS_PATH}/session-meta and ${DEFAULT_INSIGHTS_PATH}/facets.
Use status to check local /insights readiness without reading raw session JSON.
It reveals your archetype locally before asking for approval to publish it.
Run without a subcommand for the terminal-first participation flow: local reveal, then GitHub approval.
Use reveal for a local result with no sign-in and no network publish.
Use share to fetch a public profile and print its compare link, badge, embed, and privacy proof.
Use intent to set or clear your short-lived matchmaker availability from the terminal.
Use claim CODE from an SSH/TUI claim session to publish locally derived metrics back to that waiting session.
Use join/onboard as explicit aliases for the same terminal-first flow; they use a GitHub device code by default.
Use --yes with join/onboard to publish after reveal without prompting. Use sync for explicit publish automation.
Without --token, sync opens a browser approval flow against your GitHub-backed vibestats session.
Use --device to force terminal device-code auth, or --browser to force local browser callback auth.
Current no-npm claim command: ${DEFAULT_LOCAL_SYNC_COMMAND}
Current no-npm reveal command: ${DEFAULT_LOCAL_REVEAL_COMMAND}
Current no-npm status command: ${DEFAULT_LOCAL_STATUS_COMMAND}
Current npx fallback command: ${DEFAULT_NPX_SYNC_COMMAND}
Install the Claude Code /vibestats command: ${DEFAULT_LOCAL_INSTALL_COMMAND}
Use --dry-run as a legacy alias for reveal.
Use reveal --json to print the exact derived payload for debugging.`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith('-') ? args.shift() : 'onboard';
  const options = {
    file: DEFAULT_INSIGHTS_PATH,
    host: process.env.VIBESTATS_URL || DEFAULT_HOST,
    token: process.env.VIBESTATS_SYNC_TOKEN || '',
    dryRun: false,
    json: false,
    force: false,
    path: DEFAULT_CLAUDE_COMMAND_PATH,
    handle: '',
    intent: '',
    contactUrl: '',
    makePublic: false,
    openBrowser: true,
    authTimeoutMs: DEFAULT_AUTH_TIMEOUT_MS,
    authMode: process.env.VIBESTATS_AUTH_MODE || '',
    assumeYes: process.env.VIBESTATS_YES === '1' || process.env.VIBESTATS_ASSUME_YES === '1',
    promptToPublish: false,
    claimCode: '',
  };

  if (command === 'intent' && args[0] && !args[0].startsWith('-')) {
    options.intent = args.shift();
  }
  if (command === 'claim' && args[0] && !args[0].startsWith('-')) {
    options.claimCode = args.shift();
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { command: 'help', options };
    if (arg === '--file') options.file = args[++i] || '';
    else if (arg === '--dir') options.file = args[++i] || '';
    else if (arg === '--path') options.path = args[++i] || '';
    else if (arg === '--host') options.host = args[++i] || '';
    else if (arg.startsWith('--host=')) options.host = arg.slice('--host='.length);
    else if (arg === '--origin') options.host = args[++i] || '';
    else if (arg.startsWith('--origin=')) options.host = arg.slice('--origin='.length);
    else if (arg === '--handle') options.handle = args[++i] || '';
    else if (arg.startsWith('--handle=')) options.handle = arg.slice('--handle='.length);
    else if (arg === '--intent') options.intent = args[++i] || '';
    else if (arg.startsWith('--intent=')) options.intent = arg.slice('--intent='.length);
    else if (arg === '--contact-url') options.contactUrl = args[++i] || '';
    else if (arg.startsWith('--contact-url=')) options.contactUrl = arg.slice('--contact-url='.length);
    else if (arg === '--public') options.makePublic = true;
    else if (arg === '--token') options.token = args[++i] || '';
    else if (arg === '--claim') options.claimCode = args[++i] || '';
    else if (arg.startsWith('--claim=')) options.claimCode = arg.slice('--claim='.length);
    else if (arg === '--no-open') options.openBrowser = false;
    else if (arg === '--device') options.authMode = 'device';
    else if (arg === '--browser') options.authMode = 'browser';
    else if (arg === '--auth-timeout-ms') options.authTimeoutMs = Number(args[++i] || 0);
    else if (arg === '--dry-run' || arg === '--dryRun') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--yes' || arg === '-y' || arg === '--publish') options.assumeYes = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!['', 'browser', 'device'].includes(options.authMode)) {
    throw new Error('Auth mode must be browser or device.');
  }
  options.handle = String(options.handle || '').trim().replace(/^@/, '');
  options.intent = String(options.intent || '').trim() || 'idle';
  options.contactUrl = String(options.contactUrl || '').trim();
  options.claimCode = String(options.claimCode || '').trim();
  if (command === 'reveal') options.dryRun = true;
  if (!options.authMode) options.authMode = ['join', 'onboard', 'claim', 'intent'].includes(command) ? 'device' : 'browser';
  options.promptToPublish = ['join', 'onboard', 'claim'].includes(command) && !options.dryRun;
  if (command === 'claim' && !options.claimCode && !options.dryRun) {
    throw new Error('Missing SSH claim code.');
  }

  return { command, options };
}

export function isSyncCommand(command) {
  return ['reveal', 'sync', 'join', 'onboard', 'claim'].includes(command);
}

function missingInsightsAdvice() {
  return [
    'Terminal onboarding:',
    '1. Open Claude Code and run /insights.',
    `2. Check terminal readiness: ${DEFAULT_LOCAL_STATUS_COMMAND}`,
    `3. Preview locally: ${DEFAULT_LOCAL_REVEAL_COMMAND}`,
    `4. Publish when ready: ${DEFAULT_LOCAL_SYNC_COMMAND}`,
    'No raw Claude Code session data leaves your machine; publishing sends derived metrics only.',
  ].join('\n');
}

export function cliErrorMessage(err) {
  const message = String(err?.message || err || 'vibestats failed');
  const missingInsights = err?.code === 'ENOENT'
    || message.includes('No Claude Code /insights session metadata found')
    || message.includes(`${join('.claude', 'usage-data')}`);
  if (!missingInsights) return message;
  if (message.includes('Terminal onboarding:')) return message;
  return `${message}\n\n${missingInsightsAdvice()}`;
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

function compactShareLabel(value) {
  return String(value || 'Claude Code profile').replace(/\s+/g, ' ').trim();
}

function localRevealLinks(payload = {}, host = DEFAULT_HOST) {
  const archetype = payload?.archetype;
  if (!ARCHETYPE_LABELS[archetype]) return null;
  let origin = DEFAULT_HOST;
  try {
    origin = normalizeHost(host || DEFAULT_HOST);
  } catch {
    origin = DEFAULT_HOST;
  }
  const complement = COMPLEMENTARY_ARCHETYPES[archetype] || 'builder';
  return {
    compare: `${origin}/?compareArchetype=${encodeURIComponent(archetype)}`,
    pairing: `${origin}/compare?a=${encodeURIComponent(archetype)}&b=${encodeURIComponent(complement)}`,
    complement: ARCHETYPE_LABELS[complement] || complement,
  };
}

function heading(title) {
  const value = String(title || '').trim();
  return [value, '='.repeat(value.length)];
}

function section(title, lines = []) {
  return [
    '',
    title,
    ...lines.filter(Boolean).map((line) => `  ${line}`),
  ];
}

function boundedNumber(value, max = 1000000) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n), 0), max);
}

function boundedMap(source = {}, maxEntries = 20, maxValue = 1000000) {
  return Object.fromEntries(Object.entries(source || {})
    .map(([key, value]) => [
      String(key || '').trim().replace(/[^a-zA-Z0-9_+-]/g, '').slice(0, 32).toLowerCase(),
      boundedNumber(value, maxValue),
    ])
    .filter(([key, value]) => key && value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxEntries));
}

function localWebPreviewData(insights = {}) {
  const metrics = insights.metrics || {};
  return {
    version: 'vibestats.local_preview.v1',
    source: 'cli',
    insights: {
      meta: {
        user: String(insights.meta?.user || 'Local terminal reveal').replace(/\s+/g, ' ').trim().slice(0, 80),
        date_range: String(insights.meta?.date_range || '').replace(/[^\d to-]/g, '').slice(0, 32),
      },
      metrics: {
        total_sessions: boundedNumber(metrics.total_sessions, 100000),
        total_messages: boundedNumber(metrics.total_messages, 5000000),
        commits: boundedNumber(metrics.commits, 1000000),
        satisfaction_rate: Number.isFinite(Number(metrics.satisfaction_rate)) ? Math.min(Math.max(Number(metrics.satisfaction_rate), 0), 1) : undefined,
        multi_clauding_rate: Number.isFinite(Number(metrics.multi_clauding_rate)) ? Math.min(Math.max(Number(metrics.multi_clauding_rate), 0), 1) : undefined,
        buggy_code_events: boundedNumber(metrics.buggy_code_events, 100000),
        task_agent_sessions: boundedNumber(metrics.task_agent_sessions, 100000),
        longest_session_minutes: boundedNumber(metrics.longest_session_minutes, 60 * 72),
        files_modified: boundedNumber(metrics.files_modified, 100000),
        lines_changed: boundedNumber(metrics.lines_changed, 5000000),
        tool_usage: boundedMap(metrics.tool_usage, 12, 5000000),
        language_usage: boundedMap(metrics.language_usage, 20, 5000000),
      },
    },
  };
}

export function localWebPreviewUrl(insights = {}, { host = DEFAULT_HOST } = {}) {
  const encoded = Buffer.from(JSON.stringify(localWebPreviewData(insights)), 'utf8').toString('base64url');
  return `${normalizeHost(host)}/#vibestatsPreview=${encoded}`;
}

export function cliShareText({ label, compareUrl } = {}) {
  const shareLabel = compactShareLabel(label);
  return `I just claimed my Claude Code build profile: ${shareLabel}. Raw /insights stayed local. What are you? See how you'd pair with me: ${compareUrl}`;
}

export function cliXShareUrl({ label, compareUrl } = {}) {
  const shareLabel = compactShareLabel(label);
  const params = new URLSearchParams({
    text: `I just claimed my Claude Code build profile: ${shareLabel}. Raw /insights stayed local. What are you? See how you'd pair with me.`,
    url: compareUrl || DEFAULT_HOST,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function cliRevealShareText({ label, compareUrl } = {}) {
  const shareLabel = compactShareLabel(label);
  return `I just revealed my Claude Code build profile locally: ${shareLabel}. Raw /insights stayed on my machine. What are you? Compare with my archetype: ${compareUrl}`;
}

export function cliRevealXShareUrl({ label, compareUrl } = {}) {
  const shareLabel = compactShareLabel(label);
  const params = new URLSearchParams({
    text: `I just revealed my Claude Code build profile locally: ${shareLabel}. Raw /insights stayed on my machine. What are you?`,
    url: compareUrl || DEFAULT_HOST,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function cliRevealTerminalCard(payload = {}, { host = DEFAULT_HOST } = {}) {
  const archetype = ARCHETYPE_LABELS[payload.archetype] || payload.archetype || 'Unknown';
  const label = revealLabel(payload);
  const score = primaryScore(payload);
  const metrics = payload.metrics || {};
  const links = localRevealLinks(payload, host);
  const moments = publicMoments(payload.raw_meta?.moments || [], { exact: true }).slice(0, 2);
  const pattern = [
    `${formatInt(metrics.sessions)} sessions`,
    `${formatInt(metrics.days)} days`,
    `${formatInt(metrics.commitsPerDay)} commits/day`,
    `${formatInt(metrics.msgsPerSession)} messages/session`,
  ].join(' | ');
  const lines = [
    '[vibestats]',
    `${label}${score ? ` (${score}% ${archetype})` : ''}`,
    pattern,
  ];

  if (moments.length) {
    lines.push(`Moments: ${moments.map((moment) => `${moment.label}: ${moment.value}`).join(' | ')}`);
  }

  lines.push('Raw /insights stayed local. What are you?');
  if (links?.compare) lines.push(links.compare);
  return lines.join('\n');
}

export function dryRunRevealText(payload = {}, { host = DEFAULT_HOST } = {}) {
  const archetype = ARCHETYPE_LABELS[payload.archetype] || payload.archetype || 'Unknown';
  const label = revealLabel(payload);
  const score = primaryScore(payload);
  const metrics = payload.metrics || {};
  const moments = publicMoments(payload.raw_meta?.moments || [], { exact: true });
  const links = localRevealLinks(payload, host);
  const metricLine = [
    `${formatInt(metrics.sessions)} sessions`,
    `${formatInt(metrics.days)} days`,
    `${formatInt(metrics.commitsPerDay)} commits/day`,
    `${formatInt(metrics.languages)} code languages`,
    `${formatInt(metrics.msgsPerSession)} messages/session`,
  ].join(' · ');
  const lines = [
    ...heading('vibestats local reveal'),
    ...section('Profile', [
      `Revealed: ${label}${score ? ` (${score}% ${archetype})` : ''}.`,
      `Pattern: ${metricLine}.`,
    ]),
  ];

  if (moments.length) {
    lines.push('', 'Behavioral moments');
    for (const moment of moments) {
      lines.push(`  - ${moment.label}: ${moment.value}`);
    }
  }

  if (links) {
    lines.push(
      '',
      'Share',
      `  Share without claiming: ${links.compare}`,
      '  Pasteable terminal card:',
      cliRevealTerminalCard(payload, { host }),
      `  Copy/paste reveal: ${cliRevealShareText({ label, compareUrl: links.compare })}`,
      `  Share reveal on X: ${cliRevealXShareUrl({ label, compareUrl: links.compare })}`,
      `  Preview a ${archetype} x ${links.complement} pairing: ${links.pairing}`,
    );
  }

  lines.push(
    '',
    'Next',
    '  Raw Claude Code /insights data stayed local. No profile was published.',
    '  No website upload required.',
    `  1. Claim your GitHub-backed profile: ${localHelperCommand('', { host })}`,
    `  2. Install /vibestats for future reveals: ${localHelperCommand('install-claude-command', { host })}`,
    `  3. Refresh later: run /insights, then ${localHelperCommand('status', { host })}, then ${localHelperCommand('reveal', { host })}`,
    '  Audit mode: add --json to print the machine-readable derived payload.',
  );

  return `${lines.join('\n')}\n`;
}

export async function confirmPublish({
  assumeYes = false,
  input = process.stdin,
  output = process.stdout,
  stdout = process.stdout,
} = {}) {
  if (assumeYes) return true;

  if (!input?.isTTY) {
    stdout.write(`Profile not published because this terminal is non-interactive. Claim later with: ${DEFAULT_LOCAL_SYNC_COMMAND} sync\n`);
    return false;
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question([
      '',
      'Claim this GitHub-backed profile on vibestats?',
      '  Raw /insights stays local. Only derived metrics are published.',
      '  The browser will open your wrapped recap after sync.',
      'Publish now? [y/N] ',
    ].join('\n'));
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function statPath(path) {
  try {
    return await stat(path);
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

function displayPath(path) {
  const value = String(path || DEFAULT_INSIGHTS_PATH);
  const home = homedir();
  return value === home ? '~' : value.startsWith(`${home}/`) ? `~/${value.slice(home.length + 1)}` : value;
}

async function jsonFileCount(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).length;
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return 0;
    throw err;
  }
}

async function hasReportHtml(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && /^report.*\.html$/i.test(entry.name));
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return false;
    throw err;
  }
}

function onboardingNextSteps(ready) {
  if (ready) {
    return [
      `Reveal locally: ${DEFAULT_LOCAL_REVEAL_COMMAND}`,
      `Claim a GitHub-backed profile: ${DEFAULT_LOCAL_SYNC_COMMAND}`,
      `Install /vibestats in Claude Code: ${DEFAULT_LOCAL_INSTALL_COMMAND}`,
    ];
  }
  return [
    'In Claude Code, run /insights.',
    `Recheck terminal readiness: ${DEFAULT_LOCAL_STATUS_COMMAND}`,
    `Reveal locally after /insights: ${DEFAULT_LOCAL_REVEAL_COMMAND}`,
  ];
}

export async function onboardingStatus({ file = DEFAULT_INSIGHTS_PATH } = {}) {
  const target = file || DEFAULT_INSIGHTS_PATH;
  const info = await statPath(target);
  const base = {
    path: target,
    display_path: displayPath(target),
    reveal_command: DEFAULT_LOCAL_REVEAL_COMMAND,
    claim_command: DEFAULT_LOCAL_SYNC_COMMAND,
    status_command: DEFAULT_LOCAL_STATUS_COMMAND,
    install_command: DEFAULT_LOCAL_INSTALL_COMMAND,
    privacy: 'Status reads file names and counts only. Reveal and sync derive locally; publishing sends derived metrics only.',
  };

  if (!info) {
    return {
      ...base,
      input_kind: 'missing',
      ready: false,
      status: 'missing',
      session_meta_files: 0,
      facet_files: 0,
      report_html: false,
      next_steps: onboardingNextSteps(false),
    };
  }

  if (info.isFile()) {
    const lower = target.toLowerCase();
    const ready = lower.endsWith('.json') || lower.endsWith('.html');
    const inputKind = lower.endsWith('.html') ? 'report-html' : lower.endsWith('.json') ? 'legacy-json' : 'unsupported-file';
    return {
      ...base,
      input_kind: inputKind,
      ready,
      status: ready ? 'ready' : 'unsupported_file',
      session_meta_files: 0,
      facet_files: 0,
      report_html: lower.endsWith('.html'),
      next_steps: onboardingNextSteps(ready),
    };
  }

  if (!info.isDirectory()) {
    return {
      ...base,
      input_kind: 'unsupported',
      ready: false,
      status: 'unsupported_path',
      session_meta_files: 0,
      facet_files: 0,
      report_html: false,
      next_steps: onboardingNextSteps(false),
    };
  }

  const [sessionMetaFiles, facetFiles, reportHtml] = await Promise.all([
    jsonFileCount(join(target, 'session-meta')),
    jsonFileCount(join(target, 'facets')),
    hasReportHtml(target),
  ]);
  const ready = sessionMetaFiles > 0;
  return {
    ...base,
    input_kind: 'claude-usage-directory',
    ready,
    status: ready ? 'ready' : 'missing_session_meta',
    session_meta_files: sessionMetaFiles,
    facet_files: facetFiles,
    report_html: reportHtml,
    next_steps: onboardingNextSteps(ready),
  };
}

export function onboardingStatusText(status = {}) {
  const ready = status.ready === true;
  const lines = [
    ...heading('vibestats terminal onboarding check'),
    ...section('Input', [
      `Insights input: ${status.display_path || displayPath(status.path)}`,
      `Status: ${ready ? 'ready for reveal' : 'waiting for Claude Code /insights output'}`,
    ]),
  ];

  if (status.input_kind === 'claude-usage-directory') {
    const sessionCount = Number(status.session_meta_files || 0);
    const facetCount = Number(status.facet_files || 0);
    lines.push(
      '',
      'Found',
      `  ${formatInt(sessionCount)} session-meta JSON ${sessionCount === 1 ? 'file' : 'files'}`,
      `  ${formatInt(facetCount)} facet JSON ${facetCount === 1 ? 'file' : 'files'}`,
      `  report.html ${status.report_html ? 'present' : 'missing'}`,
    );
  } else if (status.input_kind === 'legacy-json') {
    lines.push('', 'Found', '  legacy JSON export file. Prefer the real /insights directory when available.');
  } else if (status.input_kind === 'report-html') {
    lines.push('', 'Found', '  /insights report HTML. The CLI will read the sibling session-meta and facets directories.');
  } else if (status.input_kind === 'unsupported-file') {
    lines.push('', 'Found', '  unsupported file type. Use the /insights directory or a legacy JSON export.');
  }

  lines.push('', 'Next');
  for (const [index, step] of (status.next_steps || onboardingNextSteps(ready)).entries()) {
    lines.push(`  ${index + 1}. ${step}`);
  }
  lines.push('', 'Privacy', `  ${status.privacy || 'Raw Claude Code data stays local; publishing sends derived metrics only.'}`);
  return `${lines.join('\n')}\n`;
}

export async function printOnboardingStatus(options = {}, { stdout = process.stdout } = {}) {
  const status = await onboardingStatus(options);
  if (options.json) stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  else stdout.write(onboardingStatusText(status));
  return status;
}

function shareKitCommands(host = DEFAULT_HOST) {
  return {
    insights: '/insights',
    status: localHelperCommand('status', { host }),
    reveal: localHelperCommand('reveal', { host }),
    claim: localHelperCommand('', { host }),
    install: localHelperCommand('install-claude-command', { host }),
  };
}

export async function printProfileShareKit(options = {}, {
  stdout = process.stdout,
  fetchImpl = fetch,
} = {}) {
  const handle = String(options.handle || '').trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) {
    throw new Error('Missing --handle. Use: vibestats share --handle <gh-handle>');
  }

  const origin = normalizeHost(options.host || DEFAULT_HOST);
  const profile = await fetchProfile({ origin, handle, fetchImpl });
  const kit = buildShareKit(profile, {
    origin,
    handle,
    terminalCommands: shareKitCommands(origin),
  });
  if (options.json) stdout.write(`${JSON.stringify(kit, null, 2)}\n`);
  else stdout.write(`${shareKitText(kit)}\n`);
  return kit;
}

function matchIntentLabel(value) {
  return {
    'pair-coding': 'Pair coding',
    'co-founder': 'Co-founder',
    hire: 'Hiring',
    mentor: 'Mentor',
    mentee: 'Mentee',
    idle: 'Idle',
  }[value] || value || 'Idle';
}

export async function setMatchIntent(options = {}, {
  stdout = process.stdout,
  fetchImpl = fetch,
} = {}) {
  const lookingFor = String(options.intent || 'idle').trim() || 'idle';
  let host = normalizeHost(options.host || DEFAULT_HOST);
  let token = options.token || '';
  if (!token) {
    const requestToken = options.requestToken || (options.authMode === 'browser' ? requestSyncToken : requestDeviceSyncToken);
    const auth = await requestToken({
      host,
      openBrowser: options.openBrowser !== false,
      timeoutMs: options.authTimeoutMs,
      stdout,
    });
    token = auth.token;
    if (auth.host) host = normalizeHost(auth.host);
    if (auth.handle) stdout.write(`Authorized CLI intent as @${auth.handle}.\n`);
  }

  const response = await fetchImpl(`${host}/api/sync-settings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibestats-cli',
    },
    body: JSON.stringify({
      looking_for: lookingFor,
      contact_url: options.contactUrl || '',
      make_public: options.makePublic === true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Match intent failed with HTTP ${response.status}`);

  const settings = body.settings || {};
  const user = body.user || {};
  const links = body.links || {};
  const active = settings.looking_for && settings.looking_for !== 'idle';
  if (active) {
    stdout.write(`Match intent active for 7 days: ${matchIntentLabel(settings.looking_for)}.\n`);
    if (settings.contact_url) stdout.write(`Contact link: ${settings.contact_url}\n`);
    if (settings.looking_for_expires_at) stdout.write(`Expires: ${settings.looking_for_expires_at}\n`);
    if (user.privacy === 'public') {
      stdout.write(`Discoverable in matchmaker: ${apiUrl(host, links.match_url, '/match')}\n`);
      stdout.write(`Browse active profiles: ${apiUrl(host, links.browse_url, '/browse?intent=active')}\n`);
    } else {
      stdout.write('Profile is still unlisted. Re-run with --public to appear in browse and /match.\n');
      stdout.write(`Settings: ${apiUrl(host, links.settings_url, '/settings#match-settings')}\n`);
    }
  } else {
    stdout.write('Match intent cleared.\n');
  }
  stdout.write('Raw Claude Code /insights data was not read or uploaded.\n');
  return body;
}

export async function installClaudeCommand({ path = DEFAULT_CLAUDE_COMMAND_PATH, force = false, stdout = process.stdout } = {}) {
  if (!path) throw new Error('Missing Claude command install path.');
  const commandMarkdown = await readFile(CLAUDE_COMMAND_SOURCE, 'utf8');
  const exists = await pathExists(path);
  if (exists && !force) {
    throw new Error(`Claude Code /vibestats command already exists at ${path}. Re-run with --force to replace it.`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, commandMarkdown, 'utf8');
  stdout.write(`Installed Claude Code /vibestats command at ${path}\n`);
  stdout.write('In Claude Code, run /vibestats to reveal locally before publishing.\n');
  stdout.write('Raw Claude Code /insights data stays on disk; the command delegates extraction to the vibestats CLI.\n');
  return { path, replaced: exists };
}

export function authUrlForLocalCallback(host, callback, nonce) {
  const params = new URLSearchParams({ callback, nonce });
  return `${normalizeHost(host)}/api/cli/local-token?${params.toString()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse(res, fallback) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || fallback || `HTTP ${res.status}`);
  return body;
}

function isDeviceFlowDisabled(err) {
  return String(err?.message || '').includes('Device Flow must be explicitly enabled');
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

export async function requestDeviceSyncToken({
  host = DEFAULT_HOST,
  open = openBrowser,
  openBrowser: shouldOpenBrowser = true,
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  stdout = process.stdout,
  fetchImpl = fetch,
  sleepImpl = sleep,
} = {}) {
  const normalizedHost = normalizeHost(host);
  let start;
  try {
    start = await readJsonResponse(await fetchImpl(`${normalizedHost}/api/cli/device-start`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'vibestats-cli',
      },
      body: '{}',
    }), 'CLI device authorization failed');
  } catch (err) {
    if (!isDeviceFlowDisabled(err)) throw err;
    stdout.write('GitHub device login is not enabled for vibestats yet. Falling back to browser approval.\n');
    return requestSyncToken({
      host: normalizedHost,
      open,
      openBrowser: shouldOpenBrowser,
      timeoutMs,
      stdout,
    });
  }

  if (!start.device_code || !start.user_code || !start.verification_uri) {
    throw new Error('CLI device authorization failed: missing GitHub device code');
  }

  stdout.write('Authorize vibestats with GitHub device login.\n');
  stdout.write(`Open: ${start.verification_uri}\n`);
  stdout.write(`Enter code: ${start.user_code}\n`);
  stdout.write('Waiting for approval...\n');

  const expiresInMs = Number(start.expires_in || 900) * 1000;
  const timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_AUTH_TIMEOUT_MS;
  const deadline = Date.now() + Math.min(timeout, expiresInMs);
  let intervalMs = Math.max(1000, Number(start.interval || 5) * 1000);

  while (Date.now() < deadline) {
    await sleepImpl(intervalMs);
    const res = await fetchImpl(`${normalizedHost}/api/cli/device-poll`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'vibestats-cli',
      },
      body: JSON.stringify({ device_code: start.device_code }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 202) {
      if (body.status === 'slow_down') intervalMs += 5000;
      continue;
    }
    if (!res.ok) throw new Error(body.error || `CLI device authorization failed with HTTP ${res.status}`);
    if (!body.token) throw new Error('CLI device authorization failed: missing sync token');
    return {
      token: body.token,
      host: body.host || normalizedHost,
      expires_at: body.expires_at || '',
      handle: body.handle || '',
    };
  }

  throw new Error('Timed out waiting for GitHub device authorization. Run again and enter the code before it expires.');
}

export async function sync(options) {
  if (!options.file) throw new Error('Missing insights file path.');

  const insights = await readInsightsInput(options.file);
  const payload = derivedUploadPayloadFromInsights(insights, { source: 'cli' });

  if (options.dryRun) {
    if (options.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else process.stdout.write(dryRunRevealText(payload, { host: options.host }));
    return { dry_run: true, payload };
  }

  const label = payload.raw_meta?.signature || ARCHETYPE_LABELS[payload.archetype] || payload.archetype;
  const score = Math.round(Number(payload.scores?.[payload.archetype] || 0));
  if (options.promptToPublish) {
    process.stdout.write(dryRunRevealText(payload, { host: options.host }));
    if (options.openBrowser !== false) {
      const previewUrl = localWebPreviewUrl(insights, { host: options.host });
      process.stdout.write(`Opening web reveal preview: ${previewUrl}\n`);
      const opened = (options.open || openBrowser)(previewUrl);
      if (!opened) process.stdout.write(`Browser did not open automatically. Open your reveal preview: ${previewUrl}\n`);
    }
    const publish = await confirmPublish({
      assumeYes: options.assumeYes,
      input: options.input || process.stdin,
      output: options.output || process.stdout,
      stdout: process.stdout,
    });
    if (!publish) return { published: false, payload };
    process.stdout.write('Publishing the derived profile now. Raw Claude Code /insights data stays local.\n');
  } else {
    process.stdout.write(`Revealed: ${label}${score ? ` (${score}% ${ARCHETYPE_LABELS[payload.archetype] || payload.archetype})` : ''}.\n`);
    process.stdout.write('Raw Claude Code /insights data stayed local. Publishing only derived metrics.\n');
  }

  let host = normalizeHost(options.host || DEFAULT_HOST);
  let token = options.token || '';
  if (!token) {
    const requestToken = options.requestToken || (options.authMode === 'device' ? requestDeviceSyncToken : requestSyncToken);
    const auth = await requestToken({
      host,
      openBrowser: options.openBrowser !== false,
      timeoutMs: options.authTimeoutMs,
    });
    token = auth.token;
    if (auth.host) host = normalizeHost(auth.host);
    if (auth.handle) process.stdout.write(`Authorized CLI sync as @${auth.handle}.\n`);
  }

  const syncPayload = options.claimCode ? { ...payload, claim_code: options.claimCode } : payload;
  const res = await fetch(`${host}/api/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibestats-cli',
    },
    body: JSON.stringify(syncPayload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Sync failed with HTTP ${res.status}`);

  const profileUrl = apiUrl(host, body.profile_url, '/');
  const profilePath = new URL(profileUrl).pathname;
  const compareUrl = apiUrl(host, body.compare_url, `/?compareArchetype=${encodeURIComponent(payload.archetype)}`);
  const recapUrl = apiUrl(host, body.recap_url, `${profilePath}/recap`);
  const credentialUrl = apiUrl(host, body.credential_url, `${profilePath}/credential.json`);
  const badgeUrl = apiUrl(host, body.badge_url, `${profilePath}/badge.svg`);
  const embedUrl = apiUrl(host, body.embed_url, `${profilePath}/embed`);
  const privacyUrl = apiUrl(host, body.privacy_url, '/settings#privacy-settings');
  const matchSettingsUrl = apiUrl(host, body.match_settings_url, '/settings#match-settings');
  const leaderboardUrl = apiUrl(host, body.leaderboard_url, `/leaderboard/${encodeURIComponent(payload.archetype)}`);
  const matchUrl = apiUrl(host, body.match_url, `/match?goal=pair-coding&archetype=${encodeURIComponent(payload.archetype)}`);
  const digestUrl = apiUrl(host, body.weekly_digest_url, '/settings#weekly-digest-row');
  const digestPreviewUrl = apiUrl(host, body.weekly_digest_preview_url, '/api/digest/preview');
  const handle = profileHandle(profileUrl) || 'me';
  const badgeMarkdown = `[![vibestats: @${handle}](${badgeUrl})](${compareUrl})`;
  const embedHtml = `<iframe src="${embedUrl}" width="600" height="320" loading="lazy" title="@${handle} on vibestats" style="border:0;border-radius:8px;max-width:100%;"></iframe>`;
  const shareText = cliShareText({ label: payload.raw_meta.signature || payload.archetype, compareUrl });
  const xShare = cliXShareUrl({ label: payload.raw_meta.signature || payload.archetype, compareUrl });
  process.stdout.write(`${heading('vibestats profile claimed').join('\n')}\n\n`);
  process.stdout.write(`Profile\n`);
  process.stdout.write(`  Synced ${payload.raw_meta.signature || payload.archetype} to ${profileUrl}\n`);
  process.stdout.write('  Minted GitHub-claimed, derived-only profile. Raw /insights stayed local.\n');
  if (body.claim_session?.state === 'synced') {
    process.stdout.write(`  Updated SSH claim session for @${body.claim_session.gh_handle || handle}.\n`);
  }
  process.stdout.write(`  Share your recap: ${recapUrl}\n`);
  if (options.openBrowser !== false) {
    process.stdout.write(`  Opening wrapped recap: ${recapUrl}\n`);
    const opened = (options.open || openBrowser)(recapUrl);
    if (!opened) process.stdout.write(`  Browser did not open automatically. Open your wrapped recap: ${recapUrl}\n`);
  }
  process.stdout.write(`  Verify derived credential: ${credentialUrl}\n`);

  process.stdout.write(`\nShare\n`);
  process.stdout.write(`  Invite people to compare: ${compareUrl}\n`);
  process.stdout.write(`  Copy/paste share: ${shareText}\n`);
  process.stdout.write(`  Share on X: ${xShare}\n`);
  process.stdout.write(`  README badge Markdown: ${badgeMarkdown}\n`);
  process.stdout.write(`  Profile embed HTML: ${embedHtml}\n`);

  process.stdout.write(`\nNext\n`);
  process.stdout.write(`  Optional public discovery: ${privacyUrl}\n`);
  process.stdout.write('  Profiles stay unlisted unless you choose Public.\n');
  process.stdout.write(`  Set match intent: ${matchSettingsUrl}\n`);
  process.stdout.write(`  Set match intent from terminal: ${localHelperCommand(`intent pair-coding --contact-url https://x.com/${handle} --public`, { host })}\n`);
  process.stdout.write(`  View your weekly board: ${leaderboardUrl}\n`);
  process.stdout.write(`  Find complementary builders: ${matchUrl}\n`);
  process.stdout.write(`  Install /vibestats for future reveals: ${localHelperCommand('install-claude-command', { host })}\n`);
  process.stdout.write(`  Reserve weekly digest: ${digestUrl}\n`);
  process.stdout.write(`  Preview weekly digest: ${digestPreviewUrl}\n`);
  return body;
}

export async function main() {
  const { command, options } = parseArgs(process.argv);
  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (['install-claude-command', 'install-command', 'install-claude'].includes(command)) {
    await installClaudeCommand(options);
    return;
  }
  if (['status', 'doctor', 'check'].includes(command)) {
    await printOnboardingStatus(options);
    return;
  }
  if (command === 'share') {
    await printProfileShareKit(options);
    return;
  }
  if (command === 'intent') {
    await setMatchIntent(options);
    return;
  }
  if (!isSyncCommand(command)) throw new Error(`Unknown command: ${command}`);
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
    process.stderr.write(`${cliErrorMessage(err)}\n`);
    process.stderr.write(`\n${usage()}\n`);
    process.exitCode = 1;
  });
}
