const MAX_MOMENTS = 3;

function formatInt(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

const MOMENT_DEFS = {
  longest_session_minutes: {
    label: 'Marathon session',
    detail: 'Longest Claude Code session',
    max: 60 * 72,
    threshold: 60,
    weight: 1.25,
    exact(value) {
      const minutes = Math.round(value);
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      if (hours <= 0) return `${minutes}m`;
      return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
    },
    bucket(value) {
      if (value >= 60 * 24) return '24h+ session';
      if (value >= 60 * 10) return '10h+ session';
      if (value >= 60 * 4) return '4h+ session';
      return '1h+ session';
    },
  },
  terminal_commands: {
    label: 'Terminal heavy',
    detail: 'Bash commands routed through Claude Code',
    max: 1_000_000,
    threshold: 100,
    weight: 1.1,
    exact(value) {
      return `${formatInt(value)} Bash commands`;
    },
    bucket(value) {
      if (value >= 100_000) return '100k+ commands';
      if (value >= 10_000) return '10k+ commands';
      if (value >= 1_000) return '1k+ commands';
      return '100+ commands';
    },
  },
  files_modified: {
    label: 'Wide edit surface',
    detail: 'Files modified across tracked sessions',
    max: 100_000,
    threshold: 10,
    weight: 0.9,
    exact(value) {
      return `${formatInt(value)} files modified`;
    },
    bucket(value) {
      if (value >= 1_000) return '1k+ files touched';
      if (value >= 100) return '100+ files touched';
      return '10+ files touched';
    },
  },
  lines_changed: {
    label: 'Code movement',
    detail: 'Lines added or removed',
    max: 5_000_000,
    threshold: 500,
    weight: 0.85,
    exact(value) {
      return `${formatInt(value)} lines changed`;
    },
    bucket(value) {
      if (value >= 100_000) return '100k+ lines changed';
      if (value >= 10_000) return '10k+ lines changed';
      return '500+ lines changed';
    },
  },
  task_agent_sessions: {
    label: 'Parallel agent use',
    detail: 'Sessions that used task agents',
    max: 100_000,
    threshold: 2,
    weight: 1,
    exact(value) {
      return `${formatInt(value)} agent sessions`;
    },
    bucket(value) {
      if (value >= 100) return '100+ agent sessions';
      if (value >= 10) return '10+ agent sessions';
      return 'multi-agent sessions';
    },
  },
  debug_events: {
    label: 'Debug battles',
    detail: 'Buggy-code friction signals',
    max: 100_000,
    threshold: 2,
    weight: 0.7,
    exact(value) {
      return `${formatInt(value)} debug friction events`;
    },
    bucket(value) {
      if (value >= 100) return '100+ debug events';
      if (value >= 10) return '10+ debug events';
      return 'debug-heavy sessions';
    },
  },
};

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boundedMomentValue(id, value) {
  const def = MOMENT_DEFS[id];
  const n = finiteNumber(value);
  if (!def || n == null || n < def.threshold) return null;
  return Math.min(Math.max(Math.round(n), 0), def.max);
}

export function sanitizeMoments(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const id = typeof item?.id === 'string' ? item.id : '';
    if (seen.has(id) || !MOMENT_DEFS[id]) continue;
    const safeValue = boundedMomentValue(id, item?.value);
    if (safeValue == null) continue;
    seen.add(id);
    out.push({ id, value: safeValue });
    if (out.length >= MAX_MOMENTS) break;
  }
  return out;
}

export function buildBehavioralMoments(data = {}) {
  const metrics = data.metrics || {};
  const tools = metrics.tool_usage || {};
  const candidates = [
    { id: 'longest_session_minutes', value: metrics.longest_session_minutes },
    { id: 'terminal_commands', value: tools.bash || metrics.terminal_commands },
    { id: 'files_modified', value: metrics.files_modified },
    { id: 'lines_changed', value: metrics.lines_changed },
    { id: 'task_agent_sessions', value: metrics.task_agent_sessions },
    { id: 'debug_events', value: metrics.buggy_code_events },
  ]
    .map((item) => {
      const value = boundedMomentValue(item.id, item.value);
      const def = MOMENT_DEFS[item.id];
      if (value == null || !def) return null;
      return {
        id: item.id,
        value,
        score: (value / def.threshold) * def.weight,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MOMENTS)
    .map(({ id, value }) => ({ id, value }));

  return sanitizeMoments(candidates);
}

export function publicMoments(value, { exact = false } = {}) {
  return sanitizeMoments(value).map((moment) => {
    const def = MOMENT_DEFS[moment.id];
    return {
      id: moment.id,
      label: def.label,
      value: exact ? def.exact(moment.value) : def.bucket(moment.value),
      detail: def.detail,
    };
  });
}
