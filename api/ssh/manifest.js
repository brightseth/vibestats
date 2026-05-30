import { originForRequest } from '../_lib/auth.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from '../_lib/http.js';
import { buildSshShellManifest } from '../_lib/ssh-shell.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);
  return json(res, 200, buildSshShellManifest(originForRequest(req)), NO_STORE_HEADERS);
}
