import { readSession } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateMethodNotAllowed, sendPrivateNotFound } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { publicScores } from './_lib/public-profile.js';
import { signatureFromUpload } from './_lib/signatures.js';

const ARCHETYPES = {
  orchestrator: { name: 'ORCHESTRATOR', color: '#6B8FFF' },
  shipper: { name: 'SHIPPER', color: '#22c55e' },
  architect: { name: 'ARCHITECT', color: '#3b82f6' },
  debugger: { name: 'DEBUGGER', color: '#f59e0b' },
  polyglot: { name: 'POLYGLOT', color: '#ff79c6' },
  sprinter: { name: 'SPRINTER', color: '#ef4444' },
  deepdiver: { name: 'DEEP DIVER', color: '#3b82f6' },
  builder: { name: 'BUILDER', color: '#22c55e' },
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

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function badgeSvg({ handle, label = 'vibestats profile', archetype = 'vibestats', color = '#6B8FFF', score = null }) {
  const safeHandle = esc(`@${truncate(handle, 20)}`);
  const safeLabel = esc(truncate(label, 25));
  const safeArchetype = esc(archetype);
  const safeColor = esc(color);
  const scoreValue = Number(score);
  const safeScore = Number.isFinite(scoreValue) ? esc(`${Math.max(0, Math.min(100, Math.round(scoreValue)))}%`) : '';
  const footer = safeScore
    ? `${safeScore} Claude Code signal - ${safeArchetype}`
    : `Claude Code signature - ${safeArchetype}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="120" viewBox="0 0 520 120" role="img" aria-label="${safeHandle} ${safeLabel}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0d0d18"/>
      <stop offset="1" stop-color="#151528"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" x2="1">
      <stop offset="0" stop-color="${safeColor}"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="520" height="120" rx="16" fill="url(#bg)"/>
  <rect x="0" y="0" width="520" height="2" fill="url(#accent)"/>
  <rect x="20" y="24" width="74" height="72" rx="12" fill="#10101d" stroke="rgba(255,255,255,0.08)"/>
  <text x="57" y="52" text-anchor="middle" fill="${safeColor}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="800">VS</text>
  <text x="57" y="72" text-anchor="middle" fill="#8888a0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9">vibestats</text>
  <text x="114" y="42" fill="#e0e0e0" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="22" font-weight="800">${safeHandle}</text>
  <text x="114" y="67" fill="${safeColor}" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="18" font-weight="800">${safeLabel}</text>
  ${safeScore ? `<rect x="412" y="25" width="82" height="36" rx="9" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)"/>
  <text x="453" y="49" text-anchor="middle" fill="#ffffff" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="900">${safeScore}</text>` : ''}
  <text x="114" y="88" fill="#8888a0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">${footer}</text>
</svg>`;
}

function sendSvg(res, status, svg, cache = 'public, s-maxage=300, stale-while-revalidate=3600') {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.status(status).send(svg);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendPrivateMethodNotAllowed(res);

  const handle = getHandle(req);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) {
    return sendPrivateNotFound(res);
  }

  try {
    const users = await sql()`
      select id, gh_handle, privacy
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = users[0];
    if (!user) return sendPrivateNotFound(res);

    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) {
      return sendPrivateNotFound(res);
    }

    const uploads = await sql()`
      select archetype, scores, raw_meta
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latest = uploads[0];
    const arch = ARCHETYPES[latest?.archetype] || null;
    const label = signatureFromUpload(latest)?.label || (arch ? arch.name : 'vibestats profile');
    const score = latest?.archetype ? publicScores(latest.scores || {})[latest.archetype] : null;

    return sendSvg(res, 200, badgeSvg({
      handle: user.gh_handle,
      label,
      archetype: arch?.name || 'vibestats',
      color: arch?.color || '#6B8FFF',
      score,
    }), profileShareCacheControl(user));
  } catch (err) {
    console.error('GET /api/badge error:', err);
    return sendSvg(res, 200, badgeSvg({ handle }), profileShareCacheControl(null));
  }
}
