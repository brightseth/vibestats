import { publicScores } from './public-profile.js';
import { ARCHETYPE_KEYS, ARCHETYPE_IDENTITY } from '../../lib/archetype-identity.js';
import { signatureFromUpload } from './signatures.js';
import { profileStreak } from './streak.js';

const ARCHETYPES = Object.fromEntries(ARCHETYPE_KEYS.map((key) => [key, { name: `The ${ARCHETYPE_IDENTITY[key].short}`, short: ARCHETYPE_IDENTITY[key].short }]));

const dayMs = 24 * 60 * 60 * 1000;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value) {
  const n = safeNumber(value);
  if (n >= 1000) return Math.round(n).toLocaleString();
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / dayMs) + 1) / 7);
}

export function uploadStreak(uploads = [], options = {}) {
  return profileStreak(uploads, options)?.upload_count || 0;
}

function streakText(streak) {
  if (!streak) return 'First saved result';
  return `${streak.label} (${streak.upload_count} upload${streak.upload_count === 1 ? '' : 's'})`;
}

function primaryScore(upload) {
  return publicScores(upload?.scores || {})[upload?.archetype] || 0;
}

function scoreDelta(latest, previous) {
  if (!latest || !previous || latest.archetype !== previous.archetype) return null;
  return primaryScore(latest) - primaryScore(previous);
}

function deltaText(delta) {
  if (delta == null) return 'First saved result';
  if (delta === 0) return 'No change vs last upload';
  return `${delta > 0 ? '+' : ''}${delta} points vs last upload`;
}

function profileUrl(origin, handle) {
  return `${origin}/u/${encodeURIComponent(handle)}`;
}

function shareCanUseHandle(user = {}) {
  return user.privacy !== 'private';
}

function compareUrl(origin, user, archetype) {
  const params = new URLSearchParams();
  if (shareCanUseHandle(user)) params.set('compareTo', user.gh_handle);
  params.set('compareArchetype', archetype);
  return `${origin}/?${params.toString()}`;
}

function leaderboardUrl(origin, archetype) {
  return `${origin}/leaderboard/${encodeURIComponent(archetype)}`;
}

function matchUrl(origin, archetype) {
  const params = new URLSearchParams({
    goal: 'pair-coding',
    archetype,
  });
  return `${origin}/match?${params.toString()}`;
}

function settingsUrl(origin) {
  return `${origin}/settings`;
}

function digestUnsubscribeUrl(origin, token) {
  return token ? `${origin}/api/digest/unsubscribe?token=${encodeURIComponent(token)}` : null;
}

function xShareUrl(shareUrl, text) {
  const params = new URLSearchParams({ text, url: shareUrl });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function ogUrl(origin, user, latest) {
  const metrics = latest.metrics || {};
  const params = new URLSearchParams({
    a: latest.archetype,
    n: `@${user.gh_handle}`,
    d: String(metrics.days || '?'),
    c: String(metrics.commitsPerDay || '?'),
    l: String(metrics.languages || metrics.codeLangCount || '?'),
    s: String(metrics.sessions || '?'),
  });
  return `${origin}/api/og?${params.toString()}`;
}

function scarcityText(rarity) {
  if (!rarity?.count) return 'Signature rarity is still warming up';
  const label = rarity.count === 1 ? 'profile' : 'profiles';
  return `${rarity.tier} combo: 1 of ${fmt(rarity.count)} saved ${label} this month`;
}

function leaderboardText(leaderboard) {
  if (!leaderboard?.rank) return null;
  const label = ARCHETYPES[leaderboard.label]?.short || leaderboard.label;
  return `#${leaderboard.rank} on the weekly ${label} board`;
}

export function buildWeeklyDigest({ user, uploads, rarity = null, leaderboard = null, origin, now = new Date(), unsubscribeToken = null }) {
  const latest = uploads?.[0];
  if (!latest) return null;

  const previous = uploads[1] || null;
  const arch = ARCHETYPES[latest.archetype] || ARCHETYPES.builder;
  const signature = signatureFromUpload(latest);
  const delta = scoreDelta(latest, previous);
  const metrics = latest.metrics || {};
  const score = primaryScore(latest);
  const streak = profileStreak(uploads, { now });
  const streakLine = streakText(streak);
  const profile = profileUrl(origin, user.gh_handle);
  const share = compareUrl(origin, user, latest.archetype);
  const board = leaderboardUrl(origin, latest.archetype);
  const match = matchUrl(origin, latest.archetype);
  const settings = settingsUrl(origin);
  const unsubscribe = digestUnsubscribeUrl(origin, unsubscribeToken);
  const boardLine = leaderboardText(leaderboard);
  const rareLine = scarcityText(rarity);

  const stats = [
    { label: 'Current signal', value: `${score}%`, detail: arch.short },
    { label: 'Evolution', value: delta == null ? 'new' : `${delta > 0 ? '+' : ''}${delta}`, detail: deltaText(delta) },
    {
      label: boardLine ? 'Leaderboard' : 'Rarity',
      value: boardLine ? `#${leaderboard.rank}` : (rarity?.count ? `1 of ${fmt(rarity.count)}` : `${streak?.days || 1}d`),
      detail: boardLine || rareLine,
    },
  ];

  const subject = `your vibecoding evolution - week ${isoWeek(now)}`;
  const signatureLine = signature?.label || arch.short;
  const shareText = shareCanUseHandle(user)
    ? `See how you'd pair with @${user.gh_handle}, a ${signatureLine}`
    : `See how you'd pair with a ${signatureLine}`;
  const xShare = xShareUrl(share, shareText);

  const text = [
    `@${user.gh_handle}, your vibecoding evolution for week ${isoWeek(now)}`,
    '',
    `${signatureLine} / ${arch.name}`,
    `Current signal: ${score}%`,
    `Evolution: ${deltaText(delta)}`,
    `Streak: ${streakLine}`,
    boardLine || rareLine,
    `Days tracked: ${fmt(metrics.days)}`,
    `Commits/day: ${fmt(metrics.commitsPerDay)}`,
    '',
    `Open profile: ${profile}`,
    `Share invite: ${share}`,
    `Leaderboard: ${board}`,
    `Find matches: ${match}`,
    `Manage digest: ${settings}`,
    'Privacy: Raw Claude Code insights JSON never leaves your browser; this digest uses only saved derived metrics.',
    unsubscribe ? `Unsubscribe: ${unsubscribe}` : null,
  ].filter(Boolean).join('\n');

  const statHtml = stats.map((stat) => `
    <td style="padding:12px;border:1px solid #252535;border-radius:8px;background:#10101a;">
      <div style="font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#77778d;text-transform:uppercase;">${esc(stat.label)}</div>
      <div style="margin-top:8px;font:700 28px Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#ffffff;">${esc(stat.value)}</div>
      <div style="margin-top:6px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#a7a7ba;line-height:1.5;">${esc(stat.detail)}</div>
    </td>
  `).join('');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#06060a;color:#e0e0e0;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px 34px;">
    <div style="font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fa8ff;margin-bottom:24px;">vibestats</div>
    <h1 style="margin:0 0 8px;font-size:34px;line-height:1;color:#fff;">@${esc(user.gh_handle)}, your week in Claude Code</h1>
    <p style="margin:0 0 20px;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8888a0;">${esc(signatureLine)} / ${esc(arch.name)}</p>
    <a href="${esc(profile)}" style="display:block;text-decoration:none;">
      <img src="${esc(ogUrl(origin, user, latest))}" alt="@${esc(user.gh_handle)} vibestats card" width="584" style="width:100%;max-width:584px;border:1px solid #252535;border-radius:8px;display:block;">
    </a>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-spacing:8px;margin:20px -8px 10px;">
      <tr>${statHtml}</tr>
    </table>
    <p style="font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8888a0;">${esc(rareLine)}. ${esc(streakLine)}.</p>
    <p style="margin:24px 0 0;">
      <a href="${esc(profile)}" style="display:inline-block;padding:12px 15px;border-radius:8px;background:#1b2443;color:#c8d5ff;text-decoration:none;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace;">Open profile</a>
      <a href="${esc(xShare)}" style="display:inline-block;margin-left:8px;padding:12px 15px;border-radius:8px;background:#ffffff;color:#06060a;text-decoration:none;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace;">Share invite</a>
      <a href="${esc(board)}" style="display:inline-block;margin-left:8px;padding:12px 15px;border-radius:8px;background:#14141e;color:#c8d5ff;text-decoration:none;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace;">View leaderboard</a>
      <a href="${esc(match)}" style="display:inline-block;margin-left:8px;padding:12px 15px;border-radius:8px;background:#162217;color:#c8facc;text-decoration:none;font:700 12px ui-monospace,SFMono-Regular,Menlo,monospace;">Find matches</a>
    </p>
    <p style="margin-top:26px;font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#555568;">You opted in to weekly vibestats emails. <a href="${esc(settings)}" style="color:#8fa8ff;">Manage digest settings</a>${unsubscribe ? ` or <a href="${esc(unsubscribe)}" style="color:#8fa8ff;">unsubscribe</a>` : ''}. Raw Claude Code insights JSON never leaves your browser; this digest uses only saved derived metrics.</p>
  </div>
</body>
</html>`;

  return {
    subject,
    text,
    html,
    profile_url: profile,
    share_url: share,
    x_share_url: xShare,
    leaderboard_url: board,
    match_url: match,
    settings_url: settings,
    unsubscribe_url: unsubscribe,
    score,
    delta,
    streak,
  };
}
