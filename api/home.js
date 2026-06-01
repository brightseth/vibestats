import { readFileSync } from 'node:fs';
import { archetypeMap } from '../lib/archetype-identity.js';
import { originForRequest } from './_lib/auth.js';
import { profileShareCacheControl, sendPrivateMethodNotAllowed } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { metricVisibility, publicActivity, visibleMetrics } from './_lib/public-profile.js';
import { profileShareProof, rarityForSignature } from './_lib/social-proof.js';
import { signatureFromUpload } from './_lib/signatures.js';
import { attributionRefFromQuery, recordViralEvent, sourceRefForProfile } from './_lib/viral-events.js';

const HOME_HTML = readFileSync(new URL('../home.html', import.meta.url), 'utf8');
const HANDLE_RE = /^[a-zA-Z0-9-]{1,39}$/;

const ARCHETYPES = archetypeMap(['name', 'short']);

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function cleanHandle(value) {
  return firstParam(value).replace(/^@/, '');
}

function cleanArchetype(value) {
  const raw = firstParam(value).toLowerCase();
  return ARCHETYPES[raw] ? raw : '';
}

function metricValue(metrics, key) {
  const value = metrics?.[key];
  return Number.isFinite(Number(value)) ? String(value) : '?';
}

function compareFirstUrl(origin, { handle = '', archetype = '' } = {}) {
  const params = new URLSearchParams();
  if (handle) params.set('compareTo', handle);
  if (archetype) params.set('compareArchetype', archetype);
  if (handle) params.set('ref', `u:${handle}`);
  const query = params.toString();
  return query ? `${origin}/?${query}` : `${origin}/`;
}

function genericHomeMetadata(origin) {
  return {
    title: "What's your vibecoding personality? | vibestats",
    description: 'Claude Code already knows how you build. Reveal your archetype: The Orchestrator, The Shipper, The Architect, The Debugger...',
    url: `${origin}/`,
    image: `${origin}/og-card.png`,
  };
}

export function archetypeInviteMetadata(archetype, origin = 'https://vibestats.io') {
  const type = cleanArchetype(archetype);
  if (!type) return genericHomeMetadata(origin);
  const arch = ARCHETYPES[type];
  const params = new URLSearchParams({
    a: type,
    n: arch.short,
    d: '?',
    c: '?',
    l: '?',
    s: '?',
  });

  return {
    title: `Compare with a ${arch.short} | vibestats`,
    description: `Claude Code already knows how you build. Run /insights, check status, reveal your vibecoding personality, and see how you pair with ${arch.name}.`,
    url: compareFirstUrl(origin, { archetype: type }),
    image: `${origin}/api/og?${params.toString()}`,
  };
}

export function homeMetadataForInvite({
  handle = '',
  archetype = '',
  signature = '',
  rarity = null,
  leaderboard = null,
  metrics = {},
  activity = {},
} = {}, origin = 'https://vibestats.io') {
  const type = cleanArchetype(archetype);
  if (!handle || !type) return archetypeInviteMetadata(type, origin);

  const arch = ARCHETYPES[type];
  const profileLabel = signature || arch.short;
  const proof = profileShareProof({ rarity, leaderboard });
  const activityProof = activity.days && activity.days !== 'fresh profile' ? activity.days : '';
  const params = new URLSearchParams({
    a: type,
    n: `@${handle}`,
    d: metricValue(metrics, 'days'),
    c: metricValue(metrics, 'commitsPerDay'),
    l: metricValue(metrics, 'languages'),
    s: metricValue(metrics, 'sessions'),
  });

  return {
    title: `See how you'd pair with @${handle} | vibestats`,
    description: [
      `@${handle} is ${profileLabel}.`,
      proof ? `${proof}.` : '',
      activityProof ? `${activityProof}.` : '',
      `Claude Code already knows how you build. Run /insights, check status, then reveal yours against @${handle}.`,
    ].filter(Boolean).join(' '),
    url: compareFirstUrl(origin, { handle, archetype: type }),
    image: `${origin}/api/og?${params.toString()}`,
  };
}

function injectHomeMeta(html, meta) {
  const twitterTags = `
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <meta name="twitter:image" content="${esc(meta.image)}">`;

  return html
    .replace('<title>Reveal Your Vibecoding Personality | vibestats</title>', `<title>${esc(meta.title)}</title>`)
    .replace(
      '<meta name="description" content="Claude Code already knows how you build. Run /insights, check status, reveal your vibecoding personality, and compare with other Claude Code users.">',
      `<meta name="description" content="${esc(meta.description)}">`,
    )
    .replace('<meta property="og:title" content="What\'s your vibecoding personality? | vibestats">', `<meta property="og:title" content="${esc(meta.title)}">`)
    .replace('<meta property="og:description" content="Claude Code already knows how you build. Reveal your archetype: The Orchestrator, The Shipper, The Architect, The Debugger...">', `<meta property="og:description" content="${esc(meta.description)}">`)
    .replace('<meta property="og:url" content="https://vibestats.io">', `<meta property="og:url" content="${esc(meta.url)}">`)
    .replace('<meta property="og:image" content="https://vibestats.io/og-card.png">', `<meta property="og:image" content="${esc(meta.image)}">`)
    .replace(
      '<meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="https://vibestats.io/og-card.png">',
      twitterTags,
    );
}

async function resolveInviteMetadata(req, origin) {
  const requestedArchetype = cleanArchetype(req.query?.compareArchetype);
  const handle = cleanHandle(req.query?.compareTo);
  if (!handle) {
    return { meta: archetypeInviteMetadata(requestedArchetype, origin), cacheUser: null };
  }
  if (!HANDLE_RE.test(handle)) {
    return { meta: archetypeInviteMetadata(requestedArchetype, origin), cacheUser: null };
  }

  const users = await sql()`
    select id, gh_handle, privacy
    from users
    where lower(gh_handle) = lower(${handle})
    limit 1
  `;
  const user = users[0];
  if (!user || user.privacy === 'private') {
    return { meta: archetypeInviteMetadata(requestedArchetype, origin), cacheUser: null };
  }

  const uploads = await sql()`
    select archetype, scores, metrics, raw_meta, uploaded_at
    from uploads
    where user_id = ${user.id}
    order by uploaded_at desc
    limit 1
  `;
  const latest = uploads[0];
  if (!latest?.archetype || !ARCHETYPES[latest.archetype]) {
    return { meta: archetypeInviteMetadata(requestedArchetype, origin), cacheUser: user };
  }

  const settingsRows = await sql()`
    select show_raw_counts, show_languages
    from profile_settings
    where user_id = ${user.id}
    limit 1
  `;
  const visibility = metricVisibility(settingsRows[0] || {}, { isOwner: false });
  const metrics = visibleMetrics(latest.metrics || {}, visibility);
  const signature = signatureFromUpload(latest);
  const [rarity, leaderboard] = await Promise.all([
    rarityForSignature(signature),
    weeklyLeaderboardRank(user, latest),
  ]);

  return {
    meta: homeMetadataForInvite({
      handle: user.gh_handle,
      archetype: latest.archetype,
      signature: signature?.label || '',
      rarity,
      leaderboard,
      metrics,
      activity: publicActivity(latest.metrics || {}),
    }, origin),
    cacheUser: user,
  };
}

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return sendPrivateMethodNotAllowed(res, ['GET', 'HEAD']);

  const origin = originForRequest(req);
  let meta = genericHomeMetadata(origin);
  let cacheUser = null;

  try {
    const resolved = await resolveInviteMetadata(req, origin);
    meta = resolved.meta;
    cacheUser = resolved.cacheUser;
    if (req.method === 'GET' && (req.query?.compareArchetype || req.query?.compareTo || req.query?.ref)) {
      const handle = cleanHandle(req.query?.compareTo);
      const archetype = cleanArchetype(req.query?.compareArchetype);
      try {
        await recordViralEvent({
          eventName: 'compare_started',
          sourceRef: attributionRefFromQuery(req.query, handle ? sourceRefForProfile(handle) : null),
          sourceSurface: 'homepage',
          profileHandle: HANDLE_RE.test(handle) ? handle : null,
          archetype,
        });
      } catch (eventErr) {
        console.error('GET /api/home viral event error:', eventErr);
      }
    }
  } catch (err) {
    console.error('GET /api/home metadata error:', err);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheUser ? profileShareCacheControl(cacheUser) : 'private, no-store');
  if (req.method === 'HEAD') return res.status(200).end();
  res.status(200).send(injectHomeMeta(HOME_HTML, meta));
}
