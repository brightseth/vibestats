#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_PACKAGE = '@lets-vibe/vibestats';
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
    packageName: process.env.npm_package_name || DEFAULT_PACKAGE,
    expectedVersion: process.env.npm_package_version || '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--package') options.packageName = argv[++i];
    else if (arg.startsWith('--package=')) options.packageName = arg.slice('--package='.length);
    else if (arg === '--version') options.expectedVersion = argv[++i];
    else if (arg.startsWith('--version=')) options.expectedVersion = arg.slice('--version='.length);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.packageName = String(options.packageName || '').trim();
  options.expectedVersion = String(options.expectedVersion || '').trim();
  if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(options.packageName)) {
    throw new Error('--package must be an npm package name');
  }
  if (options.expectedVersion && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(options.expectedVersion)) {
    throw new Error('--version must be a semver version');
  }
  return options;
}

function usage() {
  return `Usage: npm run audit:package
       npm run audit:package -- --package @lets-vibe/vibestats --version 0.1.0

Checks the publish tarball before npm publish:
- npm pack produces the scoped tarball
- tarball contains the CLI, derived scorer, extractor, share-kit helper, and Claude Code command
- packed CLI help executes and prints the terminal-first onboarding flows
- packed CLI missing-input recovery prints the /insights checklist
- output does not expose raw-insights field names or secret env names`;
}

function createRecorder() {
  const results = [];
  return {
    results,
    check(condition, label, detail = '') {
      results.push({ ok: Boolean(condition), label, detail });
    },
  };
}

function hasRawLeak(text) {
  return RAW_LEAK_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

function hasSecretName(text) {
  return SECRET_NAME_PATTERNS.some((pattern) => String(text || '').includes(pattern));
}

function safeOutput(recorder, label, output) {
  recorder.check(!hasRawLeak(output), `${label} has no raw-insights field names`);
  recorder.check(!hasSecretName(output), `${label} does not expose secret env names`);
}

function tarballName(packageName, version) {
  const scoped = packageName.replace(/^@/, '').replace(/\//g, '-');
  return `${scoped}-${version}.tgz`;
}

function parsePackNotice(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.replace(/^npm notice\s*/, '').trim())
    .filter(Boolean);
}

export async function auditPackage({ packageName = DEFAULT_PACKAGE, expectedVersion = '' } = {}, { exec = execFileAsync } = {}) {
  const recorder = createRecorder();
  const tempDir = await mkdtemp(join(tmpdir(), 'vibestats-package-audit-'));
  try {
    const pack = await exec('npm', ['pack', '--pack-destination', tempDir], { maxBuffer: 5 * 1024 * 1024 });
    const packOutput = `${pack.stdout || ''}\n${pack.stderr || ''}`;
    const notice = parsePackNotice(packOutput);
    const filename = String(pack.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
    const version = expectedVersion || (notice.find((line) => line.startsWith('version:')) || '').replace('version:', '').trim();
    const tarball = join(tempDir, filename || tarballName(packageName, version));

    recorder.check(packOutput.includes(`name: ${packageName}`) || packOutput.includes(`${packageName}@${version}`), 'npm pack uses the expected package name', packageName);
    recorder.check(Boolean(version), 'npm pack reports a package version', version || '(missing)');
    if (expectedVersion) recorder.check(version === expectedVersion || packOutput.includes(`version: ${expectedVersion}`), 'npm pack uses the expected version', expectedVersion);
    recorder.check(packOutput.includes('bin/vibestats.js'), 'tarball includes the CLI bin');
    recorder.check(packOutput.includes('lib/claude-insights-extractor.js'), 'tarball includes the Claude Code /insights extractor');
    recorder.check(packOutput.includes('lib/insights-derived.js'), 'tarball includes the derived scoring helper');
    recorder.check(packOutput.includes('lib/share-kit.js'), 'tarball includes the terminal share-kit helper');
    recorder.check(packOutput.includes('api/_lib/moments.js') && packOutput.includes('api/_lib/signatures.js'), 'tarball includes shared derived scoring dependencies');
    recorder.check(packOutput.includes('.claude/commands/vibestats.md'), 'tarball includes the Claude Code /vibestats command');

    const help = await exec('npm', ['exec', '--yes', '--package', tarball, '--', 'vibestats', '--help'], {
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, VIBESTATS_CLI_PACKAGE: packageName },
    });
    const helpOutput = `${help.stdout || ''}\n${help.stderr || ''}`;
    recorder.check(helpOutput.includes(`Current npx fallback command: npx --yes ${packageName}`) && helpOutput.includes('/cli.sh | sh -s -- status'), 'packed CLI help uses no-npm primary commands and the public package fallback');
    recorder.check(helpOutput.includes('vibestats share --handle HANDLE') && helpOutput.includes('Use reveal for a local result'), 'packed CLI help exposes reveal and share flows');
    recorder.check(helpOutput.includes('Use claim CODE from an SSH/TUI claim session'), 'packed CLI help exposes SSH claim handoff');
    safeOutput(recorder, 'packed CLI help', helpOutput);

    try {
      await exec('npm', ['exec', '--yes', '--package', tarball, '--', 'vibestats', 'reveal', '--json', '--file', '/path/does-not-exist.json'], {
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, VIBESTATS_CLI_PACKAGE: packageName },
      });
      recorder.check(false, 'packed CLI missing-input recovery exits non-zero');
    } catch (err) {
      const output = `${err.stdout || ''}\n${err.stderr || ''}`;
      recorder.check(output.includes('Terminal onboarding:') && output.includes('/insights') && output.includes('/cli.sh | sh -s -- status'), 'packed CLI missing-input recovery prints the no-npm /insights checklist');
      safeOutput(recorder, 'packed CLI missing-input recovery', output);
    }
  } catch (err) {
    recorder.check(false, 'package audit failed', err.stderr || err.message);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return recorder.results;
}

function printResults(results, { packageName }) {
  process.stdout.write(`Package audit: ${packageName}\n`);
  for (const result of results) {
    process.stdout.write(`${result.ok ? 'ok' : 'fail'} ${result.label}${result.detail ? ` (${String(result.detail).trim()})` : ''}\n`);
  }
  return results.every((result) => result.ok);
}

async function main() {
  try {
    const options = parseArgs();
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const ok = printResults(await auditPackage(options), options);
    if (!ok) process.exitCode = 1;
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
