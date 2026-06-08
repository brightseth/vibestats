#!/usr/bin/env node
import postgres from 'postgres';

const WINDOWS = [
  { label: '15m', interval: '15 minutes' },
  { label: '1h', interval: '1 hour' },
  { label: '6h', interval: '6 hours' },
  { label: '24h', interval: '24 hours' },
];

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function usage() {
  return `Usage: npm run traffic:launch
       npm run traffic:launch -- --json

Run with production env loaded:
  vercel env run -e production -- npm run traffic:launch

Reports privacy-safe launch-loop counters from Postgres. Does not print env values,
IP addresses, user agents, raw /insights data, prompts, paths, or free text.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function byEvent(rows = []) {
  const out = {
    reveal_created: 0,
    reveal_view: 0,
    profile_view: 0,
    compare_started: 0,
    profile_claimed: 0,
    attributed_reveals: 0,
  };
  for (const row of rows) {
    if (row.event_name in out) out[row.event_name] = Number(row.count || 0);
    if (row.event_name === 'reveal_created') out.attributed_reveals += Number(row.attributed_count || 0);
  }
  return out;
}

function percent(numerator, denominator) {
  if (!denominator) return '0%';
  return `${Math.round((Number(numerator || 0) / Number(denominator || 0)) * 100)}%`;
}

function fmtTime(value) {
  if (!value) return '';
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function windowSummary(sql, interval) {
  const events = byEvent(await sql`
    select
      event_name,
      count(*)::int as count,
      count(*) filter (where event_name = 'reveal_created' and source_ref is not null)::int as attributed_count
    from viral_events
    where created_at >= now() - ${interval}::interval
    group by event_name
    order by event_name
  `);
  const [reveals] = await sql`
    select count(*)::int as count
    from reveal_snapshots
    where created_at >= now() - ${interval}::interval
  `;
  const [users] = await sql`
    select count(*)::int as count
    from users
    where created_at >= now() - ${interval}::interval
  `;
  const [uploads] = await sql`
    select count(*)::int as count
    from uploads
    where uploaded_at >= now() - ${interval}::interval
  `;
  return {
    ...events,
    snapshots: Number(reveals?.count || 0),
    new_users: Number(users?.count || 0),
    uploads: Number(uploads?.count || 0),
    view_to_compare: percent(events.compare_started, events.reveal_view),
    attributed_reveal_rate: percent(events.attributed_reveals, events.reveal_created),
  };
}

async function funnelSummary(sql, interval) {
  let rows = [];
  try {
    rows = await sql`
      select event, count(*)::int as count
      from funnel_events
      where created_at >= now() - ${interval}::interval
      group by event
    `;
  } catch (err) {
    if (err?.code === '42P01' || String(err?.message || '').includes('funnel_events')) return null;
    throw err;
  }
  const m = {
    compare_intent_view: 0, pairing_shown: 0, pairing_share_x: 0,
    pairing_share_copy: 0, pairing_open_full: 0, pairing_reveal_click: 0,
  };
  for (const row of rows) if (row.event in m) m[row.event] = Number(row.count || 0);
  const shares = m.pairing_share_x + m.pairing_share_copy + m.pairing_open_full;
  return {
    ...m,
    shares,
    view_to_shown: percent(m.pairing_shown, m.compare_intent_view),
    shown_to_share: percent(shares, m.pairing_shown),
    shown_to_reveal: percent(m.pairing_reveal_click, m.pairing_shown),
  };
}

async function buildReport(sql) {
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const windows = {};
  for (const item of WINDOWS) {
    windows[item.label] = await windowSummary(sql, item.interval);
  }

  const topSources = await sql`
    select
      source_ref,
      count(*)::int as events,
      count(*) filter (where event_name = 'reveal_view')::int as reveal_views,
      count(*) filter (where event_name = 'profile_view')::int as profile_views,
      count(*) filter (where event_name = 'compare_started')::int as compares,
      count(*) filter (where event_name = 'reveal_created')::int as attributed_reveals,
      max(created_at) as latest
    from viral_events
    where created_at >= now() - interval '24 hours'
      and source_ref is not null
    group by source_ref
    order by events desc, latest desc
    limit 12
  `;

  const archetypes = await sql`
    select archetype, count(*)::int as reveals
    from reveal_snapshots
    where created_at >= now() - interval '24 hours'
    group by archetype
    order by reveals desc, archetype
  `;

  const recentEvents = await sql`
    select event_name, source_ref, source_surface, archetype, created_at
    from viral_events
    order by created_at desc
    limit 15
  `;

  const recentReveals = await sql`
    select slug, archetype, created_at, expires_at
    from reveal_snapshots
    order by created_at desc
    limit 10
  `;

  const funnel24h = await funnelSummary(sql, '24 hours');

  return {
    generated_at: generatedAt,
    windows,
    funnel_24h: funnel24h,
    top_sources_24h: topSources.map((row) => ({
      source_ref: row.source_ref,
      events: Number(row.events || 0),
      reveal_views: Number(row.reveal_views || 0),
      profile_views: Number(row.profile_views || 0),
      compares: Number(row.compares || 0),
      attributed_reveals: Number(row.attributed_reveals || 0),
      latest: fmtTime(row.latest),
    })),
    archetypes_24h: archetypes.map((row) => ({
      archetype: row.archetype,
      reveals: Number(row.reveals || 0),
    })),
    recent_events: recentEvents.map((row) => ({
      event_name: row.event_name,
      source_ref: row.source_ref,
      source_surface: row.source_surface,
      archetype: row.archetype,
      created_at: fmtTime(row.created_at),
    })),
    recent_reveals: recentReveals.map((row) => ({
      slug: row.slug,
      archetype: row.archetype,
      created_at: fmtTime(row.created_at),
      expires_at: fmtTime(row.expires_at),
    })),
  };
}

function printTable(report) {
  console.log(`vibestats launch traffic (${report.generated_at})`);
  console.log('');
  console.log('Window  created  /r views  /u views  compares  attributed  claims  snapshots  users  uploads  view->compare');
  for (const [label, row] of Object.entries(report.windows)) {
    console.log([
      label.padEnd(6),
      String(row.reveal_created).padStart(7),
      String(row.reveal_view).padStart(6),
      String(row.profile_view).padStart(8),
      String(row.compare_started).padStart(9),
      String(row.attributed_reveals).padStart(10),
      String(row.profile_claimed).padStart(7),
      String(row.snapshots).padStart(9),
      String(row.new_users).padStart(6),
      String(row.uploads).padStart(8),
      row.view_to_compare.padStart(13),
    ].join('  '));
  }

  console.log('');
  console.log('Compare-intent funnel, 24h  (who should I build with — the pairing loop)');
  const f = report.funnel_24h;
  if (!f) {
    console.log('- funnel_events table not migrated yet (run npm run migrate)');
  } else {
    console.log(`- landed on pairing link : ${f.compare_intent_view}`);
    console.log(`- saw a pairing          : ${f.pairing_shown}  (${f.view_to_shown} of landed)`);
    console.log(`- shared the pairing     : ${f.shares}  (${f.shown_to_share} of saw)  [x:${f.pairing_share_x} copy:${f.pairing_share_copy} open:${f.pairing_open_full}]`);
    console.log(`- clicked reveal yours   : ${f.pairing_reveal_click}  (${f.shown_to_reveal} of saw)`);
  }

  console.log('');
  console.log('Top attributed sources, 24h');
  if (!report.top_sources_24h.length) console.log('- none yet');
  for (const row of report.top_sources_24h) {
    console.log(`- ${row.source_ref}: ${row.events} events, ${row.reveal_views} /r views, ${row.profile_views} /u views, ${row.compares} compares, ${row.attributed_reveals} attributed reveals, latest ${row.latest}`);
  }

  console.log('');
  console.log('Reveal archetypes, 24h');
  if (!report.archetypes_24h.length) console.log('- none yet');
  for (const row of report.archetypes_24h) {
    console.log(`- ${row.archetype}: ${row.reveals}`);
  }

  console.log('');
  console.log('Recent events');
  if (!report.recent_events.length) console.log('- none yet');
  for (const row of report.recent_events) {
    const source = row.source_ref ? ` source=${row.source_ref}` : '';
    const archetype = row.archetype ? ` archetype=${row.archetype}` : '';
    console.log(`- ${row.created_at} ${row.event_name}${source} surface=${row.source_surface}${archetype}`);
  }
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!databaseUrl()) {
    throw new Error('Missing DATABASE_URL/POSTGRES_URL/NEON_DATABASE_URL. Use `vercel env run -e production -- npm run traffic:launch`.');
  }

  const sql = postgres(databaseUrl(), { max: 1, ssl: 'require' });
  try {
    const report = await buildReport(sql);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printTable(report);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
