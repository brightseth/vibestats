import postgres from 'postgres';

let client;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

export function sql() {
  const url = databaseUrl();
  if (!url) {
    const err = new Error('Database is not configured');
    err.statusCode = 503;
    throw err;
  }

  if (!client) {
    client = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
    });
  }

  return client;
}

export async function getUserById(id) {
  if (!id) return null;
  const rows = await sql()`
    select id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
    from users
    where id = ${id}
    limit 1
  `;
  return rows[0] || null;
}

export function publicUser(user, { includePrivacy = false, includeActivity = false } = {}) {
  if (!user) return null;
  const out = {
    gh_handle: user.gh_handle,
    avatar_url: user.avatar_url,
  };
  if (includeActivity) {
    out.created_at = user.created_at;
    out.last_seen_at = user.last_seen_at;
  }
  if (includePrivacy) out.privacy = user.privacy;
  return out;
}
