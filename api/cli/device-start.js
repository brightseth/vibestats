import { requestGithubDeviceCode } from '../_lib/github-oauth.js';
import { identityReadiness, identityUnavailableMessage } from '../_lib/identity-readiness.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage, setNoStore } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  setNoStore(res);

  if (!identityReadiness().available) {
    return json(res, 503, { error: identityUnavailableMessage() }, NO_STORE_HEADERS);
  }

  try {
    const device = await requestGithubDeviceCode();
    return json(res, 200, device, NO_STORE_HEADERS);
  } catch (err) {
    console.error('CLI device start error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'CLI device authorization failed') }, NO_STORE_HEADERS);
  }
}
