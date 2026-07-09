import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage } from './_lib/http.js';

// Operator-only. The funnel data is privacy-safe aggregate counts (same as
// `npm run traffic:launch`), but it's site-internal, so gate it to the operator(s).
// Override with VIBESTATS_OWNER_HANDLES (comma-separated); defaults to the repo owner.
const OWNERS = String(process.env.VIBESTATS_OWNER_HANDLES || 'brightseth')
  .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

const FUNNEL_KEYS = ['compare_intent_view', 'pairing_shown', 'pairing_share_x', 'pairing_share_copy', 'pairing_open_full', 'pairing_reveal_click', 'wrapped_view', 'wrapped_share'];

function pct(n, d) { return d ? Math.round((Number(n || 0) / Number(d)) * 100) : 0; }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function funnel(interval) {
  let rows = [];
  try {
    rows = await sql()`
      select event, count(*)::int as count
      from funnel_events
      where created_at >= now() - ${interval}::interval
      group by event
    `;
  } catch (err) {
    if (err?.code === '42P01' || String(err?.message || '').includes('funnel_events')) return null;
    throw err;
  }
  const m = Object.fromEntries(FUNNEL_KEYS.map((k) => [k, 0]));
  for (const row of rows) if (row.event in m) m[row.event] = Number(row.count || 0);
  m.shares = m.pairing_share_x + m.pairing_share_copy + m.pairing_open_full;
  return m;
}

// 🌉 Bridge gates: the phase-transition meters (see research/THE-BRIDGE.md).
// Phase 0 gate = 10 lifetime reveals (claimed users + live anonymous snapshots)
// AND ≥1 organic share (a human clicked share on a pairing or wrapped — beacons only
// humans fire). Phase 1 preview = week-1 returning users.
async function bridgeGates() {
  try {
    const [u] = await sql()`select count(*)::int as n from users`;
    const [r] = await sql()`select count(*)::int as n from reveal_snapshots`;
    const [s] = await sql()`
      select count(*)::int as n from funnel_events
      where event in ('pairing_share_x', 'pairing_share_copy', 'wrapped_share')
    `;
    const [ret] = await sql()`
      select count(*)::int as n from users
      where last_seen_at > created_at + interval '20 hours'
    `;
    return {
      reveals: (u?.n || 0) + (r?.n || 0),
      organicShares: s?.n || 0,
      returning: ret?.n || 0,
    };
  } catch (err) {
    console.error('bridge gates error:', err);
    return null;
  }
}

function bridgeBlock(g) {
  if (!g) return '';
  const gate0 = g.reveals >= 10 && g.organicShares >= 1;
  const phase = gate0 ? (g.returning >= 1 ? 'PHASE 2 — SHIPS AS ROOMS' : 'PHASE 1 — SPREAD IDENTITY') : 'PHASE 0 — PROVE THE WEDGE';
  return `<div class="card"><h2>🌉 The Bridge — ${esc(phase)}</h2>
    ${bar('Reveals (gate: 10)', Math.min(g.reveals, 10), 10, `${g.reveals} lifetime · claimed + anonymous`)}
    ${bar('Organic shares (gate: 1)', Math.min(g.organicShares, 1), 1, `${g.organicShares} human share clicks`)}
    ${bar('Week-1 returns (P1 gate)', g.returning, 0)}
    <p class="hint" style="margin-left:0">${gate0 ? '✅ Gate 0 PASSED — Phase 1 re-lights unlock (Buddy first).' : 'Phase 0 rule: nothing new gets built until both bars fill. Witnesses are the work.'}</p>
  </div>`;
}

async function topSources() {
  try {
    return await sql()`
      select source_ref,
        count(*)::int as events,
        count(*) filter (where event_name = 'compare_started')::int as compares,
        count(*) filter (where event_name = 'reveal_created')::int as reveals
      from viral_events
      where created_at >= now() - interval '24 hours' and source_ref is not null
      group by source_ref
      order by events desc
      limit 12
    `;
  } catch (err) {
    if (err?.code === '42P01' || String(err?.message || '').includes('viral_events')) return [];
    throw err;
  }
}

function bar(label, value, of, hint = '') {
  const p = pct(value, of);
  return `<div class="row"><div class="lab">${esc(label)}</div><div class="track"><div class="fill" style="width:${p}%"></div></div><div class="val">${value}${of ? ` <span>(${p}%)</span>` : ''}</div></div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}`;
}

function funnelBlock(title, f) {
  if (!f) return `<div class="card"><h2>${esc(title)}</h2><p class="muted">No funnel_events table yet (run npm run migrate).</p></div>`;
  const landed = f.compare_intent_view;
  return `<div class="card"><h2>${esc(title)}</h2>
    ${bar('Landed on a pairing link', landed, 0)}
    ${bar('Saw a pairing', f.pairing_shown, landed, 'pick → chemistry shown')}
    ${bar('Shared the pairing', f.shares, f.pairing_shown, `x:${f.pairing_share_x} · copy:${f.pairing_share_copy} · open:${f.pairing_open_full}`)}
    ${bar('Clicked “reveal yours”', f.pairing_reveal_click, f.pairing_shown)}
    ${bar('Personal Wrapped views', f.wrapped_view, 0)}
    ${bar('Wrapped shares', f.wrapped_share, f.wrapped_view)}
  </div>`;
}

function page({ f24, f1, sources, handle, gates }) {
  const srcRows = sources.length
    ? sources.map((s) => `<tr><td>${esc(s.source_ref)}</td><td>${s.events}</td><td>${s.compares}</td><td>${s.reveals}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">none yet</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>vibestats scoreboard</title>
<style>
  :root{--bg:#0b0d14;--card:#141826;--ink:#eef1f7;--dim:#9aa3b2;--accent:#6B8FFF;--line:#242a3d}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:24px 16px 60px}
  .wrap{max-width:720px;margin:0 auto}h1{font-size:22px;margin:0 0 2px}.sub{color:var(--dim);margin:0 0 18px;font-size:13px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:12px 0}
  h2{font-size:15px;margin:0 0 12px}.muted{color:var(--dim)}
  .row{display:grid;grid-template-columns:180px 1fr 92px;gap:10px;align-items:center;margin:7px 0}
  .lab{font-size:13px}.track{height:9px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden}
  .fill{height:100%;background:linear-gradient(90deg,var(--accent),#a78bfa)}
  .val{font-family:ui-monospace,monospace;font-size:13px;text-align:right}.val span{color:var(--dim)}
  .hint{color:var(--dim);font-size:11px;margin:-2px 0 6px 190px;font-family:ui-monospace,monospace}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
  th{color:var(--dim);font-weight:600}td:first-child{font-family:ui-monospace,monospace}
  .foot{color:var(--dim);font-size:12px;margin-top:18px;text-align:center}
</style></head><body><div class="wrap">
  <h1>📊 vibestats scoreboard</h1>
  <p class=”sub”>The compatibility experiment — does “who should I build with” spread? · @${esc(handle)} · auto-refreshes every 60s</p>
  ${bridgeBlock(gates)}
  ${funnelBlock('Compare-intent funnel — last 24h', f24)}
  ${funnelBlock('Last 1h', f1)}
  <div class="card"><h2>Top attributed sources — 24h (new entrants from pairing shares)</h2>
    <table><thead><tr><th>source</th><th>events</th><th>compares</th><th>reveals</th></tr></thead><tbody>${srcRows}</tbody></table>
    <p class="hint" style="margin-left:0">Win condition: rows like <code>u:${esc(handle)}</code> climbing = your pairing shares are pulling in new people.</p>
  </div>
  <p class="foot">Private · noindex · operator-only. Same data as <code>npm run traffic:launch</code>.</p>
</div><script>setTimeout(()=>location.reload(),60000)</script></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);
  try {
    const user = await requireUser(req);
    if (!user) {
      clearSessionCookie(req, res);
      res.statusCode = 401;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end('<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;background:#0b0d14;color:#eef1f7;padding:40px"><h1>Sign in required</h1><p>This scoreboard is operator-only. <a style="color:#6B8FFF" href="/api/auth/github/start?returnTo=/scoreboard">Sign in with GitHub</a></p>');
    }
    if (!OWNERS.includes(String(user.gh_handle || '').toLowerCase())) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font:16px system-ui;background:#0b0d14;color:#eef1f7;padding:40px"><h1>404</h1>');
    }
    const [f24, f1, sources, gates] = await Promise.all([funnel('24 hours'), funnel('1 hour'), topSources(), bridgeGates()]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(page({ f24, f1, sources, handle: user.gh_handle, gates }));
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Dashboard failed') }, NO_STORE_HEADERS);
  }
}
