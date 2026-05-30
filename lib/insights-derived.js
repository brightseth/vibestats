import { ARCHETYPE_KEYS, signatureFingerprint, topArchetype as canonicalTopArchetype } from '../api/_lib/signatures.js';
import { buildBehavioralMoments } from '../api/_lib/moments.js';

const NON_CODE_LANGS = new Set(['markdown', 'json', 'toml', 'yaml', 'yml', 'xml', 'csv', 'txt', 'ini', 'conf', 'env']);

const SUB_PREFIXES = {
  orchestrator: 'parallel',
  shipper: 'high-velocity',
  architect: 'methodical',
  debugger: 'investigative',
  polyglot: 'multi-stack',
  sprinter: 'rapid-fire',
  deepdiver: 'deep-session',
  builder: 'prolific',
};

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

function sig(x, midpoint, steepness) {
  return 1 / (1 + Math.exp(-steepness * (Number(x || 0) - midpoint)));
}

export function parseDays(data = {}) {
  try {
    const range = data.meta?.date_range || '';
    const parts = range.split(' to ');
    if (parts.length === 2) {
      const start = new Date(parts[0].trim());
      const end = new Date(parts[1].trim());
      return Math.max(1, Math.ceil((end - start) / 86400000));
    }
  } catch {
    // Fall through to session estimate.
  }
  return Math.max(1, Math.ceil((data.metrics?.total_sessions || 100) / 20));
}

export function scoreArchetypes(data = {}) {
  const m = data.metrics || {};
  const tools = m.tool_usage || {};
  const allLangs = Object.keys(m.language_usage || {});
  const langs = allLangs.filter((lang) => !NON_CODE_LANGS.has(lang.toLowerCase()));
  const totalTools = Object.values(tools).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  const sessions = m.total_sessions || 1;
  const messages = m.total_messages || 0;
  const commits = m.commits || 0;
  const days = parseDays(data);

  const msgsPerSession = messages / sessions;
  const commitsPerSession = commits / sessions;
  const sessionsPerDay = sessions / Math.max(days, 1);
  const bashRate = (tools.bash || 0) / totalTools;
  const readRate = (tools.read || 0) / totalTools;
  const writeRate = (tools.write || 0) / totalTools;
  const grepRate = (tools.grep || 0) / totalTools;
  const bashEditRatio = (tools.bash || 0) / Math.max(tools.edit || 1, 1);
  const readWriteRatio = (tools.read || 0) / Math.max((tools.write || 0) + (tools.edit || 0), 1);
  const writeEditRate = ((tools.write || 0) + (tools.edit || 0)) / totalTools;
  const mcRate = m.multi_clauding_rate || 0;
  const frictionRate = (m.buggy_code_events || 0) / sessions;

  const raw = {
    orchestrator: sig(mcRate, 0.15, 12) * 50 + sig(bashEditRatio, 2.5, 1) * 30 + sig(sessions, 400, 0.005) * 20,
    shipper: sig(commitsPerSession, 1.0, 2.5) * 50 + sig(commits / Math.max(days, 1), 8, 0.2) * 30 + sig(writeRate, 0.06, 25) * 20,
    architect: sig(readWriteRatio, 2.5, 1.5) * 50 + sig(readRate, 0.25, 8) * 30 + sig(msgsPerSession, 10, 0.15) * 20,
    debugger: sig(grepRate, 0.05, 35) * 50 + sig(frictionRate, 0.03, 40) * 30 + sig(bashRate, 0.4, 5) * 20,
    polyglot: sig(langs.length, 5, 0.8) * 60 + sig(langs.length, 3, 1.5) * 40,
    sprinter: sig(sessionsPerDay, 6, 0.4) * 50 + sig(messages, 4000, 0.0004) * 25 + (1 - sig(msgsPerSession, 12, 0.2)) * 25,
    deepdiver: sig(msgsPerSession, 12, 0.25) * 50 + (1 - sig(sessionsPerDay, 5, 0.4)) * 30 + sig(msgsPerSession, 20, 0.15) * 20,
    builder: sig(writeEditRate, 0.2, 10) * 50 + (1 - sig(readWriteRatio, 2.0, 1)) * 30 + sig((tools.write || 0) + (tools.edit || 0), 1500, 0.001) * 20,
  };

  const primarySignals = {
    orchestrator: sig(mcRate, 0.15, 12),
    shipper: sig(commitsPerSession, 1.0, 2.5),
    architect: sig(readWriteRatio, 2.5, 1.5),
    debugger: sig(grepRate, 0.05, 35),
    polyglot: sig(langs.length, 5, 0.8),
    sprinter: sig(sessionsPerDay, 6, 0.4),
    deepdiver: sig(msgsPerSession, 12, 0.25),
    builder: sig(writeEditRate, 0.2, 10),
  };

  const maxRaw = Math.max(...Object.values(raw));
  const scores = {};
  for (const key of Object.keys(raw)) {
    const ratio = maxRaw > 0 ? raw[key] / maxRaw : 0;
    scores[key] = Math.round(Math.pow(ratio, 1.5) * 92);
  }

  scores._percentiles = {};
  for (const key of Object.keys(primarySignals)) {
    scores._percentiles[key] = Math.max(1, Math.round((1 - primarySignals[key]) * 100));
  }

  return scores;
}

export function topArchetype(scores = {}) {
  return canonicalTopArchetype(scores, 'builder');
}

export function extractInsights(data = {}) {
  const m = data.metrics || {};
  const tools = m.tool_usage || {};
  const langUsage = m.language_usage || {};
  const days = parseDays(data);
  const sessions = m.total_sessions || 0;
  const messages = m.total_messages || 0;
  const commits = m.commits || 0;
  const codeLangs = Object.keys(langUsage).filter((lang) => !NON_CODE_LANGS.has(lang.toLowerCase()));

  return {
    dateRange: data.meta?.date_range || '',
    days,
    sessions,
    commits,
    commitsPerDay: Math.round(commits / days),
    msgsPerSession: sessions > 0 ? Math.round(messages / sessions) : 0,
    codeLangCount: codeLangs.length,
  };
}

function vibeSignature(scores, primary) {
  const secondary = Object.entries(scores)
    .filter(([key]) => key !== primary && ARCHETYPE_KEYS.includes(key))
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
  if (!secondary) return null;

  return {
    label: `${SUB_PREFIXES[secondary] || secondary} ${ARCHETYPE_SHORT_NAMES[primary] || primary}`,
    combo: `${secondary}+${primary}`,
    secondary,
    fingerprint: signatureFingerprint(scores, primary),
  };
}

export function derivedUploadPayloadFromInsights(data = {}, { source = 'cli' } = {}) {
  const scores = scoreArchetypes(data);
  const archetype = topArchetype(scores);
  const insights = extractInsights(data);
  const signature = vibeSignature(scores, archetype);
  const moments = buildBehavioralMoments(data);

  return {
    archetype,
    scores,
    metrics: {
      commitsPerDay: insights.commitsPerDay,
      sessions: insights.sessions,
      languages: insights.codeLangCount,
      msgsPerSession: insights.msgsPerSession,
      days: insights.days,
    },
    raw_meta: {
      dateRange: insights.dateRange,
      source,
      version: 'wave-1',
      ...(signature ? {
        signature: signature.label,
        signatureCombo: signature.combo,
        secondaryArchetype: signature.secondary,
        signatureFingerprint: signature.fingerprint,
      } : {}),
      ...(moments.length ? { moments } : {}),
    },
  };
}
