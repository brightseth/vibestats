import { sql } from './db.js';

export async function weeklyLeaderboardRank(user, latest) {
  if (user?.privacy !== 'public' || !user?.id || !latest?.archetype) return null;

  const rows = await sql()`
    with weekly as (
      select
        u.id,
        latest.archetype,
        latest.scores,
        latest.uploaded_at,
        row_number() over (
          order by coalesce((latest.scores->>${latest.archetype})::numeric, 0) desc, latest.uploaded_at desc
        )::int as rank,
        count(*) over()::int as total
      from users u
      join lateral (
        select archetype, scores, uploaded_at
        from uploads
        where user_id = u.id
          and uploaded_at >= date_trunc('week', now())
        order by uploaded_at desc
        limit 1
      ) latest on true
      where u.privacy = 'public'
        and latest.archetype = ${latest.archetype}
    )
    select rank, total
    from weekly
    where id = ${user.id}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    rank: row.rank,
    total: row.total,
    label: latest.archetype,
  };
}
