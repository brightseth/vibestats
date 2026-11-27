create table if not exists match_intro_events (
  id uuid primary key default gen_random_uuid(),
  target_handle text not null,
  goal text not null,
  seeker_archetype text,
  target_archetype text,
  action text not null,
  source text not null default 'match',
  created_at timestamptz not null default now(),
  constraint match_intro_events_target_handle_check
    check (target_handle ~ '^[A-Za-z0-9-]{1,39}$'),
  constraint match_intro_events_goal_check
    check (goal in ('pair-coding', 'co-founder', 'hire', 'mentor', 'mentee')),
  constraint match_intro_events_seeker_archetype_check
    check (seeker_archetype is null or seeker_archetype in ('orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder')),
  constraint match_intro_events_target_archetype_check
    check (target_archetype is null or target_archetype in ('orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder')),
  constraint match_intro_events_action_check
    check (action in ('compare_click', 'contact_click', 'copy_intro', 'share_x')),
  constraint match_intro_events_source_check
    check (source in ('match', 'browse', 'profile'))
);

create index if not exists match_intro_events_target_created_idx
on match_intro_events (target_handle, created_at desc);

create index if not exists match_intro_events_goal_created_idx
on match_intro_events (goal, created_at desc);
