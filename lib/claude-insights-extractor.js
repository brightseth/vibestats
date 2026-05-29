import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const TOOL_NAMES = {
  bash: 'bash',
  shell: 'bash',
  read: 'read',
  write: 'write',
  edit: 'edit',
  multiedit: 'edit',
  notebookedit: 'edit',
  grep: 'grep',
  glob: 'grep',
};

function number(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function addToMap(target, key, value) {
  const safeKey = String(key || '').trim();
  if (!safeKey) return;
  target[safeKey] = number(target[safeKey]) + number(value);
}

function addTools(target, counts = {}) {
  for (const [name, value] of Object.entries(counts || {})) {
    const normalized = normalizeKey(name);
    const mapped = TOOL_NAMES[normalized];
    if (mapped) addToMap(target, mapped, value);
  }
}

function addLanguages(target, counts = {}) {
  for (const [name, value] of Object.entries(counts || {})) {
    const normalized = normalizeKey(name);
    if (normalized) addToMap(target, normalized, value);
  }
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonDirectory(path) {
  let entries = [];
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  const out = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      out.push(await readJsonFile(join(path, entry.name)));
    } catch {
      // Ignore malformed per-session files; one broken session should not block a local sync.
    }
  }
  return out;
}

async function latestReportDateRange(path) {
  let entries = [];
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return '';
  }

  const reports = entries
    .filter((entry) => entry.isFile() && /^report.*\.html$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const report of reports) {
    const html = await readFile(join(path, report), 'utf8').catch(() => '');
    const match = html.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
    if (match) return `${match[1]} to ${match[2]}`;
  }
  return '';
}

function sessionDateRange(sessions = [], reportDateRange = '') {
  const dates = sessions.map((session) => dateOnly(session.start_time)).filter(Boolean).sort();
  if (dates.length) return `${dates[0]} to ${dates[dates.length - 1]}`;
  return reportDateRange;
}

export function insightsFromClaudeUsage({ sessions = [], facets = [], reportDateRange = '' } = {}) {
  const toolUsage = {};
  const languageUsage = {};
  let messages = 0;
  let commits = 0;
  let taskAgentSessions = 0;

  for (const session of sessions) {
    messages += number(session.user_message_count) + number(session.assistant_message_count);
    commits += number(session.git_commits);
    if (session.uses_task_agent === true) taskAgentSessions += 1;
    addTools(toolUsage, session.tool_counts);
    addLanguages(languageUsage, session.languages);
  }

  const buggyCodeEvents = facets.reduce((sum, facet) => (
    sum + number(facet?.friction_counts?.buggy_code)
  ), 0);
  const totalSessions = sessions.length;

  return {
    meta: {
      date_range: sessionDateRange(sessions, reportDateRange),
    },
    metrics: {
      total_sessions: totalSessions,
      total_messages: messages,
      commits,
      buggy_code_events: buggyCodeEvents,
      multi_clauding_rate: totalSessions > 0 ? taskAgentSessions / totalSessions : 0,
      tool_usage: toolUsage,
      language_usage: languageUsage,
    },
  };
}

export async function insightsFromClaudeUsageDirectory(path) {
  const sessions = await readJsonDirectory(join(path, 'session-meta'));
  if (!sessions.length) {
    throw new Error(`No Claude Code /insights session metadata found in ${path}. Run /insights first, or pass --file to an exported JSON file.`);
  }
  const [facets, reportDateRange] = await Promise.all([
    readJsonDirectory(join(path, 'facets')),
    latestReportDateRange(path),
  ]);
  return insightsFromClaudeUsage({ sessions, facets, reportDateRange });
}

export async function readInsightsInput(path) {
  const info = await stat(path);
  if (info.isDirectory()) return insightsFromClaudeUsageDirectory(path);

  if (info.isFile() && basename(path).toLowerCase().endsWith('.html')) {
    return insightsFromClaudeUsageDirectory(dirname(path));
  }

  return readJsonFile(path);
}
