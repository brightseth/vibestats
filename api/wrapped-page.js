import { readFileSync } from 'node:fs';
import { archetypeMap } from '../lib/archetype-identity.js';
import { profileShareCacheControl, sendPrivateMethodNotAllowed } from './_lib/cache.js';
import { sql } from './_lib/db.js';
import { metricVisibility } from './_lib/public-profile.js';
import { publicMoments } from './_lib/moments.js';
import { signatureFromUpload } from './_lib/signatures.js';

// Serves /wrapped. Without a handle: the static sample, meta untouched. With a valid
// claimed handle: same HTML (the client hydrates the deck), but with per-person
// title/description/og:image so the share unfurls as THEIR wrapped, not the sample.
// (wrapped.html was renamed wrapped-template.html to dodge the cleanUrls static-shadow
// trap that bit /dashboard.)
const WRAPPED_HTML = readFileSync(new URL('../wrapped-template.html', import.meta.url), 'utf8');
const HANDLE_RE = /^[a-zA-Z0-9-]{1,39}$/;
const ARCHETYPES = archetypeMap(['name', 'short']);

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function injectWrappedMeta(html, meta) {
  return html
    .replace('<title>THE ORCHESTRATOR | vibestats wrapped</title>', `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(meta.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(meta.description)}">`)
    .replace('<meta property="og:url" content="https://vibestats.io/wrapped">', `<meta property="og:url" content="${esc(meta.url)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(meta.title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(meta.description)}">`)
    .replace('<meta property="og:image" content="https://vibestats.io/og-card.png">', `<meta property="og:image" content="${esc(meta.image)}">`)
    .replace('<meta name="twitter:image" content="https://vibestats.io/og-card.png">', `<meta name="twitter:image" content="${esc(meta.image)}">`);
}

function sendHtml(res, html, cacheControl) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(html);
}

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim().replace(/^@/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendPrivateMethodNotAllowed(res, ['GET']);

  const handle = firstParam(req.query?.handle);
  if (!HANDLE_RE.test(handle)) {
    return sendHtml(res, WRAPPED_HTML, 'public, s-maxage=300, stale-while-revalidate=600');
  }

  try {
    const users = await sql()`
      select id, gh_handle, privacy from users where lower(gh_handle) = lower(${handle}) limit 1
    `;
    const user = users[0];
    if (!user || user.privacy === 'private') {
      return sendHtml(res, WRAPPED_HTML, 'private, no-store');
    }
    const uploads = await sql()`
      select archetype, scores, metrics, raw_meta, uploaded_at
      from uploads where user_id = ${user.id}
      order by uploaded_at desc limit 1
    `;
    const latest = uploads[0];
    if (!latest?.archetype || !ARCHETYPES[latest.archetype]) {
      return sendHtml(res, WRAPPED_HTML, 'private, no-store');
    }
    const settingsRows = await sql()`
      select show_raw_counts, show_languages from profile_settings where user_id = ${user.id} limit 1
    `;
    const visibility = metricVisibility(settingsRows[0] || {}, { isOwner: false });
    const signature = signatureFromUpload(latest);
    const arch = ARCHETYPES[latest.archetype];

    const imageParams = new URLSearchParams({ a: latest.archetype, n: `@${user.gh_handle}` });
    if (signature?.label) imageParams.set('sig', signature.label);
    const moments = publicMoments(latest.raw_meta?.moments, { exact: Boolean(visibility.show_raw_counts) }).slice(0, 3);
    moments.forEach((moment, index) => {
      imageParams.set(`m${index + 1}v`, String(moment.value || ''));
      imageParams.set(`m${index + 1}l`, String(moment.label || ''));
    });

    const momentLine = moments.length ? `${moments.map((m) => m.value).join(' · ')}. ` : '';
    const html = injectWrappedMeta(WRAPPED_HTML, {
      title: `@${user.gh_handle}'s vibestats wrapped`,
      description: `${signature?.label || arch.short}. ${momentLine}See how you'd pair: pick your type, instant chemistry, no signup. Raw /insights stays local.`,
      url: `https://vibestats.io/wrapped?handle=${encodeURIComponent(user.gh_handle)}`,
      image: `https://vibestats.io/api/og?${imageParams.toString()}`,
    });
    return sendHtml(res, html, profileShareCacheControl(user));
  } catch (err) {
    console.error('GET /wrapped error:', err);
    // Never block the page on meta personalization — fall back to the sample meta.
    return sendHtml(res, WRAPPED_HTML, 'private, no-store');
  }
}
