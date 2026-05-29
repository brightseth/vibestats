import { sql } from './db.js';

export async function weeklyLeaderboardRank(user, latest) {
  if (user?.privacy !== 'public' || !user?.id || !latest?.archetype) return null;

  const rows = await sql()`
    with weekly_uploads as (
      select
        u.id,
        latest.archetype,
        latest.scores,
        latest.uploaded_at,
        case
          when latest.scores->>latest.archetype ~ '^-?[0-9]+([.][0-9]+)?$'
            then least(greatest((latest.scores->>latest.archetype)::numeric, 0), 100)
          else 0
        end as public_score
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
    ),
    weekly as (
      select
        id,
        archetype,
        scores,
        uploaded_at,
        row_number() over (
          order by public_score desc, uploaded_at desc
        )::int as rank,
        count(*) over()::int as total
      from weekly_uploads
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
