import { identityUnavailableMessage, publicIdentityReadiness } from './_lib/identity-readiness.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from './_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  const readiness = publicIdentityReadiness();
  json(res, 200, {
    ...readiness,
    message: readiness.profile_save_available ? null : identityUnavailableMessage(),
  }, NO_STORE_HEADERS);
}
