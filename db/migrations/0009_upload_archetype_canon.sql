alter table uploads
drop constraint if exists uploads_archetype_check;

alter table uploads
add constraint uploads_archetype_check
check (archetype in (
  'orchestrator',
  'shipper',
  'architect',
  'debugger',
  'polyglot',
  'sprinter',
  'deepdiver',
  'builder'
));
