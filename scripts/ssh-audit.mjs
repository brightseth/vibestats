#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_HOST = process.env.VIBESTATS_SSH_HOST || 'ssh.vibestats.io';
const DEFAULT_PORT = process.env.VIBESTATS_SSH_PORT || '22';
const DEFAULT_HANDLE = 'brightseth';
const DEFAULT_ARCHETYPE = 'deepdiver';
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
  'SSH_HOST_KEY',
];

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    handle: DEFAULT_HANDLE,
    archetype: DEFAULT_ARCHETYPE,
    knownHostsFile: process.env.SSH_KNOWN_HOSTS_FILE || '',
    strictHostKeyChecking: process.env.SSH_STRICT_HOST_KEY_CHECKING || 'accept-new',
    connectTimeout: process.env.SSH_CONNECT_TIMEOUT || '10',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host') options.host = argv[++i];
    else if (arg.startsWith('--host=')) options.host = arg.slice('--host='.length);
    else if (arg === '--port') options.port = argv[++i];
    else if (arg.startsWith('--port=')) options.port = arg.slice('--port='.length);
    else if (arg === '--handle') options.handle = argv[++i];
    else if (arg.startsWith('--handle=')) options.handle = arg.slice('--handle='.length);
    else if (arg === '--archetype') options.archetype = argv[++i];
    else if (arg.startsWith('--archetype=')) options.archetype = arg.slice('--archetype='.length);
    else if (arg === '--known-hosts-file') options.knownHostsFile = argv[++i];
    else if (arg.startsWith('--known-hosts-file=')) options.knownHostsFile = arg.slice('--known-hosts-file='.length);
    else if (arg === '--strict-host-key-checking') options.strictHostKeyChecking = argv[++i];
    else if (arg.startsWith('--strict-host-key-checking=')) options.strictHostKeyChecking = arg.slice('--strict-host-key-checking='.length);
    else if (arg === '--connect-timeout') options.connectTimeout = argv[++i];
    else if (arg.startsWith('--connect-timeout=')) options.connectTimeout = arg.slice('--connect-timeout='.length);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  options.host = String(options.host || '').trim();
  options.port = String(options.port || '').trim();
  options.handle = String(options.handle || '').trim().replace(/^@/, '');
  options.archetype = String(options.archetype || '').trim().toLowerCase();
  options.knownHostsFile = String(options.knownHostsFile || '').trim();
  options.strictHostKeyChecking = String(options.strictHostKeyChecking || '').trim() || 'accept-new';
  options.connectTimeout = String(options.connectTimeout || '').trim() || '10';

  if (!/^[a-zA-Z0-9._@-]+$/.test(options.host)) throw new Error('--host must be a hostname or user@hostname');
  if (!/^\d{1,5}$/.test(options.port) || Number(options.port) < 1 || Number(options.port) > 65535) throw new Error('--port must be 1-65535');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(options.handle)) throw new Error('--handle must be a GitHub-style handle');
  if (!/^[a-z]+$/.test(options.archetype)) throw new Error('--archetype must be a lowercase archetype key');
  if (!/^\d{1,3}$/.test(options.connectTimeout)) throw new Error('--connect-timeout must be seconds');
  return options;
}

function usage() {
  return `Usage: npm run audit:ssh -- --host ssh.vibestats.io --handle brightseth
       npm run audit:ssh -- --host vibestats-ssh.fly.dev --handle brightseth
       npm run audit:ssh -- --host 127.0.0.1 --port 2222 --strict-host-key-checking=no

Checks a deployed vibestats SSH shell without reading local /insights:
- help command exposes claim, profile, leaderboard, match, compare, and share commands
- view HANDLE prints profile, credential, compare invite, and local reveal CTA
- leaderboard ARCHETYPE prints board link and claim CTA
- claim creates a bounded code and prints /insights plus the no-npm local helper
- status CODE returns a bounded pending/synced/expired state
- outputs do not include raw-insights field names or secret env names`;
}

function hasRawLeak(text) {
  return RAW_LEAK_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

function hasSecretName(text) {
  return SECRET_NAME_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

export function createRecorder() {
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

export function extractClaimCode(text) {
  return String(text || '').match(/\bVIBE-[A-Z2-9]{4}-[A-Z2-9]{4}\b/)?.[0] || '';
}

export function checkSafeOutput(recorder, label, output) {
  recorder.check(!hasRawLeak(output), `${label} has no raw-insights field names`);
  recorder.check(!hasSecretName(output), `${label} does not expose secret env names`);
}

async function sshExec(options, command, knownHostsFile) {
  const args = [
    '-p', options.port,
    '-o', 'BatchMode=yes',
    '-o', `ConnectTimeout=${options.connectTimeout}`,
    '-o', `StrictHostKeyChecking=${options.strictHostKeyChecking}`,
    '-o', `UserKnownHostsFile=${knownHostsFile}`,
    '-o', 'LogLevel=ERROR',
    options.host,
    command,
  ];
  const result = await execFileAsync('ssh', args, { maxBuffer: 5 * 1024 * 1024 });
  return `${result.stdout || ''}${result.stderr || ''}`;
}

export async function auditSshService(options, { execCommand = sshExec } = {}) {
  const recorder = createRecorder();
  let tempDir = '';
  let knownHostsFile = options.knownHostsFile;

  try {
    if (!knownHostsFile) {
      tempDir = await mkdtemp(join(tmpdir(), 'vibestats-ssh-audit-'));
      knownHostsFile = join(tempDir, 'known_hosts');
    }

    const help = await execCommand(options, 'help', knownHostsFile);
    recorder.check(help.includes('Commands') && help.includes('view HANDLE') && help.includes('claim') && help.includes('share HANDLE'), 'SSH help exposes terminal shell commands');
    recorder.check(help.includes('Run /insights in Claude Code') && help.includes('local terminal'), 'SSH help preserves local extraction flow');
    checkSafeOutput(recorder, 'SSH help', help);

    const profile = await execCommand(options, `view ${options.handle}`, knownHostsFile);
    recorder.check(profile.includes(`@${options.handle}:`) && profile.includes('/credential.json') && profile.includes('Compare invite:'), 'SSH profile view prints profile, credential, and compare links');
    recorder.check(profile.includes('Reveal yours: run /insights'), 'SSH profile view drives recipient into reveal');
    checkSafeOutput(recorder, 'SSH profile view', profile);

    const leaderboard = await execCommand(options, `leaderboard ${options.archetype}`, knownHostsFile);
    recorder.check(leaderboard.includes('leaderboard') && leaderboard.includes('/leaderboard/'), 'SSH leaderboard prints board link');
    recorder.check(leaderboard.includes('Run /insights, then claim here'), 'SSH leaderboard drives claim CTA');
    checkSafeOutput(recorder, 'SSH leaderboard', leaderboard);

    const claim = await execCommand(options, 'claim', knownHostsFile);
    const code = extractClaimCode(claim);
    recorder.check(Boolean(code), 'SSH claim creates a bounded claim code', code || '(missing)');
    recorder.check(claim.includes('/insights') && claim.includes('/cli.sh') && claim.includes('derived-only metrics'), 'SSH claim prints no-npm local helper and privacy boundary');
    checkSafeOutput(recorder, 'SSH claim', claim);

    if (code) {
      const status = await execCommand(options, `status ${code}`, knownHostsFile);
      recorder.check(status.includes('Claim state:') && /pending|synced|expired/.test(status), 'SSH status returns bounded claim state', status.split('\n').find(Boolean) || '');
      checkSafeOutput(recorder, 'SSH status', status);
    }
  } catch (err) {
    recorder.fail('SSH audit command failed', err.stderr || err.message);
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }

  return recorder.results;
}

export function printResults(results, { host, port }) {
  process.stdout.write(`SSH audit: ${host}:${port}\n`);
  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok' : 'fail'} ${result.label}${result.detail ? ` (${String(result.detail).trim()})` : ''}\n`);
  }
  return results.every((item) => item.ok);
}

async function main() {
  try {
    const options = parseArgs();
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const ok = printResults(await auditSshService(options), options);
    if (!ok) process.exitCode = 1;
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
