create table if not exists profile_settings (
  user_id uuid primary key references users(id) on delete cascade,
  weekly_digest_opt_in boolean not null default false,
  digest_email text,
  email_consent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (digest_email is null or length(digest_email) <= 254),
  check ((weekly_digest_opt_in = false) or digest_email is not null)
);

insert into profile_settings (user_id)
select id from users
on conflict (user_id) do nothing;
