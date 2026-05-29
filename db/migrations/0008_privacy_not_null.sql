update users
set privacy = 'unlisted'
where privacy is null;

alter table users
alter column privacy set default 'unlisted';

alter table users
alter column privacy set not null;
