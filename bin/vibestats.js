#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { derivedUploadPayloadFromInsights } from '../lib/insights-derived.js';

const DEFAULT_INSIGHTS_PATH = join(homedir(), '.claude', 'usage-data', 'agent-insights.json');
const DEFAULT_HOST = 'https://vibestats.io';

function usage() {
  return `Usage:
  vibestats sync [--file PATH] [--host URL] [--token TOKEN] [--dry-run]

Environment:
  VIBESTATS_SYNC_TOKEN  signed sync token from vibestats settings
  VIBESTATS_URL         alternate host, defaults to ${DEFAULT_HOST}

The CLI reads Claude Code insights locally and sends only derived metrics.
Use --dry-run to print the derived payload without sending it.`;
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.shift();
  const options = {
    file: DEFAULT_INSIGHTS_PATH,
    host: process.env.VIBESTATS_URL || DEFAULT_HOST,
    token: process.env.VIBESTATS_SYNC_TOKEN || '',
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { command: 'help', options };
    if (arg === '--file') options.file = args[++i] || '';
    else if (arg === '--host') options.host = args[++i] || '';
    else if (arg === '--token') options.token = args[++i] || '';
    else if (arg === '--dry-run' || arg === '--dryRun') options.dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return { command, options };
}

export async function sync(options) {
  if (!options.dryRun && !options.token) {
    throw new Error('Missing sync token. Generate one from vibestats Settings, or set VIBESTATS_SYNC_TOKEN.');
  }
  if (!options.file) throw new Error('Missing insights file path.');

  const raw = await readFile(options.file, 'utf8');
  const insights = JSON.parse(raw);
  const payload = derivedUploadPayloadFromInsights(insights, { source: 'cli' });

  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return { dry_run: true, payload };
  }

  const host = String(options.host || DEFAULT_HOST).replace(/\/+$/, '');

  const res = await fetch(`${host}/api/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibestats-cli',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Sync failed with HTTP ${res.status}`);

  const profileUrl = body.profile_url?.startsWith('http')
    ? body.profile_url
    : `${host}${body.profile_url || ''}`;
  const compareUrl = body.compare_url
    ? (body.compare_url.startsWith('http') ? body.compare_url : `${host}${body.compare_url}`)
    : `${host}/?compareArchetype=${encodeURIComponent(payload.archetype)}`;
  process.stdout.write(`Synced ${payload.raw_meta.signature || payload.archetype} to ${profileUrl}\n`);
  process.stdout.write(`Invite people to compare: ${compareUrl}\n`);
  return body;
}

export async function main() {
  const { command, options } = parseArgs(process.argv);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command !== 'sync') throw new Error(`Unknown command: ${command}`);
  await sync(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.stderr.write(`\n${usage()}\n`);
    process.exitCode = 1;
  });
}
