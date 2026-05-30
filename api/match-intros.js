import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, requireSameOrigin, safeErrorMessage } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { LOOKING_FOR_VALUES } from './_lib/profile-settings.js';
import { ARCHETYPE_KEYS } from './_lib/signatures.js';

const ACTIONS = new Set(['compare_click', 'contact_click', 'copy_intro', 'share_x']);
const SOURCES = new Set(['match', 'browse', 'profile']);
const HANDLE_RE = /^[a-zA-Z0-9-]{1,39}$/;

function cleanEnum(value, allowed, name, { optional = false } = {}) {
  if ((value == null || value === '') && optional) return null;
  const cleaned = String(value || '').trim();
  if (!allowed.has(cleaned)) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return cleaned;
}

function cleanArchetype(value, name) {
  if (value == null || value === '' || value === 'any') return null;
  const cleaned = String(value).trim().toLowerCase();
  if (!ARCHETYPE_KEYS.includes(cleaned)) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return cleaned;
}

export function cleanMatchIntroEvent(body = {}) {
  const targetHandle = String(body.target_handle || body.target || '')
    .trim()
    .replace(/^@/, '');
  if (!HANDLE_RE.test(targetHandle)) {
    const err = new Error('Invalid target handle');
    err.statusCode = 400;
    throw err;
  }

  const goal = cleanEnum(body.goal || 'pair-coding', LOOKING_FOR_VALUES, 'goal');
  if (goal === 'idle') {
    const err = new Error('Invalid goal');
    err.statusCode = 400;
    throw err;
  }

  return {
    target_handle: targetHandle,
    goal,
    seeker_archetype: cleanArchetype(body.seeker_archetype, 'seeker archetype'),
    target_archetype: cleanArchetype(body.target_archetype, 'target archetype'),
    action: cleanEnum(body.action, ACTIONS, 'action'),
    source: cleanEnum(body.source || 'match', SOURCES, 'source'),
  };
}

function storageUnavailable(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.statusCode === 503
    || err?.code === '42P01'
    || message.includes('database is not configured')
    || message.includes('match_intro_events');
}

async function recordMatchIntroEvent(event) {
  await sql()`
    insert into match_intro_events (
      target_handle,
      goal,
      seeker_archetype,
      target_archetype,
      action,
      source
    )
    values (
      ${event.target_handle},
      ${event.goal},
      ${event.seeker_archetype},
      ${event.target_archetype},
      ${event.action},
      ${event.source}
    )
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  try {
    requireSameOrigin(req);
    const body = await readJson(req, { maxBytes: 2 * 1024 });
    const event = cleanMatchIntroEvent(body);

    try {
      await recordMatchIntroEvent(event);
      return json(res, 200, { ok: true, recorded: true }, NO_STORE_HEADERS);
    } catch (err) {
      if (!storageUnavailable(err)) throw err;
      console.error('POST /api/match-intros storage unavailable:', err);
      return json(res, 202, { ok: true, recorded: false }, NO_STORE_HEADERS);
    }
  } catch (err) {
    console.error('POST /api/match-intros error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Match intro event failed') }, NO_STORE_HEADERS);
  }
}
