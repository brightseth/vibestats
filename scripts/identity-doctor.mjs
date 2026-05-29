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
const MIN_SESSION_SECRET_BYTES = 32;
const requiredGroups = [
  { label: 'database URL', any: ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'] },
  { label: 'GitHub OAuth client ID', any: ['GITHUB_CLIENT_ID'] },
  { label: 'GitHub OAuth client secret', any: ['GITHUB_CLIENT_SECRET'] },
  {
    label: 'session secret',
    any: ['VIBE_SESSION_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET'],
    minBytes: MIN_SESSION_SECRET_BYTES,
  },
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
  return keys.find((key) => String(loaded[key] || '').trim());
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
const requiredConstraints = [
  { name: 'users_privacy_check', validated: true },
  { name: 'uploads_archetype_check', validated: true },
  { name: 'profile_settings_looking_for_check', validated: true },
  { name: 'profile_settings_contact_url_len', validated: true },
  { name: 'profile_settings_contact_url_protocol', validated: true },
];
const requiredForeignKeys = [
  {
    table: 'uploads',
    column: 'user_id',
    references: 'users',
    onDelete: 'c',
    label: 'schema foreign key uploads.user_id cascades to users',
  },
  {
    table: 'profile_settings',
    column: 'user_id',
    references: 'users',
    onDelete: 'c',
    label: 'schema foreign key profile_settings.user_id cascades to users',
  },
];
const requiredColumnProperties = [
  {
    table: 'users',
    column: 'privacy',
    label: 'schema column users.privacy default unlisted and not null',
    check(row) {
      return row?.is_nullable === 'NO' && String(row?.column_default || '').includes("'unlisted'");
    },
  },
];

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
      select table_name, column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ${sql(columnTables)}
    `;
    const columns = new Map(columnRows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
    for (const [table, names] of Object.entries(requiredColumns)) {
      for (const column of names) {
        const key = `${table}.${column}`;
        if (columns.has(key)) ok.push(`schema column ${key}`);
        else missing.push(`schema column ${key}`);
      }
    }
    for (const rule of requiredColumnProperties) {
      const key = `${rule.table}.${rule.column}`;
      if (rule.check(columns.get(key))) ok.push(rule.label);
      else missing.push(rule.label);
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

    const requiredConstraintNames = requiredConstraints.map((constraint) => constraint.name);
    const constraintRows = await sql`
      select con.conname, con.convalidated
      from pg_constraint con
      join pg_class table_name on table_name.oid = con.conrelid
      join pg_namespace namespace on namespace.oid = table_name.relnamespace
      where namespace.nspname = 'public'
        and con.conname in ${sql(requiredConstraintNames)}
    `;
    const constraints = new Map(constraintRows.map((row) => [row.conname, row]));
    for (const constraint of requiredConstraints) {
      const row = constraints.get(constraint.name);
      if (!row) {
        missing.push(`schema constraint ${constraint.name}`);
      } else if (constraint.validated && row.convalidated !== true) {
        missing.push(`schema constraint ${constraint.name} validated`);
      } else {
        ok.push(`schema constraint ${constraint.name} validated`);
      }
    }

    const foreignKeyRows = await sql`
      select
        source.relname as table_name,
        source_attr.attname as column_name,
        target.relname as references_table,
        con.confdeltype
      from pg_constraint con
      join pg_class source on source.oid = con.conrelid
      join pg_namespace namespace on namespace.oid = source.relnamespace
      join pg_class target on target.oid = con.confrelid
      join unnest(con.conkey) with ordinality as source_key(attnum, ord) on true
      join pg_attribute source_attr on source_attr.attrelid = source.oid and source_attr.attnum = source_key.attnum
      where namespace.nspname = 'public'
        and con.contype = 'f'
    `;
    for (const rule of requiredForeignKeys) {
      const found = foreignKeyRows.some((row) => (
        row.table_name === rule.table
        && row.column_name === rule.column
        && row.references_table === rule.references
        && row.confdeltype === rule.onDelete
      ));
      if (found) ok.push(rule.label);
      else missing.push(rule.label);
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
const weak = [];
for (const group of requiredGroups) {
  const key = firstPresent(group.any);
  if (key && (!group.minBytes || Buffer.byteLength(String(loaded[key]).trim(), 'utf8') >= group.minBytes)) {
    present.push({ ...group, key });
  } else if (key && group.minBytes) {
    weak.push({ ...group, key });
  } else {
    missing.push(group);
  }
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
for (const group of weak) console.log(`weak ${group.label} (${group.key} must be at least ${group.minBytes} bytes)`);
for (const group of optional) {
  if (group.complete) {
    console.log(`ok optional ${group.label} (${group.complete.join(', ')})`);
  } else if (group.partial) {
    console.log(`partial optional ${group.label}`);
  } else {
    console.log(`missing optional ${group.label}`);
  }
}

if (missing.length || weak.length) {
  console.log('');
  console.log('Wave 1 identity is not launch-ready until the missing or weak env vars are fixed on lets-vibe/vibestats.');
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
