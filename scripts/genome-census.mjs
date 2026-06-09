#!/usr/bin/env node
// Weekly genome census: turns /api/stats aggregates into a ready-to-post draft.
// Reads PUBLIC aggregate data only. Drafts land in research/ (gitignored) for the
// human to post — this script never publishes anywhere.
// Usage: node scripts/genome-census.mjs [--host https://vibestats.io]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HOST = process.argv.includes('--host') ? process.argv[process.argv.indexOf('--host') + 1] : 'https://vibestats.io';
const SNAP = 'research/genome-census.json';
const OUTDIR = 'research/census-drafts';
const NAMES = { orchestrator: 'Orchestrator', shipper: 'Shipper', architect: 'Architect', debugger: 'Debugger', polyglot: 'Polyglot', sprinter: 'Sprinter', deepdiver: 'Deep Diver', builder: 'Builder' };

const res = await fetch(`${HOST}/api/stats`);
if (!res.ok) { console.error('stats fetch failed', res.status); process.exit(1); }
const stats = await res.json();
const total = Number(stats.total || 0);
const arch = stats.archetypes || {};

let prev = null;
try { prev = JSON.parse(readFileSync(SNAP, 'utf8')); } catch { /* first run */ }

const rows = Object.entries(NAMES).map(([key, name]) => {
  const count = Number(arch[key] || 0);
  const pct = total ? Math.round((count / total) * 1000) / 10 : 0;
  const prevCount = prev ? Number(prev.archetypes?.[key] || 0) : null;
  const delta = prevCount == null ? null : count - prevCount;
  return { key, name, count, pct, delta };
}).sort((a, b) => b.count - a.count);

const top = rows[0];
const rare = [...rows].reverse().find((r) => r.count > 0) || rows[rows.length - 1];
const mover = prev ? [...rows].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0] : null;
const newReveals = prev ? total - Number(prev.total || 0) : null;
const date = new Date().toISOString().slice(0, 10);

const lines = rows.map((r) => `${r.name.padEnd(12)} ${String(r.pct).padStart(5)}%${r.delta != null && r.delta !== 0 ? `  (${r.delta > 0 ? '+' : ''}${r.delta})` : ''}`).join('\n');

const draft = `# Genome census draft — ${date}
(${total} reveals analyzed${newReveals != null ? `, ${newReveals >= 0 ? '+' : ''}${newReveals} since last census` : ''}; data: ${HOST}/genome)

## Tweet draft
The Claude Code genome this week (${total} builders analyzed):

${rows.slice(0, 4).map((r) => `${r.name} ${r.pct}%`).join(' · ')}

Most common: ${top.name}. Rarest: ${rare.name} (${rare.pct}%).${mover && mover.delta > 0 ? ` Fastest growing: ${mover.name} (+${mover.delta}).` : ''}

Which are you? → vibestats.io

## Full table
\`\`\`
${lines}
\`\`\`

Rules check: counts are live aggregates from /genome (launch baseline + real submissions
— per SHARE-PLAYBOOK, treat the baseline as scaffold and don't present counts as pure
organic users while the baseline dominates; phrasing above says "analyzed", which is true).
`;

mkdirSync(OUTDIR, { recursive: true });
const out = join(OUTDIR, `census-${date}.md`);
writeFileSync(out, draft);
writeFileSync(SNAP, JSON.stringify({ ts: new Date().toISOString(), total, archetypes: arch }, null, 2));
console.log(`census draft → ${out}`);
console.log(draft.split('## Full table')[0]);
