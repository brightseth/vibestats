#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import ssh2 from 'ssh2';
import { buildSshShellManifest } from '../../api/_lib/ssh-shell.js';

const { Server } = ssh2;
const DEFAULT_ORIGIN = process.env.VIBESTATS_URL || 'https://vibestats.io';
const DEFAULT_PORT = Number(process.env.PORT || process.env.SSH_PORT || 2222);
const DEFAULT_BIND_HOST = process.env.SSH_BIND_HOST || '0.0.0.0';

function originUrl(origin = DEFAULT_ORIGIN) {
  return String(origin || DEFAULT_ORIGIN).replace(/\/$/, '');
}

function cleanPart(value, fallback = '') {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function cleanHandle(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 39);
}

function line(text = '') {
  return `${text}\r\n`;
}

function block(lines = []) {
  return lines.filter((item) => item != null && item !== '').map((item) => line(item)).join('');
}

function firstUpload(profile) {
  return Array.isArray(profile?.uploads) ? profile.uploads[0] : null;
}

function profileLabel(profile) {
  const upload = firstUpload(profile);
  return upload?.raw_meta?.signature || upload?.archetype || 'unrevealed';
}

async function fetchJson(url, { fetchImpl = fetch, method = 'GET', body = null } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || `HTTP ${response.status}`);
  }
  return json;
}

export function renderWelcome({ origin = DEFAULT_ORIGIN, manifest = buildSshShellManifest(origin) } = {}) {
  return block([
    'vibestats terminal shell',
    'Claude Code already knows how you build. Reveal locally, claim publicly.',
    '',
    `Web: ${originUrl(origin)}`,
    `SSH: ${manifest.ssh.command}`,
    '',
    'Type help for commands. Type claim to start a local-only reveal handoff.',
    'Privacy: this SSH shell never reads ~/.claude/usage-data; the local helper uploads derived-only metrics.',
  ]);
}

export function renderHelp({ origin = DEFAULT_ORIGIN, manifest = buildSshShellManifest(origin) } = {}) {
  const commands = manifest.commands.map((item) => `  ${item.name.padEnd(22)} ${item.description}`);
  return block([
    'Commands',
    ...commands,
    '  status CODE            Check a waiting claim code.',
    '  manifest               Print the shell contract JSON.',
    '  quit                   Close the session.',
    '',
    'Claim flow',
    '  1. Run /insights in Claude Code.',
    '  2. Type claim here.',
    '  3. Run the printed curl command in your local terminal.',
    '  4. This shell refreshes to profile, credential, compare, badge, and match links.',
  ]);
}

function renderProfile(profile, { origin = DEFAULT_ORIGIN } = {}) {
  const handle = profile?.user?.gh_handle;
  const upload = firstUpload(profile);
  const label = profileLabel(profile);
  const archetype = upload?.archetype || 'unknown';
  const rarity = profile?.rarity ? `${profile.rarity.tier}, ${profile.rarity.count} in ${profile.rarity.window_days}d` : 'rarity warming up';
  const leaderboard = profile?.leaderboard?.rank
    ? `#${profile.leaderboard.rank} on ${profile.leaderboard.label || archetype}`
    : 'not ranked yet';
  const compareUrl = `${originUrl(origin)}/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(archetype)}`;
  const achievements = (profile?.achievements || []).slice(0, 3).map((item) => `  - ${item.label}: ${item.value}`);

  return block([
    `@${handle}: ${label}`,
    `Archetype: ${archetype}`,
    `Activity: ${upload?.activity?.days || 'private'} / ${upload?.activity?.cadence || 'private'} / ${upload?.activity?.depth || 'private'}`,
    `Rarity: ${rarity}`,
    `Leaderboard: ${leaderboard}`,
    achievements.length ? 'Achievements:' : '',
    ...achievements,
    '',
    `Profile: ${originUrl(origin)}/u/${handle}`,
    `Credential: ${originUrl(origin)}/u/${handle}/credential.json`,
    `Compare invite: ${compareUrl}`,
    'Reveal yours: run /insights, then claim from this shell.',
  ]);
}

function renderShare(profile, { origin = DEFAULT_ORIGIN } = {}) {
  const handle = profile?.user?.gh_handle;
  const upload = firstUpload(profile);
  const label = profileLabel(profile);
  const archetype = upload?.archetype || 'builder';
  const profileUrl = `${originUrl(origin)}/u/${handle}`;
  const compareUrl = `${originUrl(origin)}/?compareTo=${encodeURIComponent(handle)}&compareArchetype=${encodeURIComponent(archetype)}`;

  return block([
    `vibestats share kit: @${handle}`,
    `Copy/paste: I just found @${handle}'s Claude Code build profile: ${label}. Raw /insights stayed local. What are you? See how you'd pair: ${compareUrl}`,
    `X share: https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just found @${handle}'s Claude Code build profile: ${label}. What are you? ${compareUrl}`)}`,
    `README badge: [![vibestats: @${handle}](${profileUrl}/badge.svg)](${profileUrl})`,
    `Embed: <iframe src="${profileUrl}/embed" title="vibestats @${handle}" width="420" height="280"></iframe>`,
    `Credential: ${profileUrl}/credential.json`,
  ]);
}

function renderLeaderboard(data, { origin = DEFAULT_ORIGIN } = {}) {
  const entries = (data.entries || []).slice(0, 8);
  const rows = entries.map((entry) => {
    const handle = entry.user?.gh_handle || 'unknown';
    const label = entry.signature?.label || entry.archetype;
    return `${String(entry.rank || '?').padStart(2)}. @${handle.padEnd(16)} ${String(entry.score || 0).padStart(3)} ${label}`;
  });
  return block([
    `${data.label || data.archetype} leaderboard (${data.total || 0} public profiles)`,
    ...rows,
    rows.length ? '' : 'No public entries yet.',
    `Open board: ${originUrl(origin)}/leaderboard/${encodeURIComponent(data.archetype || 'builder')}`,
    'Run /insights, then claim here to join the board.',
  ]);
}

function renderMatches(data, { origin = DEFAULT_ORIGIN } = {}) {
  const entries = (data.entries || []).slice(0, 6);
  const rows = entries.map((entry) => {
    const handle = entry.user?.gh_handle || 'unknown';
    const label = entry.signature?.label || entry.archetype_label || entry.archetype;
    return `  @${handle.padEnd(16)} ${String(entry.fit_score || 0).padStart(3)} ${entry.fit_level || 'fit'} - ${label}`;
  });
  return block([
    `${data.goal_label || data.goal || 'Match'} suggestions`,
    ...rows,
    rows.length ? '' : 'No active matches yet.',
    `Open matchmaker: ${originUrl(origin)}/match?goal=${encodeURIComponent(data.goal || 'pair-coding')}`,
    'Set your intent after claiming: vibestats intent pair-coding --contact-url https://x.com/you --public',
  ]);
}

function renderClaimStart(data) {
  return block([
    `Claim code: ${data.code}`,
    `Expires: ${data.expires_in_seconds || 600}s`,
    '',
    'Run these locally, not inside SSH:',
    '  /insights',
    `  ${data.local_command}`,
    '',
    'No npm fallback:',
    `  ${data.npx_command}`,
    '',
    'This SSH host never sees raw /insights. It waits for derived-only metrics from the local helper.',
    `Check here: status ${data.code}`,
  ]);
}

function renderClaimStatus(data) {
  const lines = [`Claim state: ${data.state}`];
  if (data.gh_handle) lines.push(`GitHub: @${data.gh_handle}`);
  if (data.profile_url) lines.push(`Profile: ${data.profile_url}`);
  if (data.compare_url) lines.push(`Compare invite: ${data.compare_url}`);
  if (data.credential_url) lines.push(`Credential: ${data.credential_url}`);
  if (data.expires_at) lines.push(`Expires at: ${data.expires_at}`);
  if (data.state === 'pending') lines.push('Still waiting for the local helper. Raw /insights stays local.');
  return block(lines);
}

export async function handleShellCommand(input, {
  origin = DEFAULT_ORIGIN,
  fetchImpl = fetch,
  manifest = buildSshShellManifest(origin),
} = {}) {
  const raw = String(input || '').trim();
  if (!raw) return { text: '', exit: false };

  const [verbRaw, ...args] = raw.split(/\s+/);
  const verb = verbRaw.toLowerCase();
  const base = originUrl(origin);

  if (verb === 'quit' || verb === 'exit' || verb === 'logout') {
    return { text: line('bye'), exit: true };
  }
  if (verb === 'help' || verb === '?') {
    return { text: renderHelp({ origin: base, manifest }), exit: false };
  }
  if (verb === 'manifest') {
    return { text: `${JSON.stringify(manifest, null, 2)}\r\n`, exit: false };
  }
  if (verb === 'compare') {
    const a = cleanPart(args[0], 'builder');
    const b = cleanPart(args[1], 'shipper');
    return {
      text: block([
        `Pair preview: ${base}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
        'Compare-first loop: send that link, then have the recipient run /insights and claim.',
      ]),
      exit: false,
    };
  }
  if (verb === 'claim') {
    const data = await fetchJson(`${base}/api/ssh/claim-start`, { fetchImpl, method: 'POST', body: {} });
    return { text: renderClaimStart(data), exit: false };
  }
  if (verb === 'status') {
    const code = String(args[0] || '').trim();
    if (!code) return { text: line('Usage: status VIBE-XXXX-XXXX'), exit: false };
    const data = await fetchJson(`${base}/api/ssh/claim-status?code=${encodeURIComponent(code)}`, { fetchImpl });
    return { text: renderClaimStatus(data), exit: false };
  }
  if (verb === 'view' || verb === 'profile' || verb === 'share') {
    const handle = cleanHandle(args[0]);
    if (!handle) return { text: line(`Usage: ${verb} HANDLE`), exit: false };
    const profile = await fetchJson(`${base}/api/u/${encodeURIComponent(handle)}`, { fetchImpl });
    return { text: verb === 'share' ? renderShare(profile, { origin: base }) : renderProfile(profile, { origin: base }), exit: false };
  }
  if (verb === 'leaderboard' || verb === 'board') {
    const archetype = cleanPart(args[0], 'builder');
    const data = await fetchJson(`${base}/api/leaderboard?archetype=${encodeURIComponent(archetype)}`, { fetchImpl });
    return { text: renderLeaderboard(data, { origin: base }), exit: false };
  }
  if (verb === 'match') {
    const goal = cleanPart(args[0], 'pair-coding');
    const archetype = cleanPart(args[1], 'builder');
    const data = await fetchJson(`${base}/api/match?goal=${encodeURIComponent(goal)}&archetype=${encodeURIComponent(archetype)}`, { fetchImpl });
    return { text: renderMatches(data, { origin: base }), exit: false };
  }

  return { text: line(`Unknown command: ${verb}. Type help.`), exit: false };
}

function hostKeysFromEnv() {
  const configured = process.env.SSH_HOST_KEY || process.env.VIBESTATS_SSH_HOST_KEY;
  if (configured) return [configured.replace(/\\n/g, '\n')];
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SSH_HOST_KEY is required in production for a stable host fingerprint.');
  }
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  return [privateKey];
}

function handleSession(stream, context) {
  let buffer = '';
  let busy = false;
  const prompt = () => stream.write('\r\nvibestats> ');

  stream.write(renderWelcome(context));
  prompt();

  stream.on('data', async (chunk) => {
    const text = chunk.toString('utf8');
    if (text.includes('\u0003')) {
      stream.end('\r\nbye\r\n');
      return;
    }
    buffer += text.replace(/\u0004/g, '');
    const lines = buffer.split(/\r?\n|\r/g);
    buffer = lines.pop() || '';
    for (const command of lines) {
      if (busy) continue;
      busy = true;
      try {
        const result = await handleShellCommand(command, context);
        if (result.text) stream.write(result.text);
        if (result.exit) {
          stream.end();
          return;
        }
      } catch (err) {
        stream.write(line(err.message || 'Command failed'));
      } finally {
        busy = false;
      }
      prompt();
    }
  });
}

export function createSshShellServer({
  origin = DEFAULT_ORIGIN,
  hostKeys = hostKeysFromEnv(),
  fetchImpl = fetch,
  manifest = buildSshShellManifest(origin),
} = {}) {
  const server = new Server({ hostKeys }, (client) => {
    client.on('authentication', (ctx) => ctx.accept());
    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();
        session.on('pty', (acceptPty) => acceptPty?.());
        session.on('shell', (acceptShell) => {
          handleSession(acceptShell(), { origin, fetchImpl, manifest });
        });
        session.on('exec', async (acceptExec, _reject, info) => {
          const stream = acceptExec();
          try {
            const result = await handleShellCommand(info.command, { origin, fetchImpl, manifest });
            if (result.text) stream.write(result.text);
            stream.exit(0);
          } catch (err) {
            stream.stderr.write(line(err.message || 'Command failed'));
            stream.exit(1);
          } finally {
            stream.end();
          }
        });
      });
    });
  });
  return server;
}

export function startSshShellServer({
  port = DEFAULT_PORT,
  host = DEFAULT_BIND_HOST,
  origin = DEFAULT_ORIGIN,
} = {}) {
  const server = createSshShellServer({ origin });
  server.listen(port, host, () => {
    process.stdout.write(`vibestats SSH shell listening on ${host}:${port} for ${originUrl(origin)}\n`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startSshShellServer();
}
