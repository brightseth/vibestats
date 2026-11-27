import { getClaimSessionStatus } from '../_lib/ssh-claims.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  try {
    const session = await getClaimSessionStatus(req.query?.code || '');
    return json(res, 200, { ok: true, ...session }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/ssh/claim-status error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Claim status failed') }, NO_STORE_HEADERS);
  }
}
