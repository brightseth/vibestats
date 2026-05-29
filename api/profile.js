import { readFileSync } from 'node:fs';
import { readSession, originForRequest } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateNotFound } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { metricVisibility, visibleMetrics } from './_lib/public-profile.js';
import { profileShareProof, rarityForSignature } from './_lib/social-proof.js';
import { signatureFromUpload } from './_lib/signatures.js';

const PROFILE_HTML = readFileSync(new URL('../u.html', import.meta.url), 'utf8');

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', short: 'Orchestrator', tagline: "You don't code — you conduct." },
  shipper: { name: 'THE SHIPPER', short: 'Shipper', tagline: 'Done is better than perfect. You live this.' },
  architect: { name: 'THE ARCHITECT', short: 'Architect', tagline: 'You read before you write. You plan before you build.' },
  debugger: { name: 'THE DEBUGGER', short: 'Debugger', tagline: "You don't guess. You investigate." },
  polyglot: { name: 'THE POLYGLOT', short: 'Polyglot', tagline: 'One language is never enough.' },
  sprinter: { name: 'THE SPRINTER', short: 'Sprinter', tagline: 'Fast, focused, ferocious.' },
  deepdiver: { name: 'THE DEEP DIVER', short: 'Deep Diver', tagline: 'You go deep, not wide.' },
  builder: { name: 'THE BUILDER', short: 'Builder', tagline: "You build things that didn't exist before." },
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

function injectProfileMeta(html, meta) {
  const tags = `
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${esc(meta.url)}">
  <meta property="og:image" content="${esc(meta.image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <meta name="twitter:image" content="${esc(meta.image)}">`;

  return html
    .replace('<title>vibestats profile</title>', `<title>${esc(meta.title)}</title>`)
    .replace(
      '<meta name="description" content="A persistent vibestats profile for Claude Code users.">',
      `<meta name="description" content="${esc(meta.description)}">${tags}`,
    );
}

function genericProfilePage(req, handle) {
  const origin = originForRequest(req);
  return injectProfileMeta(PROFILE_HTML, {
    title: `@${handle} on vibestats`,
    description: 'A persistent vibestats profile for Claude Code users.',
    url: `${origin}/u/${encodeURIComponent(handle)}`,
    image: `${origin}/og-card.png`,
  });
}

function sendGenericProfilePage(req, res, status, handle, cacheUser = null) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', profileShareCacheControl(cacheUser));
  return res.status(status).send(genericProfilePage(req, handle));
}

export function profileDescription({ signature = '', arch, metrics = {}, handle, rarity = null, leaderboard = null } = {}) {
  const proof = profileShareProof({ rarity, leaderboard });
  return [
    signature ? `${signature}.` : '',
    arch?.tagline || 'A privacy-preserving Claude Code profile.',
    metrics.days ? `${metrics.days} days of Claude Code history.` : 'A privacy-preserving Claude Code profile.',
    proof ? `${proof}.` : '',
    `Compare your vibecoding personality with @${handle}.`,
  ].filter(Boolean).join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const handle = getHandle(req);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) return res.status(404).send('Not found');

  try {
    const users = await sql()`
      select id, gh_handle, privacy
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = users[0];
    if (!user) return sendGenericProfilePage(req, res, 404, handle);

    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) {
      return sendPrivateNotFound(res);
    }

    const uploads = await sql()`
      select archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latest = uploads[0];
    if (!latest) {
      return sendGenericProfilePage(req, res, 200, user.gh_handle, user);
    }

    const arch = ARCHETYPES[latest.archetype] || ARCHETYPES.builder;
    const settingsRows = await sql()`
      select show_raw_counts, show_languages
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    const visibility = metricVisibility(settingsRows[0] || {}, { isOwner: false });
    const metrics = visibleMetrics(latest.metrics || {}, visibility);
    const percentiles = latest.scores?._percentiles || {};
    const signature = signatureFromUpload(latest);
    const signatureLabel = signature?.label || '';
    const [rarity, leaderboard] = await Promise.all([
      rarityForSignature(signature),
      weeklyLeaderboardRank(user, latest),
    ]);
    const origin = originForRequest(req);
    const imageParams = new URLSearchParams({
      a: latest.archetype,
      n: `@${user.gh_handle}`,
      d: String(metrics.days || '?'),
      c: String(metrics.commitsPerDay || '?'),
      l: String(metrics.languages || '?'),
      s: String(metrics.sessions || '?'),
    });
    if (percentiles[latest.archetype]) imageParams.set('p', String(percentiles[latest.archetype]));

    const html = injectProfileMeta(PROFILE_HTML, {
      title: `@${user.gh_handle} is ${signatureLabel || arch.name} | vibestats`,
      description: profileDescription({
        signature: signatureLabel,
        arch,
        metrics,
        handle: user.gh_handle,
        rarity,
        leaderboard,
      }),
      url: `${origin}/u/${encodeURIComponent(user.gh_handle)}`,
      image: `${origin}/api/og?${imageParams.toString()}`,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', profileShareCacheControl(user));
    res.status(200).send(html);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    sendGenericProfilePage(req, res, 200, handle);
  }
}
