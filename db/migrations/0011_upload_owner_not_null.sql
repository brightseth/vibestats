delete from uploads
where user_id is null;

alter table uploads
alter column user_id set not null;
