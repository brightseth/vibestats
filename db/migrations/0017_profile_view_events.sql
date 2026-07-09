alter table viral_events
  drop constraint if exists viral_events_event_name_check;

alter table viral_events
  add constraint viral_events_event_name_check
  check (event_name in (
    'reveal_created',
    'reveal_view',
    'profile_view',
    'compare_started',
    'profile_claimed'
  ));
