import { sql } from './db.js';
import { rarityTier } from './signatures.js';

const ARCHETYPE_SHORT_NAMES = {
  orchestrator: 'Orchestrator',
  shipper: 'Shipper',
  architect: 'Architect',
  debugger: 'Debugger',
  polyglot: 'Polyglot',
  sprinter: 'Sprinter',
  deepdiver: 'Deep Diver',
  builder: 'Builder',
};

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function rarityProof(rarity) {
  if (!rarity?.count) return '';
  const plural = rarity.count === 1 ? 'profile' : 'profiles';
  return `${rarity.tier} combo: 1 of ${fmt(rarity.count)} saved ${plural} this month`;
}

export function leaderboardProof(leaderboard) {
  if (!leaderboard?.rank) return '';
  const label = ARCHETYPE_SHORT_NAMES[leaderboard.label] || leaderboard.label || 'archetype';
  const total = leaderboard.total ? ` of ${fmt(leaderboard.total)}` : '';
  return `#${fmt(leaderboard.rank)}${total} on weekly ${label} board`;
}

export function profileShareProof({ rarity = null, leaderboard = null } = {}) {
  return [
    rarityProof(rarity),
    leaderboardProof(leaderboard),
  ].filter(Boolean).join(' / ');
}

export async function rarityForSignature(signature) {
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
    fingerprint: signature.fingerprint,
    count,
    tier: rarityTier(count),
    window_days: 30,
  };
}
