import { sql } from './db.js';

export const GITHUB_DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

function githubClientId() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    const err = new Error('GitHub OAuth is not configured');
    err.statusCode = 500;
    throw err;
  }
  return clientId;
}

async function readGithubJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error_description || body.message || body.error || 'GitHub OAuth failed');
    err.statusCode = res.status;
    err.github = body;
    throw err;
  }
  return body;
}

export async function requestGithubDeviceCode({ fetchImpl = fetch } = {}) {
  const body = await readGithubJson(await fetchImpl('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      scope: '',
    }),
  }));

  if (body.error) {
    const err = new Error(body.error_description || body.error);
    err.statusCode = 400;
    throw err;
  }

  if (!body.device_code || !body.user_code || !body.verification_uri) {
    const err = new Error('GitHub device authorization did not return a device code');
    err.statusCode = 502;
    throw err;
  }

  return {
    device_code: body.device_code,
    user_code: body.user_code,
    verification_uri: body.verification_uri,
    expires_in: Number(body.expires_in || 900),
    interval: Number(body.interval || 5),
  };
}

export async function pollGithubDeviceToken(deviceCode, { fetchImpl = fetch } = {}) {
  if (!deviceCode || typeof deviceCode !== 'string' || deviceCode.length > 512) {
    const err = new Error('Invalid device code');
    err.statusCode = 400;
    throw err;
  }

  const body = await readGithubJson(await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      device_code: deviceCode,
      grant_type: GITHUB_DEVICE_GRANT_TYPE,
    }),
  }));

  return body;
}

export async function fetchGithubUser(accessToken, { fetchImpl = fetch } = {}) {
  if (!accessToken) {
    const err = new Error('GitHub access token missing');
    err.statusCode = 502;
    throw err;
  }

  const user = await readGithubJson(await fetchImpl('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'vibestats',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }));

  if (!user.id || !user.login) {
    const err = new Error('GitHub user fetch failed');
    err.statusCode = 502;
    throw err;
  }

  return user;
}

export async function upsertGithubUser(ghUser) {
  const rows = await sql()`
    insert into users (gh_id, gh_handle, avatar_url, privacy, last_seen_at)
    values (${ghUser.id}, ${ghUser.login}, ${ghUser.avatar_url || null}, 'unlisted', now())
    on conflict (gh_id) do update
      set gh_handle = excluded.gh_handle,
          avatar_url = excluded.avatar_url,
          last_seen_at = now()
    returning id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
  `;
  return rows[0];
}
