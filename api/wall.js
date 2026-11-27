import { sql } from './_lib/db.js';
import { archetypeMap } from '../lib/archetype-identity.js';
import { signatureFromUpload } from './_lib/signatures.js';

// The badge wall: every PUBLIC-privacy profile's badge, newest first, plus the
// "add yours" loop. PRIVACY RULE: public profiles ONLY — unlisted/private users
// must never appear here (the wall is a directory surface; unlisted means
// link-shareable, not listed).
const ARCHETYPES = archetypeMap(['name', 'short']);

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end('Method Not Allowed');
  }
  let entries = [];
  try {
    const rows = await sql()`
      select u.gh_handle, up.archetype, up.raw_meta, up.uploaded_at
      from users u
      join lateral (
        select archetype, raw_meta, uploaded_at from uploads
        where user_id = u.id order by uploaded_at desc limit 1
      ) up on true
      where u.privacy = 'public'
      order by up.uploaded_at desc
      limit 200
    `;
    entries = rows.filter((r) => ARCHETYPES[r.archetype]);
  } catch (err) {
    console.error('GET /wall error:', err);
    // graceful: render the empty wall + CTA
  }

  const cards = entries.map((r) => {
    const signature = signatureFromUpload(r)?.label || ARCHETYPES[r.archetype].short;
    return `<a class="cell" href="/u/${encodeURIComponent(r.gh_handle)}">
      <img src="/u/${encodeURIComponent(r.gh_handle)}/badge.svg" alt="@${esc(r.gh_handle)} — ${esc(signature)}" loading="lazy" width="320" height="64">
      <span>@${esc(r.gh_handle)}</span>
    </a>`;
  }).join('\n') || '<p class="empty">The wall is fresh. Claim a public profile and be first.</p>';

  const badgeSnippet = '[![vibestats](https://vibestats.io/u/YOURHANDLE/badge.svg)](https://vibestats.io/?compareTo=YOURHANDLE)';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Badge Wall | vibestats</title>
<meta name="description" content="Every public vibestats builder, one wall. Claim your Claude Code archetype and add your badge.">
<meta property="og:title" content="The vibestats Badge Wall">
<meta property="og:description" content="Every public Claude Code build identity, one wall. Add yours.">
<meta property="og:image" content="https://vibestats.io/og-card.png">
<style>
  body{margin:0;background:#06060a;color:#eef1f7;font:16px/1.5 system-ui,sans-serif;padding:34px 16px 80px}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px}.sub{color:#9aa3b2;font-size:14px;margin:0 0 26px}
  .grid{display:flex;flex-wrap:wrap;gap:14px}
  .cell{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:#9aa3b2;font-family:ui-monospace,monospace;font-size:12px}
  .cell img{border-radius:10px;border:1px solid #242a3d;background:#0b0d14}
  .empty{color:#9aa3b2}
  .add{margin-top:38px;background:#141826;border:1px solid #242a3d;border-radius:14px;padding:18px}
  .add h2{font-size:16px;margin:0 0 8px}
  code{display:block;background:#0a0c14;border:1px solid #242a3d;border-radius:8px;padding:10px;font-size:12px;overflow-x:auto;color:#dbe2f0;margin:8px 0}
  a{color:#8aadff}
  .foot{color:#9aa3b2;font-size:12px;margin-top:26px}
</style></head><body><div class="wrap">
  <h1>🧱 The Badge Wall</h1>
  <p class="sub">Every public vibestats builder. Public profiles only — unlisted stays unlisted.</p>
  <div class="grid">${cards}</div>
  <div class="add">
    <h2>Add yours</h2>
    <p style="margin:0 0 4px;font-size:14px;color:#9aa3b2">1. Reveal on desktop: <code style="display:inline;padding:2px 6px">/insights</code> then the helper at <a href="/">vibestats.io</a> · 2. Claim with GitHub + set profile public · 3. Paste in your README:</p>
    <code>${esc(badgeSnippet)}</code>
  </div>
  <p class="foot">Badges link to a live pairing — visitors see how they'd build with you. <a href="/">vibestats.io</a></p>
</div></body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.end(html);
}
