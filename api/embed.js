import { readSession, originForRequest } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateNotFound } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { metricVisibility, publicUpload } from './_lib/public-profile.js';
import { rarityTier, signatureFromUpload } from './_lib/signatures.js';

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', short: 'Orchestrator', tagline: "You don't code. You conduct.", color: '#6B8FFF', accent: '#a78bfa' },
  shipper: { name: 'THE SHIPPER', short: 'Shipper', tagline: 'Done is better than perfect.', color: '#22c55e', accent: '#22d3ee' },
  architect: { name: 'THE ARCHITECT', short: 'Architect', tagline: 'You plan before you build.', color: '#3b82f6', accent: '#6B8FFF' },
  debugger: { name: 'THE DEBUGGER', short: 'Debugger', tagline: "You don't guess. You investigate.", color: '#f59e0b', accent: '#ef4444' },
  polyglot: { name: 'THE POLYGLOT', short: 'Polyglot', tagline: 'One language is never enough.', color: '#ff79c6', accent: '#22c55e' },
  sprinter: { name: 'THE SPRINTER', short: 'Sprinter', tagline: 'Fast, focused, ferocious.', color: '#ef4444', accent: '#ff79c6' },
  deepdiver: { name: 'THE DEEP DIVER', short: 'Deep Diver', tagline: 'You go deep, not wide.', color: '#3b82f6', accent: '#1e40af' },
  builder: { name: 'THE BUILDER', short: 'Builder', tagline: "You build things that didn't exist before.", color: '#22c55e', accent: '#16a34a' },
};

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getHandle(req) {
  const raw = req.query?.handle;
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim();
}

function metricValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1000) return Math.round(n).toLocaleString();
  if (n % 1 === 0) return String(n);
  return n.toFixed(1);
}

function metricCards({ score, latest, visibility }) {
  const metrics = latest?.metrics || {};
  const activity = latest?.activity || {};
  const cards = [`<div class="metric"><strong>${score}%</strong><span>signal</span></div>`];
  if (visibility?.show_raw_counts) {
    cards.push(`<div class="metric"><strong>${esc(metricValue(metrics.days))}</strong><span>days</span></div>`);
    cards.push(`<div class="metric"><strong>${esc(metricValue(metrics.commitsPerDay))}</strong><span>commits/day</span></div>`);
    cards.push(`<div class="metric"><strong>${esc(metricValue(metrics.sessions))}</strong><span>sessions</span></div>`);
  } else {
    cards.push(`<div class="metric"><strong>${esc(activity.days || 'private')}</strong><span>activity</span></div>`);
    cards.push(`<div class="metric"><strong>${esc(activity.cadence || 'private')}</strong><span>cadence</span></div>`);
    cards.push(`<div class="metric"><strong>${esc(activity.depth || 'private')}</strong><span>history</span></div>`);
  }
  if (visibility?.show_languages) {
    cards[cards.length - 1] = `<div class="metric"><strong>${esc(metricValue(metrics.languages))}</strong><span>languages</span></div>`;
  }
  return cards.join('');
}

function embedHtml({ origin, user, latest, rarity, visibility = {} }) {
  const hasLatest = Boolean(latest?.archetype && ARCHETYPES[latest.archetype]);
  const arch = hasLatest ? ARCHETYPES[latest.archetype] : {
    name: 'VIBESTATS PROFILE',
    short: 'vibestats profile',
    tagline: 'Claim your Claude Code signature.',
    color: '#6B8FFF',
    accent: '#a78bfa',
  };
  const score = hasLatest ? Math.max(0, Math.min(100, Math.round(Number(latest?.scores?.[latest?.archetype]) || 0))) : 0;
  const signature = hasLatest ? signatureFromUpload(latest || {})?.label || arch.short : 'Waiting for an upload';
  const profileUrl = `${origin}/u/${encodeURIComponent(user.gh_handle)}`;
  const compareUrl = hasLatest
    ? `${origin}/?compareTo=${encodeURIComponent(user.gh_handle)}&compareArchetype=${encodeURIComponent(latest.archetype)}`
    : profileUrl;
  const actionLabel = hasLatest ? `Compare with @${user.gh_handle}` : `Open @${user.gh_handle} on vibestats`;
  const avatar = user.avatar_url
    ? `<img class="avatar" src="${esc(user.avatar_url)}" alt="@${esc(user.gh_handle)}">`
    : '<div class="avatar fallback" aria-hidden="true">VS</div>';
  const rarityLine = rarity?.count
    ? `${rarity.tier} combo: 1 of ${metricValue(rarity.count)} this month`
    : 'Claude Code personality profile';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>@${esc(user.gh_handle)} on vibestats</title>
  <link rel="stylesheet" href="/fonts/fonts.css">
  <style>
    :root {
      --bg: #07070c;
      --surface: #10101a;
      --border: rgba(255,255,255,0.1);
      --text: #f4f4f5;
      --muted: #9797ad;
      --dim: #626276;
      --accent: ${esc(arch.color)};
      --accent-2: ${esc(arch.accent)};
      --mono: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;
      --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; }
    body {
      background: transparent;
      color: var(--text);
      font-family: var(--sans);
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      min-height: 260px;
      padding: 22px;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015)),
        linear-gradient(135deg, #090911, #151521);
      color: inherit;
      text-decoration: none;
    }
    .card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }
    .head, .foot {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .identity {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 13px;
    }
    .avatar {
      flex: 0 0 auto;
      width: 56px;
      height: 56px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.12);
      background: #151522;
      object-fit: cover;
    }
    .avatar.fallback {
      display: grid;
      place-items: center;
      color: var(--accent);
      font-family: var(--mono);
      font-size: 16px;
      font-weight: 800;
    }
    .handle {
      overflow: hidden;
      color: #fff;
      font-size: 24px;
      font-weight: 850;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .brand, .label, .rarity, .cta, .metric span {
      font-family: var(--mono);
      letter-spacing: 0;
    }
    .brand {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .body {
      position: relative;
      z-index: 1;
      padding: 18px 0 16px;
    }
    .label {
      margin-bottom: 8px;
      color: var(--dim);
      font-size: 11px;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: transparent;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      -webkit-background-clip: text;
      background-clip: text;
      font-size: clamp(30px, 8vw, 52px);
      line-height: 0.98;
      letter-spacing: 0;
    }
    .signature {
      margin-top: 11px;
      color: #d8ddff;
      font-family: var(--mono);
      font-size: 14px;
      line-height: 1.45;
    }
    .tagline {
      color: var(--muted);
    }
    .metrics {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .metric {
      min-width: 0;
      padding: 9px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      background: rgba(255,255,255,0.035);
    }
    .metric strong {
      display: block;
      overflow: hidden;
      color: #fff;
      font-size: 17px;
      font-weight: 800;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .metric span {
      display: block;
      margin-top: 5px;
      color: var(--dim);
      font-size: 10px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .rarity {
      overflow: hidden;
      color: var(--dim);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cta {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 7px 10px;
      border: 1px solid rgba(107,143,255,0.34);
      border-radius: 8px;
      color: #c8d5ff;
      background: rgba(107,143,255,0.1);
      font-size: 11px;
      font-weight: 700;
    }
    @media (max-width: 420px) {
      .card { padding: 18px; }
      .brand { display: none; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .foot { align-items: flex-start; flex-direction: column; }
      .cta { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <a class="card" href="${esc(compareUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(actionLabel)}">
    <div class="head">
      <div class="identity">
        ${avatar}
        <div class="handle">@${esc(user.gh_handle)}</div>
      </div>
      <div class="brand">vibestats</div>
    </div>
    <div class="body">
      <div class="label">Claude Code signature</div>
      <h1>${esc(arch.name)}</h1>
      <div class="signature">${esc(signature)} <span class="tagline">/ ${esc(arch.tagline)}</span></div>
    </div>
    <div class="metrics">
      ${metricCards({ score, latest, visibility })}
    </div>
    <div class="foot">
      <div class="rarity">${esc(rarityLine)}</div>
      <div class="cta">${hasLatest ? 'Compare with me' : 'Open profile'}</div>
    </div>
  </a>
</body>
</html>`;
}

function genericEmbedPage(req, handle) {
  return embedHtml({
    origin: originForRequest(req),
    user: { gh_handle: handle, avatar_url: '' },
    latest: null,
    rarity: null,
    visibility: {},
  });
}

function sendHtml(res, status, html, cache = 'public, s-maxage=300, stale-while-revalidate=3600') {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors https: http://localhost:* http://127.0.0.1:*");
  res.status(status).send(html);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const handle = getHandle(req);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) {
    return res.status(404).send('Not found');
  }

  try {
    const users = await sql()`
      select id, gh_handle, avatar_url, privacy
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = users[0];
    if (!user) return res.status(404).send('Not found');

    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) {
      return sendPrivateNotFound(res);
    }
    const settingsRows = await sql()`
      select show_raw_counts, show_languages
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    const visibility = metricVisibility(settingsRows[0] || {}, { isOwner: false });

    const uploads = await sql()`
      select archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latest = uploads[0];
    if (!latest) {
      return sendHtml(res, 200, embedHtml({
        origin: originForRequest(req),
        user,
        latest: null,
        rarity: null,
        visibility,
      }), profileShareCacheControl(user));
    }

    const latestSignature = signatureFromUpload(latest);
    let rarity = null;
    if (latestSignature?.fingerprint) {
      const rarityRows = await sql()`
        with latest_uploads as (
          select distinct on (user_id) user_id, raw_meta, uploaded_at
          from uploads
          order by user_id, uploaded_at desc
        )
        select count(*)::int as count
        from latest_uploads
        where raw_meta->>'signatureFingerprint' = ${latestSignature.fingerprint}
          and uploaded_at > now() - interval '30 days'
      `;
      const count = rarityRows[0]?.count || 1;
      rarity = { count, tier: rarityTier(count) };
    }

    return sendHtml(res, 200, embedHtml({
      origin: originForRequest(req),
      user,
      latest: publicUpload(latest, visibility, { isOwner: false }),
      rarity,
      visibility,
    }), profileShareCacheControl(user));
  } catch (err) {
    console.error('GET /api/embed error:', err);
    return sendHtml(res, 200, genericEmbedPage(req, handle), 'public, s-maxage=60');
  }
}
