import { derivedProfileSpec } from './_lib/credential.js';
import { originForRequest } from './_lib/auth.js';
import { json, methodNotAllowed } from './_lib/http.js';

const PUBLIC_SPEC_HEADERS = Object.freeze({
  'Cache-Control': 'public, max-age=300, s-maxage=300',
});

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], PUBLIC_SPEC_HEADERS);

  return json(res, 200, derivedProfileSpec(originForRequest(req)), PUBLIC_SPEC_HEADERS);
}
