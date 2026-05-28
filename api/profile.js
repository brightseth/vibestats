import { readFileSync } from 'node:fs';
import { readSession, originForRequest } from './_lib/auth.js';
import { sql } from './_lib/db.js';

const PROFILE_HTML = readFileSync(new URL('../u.html', import.meta.url), 'utf8');

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', tagline: "You don't code — you conduct." },
  shipper: { name: 'THE SHIPPER', tagline: 'Done is better than perfect. You live this.' },
  architect: { name: 'THE ARCHITECT', tagline: 'You read before you write. You plan before you build.' },
  debugger: { name: 'THE DEBUGGER', tagline: "You don't guess. You investigate." },
  polyglot: { name: 'THE POLYGLOT', tagline: 'One language is never enough.' },
  sprinter: { name: 'THE SPRINTER', tagline: 'Fast, focused, ferocious.' },
  deepdiver: { name: 'THE DEEP DIVER', tagline: 'You go deep, not wide.' },
  builder: { name: 'THE BUILDER', tagline: "You build things that didn't exist before." },
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
    if (!user) return res.status(404).send(genericProfilePage(req, handle));

    const session = readSession(req);
    if (user.privacy === 'private' && session?.sub !== user.id) {
      return res.status(404).send('Not found');
    }

    const uploads = await sql()`
      select archetype, scores, metrics, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latest = uploads[0];
    if (!latest) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).send(genericProfilePage(req, user.gh_handle));
    }

    const arch = ARCHETYPES[latest.archetype] || ARCHETYPES.builder;
    const metrics = latest.metrics || {};
    const percentiles = latest.scores?._percentiles || {};
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
      title: `@${user.gh_handle} is ${arch.name} | vibestats`,
      description: `${arch.tagline} ${metrics.days || '?'} days of Claude Code history. Compare your vibecoding personality with @${user.gh_handle}.`,
      url: `${origin}/u/${encodeURIComponent(user.gh_handle)}`,
      image: `${origin}/api/og?${imageParams.toString()}`,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(html);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).send(genericProfilePage(req, handle));
  }
}
