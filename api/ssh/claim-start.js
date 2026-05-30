import { originForRequest } from '../_lib/auth.js';
import { CLAIM_SESSION_TTL_SECONDS, claimLocalCommand, claimNpxCommand, createClaimSession } from '../_lib/ssh-claims.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  try {
    const origin = originForRequest(req);
    const { code, session } = await createClaimSession();
    return json(res, 201, {
      ok: true,
      code,
      state: session.state,
      expires_at: session.expires_at,
      expires_in_seconds: CLAIM_SESSION_TTL_SECONDS,
      status_url: `${origin}/api/ssh/claim-status?code=${encodeURIComponent(code)}`,
      local_command: claimLocalCommand(origin, code),
      npx_command: claimNpxCommand(origin, code),
      privacy: {
        ssh_host_reads_raw_insights: false,
        local_helper_uploads: 'derived-only',
        raw_claude_code_sessions: 'local-only',
      },
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('POST /api/ssh/claim-start error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Claim session failed') }, NO_STORE_HEADERS);
  }
}
