import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readSession, originForRequest } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { weeklyLeaderboardRank } from './_lib/leaderboard-rank.js';
import { profileShareProof, rarityForSignature } from './_lib/social-proof.js';
import { signatureFromUpload } from './_lib/signatures.js';

const COMPARE_HTML = readFileSync(new URL('../compare-template.html', import.meta.url), 'utf8');
const COMPAT_SOURCE = readFileSync(new URL('../lib/compat.js', import.meta.url), 'utf8');
const compatContext = { window: {} };
runInNewContext(COMPAT_SOURCE, compatContext);
const VibeCompat = compatContext.window.VibeCompat;

const HANDLE_RE = /^[a-zA-Z0-9-]{1,39}$/;

const ARCHETYPES = {
  orchestrator: { name: 'THE ORCHESTRATOR', short: 'Orchestrator' },
  shipper: { name: 'THE SHIPPER', short: 'Shipper' },
  architect: { name: 'THE ARCHITECT', short: 'Architect' },
  debugger: { name: 'THE DEBUGGER', short: 'Debugger' },
  polyglot: { name: 'THE POLYGLOT', short: 'Polyglot' },
  sprinter: { name: 'THE SPRINTER', short: 'Sprinter' },
  deepdiver: { name: 'THE DEEP DIVER', short: 'Deep Diver' },
  builder: { name: 'THE BUILDER', short: 'Builder' },
};

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim().replace(/^@/, '');
}

function subjectParam(subject) {
  return subject?.handle || subject?.type || '';
}

function subjectLabel(subject) {
  if (subject?.handle) return `@${subject.handle}`;
  return ARCHETYPES[subject?.type]?.short || 'Claude Code profile';
}

function subjectProof(subject) {
  if (!subject?.handle) return '';
  return [
    subject.signature,
    profileShareProof({ rarity: subject.rarity, leaderboard: subject.leaderboard }),
  ].filter(Boolean).join(' / ');
}

function canonicalCompareUrl(aSubject, bSubject, origin) {
  if (aSubject?.handle && bSubject?.handle) {
    return `${origin}/u/${encodeURIComponent(bSubject.handle)}/pair/${encodeURIComponent(aSubject.handle)}`;
  }
  const query = new URLSearchParams({
    a: subjectParam(aSubject),
    b: subjectParam(bSubject),
  });
  return `${origin}/compare?${query.toString()}`;
}

function genericMeta(origin) {
  return {
    title: 'Compare Vibecoding Personalities | vibestats',
    description: 'Compare your vibecoding personality with a friend. See your chemistry, dynamic, and pairing name.',
    url: `${origin}/compare`,
    image: `${origin}/og-card.png`,
  };
}

export function compareMetadataForSubjects(aSubject, bSubject, origin = 'https://vibestats.io') {
  if (!aSubject?.type || !bSubject?.type || !ARCHETYPES[aSubject.type] || !ARCHETYPES[bSubject.type]) {
    return genericMeta(origin);
  }

  const pairing = VibeCompat.getPairing(aSubject.type, bSubject.type);
  const aLabel = subjectLabel(aSubject);
  const bLabel = subjectLabel(bSubject);
  const aProof = subjectProof(aSubject);
  const bProof = subjectProof(bSubject);
  const primaryImageSubject = aSubject.handle ? aSubject : bSubject.handle ? bSubject : aSubject;
  const params = new URLSearchParams({
    a: primaryImageSubject.type,
    n: subjectLabel(primaryImageSubject),
  });

  return {
    title: `${aLabel} + ${bLabel} = ${pairing.name} | vibestats`,
    description: [
      `${pairing.vibe}.`,
      pairing.dynamic,
      aProof || bProof ? `${[aProof, bProof].filter(Boolean).join(' / ')}.` : '',
      'Open the pairing, then claim yours with one Claude Code insights upload.',
    ].filter(Boolean).join(' '),
    url: canonicalCompareUrl(aSubject, bSubject, origin),
    image: `${origin}/api/og?${params.toString()}`,
  };
}

function injectCompareMeta(html, meta) {
  const twitterTags = `
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.description)}">
  <meta name="twitter:image" content="${esc(meta.image)}">`;

  return html
    .replace('<title>Compare Vibecoding Personalities | vibestats</title>', `<title>${esc(meta.title)}</title>`)
    .replace(
      '<meta name="description" content="Compare your vibecoding personality with a friend. See your chemistry, dynamic, and pairing name.">',
      `<meta name="description" content="${esc(meta.description)}">`,
    )
    .replace('<meta property="og:title" content="Compare Vibecoding Personalities | vibestats">', `<meta property="og:title" content="${esc(meta.title)}">`)
    .replace('<meta property="og:description" content="See how two vibecoding archetypes work together. Chemistry, dynamics, and pairing names.">', `<meta property="og:description" content="${esc(meta.description)}">`)
    .replace('<meta property="og:url" content="https://vibestats.io/compare">', `<meta property="og:url" content="${esc(meta.url)}">`)
    .replace('<meta property="og:image" content="https://vibestats.io/og-card.png">', `<meta property="og:image" content="${esc(meta.image)}">`)
    .replace(
      '<meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="https://vibestats.io/og-card.png">',
      twitterTags,
    );
}

async function resolveCompareSubject(req, value) {
  const raw = firstParam(value).toLowerCase();
  if (!raw) return null;
  if (ARCHETYPES[raw]) return { type: raw, param: raw };
  if (!HANDLE_RE.test(raw)) return null;

  const users = await sql()`
    select id, gh_handle, privacy
    from users
    where lower(gh_handle) = lower(${raw})
    limit 1
  `;
  const user = users[0];
  if (!user) return null;

  const session = readSession(req);
  const isOwner = session?.sub === user.id;
  if (user.privacy === 'private' && !isOwner) return null;

  const uploads = await sql()`
    select archetype, scores, metrics, raw_meta, uploaded_at
    from uploads
    where user_id = ${user.id}
    order by uploaded_at desc
    limit 1
  `;
  const latest = uploads[0];
  if (!latest?.archetype || !ARCHETYPES[latest.archetype]) return null;

  const signature = signatureFromUpload(latest);
  const [rarity, leaderboard] = await Promise.all([
    rarityForSignature(signature),
    weeklyLeaderboardRank(user, latest),
  ]);

  return {
    type: latest.archetype,
    handle: user.gh_handle,
    signature: signature?.label || '',
    rarity,
    leaderboard,
    param: user.gh_handle,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const origin = originForRequest(req);
  let meta = genericMeta(origin);

  try {
    const [aSubject, bSubject] = await Promise.all([
      resolveCompareSubject(req, req.query?.a || req.query?.me),
      resolveCompareSubject(req, req.query?.b),
    ]);
    if (aSubject && bSubject) {
      meta = compareMetadataForSubjects(aSubject, bSubject, origin);
    }
  } catch (err) {
    console.error('GET /api/compare-page metadata error:', err);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(injectCompareMeta(COMPARE_HTML, meta));
}
