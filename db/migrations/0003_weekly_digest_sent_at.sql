alter table profile_settings
add column if not exists weekly_digest_sent_at timestamptz;
