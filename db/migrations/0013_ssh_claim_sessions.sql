create table if not exists ssh_claim_sessions (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  state text not null default 'pending',
  user_id uuid references users(id) on delete set null,
  gh_handle text,
  profile_url text,
  compare_url text,
  credential_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ssh_claim_sessions_state_check
    check (state in ('pending', 'authorized', 'synced', 'expired', 'revoked')),
  constraint ssh_claim_sessions_gh_handle_check
    check (gh_handle is null or gh_handle ~ '^[A-Za-z0-9-]{1,39}$')
);

create index if not exists ssh_claim_sessions_state_expires_idx
on ssh_claim_sessions (state, expires_at);

create index if not exists ssh_claim_sessions_created_idx
on ssh_claim_sessions (created_at desc);
