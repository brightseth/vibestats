create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  gh_id bigint unique not null,
  gh_handle text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  privacy text default 'unlisted' check (privacy in ('public','unlisted','private'))
);

create unique index if not exists users_gh_handle_lower_idx on users (lower(gh_handle));
create index if not exists users_handle_idx on users(gh_handle);

create table if not exists uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  archetype text not null,
  scores jsonb not null,
  metrics jsonb not null,
  raw_meta jsonb,
  uploaded_at timestamptz default now()
);

create index if not exists uploads_user_time_idx on uploads(user_id, uploaded_at desc);

