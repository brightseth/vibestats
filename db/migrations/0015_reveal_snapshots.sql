create table if not exists reveal_snapshots (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  archetype text not null,
  scores jsonb not null,
  metrics jsonb not null,
  raw_meta jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  constraint reveal_snapshots_archetype_check check (archetype in (
    'orchestrator', 'shipper', 'architect', 'debugger',
    'polyglot', 'sprinter', 'deepdiver', 'builder'
  ))
);

create index if not exists reveal_snapshots_slug_idx on reveal_snapshots(slug);
create index if not exists reveal_snapshots_expires_at_idx on reveal_snapshots(expires_at);
