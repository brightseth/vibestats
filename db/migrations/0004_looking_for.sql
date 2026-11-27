alter table profile_settings
add column if not exists looking_for text not null default 'idle'
  check (looking_for in ('pair-coding', 'co-founder', 'hire', 'mentor', 'mentee', 'idle')),
add column if not exists looking_for_expires_at timestamptz,
add column if not exists contact_url text,
add constraint profile_settings_contact_url_len check (contact_url is null or length(contact_url) <= 500);

create index if not exists profile_settings_looking_for_idx
on profile_settings (looking_for, looking_for_expires_at)
where looking_for <> 'idle';
