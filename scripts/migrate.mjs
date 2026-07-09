import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'db', 'migrations');
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL, POSTGRES_URL, or NEON_DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: 'require' });

try {
  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz default now()
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await sql`
      select filename from schema_migrations where filename = ${file} limit 1
    `;
    if (applied.length) {
      console.log(`skip ${file}`);
      continue;
    }

    const contents = await readFile(join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`insert into schema_migrations (filename) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
} finally {
  await sql.end();
}

