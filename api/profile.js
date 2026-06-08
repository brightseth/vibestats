import { readFileSync } from 'node:fs';
import { archetypeMap } from '../lib/archetype-identity.js';
import { readSession, originForRequest } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateMethodNotAllowed, sendPrivateNotFound } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { metricVisibility, visibleMetrics } from './_lib/public-profile.js';
import { profileShareProof, rarityForSignature } from './_lib/social-proof.js';
import { signatureFromUpload } from './_lib/signatures.js';
import { attributionRefFromQuery, recordViralEvent, sourceRefForProfile } from './_lib/viral-events.js';

const PROFILE_HTML = readFileSync(new URL('../u.html', import.meta.url), 'utf8');

const ARCHETYPES = archetypeMap(['name', 'short', 'tagline']);

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

function queryValue(req, key) {
  const value = req.query?.[key];
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function decodeLoose(value) {
  let text = String(value || '').trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text;
}

function embeddedParams(rawHandle) {
  const text = decodeLoose(rawHandle);
  const marker = text.indexOf('?');
  return marker >= 0 ? new URLSearchParams(text.slice(marker + 1)) : new URLSearchParams();
}

function recoveredComparePath(req, rawHandle) {
  const embedded = embeddedParams(rawHandle);
  const compareTo = queryValue(req, 'compareTo') || embedded.get('compareTo') || '';
  const compareArchetype = queryValue(req, 'compareArchetype') || embedded.get('compareArchetype') || '';
  const params = new URLSearchParams();
  if (/^[a-zA-Z0-9-]{1,39}$/.test(compareTo)) params.set('compareTo', compareTo);
  if (ARCHETYPES[compareArchetype]) params.set('compareArchetype', compareArchetype);
  const query = params.toString();
  return query ? `/?${query}` : '';
}

function pastedProfileRecoveryPath(req, rawHandle) {
  const text = decodeLoose(rawHandle);
  if (!/[\s/]|https?:/i.test(text)) return '';
  const match = text.match(/^([a-zA-Z0-9-]{1,39})(?=$|[\s/])/);
  if (!match) return '';
  return recoveredComparePath(req, rawHandle) || `/u/${encodeURIComponent(match[1])}`;
}

function redirectNoStore(res, path) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (typeof res.redirect === 'function') return res.redirect(302, path);
  res.setHeader('Location', path);
  return res.status(302).send('');
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
  if (req.method !== 'GET') return sendPrivateMethodNotAllowed(res);

  const rawHandle = getHandle(req);
  const recoveryPath = pastedProfileRecoveryPath(req, rawHandle);
  if (recoveryPath) return redirectNoStore(res, recoveryPath);

  const handle = rawHandle;
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) return sendPrivateNotFound(res);

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

    if (!isOwner) {
      try {
        await recordViralEvent({
          eventName: 'profile_view',
          sourceRef: attributionRefFromQuery(req.query, sourceRefForProfile(user.gh_handle)),
          sourceSurface: 'profile',
          profileHandle: user.gh_handle,
          archetype: latest.archetype,
        });
      } catch (eventErr) {
        console.error('GET /api/profile viral event error:', eventErr);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', profileShareCacheControl(user));
    res.status(200).send(html);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    sendGenericProfilePage(req, res, 200, handle);
  }
}
