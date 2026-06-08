// Facet signals — the depth layer.
//
// Claude Code /insights writes one rich, LLM-judged facet file per session
// (outcome, helpfulness, session_type, primary_success, satisfaction, friction).
// We derive COUNTS-ONLY distributions from these, locally, and sync only the
// counts. No free text, no goals, no summaries ever cross the boundary.
//
// PRIVACY CONTRACT — allowlist, not denylist:
//   friction_counts is FREE VOCABULARY (the model invents keys, e.g. secret_leak,
//   and could in principle emit a sensitive label). So every category here maps a
//   FIXED set of known keys to a BOUNDED taxonomy; ANY unrecognized key — including
//   secret_leak and any future label — is dropped. The keyspace that can cross the
//   wire is closed and enumerable below.
//
//   aggregateFacetSignals() runs locally (CLI) to build the counts.
//   sanitizeFacetSignals() runs server-side on ingest and re-validates against the
//   SAME allowlist — the client is never trusted to have filtered correctly.

// raw enum value -> canonical (short) key. Only these raw values are counted.
const OUTCOME_KEYS = {
  fully_achieved: 'fully',
  mostly_achieved: 'mostly',
  partially_achieved: 'partially',
  not_achieved: 'not_achieved',
  unclear_from_transcript: 'unclear',
};

const HELPFULNESS_KEYS = {
  essential: 'essential',
  very_helpful: 'very_helpful',
  moderately_helpful: 'moderately_helpful',
  slightly_helpful: 'slightly_helpful',
  unhelpful: 'unhelpful',
};

const SESSION_TYPE_KEYS = {
  multi_task: 'multi_task',
  single_task: 'single_task',
  exploration: 'exploration',
  quick_question: 'quick_question',
  iterative_refinement: 'iterative',
};

const SUCCESS_KEYS = {
  proactive_help: 'proactive_help',
  multi_file_changes: 'multi_file_changes',
  good_explanations: 'good_explanations',
  good_debugging: 'good_debugging',
  fast_accurate_search: 'search',
  correct_code_edits: 'code_edits',
  none: 'none',
};

// user_satisfaction_counts keys collapse to a 3-way register.
const SATISFACTION_POS = new Set(['satisfied', 'likely_satisfied', 'happy', 'very_satisfied']);
const SATISFACTION_NEU = new Set(['neutral', 'unclear', 'mixed']);
const SATISFACTION_NEG = new Set(['dissatisfied', 'likely_dissatisfied', 'unhappy', 'frustrated']);

// friction_counts (FREE VOCAB) -> 4 bounded buckets. Unlisted keys (incl.
// secret_leak) are intentionally absent and therefore dropped.
const FRICTION_MAP = {
  // collaboration: friction in the human <-> AI loop
  wrong_approach: 'collaboration',
  misunderstood_request: 'collaboration',
  missed_context: 'collaboration',
  missing_context: 'collaboration',
  stale_context: 'collaboration',
  false_tool_claim: 'collaboration',
  user_rejected_action: 'collaboration',
  // code: defects in produced code
  buggy_code: 'code',
  // tooling: local tools / environment / dependencies
  tool_unavailable: 'tooling',
  tool_misconfiguration: 'tooling',
  tool_timeout: 'tooling',
  missing_tools: 'tooling',
  missing_dependencies: 'tooling',
  environment_issue: 'tooling',
  // platform: API / rate limits / network — outside the user's control
  api_error: 'platform',
  api_errors: 'platform',
  rate_limit_error: 'platform',
  rate_limit_errors: 'platform',
  api_rate_limit: 'platform',
  output_token_limit_exceeded: 'platform',
  slow_response: 'platform',
  network_issues: 'platform',
  external_blocker: 'platform',
};

const SATISFACTION_KEYS = ['positive', 'neutral', 'negative'];
const FRICTION_BUCKETS = ['collaboration', 'code', 'tooling', 'platform'];
const MAX_COUNT = 10_000_000;

// Allowlisted canonical key sets, derived from the maps above (DRY: sanitize
// validates against exactly what aggregate can produce).
const CANON = {
  outcome_mix: new Set(Object.values(OUTCOME_KEYS)),
  helpfulness_mix: new Set(Object.values(HELPFULNESS_KEYS)),
  session_type_mix: new Set(Object.values(SESSION_TYPE_KEYS)),
  success_mix: new Set(Object.values(SUCCESS_KEYS)),
  satisfaction_mix: new Set(SATISFACTION_KEYS),
  friction_taxonomy: new Set(FRICTION_BUCKETS),
};

function clampInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), MAX_COUNT);
}

function tallyEnum(facets, field, keymap) {
  const out = {};
  for (const facet of facets) {
    const canon = keymap[facet?.[field]];
    if (canon) out[canon] = (out[canon] || 0) + 1;
  }
  return out;
}

function nonEmpty(map) {
  return map && typeof map === 'object' && Object.keys(map).length > 0;
}

function hasAnyCounts(signals) {
  return Object.keys(signals).some((key) => key !== 'sessions_analyzed' && nonEmpty(signals[key]));
}

// Local aggregation from the raw facet array. Counts only; free text never read.
export function aggregateFacetSignals(facets = []) {
  if (!Array.isArray(facets) || !facets.length) return null;

  const satisfaction = { positive: 0, neutral: 0, negative: 0 };
  const friction = {};
  for (const facet of facets) {
    for (const [key, value] of Object.entries(facet?.user_satisfaction_counts || {})) {
      const n = Number(value) || 0;
      if (!n) continue;
      if (SATISFACTION_POS.has(key)) satisfaction.positive += n;
      else if (SATISFACTION_NEG.has(key)) satisfaction.negative += n;
      else if (SATISFACTION_NEU.has(key)) satisfaction.neutral += n;
      // unknown satisfaction labels: dropped
    }
    for (const [key, value] of Object.entries(facet?.friction_counts || {})) {
      const bucket = FRICTION_MAP[key];
      if (!bucket) continue; // drops secret_leak + any unrecognized key
      const n = Number(value) || 0;
      if (!n) continue;
      friction[bucket] = (friction[bucket] || 0) + n;
    }
  }

  const satisfactionMix = {};
  for (const key of SATISFACTION_KEYS) if (satisfaction[key] > 0) satisfactionMix[key] = satisfaction[key];

  const signals = {
    sessions_analyzed: facets.length,
    outcome_mix: tallyEnum(facets, 'outcome', OUTCOME_KEYS),
    helpfulness_mix: tallyEnum(facets, 'claude_helpfulness', HELPFULNESS_KEYS),
    session_type_mix: tallyEnum(facets, 'session_type', SESSION_TYPE_KEYS),
    success_mix: tallyEnum(facets, 'primary_success', SUCCESS_KEYS),
    satisfaction_mix: satisfactionMix,
    friction_taxonomy: friction,
  };

  // prune empty sub-maps
  for (const key of Object.keys(signals)) {
    if (key !== 'sessions_analyzed' && !nonEmpty(signals[key])) delete signals[key];
  }
  return hasAnyCounts(signals) ? signals : null;
}

function cleanCountMap(input, allowed) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue; // drop unknown/free-text keys
    const n = clampInt(value); // drop strings / non-finite / <= 0
    if (n != null) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}

// Server-side boundary: re-validate an untrusted facet_signals object against the
// same allowlist. Returns a counts-only object or null. Never trusts the client.
export function sanitizeFacetSignals(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  const sessions = clampInt(input.sessions_analyzed);
  if (sessions != null) out.sessions_analyzed = sessions;
  for (const [field, allowed] of Object.entries(CANON)) {
    const cleaned = cleanCountMap(input[field], allowed);
    if (cleaned) out[field] = cleaned;
  }
  return hasAnyCounts(out) ? out : null;
}

export const FACET_SIGNAL_TAXONOMY = {
  outcome: Object.values(OUTCOME_KEYS),
  helpfulness: Object.values(HELPFULNESS_KEYS),
  session_type: Object.values(SESSION_TYPE_KEYS),
  success: Object.values(SUCCESS_KEYS),
  satisfaction: SATISFACTION_KEYS,
  friction: FRICTION_BUCKETS,
};
