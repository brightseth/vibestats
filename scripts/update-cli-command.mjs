#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const FALLBACK_PACKAGE = 'github:brightseth/vibestats#v0.1.0';
const FALLBACK_COMMAND = `npx --yes ${FALLBACK_PACKAGE}`;
const TARGET_FILES = [
  '.claude/commands/vibestats.md',
  'README.md',
  'settings.html',
  'scripts/launch-audit.mjs',
  'scripts/smoke.mjs',
];

function usage() {
  return `Usage: node scripts/update-cli-command.mjs --package @scope/vibestats [--write]

Replaces fallback npm command snippets:
  ${FALLBACK_COMMAND}

With:
  npx --yes <package>

Defaults to dry-run. Product-facing web onboarding should stay on /cli.sh; use --write only after the scoped package is published and VIBESTATS_CLI_PACKAGE is set in Vercel.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    packageSpec: process.env.VIBESTATS_CLI_PACKAGE || '',
    write: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--package') options.packageSpec = argv[++i] || '';
    else if (arg.startsWith('--package=')) options.packageSpec = arg.slice('--package='.length);
    else if (arg === '--write') options.write = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  options.packageSpec = String(options.packageSpec || '').trim();
  if (!options.help) {
    if (!options.packageSpec) throw new Error('Missing --package or VIBESTATS_CLI_PACKAGE.');
    if (/\s/.test(options.packageSpec)) throw new Error('--package must be an npx package spec, not a full command.');
  }
  return options;
}

async function updateCliCommand({ packageSpec, write = false } = {}) {
  const nextCommand = `npx --yes ${packageSpec}`;
  const results = [];

  for (const file of TARGET_FILES) {
    const before = await readFile(file, 'utf8');
    const count = before.split(FALLBACK_COMMAND).length - 1;
    if (!count) {
      results.push({ file, count: 0, changed: false });
      continue;
    }
    const after = before.replaceAll(FALLBACK_COMMAND, nextCommand);
    if (write) await writeFile(file, after, 'utf8');
    results.push({ file, count, changed: true });
  }

  return {
    write,
    from: FALLBACK_COMMAND,
    to: nextCommand,
    replacements: results.reduce((sum, item) => sum + item.count, 0),
    files: results,
  };
}

function printReport(report) {
  console.log(`${report.write ? 'Updated' : 'Would update'} ${report.replacements} CLI command snippet${report.replacements === 1 ? '' : 's'}.`);
  console.log(`from: ${report.from}`);
  console.log(`to:   ${report.to}`);
  for (const item of report.files.filter((file) => file.count > 0)) {
    console.log(`${report.write ? 'updated' : 'would update'} ${item.file} (${item.count})`);
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

  const report = await updateCliCommand(options);
  printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}

export { FALLBACK_COMMAND, TARGET_FILES, parseArgs, updateCliCommand };
