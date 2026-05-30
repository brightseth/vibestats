#!/usr/bin/env node
import {
  DEFAULT_INSTALL_COMMAND,
  DEFAULT_NPX_REVEAL_COMMAND,
  DEFAULT_NPX_STATUS_COMMAND,
  DEFAULT_NPX_SYNC_COMMAND,
} from '../bin/vibestats.js';
import {
  buildShareKit as buildBaseShareKit,
  fetchProfile,
  shareKitText,
} from '../lib/share-kit.js';

function usage() {
  return `Usage: npm run share:kit -- --handle brightseth [--origin https://vibestats.io] [--json]

Builds a copy-ready, privacy-safe sharing kit from a public vibestats profile.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    origin: process.env.VIBESTATS_URL || 'https://vibestats.io',
    handle: '',
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--origin') options.origin = argv[++i] || '';
    else if (arg.startsWith('--origin=')) options.origin = arg.slice('--origin='.length);
    else if (arg === '--handle') options.handle = argv[++i] || '';
    else if (arg.startsWith('--handle=')) options.handle = arg.slice('--handle='.length);
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (!options.handle && !arg.startsWith('-')) options.handle = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  options.origin = new URL(String(options.origin || '').trim()).origin;
  options.handle = String(options.handle || '').trim().replace(/^@/, '');
  if (!options.help && !/^[a-zA-Z0-9-]{1,39}$/.test(options.handle)) {
    throw new Error('--handle must be a GitHub-style handle');
  }
  return options;
}

function buildShareKit(profile, { origin = 'https://vibestats.io', handle = '' } = {}) {
  return buildBaseShareKit(profile, {
    origin,
    handle,
    terminalCommands: {
      insights: '/insights',
      status: DEFAULT_NPX_STATUS_COMMAND,
      reveal: DEFAULT_NPX_REVEAL_COMMAND,
      claim: DEFAULT_NPX_SYNC_COMMAND,
      install: DEFAULT_INSTALL_COMMAND,
    },
  });
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

  const profile = await fetchProfile(options);
  const kit = buildShareKit(profile, options);
  if (options.json) console.log(JSON.stringify(kit, null, 2));
  else console.log(shareKitText(kit));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { buildShareKit, fetchProfile, parseArgs, shareKitText };
