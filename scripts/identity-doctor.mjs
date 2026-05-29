import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envFiles = ['.env.local', '.vercel/.env.preview.local'];
const requiredGroups = [
  { label: 'database URL', any: ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'] },
  { label: 'GitHub OAuth client ID', any: ['GITHUB_CLIENT_ID'] },
  { label: 'GitHub OAuth client secret', any: ['GITHUB_CLIENT_SECRET'] },
  { label: 'session secret', any: ['VIBE_SESSION_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET'] },
];
const optionalGroups = [
  {
    label: 'stable app origin',
    alternatives: [
      ['VIBESTATS_URL'],
    ],
  },
  {
    label: 'community stats Redis',
    alternatives: [
      ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
      ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ],
  },
  {
    label: 'weekly digest email',
    alternatives: [
      ['CRON_SECRET', 'RESEND_API_KEY', 'DIGEST_FROM_EMAIL'],
    ],
  },
];

function parseEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const loaded = {};
for (const file of envFiles) {
  if (!existsSync(file)) continue;
  const parsed = parseEnv(await readFile(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (loaded[key] == null) loaded[key] = value;
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (loaded[key] == null) loaded[key] = value;
}

function firstPresent(keys) {
  return keys.find((key) => loaded[key]);
}

function completeAlternative(alternatives) {
  return alternatives.find((keys) => keys.every((key) => loaded[key]));
}

function anyPresent(alternatives) {
  return alternatives.flat().some((key) => loaded[key]);
}

const present = [];
const missing = [];
for (const group of requiredGroups) {
  const key = firstPresent(group.any);
  if (key) present.push({ ...group, key });
  else missing.push(group);
}

const optional = optionalGroups.map((group) => ({
  ...group,
  complete: completeAlternative(group.alternatives),
  partial: !completeAlternative(group.alternatives) && anyPresent(group.alternatives),
}));

console.log('Identity launch doctor');
console.log('');
for (const group of present) console.log(`ok ${group.label} (${group.key})`);
for (const group of missing) console.log(`missing ${group.label} (${group.any.join(' or ')})`);
for (const group of optional) {
  if (group.complete) {
    console.log(`ok optional ${group.label} (${group.complete.join(', ')})`);
  } else if (group.partial) {
    console.log(`partial optional ${group.label}`);
  } else {
    console.log(`missing optional ${group.label}`);
  }
}

if (missing.length) {
  console.log('');
  console.log('Wave 1 identity is not launch-ready until the missing env vars are configured on lets-vibe/vibestats.');
  process.exit(1);
}

console.log('');
console.log('Wave 1 identity env looks launch-ready.');
