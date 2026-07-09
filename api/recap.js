import { readFileSync } from 'node:fs';
import { archetypeMap } from '../lib/archetype-identity.js';
import { originForRequest, readSession } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateMethodNotAllowed, sendPrivateNotFound } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { profileShareProof, rarityForSignature } from './_lib/social-proof.js';
import { signatureFromUpload } from './_lib/signatures.js';

const RECAP_HTML = readFileSync(new URL('../recap.html', import.meta.url), 'utf8');

const ARCHETYPES = archetypeMap(['name', 'short']);

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

function injectRecapMeta(html, meta) {
  const tags = `
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(meta.url)}">
  <meta property="og:image" content="${esc(meta.image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <meta name="twitter:image" content="${esc(meta.image)}">`;

  return html
    .replace('<title>vibestats recap</title>', `<title>${esc(meta.title)}</title>`)
    .replace(
      '<meta name="description" content="A privacy-preserving weekly recap for a Claude Code vibestats profile.">',
      `<meta name="description" content="${esc(meta.description)}">${tags}`,
    );
}

function genericRecap(req, handle) {
  const origin = originForRequest(req);
  return injectRecapMeta(RECAP_HTML, {
    title: `@${handle} vibestats recap`,
    description: 'A privacy-preserving weekly recap for a Claude Code vibestats profile.',
    url: `${origin}/u/${encodeURIComponent(handle)}/recap`,
    image: `${origin}/og-card.png`,
  });
}

export function recapDescription({ handle, signature = '', arch, rarity = null, leaderboard = null } = {}) {
  const proof = profileShareProof({ rarity, leaderboard });
  return [
    signature ? `${signature}.` : `${arch?.name || 'Claude Code'} recap.`,
    proof ? `${proof}.` : '',
    `See how you'd pair with @${handle}.`,
    'Raw insights stay local; this recap uses only derived profile signals.',
  ].filter(Boolean).join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendPrivateMethodNotAllowed(res);

  const handle = getHandle(req);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) return sendPrivateNotFound(res);

  try {
    const users = await sql()`
      select id, gh_handle, privacy
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = users[0];
    if (!user) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', profileShareCacheControl(null));
      return res.status(404).send(genericRecap(req, handle));
    }
    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) return sendPrivateNotFound(res);

    const uploads = await sql()`
      select archetype, scores, raw_meta
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 1
    `;
    const latest = uploads[0];
    if (!latest) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', profileShareCacheControl(user));
      return res.status(200).send(genericRecap(req, user.gh_handle));
    }

    const arch = ARCHETYPES[latest.archetype] || ARCHETYPES.builder;
    const signature = signatureFromUpload(latest);
    const [rarity, leaderboard] = await Promise.all([
      rarityForSignature(signature),
      weeklyLeaderboardRank(user, latest),
    ]);
    const origin = originForRequest(req);
    const imageParams = new URLSearchParams({
      a: latest.archetype,
      n: `@${user.gh_handle}`,
      d: '?',
      c: '?',
      l: '?',
      s: '?',
    });

    const html = injectRecapMeta(RECAP_HTML, {
      title: `@${user.gh_handle} recap: ${signature?.label || arch.short} | vibestats`,
      description: recapDescription({
        handle: user.gh_handle,
        signature: signature?.label || '',
        arch,
        rarity,
        leaderboard,
      }),
      url: `${origin}/u/${encodeURIComponent(user.gh_handle)}/recap`,
      image: `${origin}/api/og?${imageParams.toString()}`,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', profileShareCacheControl(user));
    res.status(200).send(html);
  } catch (err) {
    console.error('GET /api/recap error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', profileShareCacheControl(null));
    res.status(200).send(genericRecap(req, handle));
  }
}
