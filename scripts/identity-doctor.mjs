import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'db', 'migrations');
const args = new Set(process.argv.slice(2));
const checkSchema = args.has('--schema') || args.has('--check-schema');
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

const requiredTables = ['users', 'uploads', 'profile_settings', 'schema_migrations'];
const requiredColumns = {
  users: ['id', 'gh_id', 'gh_handle', 'avatar_url', 'privacy', 'created_at', 'last_seen_at'],
  uploads: ['id', 'user_id', 'archetype', 'scores', 'metrics', 'raw_meta', 'uploaded_at'],
  profile_settings: [
    'user_id',
    'weekly_digest_opt_in',
    'digest_email',
    'email_consent_at',
    'weekly_digest_sent_at',
    'looking_for',
    'looking_for_expires_at',
    'contact_url',
    'show_raw_counts',
    'show_languages',
    'sync_token_invalidated_at',
    'created_at',
    'updated_at',
  ],
};
const requiredIndexes = [
  'users_gh_handle_lower_idx',
  'users_handle_idx',
  'uploads_user_time_idx',
  'profile_settings_looking_for_idx',
];
const requiredConstraints = ['profile_settings_contact_url_protocol'];

async function migrationFiles() {
  return (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function checkIdentitySchema(databaseUrl) {
  const ok = [];
  const missing = [];
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const tableRows = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ${sql(requiredTables)}
    `;
    const tables = new Set(tableRows.map((row) => row.table_name));
    for (const table of requiredTables) {
      if (tables.has(table)) ok.push(`schema table ${table}`);
      else missing.push(`schema table ${table}`);
    }

    const columnTables = Object.keys(requiredColumns);
    const columnRows = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ${sql(columnTables)}
    `;
    const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const [table, names] of Object.entries(requiredColumns)) {
      for (const column of names) {
        const key = `${table}.${column}`;
        if (columns.has(key)) ok.push(`schema column ${key}`);
        else missing.push(`schema column ${key}`);
      }
    }

    const indexRows = await sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname in ${sql(requiredIndexes)}
    `;
    const indexes = new Set(indexRows.map((row) => row.indexname));
    for (const index of requiredIndexes) {
      if (indexes.has(index)) ok.push(`schema index ${index}`);
      else missing.push(`schema index ${index}`);
    }

    const constraintRows = await sql`
      select conname
      from pg_constraint
      where conname in ${sql(requiredConstraints)}
    `;
    const constraints = new Set(constraintRows.map((row) => row.conname));
    for (const constraint of requiredConstraints) {
      if (constraints.has(constraint)) ok.push(`schema constraint ${constraint}`);
      else missing.push(`schema constraint ${constraint}`);
    }

    const files = await migrationFiles();
    if (tables.has('schema_migrations')) {
      const migrationRows = await sql`
        select filename
        from schema_migrations
        where filename in ${sql(files)}
      `;
      const applied = new Set(migrationRows.map((row) => row.filename));
      for (const file of files) {
        if (applied.has(file)) ok.push(`migration ${file}`);
        else missing.push(`migration ${file}`);
      }
    } else {
      for (const file of files) missing.push(`migration ${file}`);
    }

    return { ok, missing };
  } finally {
    await sql.end();
  }
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

if (checkSchema) {
  console.log('');
  console.log('Database schema');
  try {
    const schema = await checkIdentitySchema(firstPresent(['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL']));
    for (const item of schema.ok) console.log(`ok ${item}`);
    for (const item of schema.missing) console.log(`missing ${item}`);
    if (schema.missing.length) {
      console.log('');
      console.log('Run npm run migrate, then repeat npm run doctor:identity -- --schema before dogfooding profile saves.');
      process.exit(1);
    }
  } catch (err) {
    console.log(`missing database schema check (${err.message || 'connection failed'})`);
    console.log('');
    console.log('Confirm the database URL points to the intended Neon database, then repeat npm run doctor:identity -- --schema.');
    process.exit(1);
  }

  console.log('');
  console.log('Wave 1 identity env and schema look launch-ready.');
  process.exit(0);
}

console.log('');
console.log('Wave 1 identity env looks launch-ready.');
console.log('Run npm run migrate, then npm run doctor:identity -- --schema to verify the profile database before dogfooding.');
