import { NO_STORE_HEADERS, json, methodNotAllowed, readJson } from './_lib/http.js';
import { recordFunnelEvent } from './_lib/funnel-events.js';

// Lightweight client funnel beacon. Records a single allowlisted event name (+ optional
// archetype) for the compare-intent loop. Best-effort analytics: never throws back to the
// client beyond a 400 for an unknown event name, and no-ops if the DB/table is absent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);
  try {
    const body = await readJson(req, { maxBytes: 2 * 1024 });
    await recordFunnelEvent({ event: body?.event, archetype: body?.archetype });
    return json(res, 202, { ok: true }, NO_STORE_HEADERS);
  } catch (err) {
    if (err?.statusCode === 400) return json(res, 400, { error: 'invalid event' }, NO_STORE_HEADERS);
    // Swallow everything else — analytics failures must be invisible to users.
    return json(res, 202, { ok: true }, NO_STORE_HEADERS);
  }
}
