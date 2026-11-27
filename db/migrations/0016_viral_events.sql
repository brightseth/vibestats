create table if not exists viral_events (
  id uuid primary key default uuid_generate_v4(),
  event_name text not null,
  source_ref text,
  source_surface text not null default 'unknown',
  reveal_slug text,
  profile_handle text,
  archetype text,
  created_at timestamptz not null default now(),
  constraint viral_events_event_name_check
    check (event_name in ('reveal_created', 'reveal_view', 'compare_started', 'profile_claimed')),
  constraint viral_events_source_ref_check
    check (source_ref is null or source_ref ~ '^(r|u):[A-Za-z0-9_-]{1,39}$'),
  constraint viral_events_source_surface_check
    check (source_surface in ('homepage', 'anon_reveal', 'profile', 'compare', 'cli', 'ssh', 'unknown')),
  constraint viral_events_reveal_slug_check
    check (reveal_slug is null or reveal_slug ~ '^[A-Za-z0-9_-]{10,24}$'),
  constraint viral_events_profile_handle_check
    check (profile_handle is null or profile_handle ~ '^[A-Za-z0-9-]{1,39}$'),
  constraint viral_events_archetype_check
    check (archetype is null or archetype in (
      'orchestrator', 'shipper', 'architect', 'debugger',
      'polyglot', 'sprinter', 'deepdiver', 'builder'
    ))
);

create index if not exists viral_events_event_created_idx on viral_events(event_name, created_at desc);
create index if not exists viral_events_source_created_idx on viral_events(source_ref, created_at desc);
create index if not exists viral_events_reveal_created_idx on viral_events(reveal_slug, created_at desc);
create index if not exists viral_events_profile_created_idx on viral_events(profile_handle, created_at desc);
