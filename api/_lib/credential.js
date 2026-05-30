import { createHash } from 'node:crypto';
import { publicUpload } from './public-profile.js';
import { signatureFromUpload } from './signatures.js';

export const DERIVED_PROFILE_SCHEMA = 'vibestats.derived_profile.v1';
const RAW_LEAK_PATTERNS = ['rawJson', 'tool_usage', 'language_usage'];

const DERIVED_PROFILE_SPEC_BODY = Object.freeze({
  schema_version: DERIVED_PROFILE_SCHEMA,
  purpose: 'A public, source-agnostic build identity claim derived locally from coding-agent activity.',
  trust_tier: 'github_claimed_derived',
  current_source: {
    id: 'claude_code_insights',
    label: 'Claude Code /insights',
    local_inputs: ['session metadata files', 'facet summaries', 'report HTML'],
    extractor_location: 'user machine',
    raw_data_boundary: 'local-only',
  },
  future_sources: ['codex', 'cursor', 'aider', 'git', 'terminal'],
  public_claims: [
    'github-claimed subject',
    'primary archetype',
    'derived signature',
    'public score vector',
    'facet radar',
    'coarse activity buckets',
    'rarity cohort',
    'leaderboard proof',
    'collectible badges',
  ],
  synced_fields: 'derived-only',
  forbidden_synced_fields: [
    'prompts',
    'session summaries',
    'project paths',
    'session ids',
    'raw tool-count maps',
    'raw language-count maps',
    'free-text goals',
    'free-text friction details',
    'credentials or API keys',
  ],
  matching_contract: {
    allowed_signals: ['archetype', 'scores', 'facets', 'coarse activity', 'explicit match intent', 'bounded outcome events'],
    forbidden_signals: ['single hireable score', 'private repo access', 'employer people search', 'raw work transcript'],
  },
});

function absoluteUrl(origin, path) {
  return new URL(path, `${origin}/`).toString();
}

function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null || item === '') continue;
    const cleaned = cleanObject(item);
    if (cleaned === undefined) continue;
    if (Array.isArray(cleaned) && !cleaned.length) continue;
    if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && !Object.keys(cleaned).length) continue;
    out[key] = cleaned;
  }
  return out;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function publicPayloadHasNoRawUsageFields(value) {
  const text = JSON.stringify(value || {});
  return RAW_LEAK_PATTERNS.every((pattern) => !text.includes(pattern));
}

export function derivedProfileSpec(origin = 'https://vibestats.io') {
  const promises = absoluteUrl(origin, '/promises');
  return cleanObject({
    ...DERIVED_PROFILE_SPEC_BODY,
    links: {
      promises,
      spec: absoluteUrl(origin, '/api/derived-profile-spec'),
    },
    privacy: {
      raw_source_data: 'local-only',
      public_profile_fields: 'bounded-derived-only',
      deletion_model: 'builder-owned',
    },
  });
}

export function buildDerivedProfileCredential({
  origin = 'https://vibestats.io',
  user,
  upload,
  visibility = {},
  rarity = null,
  leaderboard = null,
  achievements = [],
} = {}) {
  if (!user?.gh_handle || !upload?.archetype) return null;

  const handle = user.gh_handle;
  const encodedHandle = encodeURIComponent(handle);
  const publicLatest = publicUpload(upload, visibility, { isOwner: false });
  const signature = signatureFromUpload(upload);
  const profilePath = `/u/${encodedHandle}`;
  const comparePath = `/?compareTo=${encodedHandle}&compareArchetype=${encodeURIComponent(upload.archetype)}`;
  const credentialPath = `${profilePath}/credential.json`;
  const profileUrl = absoluteUrl(origin, profilePath);
  const compareUrl = absoluteUrl(origin, comparePath);
  const credential = cleanObject({
    schema_version: DERIVED_PROFILE_SCHEMA,
    subject: {
      github_handle: handle,
      github_anchor: `https://github.com/${handle}`,
      github_claimed: true,
      profile_url: profileUrl,
    },
    issued_at: upload.uploaded_at ? new Date(upload.uploaded_at).toISOString() : null,
    claim: {
      archetype: publicLatest.archetype,
      signature: signature ? {
        label: signature.label,
        combo: signature.combo,
        secondary: signature.secondary,
      } : null,
      scores: publicLatest.scores,
      facets: publicLatest.facets,
      activity: publicLatest.activity,
      rarity,
      leaderboard,
      achievements: (achievements || []).slice(0, 6).map((badge) => cleanObject({
        id: badge.id,
        label: badge.label,
        value: badge.value,
        detail: badge.detail,
      })),
    },
    links: {
      profile: profileUrl,
      compare: compareUrl,
      badge: absoluteUrl(origin, `${profilePath}/badge.svg`),
      embed: absoluteUrl(origin, `${profilePath}/embed`),
      recap: absoluteUrl(origin, `${profilePath}/recap`),
      promises: absoluteUrl(origin, '/promises'),
      credential: absoluteUrl(origin, credentialPath),
    },
    privacy: {
      raw_claude_code_sessions: 'local-only',
      synced_profile_fields: 'derived-only',
      public_metrics_default: 'coarse',
      no_raw_usage_fields: true,
      no_single_hireable_score: true,
      no_employer_people_search: true,
    },
    method: {
      spec_version: DERIVED_PROFILE_SCHEMA,
      spec_url: absoluteUrl(origin, '/api/derived-profile-spec'),
      spec_path: '/api/derived-profile-spec',
      trust_tier: 'github_claimed_derived',
      derived_locally: true,
      source: {
        id: DERIVED_PROFILE_SPEC_BODY.current_source.id,
        label: DERIVED_PROFILE_SPEC_BODY.current_source.label,
        raw_data_boundary: DERIVED_PROFILE_SPEC_BODY.current_source.raw_data_boundary,
      },
      synced_fields: DERIVED_PROFILE_SPEC_BODY.synced_fields,
      future_source_ready: true,
    },
  });

  const hash = sha256Hex(canonicalJson(credential));
  return {
    ...credential,
    verification: {
      credential_id: `vibestats:${hash.slice(0, 24)}`,
      content_hash: `sha256:${hash}`,
      algorithm: 'sha256-canonical-json-v1',
      verification_url: absoluteUrl(origin, credentialPath),
      profile_url: profileUrl,
      raw_field_scan: publicPayloadHasNoRawUsageFields(credential) ? 'passed' : 'failed',
      privacy_promises_url: absoluteUrl(origin, '/promises'),
    },
  };
}
