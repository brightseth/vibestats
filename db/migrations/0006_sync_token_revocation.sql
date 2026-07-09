alter table profile_settings
add column if not exists sync_token_invalidated_at timestamptz;
