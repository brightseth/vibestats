import { publicIdentityReadiness } from './identity-readiness.js';
import { publicScores, uploadRecency } from './public-profile.js';
import { signatureFromUpload } from './signatures.js';
import { profileStreak } from './streak.js';

const CRON_UTC_HOUR = 13;

function absoluteUrl(origin, path) {
  return new URL(path, `${String(origin || 'https://vibestats.io').replace(/\/$/, '')}/`).toString();
}

function nextWeeklyDigestAt(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_UTC_HOUR, 0, 0, 0));
  const day = date.getUTCDay();
  const daysUntilMonday = (8 - day) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  if (date <= now) date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString();
}

function latestDigestSignal(upload) {
  if (!upload) return null;
  const scores = publicScores(upload.scores || {});
  const signature = signatureFromUpload(upload);
  return {
    archetype: upload.archetype,
    score: scores[upload.archetype] || 0,
    signature_label: signature?.label || upload.archetype,
    updated: uploadRecency(upload.uploaded_at),
  };
}

export function buildDigestStatus({
  user,
  settings = {},
  uploads = [],
  origin,
  now = new Date(),
} = {}) {
  const latest = uploads[0] || null;
  const readiness = publicIdentityReadiness();
  const optIn = Boolean(settings.weekly_digest_opt_in);
  const hasEmail = Boolean(settings.digest_email);
  const canPreview = Boolean(latest);
  const deliveryReady = readiness.weekly_digest_available === true;
  const profilePath = user?.gh_handle ? `/u/${encodeURIComponent(user.gh_handle)}` : '/settings';
  const archetype = latest?.archetype || null;
  const shareParams = new URLSearchParams();
  if (user?.privacy !== 'private' && user?.gh_handle) shareParams.set('compareTo', user.gh_handle);
  if (archetype) shareParams.set('compareArchetype', archetype);

  return {
    ok: true,
    delivery_ready: deliveryReady,
    reserved: optIn && hasEmail,
    opt_in: optIn,
    has_email: hasEmail,
    email_visible_to_owner_only: true,
    state: !optIn
      ? 'off'
      : hasEmail
      ? (deliveryReady ? 'scheduled' : 'reserved')
      : 'needs_email',
    next_scheduled_at: nextWeeklyDigestAt(now),
    last_sent_at: settings.weekly_digest_sent_at || null,
    consent_at: settings.email_consent_at || null,
    can_preview: canPreview,
    latest: latestDigestSignal(latest),
    streak: profileStreak(uploads, { now }),
    links: {
      settings_url: absoluteUrl(origin, '/settings#weekly-digest-row'),
      preview_url: absoluteUrl(origin, '/api/digest/preview'),
      profile_url: absoluteUrl(origin, profilePath),
      recap_url: absoluteUrl(origin, `${profilePath}/recap`),
      share_url: shareParams.toString()
        ? absoluteUrl(origin, `/?${shareParams.toString()}`)
        : absoluteUrl(origin, '/'),
      leaderboard_url: archetype ? absoluteUrl(origin, `/leaderboard/${encodeURIComponent(archetype)}`) : null,
      match_url: archetype ? absoluteUrl(origin, `/match?goal=pair-coding&archetype=${encodeURIComponent(archetype)}`) : null,
    },
    privacy: {
      raw_claude_code_sessions: 'local-only',
      synced_profile_fields: 'derived-only',
      digest_uses: 'saved derived metrics',
      email_address_public: false,
    },
  };
}

export { nextWeeklyDigestAt };
