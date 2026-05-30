import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
const slug = String(process.argv[2] || '').trim();

if (!/^[A-Za-z0-9_-]{10,24}$/.test(slug)) {
  console.error('Usage: npm run reveal:delete -- <reveal-slug>');
  process.exit(1);
}

if (!databaseUrl) {
  console.error('DATABASE_URL, POSTGRES_URL, or NEON_DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, ssl: 'require' });

try {
  const rows = await sql`
    delete from reveal_snapshots
    where slug = ${slug}
    returning slug
  `;
  if (rows.length) {
    console.log(`deleted reveal snapshot ${slug}`);
  } else {
    console.log(`reveal snapshot ${slug} not found`);
  }
} finally {
  await sql.end();
}
