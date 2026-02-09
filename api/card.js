const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', tagline: "You don't code — you conduct.", color: '#6B8FFF', gradient: 'linear-gradient(135deg, #6B8FFF, #a78bfa)' },
  shipper: { name: 'THE SHIPPER', tagline: "Done is better than perfect. You live this.", color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #22d3ee)' },
  architect: { name: 'THE ARCHITECT', tagline: "You read before you write. You plan before you build.", color: '#6B8FFF', gradient: 'linear-gradient(135deg, #6B8FFF, #3b82f6)' },
  debugger: { name: 'THE DEBUGGER', tagline: "You don't guess. You investigate.", color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  polyglot: { name: 'THE POLYGLOT', tagline: "One language is never enough.", color: '#ff79c6', gradient: 'linear-gradient(135deg, #ff79c6, #f59e0b)' },
  sprinter: { name: 'THE SPRINTER', tagline: "Fast, focused, ferocious.", color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #ff79c6)' },
  deepdiver: { name: 'THE DEEP DIVER', tagline: "You go deep, not wide.", color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1e40af)' },
  builder: { name: 'THE BUILDER', tagline: "You build things that didn't exist before.", color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function handler(req, res) {
  const { a: key, n, d, c, l, s, sat, p } = req.query;
  const arch = ARCHETYPES[key] || ARCHETYPES.builder;
  const name = esc(n || 'Vibecoder');
  const days = esc(d || '?');
  const commits = esc(c || '?');
  const langs = esc(l || '?');
  const sessions = esc(s || '?');
  const satisfaction = sat ? esc(sat) + '%' : null;
  const percentile = p ? esc(p) : null;

  const ogParams = new URLSearchParams(req.query).toString();
  const ogImageUrl = `https://vibestats.io/api/og?${ogParams}`;
  const cardUrl = `https://vibestats.io/card?${ogParams}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${name} is ${esc(arch.name)} | vibestats</title>
  <meta name="description" content="${name} — ${esc(arch.tagline)} ${days} days of vibecoding. What's YOUR personality?">
  <meta property="og:title" content="${name} is ${esc(arch.name)} | vibestats">
  <meta property="og:description" content="${esc(arch.tagline)} — ${commits} commits/day across ${langs} languages. ${days} days of vibecoding.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${cardUrl}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${name} is ${esc(arch.name)}">
  <meta name="twitter:description" content="${esc(arch.tagline)} — ${days} days of vibecoding. What's yours?">
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
    .footer {
      margin-top: 24px; font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: var(--text-dim);
    }
    .footer a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">vibecoding personality</div>
    <div class="name">${esc(arch.name)}</div>
    <div class="tagline">"${esc(arch.tagline)}"</div>
    <div class="stats">
      <div class="stat"><div class="stat-val">${sessions}</div><div class="stat-label">sessions</div></div>
      <div class="stat"><div class="stat-val">${commits}/day</div><div class="stat-label">commits</div></div>
      <div class="stat"><div class="stat-val">${langs}</div><div class="stat-label">languages</div></div>
      <div class="stat"><div class="stat-val">${satisfaction || '—'}</div><div class="stat-label">${satisfaction ? 'satisfaction' : ''}</div></div>
    </div>
    <div class="user">${name}</div>
    <div class="period">${days} days of vibecoding</div>
    ${percentile ? `<div class="percentile">top ${percentile}%</div>` : ''}
    <div class="brand">vibestats.io</div>
  </div>
  <a class="cta" href="/">What's YOUR personality? &rarr;</a>
  <div class="footer">made with <a href="https://slashvibe.dev">/vibe</a></div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.status(200).send(html);
}
