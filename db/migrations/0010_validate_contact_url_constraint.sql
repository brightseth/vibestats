update profile_settings
set contact_url = null,
    updated_at = now()
where contact_url is not null
  and contact_url not like 'https://%';

alter table profile_settings
validate constraint profile_settings_contact_url_protocol;
