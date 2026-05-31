import { originForRequest } from './_lib/auth.js';
import { archetypeMap } from '../lib/archetype-identity.js';
import { NO_STORE_HEADERS, methodNotAllowed, safeErrorMessage } from './_lib/http.js';
import { getRevealSnapshot } from './_lib/reveal-snapshots.js';

const ARCHETYPES = archetypeMap(['name', 'short', 'color', 'gradient']);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function fmt(value, fallback = '?') {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n).toLocaleString();
}

function dateLabel(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return '30 days after creation';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreRows(scores = {}, primary) {
  return Object.entries(scores)
    .filter(([key, value]) => ARCHETYPES[key] && Number.isFinite(Number(value)))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5)
    .map(([key, value]) => {
      const pct = Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
      const arch = ARCHETYPES[key] || ARCHETYPES.builder;
      return `
        <div class="score-row">
          <div class="score-name">${esc(arch.short)}${key === primary ? ' primary' : ''}</div>
          <div class="score-track"><div style="width:${pct}%;background:${arch.gradient}"></div></div>
          <div class="score-val">${pct}</div>
        </div>`;
    }).join('');
}

function momentRows(moments = []) {
  return moments.slice(0, 3).map((moment) => `
    <div class="moment">
      <div>${esc(moment.label)}</div>
      <strong>${esc(moment.value)}</strong>
    </div>
  `).join('');
}

function setRevealHeaders(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
}

export function revealMetadata(snapshot, origin = 'https://vibestats.io') {
  const arch = ARCHETYPES[snapshot?.archetype] || ARCHETYPES.builder;
  const signature = snapshot?.raw_meta?.signature || `anonymous ${arch.short}`;
  const params = new URLSearchParams({
    a: snapshot?.archetype || 'builder',
    n: 'Anonymous',
    d: snapshot?.metrics?.days ?? '?',
    c: snapshot?.metrics?.commitsPerDay ?? '?',
    l: snapshot?.metrics?.languages ?? '?',
    s: snapshot?.metrics?.sessions ?? '?',
  });
  return {
    title: `Anonymous ${arch.short} reveal | vibestats`,
    description: `${signature}. Shared from a local Claude Code reveal. Raw /insights stayed local; this link stores derived metrics only.`,
    url: `${origin.replace(/\/$/, '')}/r/${encodeURIComponent(snapshot.slug)}`,
    image: `${origin.replace(/\/$/, '')}/api/og?${params.toString()}`,
  };
}

function renderRevealHtml(snapshot, origin) {
  const arch = ARCHETYPES[snapshot.archetype] || ARCHETYPES.builder;
  const metrics = snapshot.metrics || {};
  const signature = snapshot.raw_meta?.signature || `anonymous ${arch.short}`;
  const moments = momentRows(snapshot.raw_meta?.moments || []);
  const scores = scoreRows(snapshot.scores || {}, snapshot.archetype);
  const meta = revealMetadata(snapshot, origin);
  const expiry = dateLabel(snapshot.expires_at);
  const compareUrl = `/?compareArchetype=${encodeURIComponent(snapshot.archetype)}`;
  const revealCommand = 'curl -fsSL https://vibestats.io/cli.sh | sh -s --';
  const shareText = `Anonymous vibestats reveal: ${signature}. Raw /insights stayed local. What are you?`;
  const xUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({ text: shareText, url: meta.url }).toString()}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(meta.url)}">
  <meta property="og:image" content="${esc(meta.image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <meta name="twitter:image" content="${esc(meta.image)}">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <style>
    :root { --bg:#06060a; --panel:#0d0d16; --line:#272738; --text:#f4f7fb; --muted:#9ca3af; --dim:#606276; --accent:#6B8FFF; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif; color:var(--text); background:radial-gradient(circle at 50% 0%, ${arch.color}26, transparent 42%), var(--bg); }
    main { width:min(1080px, 100%); margin:0 auto; padding:32px 18px 56px; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:30px; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--muted); }
    .top a { color:#dbe7ff; text-decoration:none; }
    .hero { display:grid; grid-template-columns:minmax(0, 1.08fr) minmax(320px, .92fr); gap:28px; align-items:center; }
    .eyebrow { font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); margin-bottom:14px; }
    h1 { margin:0 0 12px; font-size:clamp(46px, 9vw, 96px); line-height:.9; letter-spacing:0; background:${arch.gradient}; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .signature { font-size:clamp(22px, 4vw, 36px); line-height:1.08; font-weight:850; margin-bottom:18px; }
    .copy { max-width:620px; color:var(--muted); font-size:17px; line-height:1.6; }
    .privacy { margin-top:22px; padding:12px 14px; border:1px solid rgba(255,255,255,.09); border-radius:8px; color:#dbe7ff; background:rgba(255,255,255,.035); font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.5; }
    .card { border:1px solid ${arch.color}55; border-radius:8px; background:linear-gradient(145deg, rgba(13,13,24,.96), rgba(18,18,31,.9)); padding:24px; box-shadow:0 30px 90px rgba(0,0,0,.35); }
    .card-title { font-family:'JetBrains Mono',monospace; color:var(--dim); text-transform:uppercase; letter-spacing:.14em; font-size:11px; margin-bottom:12px; }
    .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:20px 0; }
    .stat { border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:14px 12px; background:rgba(255,255,255,.025); }
    .stat strong { display:block; font-family:'JetBrains Mono',monospace; font-size:24px; color:#fff; }
    .stat span { color:var(--dim); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
    .moment { display:flex; justify-content:space-between; gap:14px; padding:12px 0; border-top:1px solid rgba(255,255,255,.07); color:var(--muted); font-size:13px; }
    .moment strong { color:#fff; text-align:right; }
    .score-row { display:grid; grid-template-columns:94px minmax(0,1fr) 34px; gap:10px; align-items:center; margin:10px 0; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); }
    .score-track { height:7px; border-radius:999px; background:rgba(255,255,255,.07); overflow:hidden; }
    .score-track div { height:100%; border-radius:999px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:26px; }
    .btn { min-height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0 16px; border-radius:8px; border:1px solid rgba(107,143,255,.36); color:#dbe7ff; text-decoration:none; background:rgba(107,143,255,.12); font-family:'JetBrains Mono',monospace; font-size:13px; cursor:pointer; }
    .btn.primary { color:#fff; background:linear-gradient(135deg, rgba(107,143,255,.42), rgba(167,139,250,.28)); border-color:rgba(107,143,255,.68); }
    .terminal { margin-top:32px; border:1px solid rgba(255,255,255,.08); border-radius:8px; background:rgba(255,255,255,.025); padding:16px; }
    .terminal-title { font-weight:800; margin-bottom:8px; }
    .mobile-note { margin-top:12px; color:#9aa3b8; font-size:13px; line-height:1.5; }
    code { font-family:'JetBrains Mono',monospace; color:#dbe7ff; overflow-wrap:anywhere; }
    @media (max-width:760px) { .hero { grid-template-columns:1fr; } .top { align-items:flex-start; flex-direction:column; } .actions .btn { width:100%; } }
  </style>
</head>
<body>
  <main>
    <div class="top"><a href="/">vibestats</a><span>anonymous unlisted reveal</span></div>
    <section class="hero">
      <div>
        <div class="eyebrow">shared Claude Code build profile</div>
        <h1>${esc(arch.name)}</h1>
        <div class="signature">${esc(signature)}</div>
        <p class="copy">Someone shared their vibecoding profile without attaching a name or GitHub handle. This is a hosted snapshot of derived metrics only, created from a local reveal.</p>
        <div class="privacy">Public unlisted link; expires ${esc(expiry)}. Raw /insights stayed local. No prompts, project paths, session ids, or free text are stored in this link.</div>
        <div class="actions">
          <a class="btn primary" href="${esc(compareUrl)}">Reveal yours to compare</a>
          <button class="btn" type="button" data-copy="${esc(meta.url)}">Copy link</button>
          <a class="btn" href="${esc(xUrl)}" target="_blank" rel="noopener">Share on X</a>
        </div>
      </div>
      <div class="card">
        <div class="card-title">anonymous reveal card</div>
        <div class="stats">
          <div class="stat"><strong>${fmt(metrics.sessions)}</strong><span>sessions</span></div>
          <div class="stat"><strong>${fmt(metrics.commitsPerDay)}/day</strong><span>commits</span></div>
          <div class="stat"><strong>${fmt(metrics.languages)}</strong><span>languages</span></div>
          <div class="stat"><strong>${fmt(metrics.msgsPerSession)}</strong><span>msgs/session</span></div>
        </div>
        ${moments || '<div class="moment"><div>Shared signal</div><strong>derived-only</strong></div>'}
        <div style="height:14px"></div>
        ${scores}
      </div>
    </section>
    <section class="terminal">
      <div class="terminal-title">Reveal yours locally</div>
      <p class="copy" style="font-size:14px;margin:0 0 12px">Run <code>/insights</code> in Claude Code, then reveal with the terminal helper. You can share anonymously before claiming any identity.</p>
      <code>${esc(revealCommand)}</code>
      <div class="mobile-note">On mobile? Save this command for your desktop Claude Code machine. Reveal cannot run on a phone yet because the signal lives in your local <code>~/.claude</code> data.</div>
      <div class="actions" style="margin-top:14px">
        <button class="btn" type="button" data-copy="${esc(revealCommand)}">Copy command for desktop</button>
        <a class="btn" href="/">Open vibestats</a>
      </div>
    </section>
  </main>
  <script>
    async function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
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
        } catch (e) {
          button.textContent = 'Copy failed';
        }
        setTimeout(function() { button.textContent = idle; }, 1400);
      });
    });
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return methodNotAllowed(res, ['GET', 'HEAD'], NO_STORE_HEADERS);

  try {
    const origin = originForRequest(req);
    const snapshot = await getRevealSnapshot(firstParam(req.query?.slug), { origin });
    setRevealHeaders(res);
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(renderRevealHtml(snapshot, origin));
  } catch (err) {
    setRevealHeaders(res);
    if (req.method === 'HEAD') return res.status(err.statusCode || 500).end();
    const message = safeErrorMessage(err, 'Reveal link failed');
    return res.status(err.statusCode || 500).send(`<!doctype html><html><head><meta charset="utf-8"><title>Reveal unavailable | vibestats</title></head><body><h1>${esc(message)}</h1><p>This anonymous reveal link may have expired. Raw /insights data was not stored here.</p><p><a href="/">Reveal yours</a></p></body></html>`);
  }
}
