-- Client-side funnel events for the compare-intent loop.
-- Measures the in-browser drop-off the server-rendered viral_events can't see:
-- landed on a compare link -> saw a pairing -> shared it -> started their own reveal.
-- Counts only. No PII, no raw /insights, no free text. Event names are allowlisted
-- in api/_lib/funnel-events.js; the column is bounded here as a backstop.
create table if not exists funnel_events (
  id uuid primary key default uuid_generate_v4(),
  event text not null,
  archetype text,
  created_at timestamptz not null default now(),
  constraint funnel_events_event_check
    check (event ~ '^[a-z_]{3,40}$'),
  constraint funnel_events_archetype_check
    check (archetype is null or archetype in (
      'orchestrator', 'shipper', 'architect', 'debugger',
      'polyglot', 'sprinter', 'deepdiver', 'builder'
    ))
);

create index if not exists funnel_events_event_created_idx on funnel_events(event, created_at desc);
