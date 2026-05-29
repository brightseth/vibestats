import { createDigestUnsubscribeToken, originForRequest } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { buildWeeklyDigest } from '../_lib/digest.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from '../_lib/http.js';
import { weeklyLeaderboardRank } from '../_lib/leaderboard-rank.js';
import { rarityTier, signatureFromUpload } from '../_lib/signatures.js';

const MAX_DIGESTS_PER_RUN = 100;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    const err = new Error('Weekly digest delivery is not configured');
    err.statusCode = 503;
    throw err;
  }

  const header = req.headers?.authorization || '';
  if (header !== `Bearer ${secret}`) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

function resendReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);
}

export function resendDigestPayload({ to, digest }) {
  const payload = {
    from: process.env.DIGEST_FROM_EMAIL,
    to,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    reply_to: process.env.DIGEST_REPLY_TO || undefined,
    tags: [
      { name: 'product', value: 'vibestats' },
      { name: 'kind', value: 'weekly-digest' },
    ],
  };

  if (digest.unsubscribe_url) {
    payload.headers = {
      'List-Unsubscribe': `<${digest.unsubscribe_url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  return payload;
}

async function sendDigestEmail({ to, digest }) {
  if (!resendReady()) {
    const err = new Error('Weekly digest delivery is not configured');
    err.statusCode = 503;
    throw err;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resendDigestPayload({ to, digest })),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Resend failed: ${response.status} ${detail}`.trim());
    err.statusCode = 502;
    throw err;
  }

  return response.json().catch(() => ({}));
}

async function monthlyRarity(latest) {
  const signature = signatureFromUpload(latest);
  if (!signature?.fingerprint) return null;

  const rows = await sql()`
    with latest_uploads as (
      select distinct on (user_id) user_id, raw_meta, uploaded_at
      from uploads
      order by user_id, uploaded_at desc
    )
    select count(*)::int as count
    from latest_uploads
    where raw_meta->>'signatureFingerprint' = ${signature.fingerprint}
      and uploaded_at > now() - interval '30 days'
  `;
  const count = rows[0]?.count || 1;
  return {
    count,
    tier: rarityTier(count),
  };
}

async function digestCandidates() {
  return sql()`
    select
      u.id,
      u.gh_handle,
      u.avatar_url,
      u.privacy,
      ps.digest_email,
      ps.weekly_digest_sent_at
    from profile_settings ps
    join users u on u.id = ps.user_id
    where ps.weekly_digest_opt_in = true
      and ps.digest_email is not null
      and (
        ps.weekly_digest_sent_at is null
        or ps.weekly_digest_sent_at < date_trunc('week', now())
      )
    order by ps.email_consent_at nulls last, ps.updated_at
    limit ${MAX_DIGESTS_PER_RUN}
  `;
}

async function latestUploads(userId) {
  return sql()`
    select archetype, scores, metrics, raw_meta, uploaded_at
    from uploads
    where user_id = ${userId}
    order by uploaded_at desc
    limit 8
  `;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST'], NO_STORE_HEADERS);

  try {
    authorized(req);

    const dryRun = req.query?.dryRun === '1' || req.query?.dry_run === '1' || process.env.DIGEST_DRY_RUN === '1';
    const origin = originForRequest(req);
    const candidates = await digestCandidates();
    const results = [];

    for (const user of candidates) {
      const uploads = await latestUploads(user.id);
      if (!uploads.length) {
        results.push({ handle: user.gh_handle, skipped: 'no_uploads' });
        continue;
      }

      const latest = uploads[0];
      const digest = buildWeeklyDigest({
        user,
        uploads,
        rarity: await monthlyRarity(latest),
        leaderboard: await weeklyLeaderboardRank(user, latest),
        origin,
        unsubscribeToken: createDigestUnsubscribeToken(user),
      });
      if (!digest) {
        results.push({ handle: user.gh_handle, skipped: 'no_digest' });
        continue;
      }

      if (!dryRun) {
        await sendDigestEmail({ to: user.digest_email, digest });
        await sql()`
          update profile_settings
          set weekly_digest_sent_at = now(), updated_at = now()
          where user_id = ${user.id}
        `;
      }

      results.push({
        handle: user.gh_handle,
        to: user.digest_email,
        subject: digest.subject,
        sent: !dryRun,
        dry_run: dryRun,
      });
    }

    return json(res, 200, {
      ok: true,
      dry_run: dryRun,
      resend_ready: resendReady(),
      considered: candidates.length,
      results,
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('weekly digest cron error:', err);
    return json(res, err.statusCode || 500, { error: err.message || 'Weekly digest failed' }, NO_STORE_HEADERS);
  }
}
