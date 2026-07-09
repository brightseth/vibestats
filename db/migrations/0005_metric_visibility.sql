alter table profile_settings
add column if not exists show_raw_counts boolean not null default false,
add column if not exists show_languages boolean not null default false;
