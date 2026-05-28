import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envFiles = ['.env.local', '.vercel/.env.preview.local'];
const required = [
  'DATABASE_URL',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'VIBE_SESSION_SECRET',
  'VIBESTATS_URL',
];
const optionalExisting = [
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
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

const missing = required.filter((key) => !loaded[key]);
const present = required.filter((key) => !missing.includes(key));
const optionalPresent = optionalExisting.filter((key) => loaded[key]);
const optionalMissing = optionalExisting.filter((key) => !loaded[key]);

console.log('Identity launch doctor');
console.log('');
for (const key of present) console.log(`ok ${key}`);
for (const key of missing) console.log(`missing ${key}`);
for (const key of optionalPresent) console.log(`ok ${key}`);
for (const key of optionalMissing) console.log(`missing optional ${key}`);

if (missing.length) {
  console.log('');
  console.log('Wave 1 identity is not launch-ready until the missing env vars are configured on lets-vibe/vibestats.');
  process.exit(1);
}

console.log('');
console.log('Wave 1 identity env looks launch-ready.');
