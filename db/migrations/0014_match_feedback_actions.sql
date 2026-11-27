alter table match_intro_events
drop constraint if exists match_intro_events_action_check;

alter table match_intro_events
add constraint match_intro_events_action_check
check (
  action in (
    'compare_click',
    'contact_click',
    'copy_intro',
    'share_x',
    'intro_accept',
    'outcome_positive',
    'outcome_neutral',
    'outcome_negative'
  )
);
