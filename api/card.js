import { NO_STORE_HEADERS, methodNotAllowed } from './_lib/http.js';
import { archetypeMap } from '../lib/archetype-identity.js';

const INSIGHTS_COMMAND = '/insights';
const BASE_CLI_COMMAND = 'curl -fsSL https://vibestats.io/cli.sh | sh -s --';
const CLAIM_COMMAND = BASE_CLI_COMMAND;
const STATUS_COMMAND = `${BASE_CLI_COMMAND} status`;
const REVEAL_COMMAND = `${BASE_CLI_COMMAND} reveal`;
const INSTALL_CLAUDE_COMMAND = `${BASE_CLI_COMMAND} install-claude-command`;

const ARCHETYPES = archetypeMap(['name', 'tagline', 'color', 'gradient', 'glyph']);

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value ?? '').trim();
}

function cleanTextParam(value, fallback, max = 42) {
  const cleaned = firstParam(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, max)
    .trim();
  return cleaned || fallback;
}

function cleanNumberParam(value, fallback, { min = 0, max = 100, decimals = 0 } = {}) {
  const raw = firstParam(value);
  if (!raw) return fallback;
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return fallback;
  const bounded = Math.min(Math.max(n, min), max);
  if (decimals === 0) return String(Math.round(bounded));
  return String(Number(bounded.toFixed(decimals))).replace(/\.0$/, '');
}

export function sanitizeCardQuery(query = {}) {
  const requestedKey = firstParam(query.a);
  const archetypeKey = ARCHETYPES[requestedKey] ? requestedKey : 'builder';
  const name = cleanTextParam(query.n, 'Vibecoder');
  const days = cleanNumberParam(query.d, '?', { max: 5000 });
  const commits = cleanNumberParam(query.c, '?', { max: 500, decimals: 1 });
  const langs = cleanNumberParam(query.l, '?', { max: 200 });
  const sessions = cleanNumberParam(query.s, '?', { max: 100000 });
  const satisfaction = cleanNumberParam(query.sat, null, { max: 100 });
  const percentile = cleanNumberParam(query.p, null, { min: 1, max: 100 });

  const params = new URLSearchParams();
  params.set('a', archetypeKey);
  params.set('n', name);
  if (days !== '?') params.set('d', days);
  if (commits !== '?') params.set('c', commits);
  if (langs !== '?') params.set('l', langs);
  if (sessions !== '?') params.set('s', sessions);
  if (satisfaction) params.set('sat', satisfaction);
  if (percentile) params.set('p', percentile);

  return {
    archetypeKey,
    name,
    days,
    commits,
    langs,
    sessions,
    satisfaction,
    percentile,
    queryString: params.toString(),
  };
}

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  const card = sanitizeCardQuery(req.query);
  const { archetypeKey, name, days, commits, langs, sessions, percentile } = card;
  const arch = ARCHETYPES[archetypeKey];
  const displayName = esc(name);
  const displayDays = esc(days);
  const displayCommits = esc(commits);
  const displayLangs = esc(langs);
  const displaySessions = esc(sessions);
  const satisfaction = card.satisfaction ? esc(card.satisfaction) + '%' : null;

  const ogParams = card.queryString;
  const ogImageUrl = `https://vibestats.io/api/og?${ogParams}`;
  const cardUrl = `https://vibestats.io/card?${ogParams}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${displayName} is ${esc(arch.name)} | vibestats</title>
  <meta name="description" content="${displayName} — ${esc(arch.tagline)} Claude Code already knows how you build. Run /insights, check status, reveal yours, and compare with this archetype.">
  <meta property="og:title" content="${displayName} is ${esc(arch.name)} | vibestats">
  <meta property="og:description" content="${esc(arch.tagline)} — ${displayCommits} commits/day across ${displayLangs} languages. Run /insights, check status, then reveal yours.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${cardUrl}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${displayName} is ${esc(arch.name)}">
  <meta name="twitter:description" content="${esc(arch.tagline)} — Claude Code already knows how you build. Run /insights, check status, then reveal yours.">
  <meta name="twitter:image" content="${ogImageUrl}">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <style>
    :root {
      --bg: #06060a; --surface: #0d0d14; --border: #252535;
      --text: #E0E0E0; --text-muted: #8888a0; --text-dim: #555568;
      --accent: #6B8FFF; --purple: #a78bfa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 32px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: min(380px, 88vw); background: linear-gradient(145deg, #0d0d18, #12121f);
      border: 1px solid ${arch.color}40; border-radius: 20px;
      padding: 28px 24px 20px; text-align: center; position: relative;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: ${arch.gradient};
    }
    .label {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      color: var(--text-dim); letter-spacing: 0.2em; text-transform: uppercase;
      margin-bottom: 12px;
    }
    .glyph {
      width: 64px; height: 64px; margin: 0 auto 14px;
      display: grid; place-items: center;
      border-radius: 18px; border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.035); color: ${arch.color};
      font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 800;
      line-height: 1;
    }
    .name {
      font-size: clamp(28px, 7vw, 40px); font-weight: 900;
      background: ${arch.gradient}; -webkit-background-clip: text;
      -webkit-text-fill-color: transparent; background-clip: text;
      letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 8px;
    }
    .tagline {
      font-family: 'JetBrains Mono', monospace; font-size: 13px;
      color: var(--text-muted); font-style: italic; margin-bottom: 24px;
    }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .stat {
      padding: 10px 8px; background: rgba(255,255,255,0.02);
      border-radius: 10px; border: 1px solid rgba(255,255,255,0.04);
    }
    .stat-val {
      font-family: 'JetBrains Mono', monospace; font-size: 18px;
      font-weight: 700; color: #fff;
    }
    .stat-label {
      font-size: 10px; color: var(--text-dim);
      text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px;
    }
    .user { font-size: 14px; font-weight: 600; color: #fff; }
    .period {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      color: var(--text-dim); margin-top: 4px;
    }
    .percentile {
      display: inline-block; font-family: 'JetBrains Mono', monospace;
      font-size: 11px; color: ${arch.color}; margin-top: 12px;
      padding: 4px 14px; border: 1px solid ${arch.color}30;
      border-radius: 20px;
    }
    .brand {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      margin-top: 12px; letter-spacing: 0.1em;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .cta {
      display: inline-flex; align-items: center; gap: 8px;
      margin-top: 32px; padding: 14px 28px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(107,143,255,0.15), rgba(167,139,250,0.1));
      border: 1px solid rgba(107,143,255,0.35);
      font-family: 'JetBrains Mono', monospace; font-size: 14px;
      font-weight: 500; color: #8aadff; text-decoration: none;
      transition: all 0.2s; min-height: 44px;
      -webkit-tap-highlight-color: transparent;
    }
    .cta:hover { border-color: var(--accent); background: rgba(107,143,255,0.12); }
    .reveal-panel {
      width: min(560px, 92vw); margin-top: 22px; padding: 18px;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
      background: rgba(255,255,255,0.025); text-align: left;
    }
    .reveal-title { font-size: 14px; color: #fff; font-weight: 700; margin-bottom: 6px; }
    .reveal-copy { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px; }
    .reveal-command {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px;
      align-items: center; padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.06);
    }
    .reveal-command code {
      font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #dbe7ff;
      overflow-wrap: anywhere;
    }
    .reveal-command button {
      min-height: 34px; border: 1px solid rgba(107,143,255,0.35); border-radius: 6px;
      background: rgba(107,143,255,0.10); color: #8aadff; padding: 0 10px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px; cursor: pointer;
    }
    .footer {
      margin-top: 24px; font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: var(--text-dim);
    }
    .footer a { color: var(--accent); text-decoration: none; }
    @media (max-width: 480px) {
      body { padding: 24px 16px; }
      .card { width: 100%; }
      .name { font-size: 30px; }
      .cta {
        width: 100%; justify-content: center; text-align: center;
        padding-left: 16px; padding-right: 16px;
      }
      .reveal-command { grid-template-columns: 1fr; }
      .reveal-command button { justify-self: start; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">vibecoding personality</div>
    <div class="glyph">${esc(arch.glyph || 'VS')}</div>
    <div class="name">${esc(arch.name)}</div>
    <div class="tagline">"${esc(arch.tagline)}"</div>
    <div class="stats">
      <div class="stat"><div class="stat-val">${displaySessions}</div><div class="stat-label">sessions</div></div>
      <div class="stat"><div class="stat-val">${displayCommits}/day</div><div class="stat-label">commits</div></div>
      <div class="stat"><div class="stat-val">${displayLangs}</div><div class="stat-label">languages</div></div>
      <div class="stat"><div class="stat-val">${satisfaction || '—'}</div><div class="stat-label">${satisfaction ? 'satisfaction' : ''}</div></div>
    </div>
    <div class="user">${displayName}</div>
    <div class="period">${displayDays} days of vibecoding</div>
    <div class="brand">vibestats.io</div>
  </div>
  <a class="cta" href="/?compareArchetype=${encodeURIComponent(archetypeKey)}">Compare with this archetype &rarr;</a>
  <div class="reveal-panel" aria-label="Reveal your own vibestats">
    <div class="reveal-title">What are you?</div>
    <div class="reveal-copy">Claude Code has already captured your build fingerprint. Reveal yours with the no-npm local helper; raw /insights sessions stay on your machine.</div>
    <div class="reveal-command">
      <code>${esc(INSIGHTS_COMMAND)}</code>
      <button type="button" data-copy="${esc(INSIGHTS_COMMAND)}">Copy</button>
    </div>
    <div class="reveal-command">
      <code>${esc(STATUS_COMMAND)}</code>
      <button type="button" data-copy="${esc(STATUS_COMMAND)}">Copy status</button>
    </div>
    <div class="reveal-command">
      <code>${esc(REVEAL_COMMAND)}</code>
      <button type="button" data-copy="${esc(REVEAL_COMMAND)}">Copy</button>
    </div>
    <div class="reveal-command">
      <code>${esc(CLAIM_COMMAND)}</code>
      <button type="button" data-copy="${esc(CLAIM_COMMAND)}">Copy claim</button>
    </div>
    <div class="reveal-command">
      <code>${esc(INSTALL_CLAUDE_COMMAND)}</code>
      <button type="button" data-copy="${esc(INSTALL_CLAUDE_COMMAND)}">Copy install</button>
    </div>
  </div>
  <script>
    async function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    document.querySelectorAll('[data-copy]').forEach(function(button) {
      button.addEventListener('click', async function() {
        var idle = button.textContent;
        try {
          await copyText(button.getAttribute('data-copy') || '');
          button.textContent = 'Copied';
        } catch(e) {
          button.textContent = 'Copy failed';
        }
        setTimeout(function() { button.textContent = idle; }, 1400);
      });
    });
  </script>
  <div class="footer">vibestats.io</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.status(200).send(html);
}
