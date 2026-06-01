import { hasDatabase, sql } from './db.js';
import { ARCHETYPE_KEYS } from './uploads.js';

const EVENT_NAMES = new Set(['reveal_created', 'reveal_view', 'compare_started', 'profile_claimed']);
const SURFACES = new Set(['homepage', 'anon_reveal', 'profile', 'compare', 'cli', 'ssh', 'unknown']);
const SOURCE_REF_RE = /^(r|u):[A-Za-z0-9_-]{1,39}$/;
const REVEAL_SLUG_RE = /^[A-Za-z0-9_-]{10,24}$/;
const HANDLE_RE = /^[A-Za-z0-9-]{1,39}$/;

function firstParam(value) {
  return String(Array.isArray(value) ? value[0] : value ?? '').trim();
}

export function cleanAttributionRef(value) {
  const ref = firstParam(value);
  return SOURCE_REF_RE.test(ref) ? ref : null;
}

export function sourceRefForReveal(slug) {
  const clean = firstParam(slug);
  return REVEAL_SLUG_RE.test(clean) ? `r:${clean}` : null;
}

export function sourceRefForProfile(handle) {
  const clean = firstParam(handle).replace(/^@/, '');
  return HANDLE_RE.test(clean) ? `u:${clean}` : null;
}

export function cleanViralSurface(value, fallback = 'unknown') {
  const surface = firstParam(value).toLowerCase();
  return SURFACES.has(surface) ? surface : fallback;
}

export function attributionRefFromBody(body = {}) {
  return cleanAttributionRef(body?.attribution?.ref || body?.ref || body?.source_ref);
}

export function attributionSurfaceFromBody(body = {}, fallback = 'unknown') {
  return cleanViralSurface(body?.attribution?.surface || body?.source_surface, fallback);
}

export function attributionRefFromQuery(query = {}, fallback = null) {
  return cleanAttributionRef(query?.ref) || cleanAttributionRef(fallback);
}

function cleanEventName(value) {
  const eventName = firstParam(value);
  if (!EVENT_NAMES.has(eventName)) {
    const err = new Error('Invalid viral event');
    err.statusCode = 400;
    throw err;
  }
  return eventName;
}

function cleanRevealSlug(value) {
  const slug = firstParam(value);
  return REVEAL_SLUG_RE.test(slug) ? slug : null;
}

function cleanProfileHandle(value) {
  const handle = firstParam(value).replace(/^@/, '');
  return HANDLE_RE.test(handle) ? handle : null;
}

function cleanArchetype(value) {
  const archetype = firstParam(value).toLowerCase();
  return ARCHETYPE_KEYS.includes(archetype) ? archetype : null;
}

function isMissingViralEventsTable(err) {
  const message = String(err?.message || '');
  return err?.code === '42P01' || message.includes('viral_events');
}

export async function recordViralEvent({
  eventName,
  sourceRef = null,
  sourceSurface = 'unknown',
  revealSlug = null,
  profileHandle = null,
  archetype = null,
} = {}) {
  if (!hasDatabase()) return false;
  const event_name = cleanEventName(eventName);
  const source_ref = cleanAttributionRef(sourceRef);
  const source_surface = cleanViralSurface(sourceSurface);
  const reveal_slug = cleanRevealSlug(revealSlug);
  const profile_handle = cleanProfileHandle(profileHandle);
  const clean_archetype = cleanArchetype(archetype);

  try {
    await sql()`
      insert into viral_events (
        event_name,
        source_ref,
        source_surface,
        reveal_slug,
        profile_handle,
        archetype
      ) values (
        ${event_name},
        ${source_ref},
        ${source_surface},
        ${reveal_slug},
        ${profile_handle},
        ${clean_archetype}
      )
    `;
    return true;
  } catch (err) {
    if (isMissingViralEventsTable(err)) return false;
    throw err;
  }
}
