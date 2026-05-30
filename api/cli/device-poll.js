import { createSyncToken, originForRequest, syncTokenExpiresAt } from '../_lib/auth.js';
import { fetchGithubUser, pollGithubDeviceToken, upsertGithubUser } from '../_lib/github-oauth.js';
import { identityReadiness, identityUnavailableMessage } from '../_lib/identity-readiness.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, readJson, safeErrorMessage, setNoStore } from '../_lib/http.js';

const PENDING_ERRORS = new Set(['authorization_pending', 'slow_down']);
const DENIED_ERRORS = new Set(['expired_token', 'access_denied', 'incorrect_device_code']);

function githubDeviceError(body = {}) {
  const error = body.error || '';
  if (!error) return null;
  const err = new Error(body.error_description || error);
  err.statusCode = PENDING_ERRORS.has(error) ? 202 : (DENIED_ERRORS.has(error) ? 400 : 502);
  err.githubError = error;
  return err;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  setNoStore(res);

  if (!identityReadiness().available) {
    return json(res, 503, { error: identityUnavailableMessage() }, NO_STORE_HEADERS);
  }

  try {
    const body = await readJson(req, { maxBytes: 2048 });
    const tokenBody = await pollGithubDeviceToken(body.device_code);
    const pending = githubDeviceError(tokenBody);
    if (pending) {
      return json(res, pending.statusCode, {
        status: pending.githubError,
        error: pending.message,
      }, NO_STORE_HEADERS);
    }
    const ghUser = await fetchGithubUser(tokenBody.access_token);
    const user = await upsertGithubUser(ghUser);
    return json(res, 200, {
      token: createSyncToken(user),
      host: originForRequest(req),
      expires_at: syncTokenExpiresAt(),
      handle: user.gh_handle,
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('CLI device poll error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'CLI device authorization failed') }, NO_STORE_HEADERS);
  }
}
