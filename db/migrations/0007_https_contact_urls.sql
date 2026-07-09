alter table profile_settings
drop constraint if exists profile_settings_contact_url_protocol;

alter table profile_settings
add constraint profile_settings_contact_url_protocol
check (contact_url is null or contact_url like 'https://%') not valid;
