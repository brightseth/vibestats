import { randomBytes } from 'node:crypto';
import { sql } from './db.js';
import { publicFacetRadar } from './facets.js';
import { publicMoments } from './moments.js';
import { publicScores } from './public-profile.js';
import { sanitizeUploadPayload } from './uploads.js';
import { signatureFromUpload } from './signatures.js';

export const REVEAL_SLUG_PATTERN = /^[A-Za-z0-9_-]{10,24}$/;

export function cleanRevealSlug(value) {
  const slug = String(value || '').trim();
  if (!REVEAL_SLUG_PATTERN.test(slug)) {
    const err = new Error('Invalid reveal link');
    err.statusCode = 400;
    throw err;
  }
  return slug;
}

export function generateRevealSlug() {
  return randomBytes(9).toString('base64url');
}

function safeMetric(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), 0), max);
}

function publicMetrics(metrics = {}) {
  const out = {};
  const limits = {
    commitsPerDay: 500,
    sessions: 100000,
    languages: 200,
    msgsPerSession: 5000,
    days: 5000,
  };
  for (const [key, max] of Object.entries(limits)) {
    const value = safeMetric(metrics[key], max);
    if (value != null) out[key] = value;
  }
  return out;
}

export function publicRevealSnapshot(row = {}, { origin = 'https://vibestats.io' } = {}) {
  const upload = {
    archetype: row.archetype,
    scores: row.scores || {},
    metrics: row.metrics || {},
    raw_meta: row.raw_meta || {},
    uploaded_at: row.created_at,
  };
  const scores = publicScores(upload.scores);
  const signature = signatureFromUpload({ ...upload, scores });
  const metrics = publicMetrics(upload.metrics);
  const slug = row.slug;
  const path = `/r/${encodeURIComponent(slug)}`;

  return {
    slug,
    archetype: upload.archetype,
    scores,
    facets: publicFacetRadar(scores),
    metrics,
    raw_meta: {
      ...(signature?.label ? { signature: signature.label } : {}),
      ...(signature?.combo ? { signatureCombo: signature.combo } : {}),
      ...(signature?.secondary ? { secondaryArchetype: signature.secondary } : {}),
      moments: publicMoments(upload.raw_meta?.moments || [], { exact: true }),
    },
    created_at: row.created_at,
    expires_at: row.expires_at,
    reveal_path: path,
    reveal_url: `${String(origin || 'https://vibestats.io').replace(/\/$/, '')}${path}`,
    privacy: {
      identity: 'anonymous',
      listed: false,
      raw_insights: 'local-only',
      synced_fields: 'derived-only',
    },
  };
}

export async function createRevealSnapshot(body = {}, { origin = 'https://vibestats.io' } = {}) {
  const payload = sanitizeUploadPayload(body, { source: 'browser' });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateRevealSlug();
    const rows = await sql()`
      insert into reveal_snapshots (slug, archetype, scores, metrics, raw_meta)
      values (
        ${slug},
        ${payload.archetype},
        ${sql().json(payload.scores)},
        ${sql().json(payload.metrics)},
        ${sql().json(payload.raw_meta)}
      )
      on conflict (slug) do nothing
      returning slug, archetype, scores, metrics, raw_meta, created_at, expires_at
    `;
    if (rows[0]) return publicRevealSnapshot(rows[0], { origin });
  }

  const err = new Error('Could not create reveal link');
  err.statusCode = 503;
  throw err;
}

export async function getRevealSnapshot(slug, { origin = 'https://vibestats.io' } = {}) {
  const cleanSlug = cleanRevealSlug(slug);
  const rows = await sql()`
    select slug, archetype, scores, metrics, raw_meta, created_at, expires_at
    from reveal_snapshots
    where slug = ${cleanSlug}
      and (expires_at is null or expires_at > now())
    limit 1
  `;
  if (!rows[0]) {
    const err = new Error('Reveal link not found');
    err.statusCode = 404;
    throw err;
  }
  return publicRevealSnapshot(rows[0], { origin });
}
