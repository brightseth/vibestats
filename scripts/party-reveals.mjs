#!/usr/bin/env node
// Terminal Party blind-pairing reveal pipeline.
// Takes attendee handles, fetches each one's public credential (if revealed),
// shuffles them into pairs, and emits ready-to-paste whiteboard markdown with
// pairing-card images. Output goes to stdout AND research/ (gitignored).
// PUBLIC data only (the /u/:handle/credential.json endpoint). No DB access.
//
// Usage:
//   node scripts/party-reveals.mjs alice,bob,carol
//   node scripts/party-reveals.mjs alice:architect,bob   (override/supply archetype)
//   HOST=http://localhost:3000 node scripts/party-reveals.mjs ...
import { writeFileSync, mkdirSync } from 'node:fs';

const HOST = process.env.HOST || 'https://vibestats.io';
const ARCHES = ['orchestrator', 'shipper', 'architect', 'debugger', 'polyglot', 'sprinter', 'deepdiver', 'builder'];
const raw = (process.argv[2] || '').trim();
if (!raw) { console.error('usage: node scripts/party-reveals.mjs handle[,handle:archetype,...]'); process.exit(1); }

const entries = raw.split(',').map((s) => {
  const [handle, override] = s.trim().split(':');
  return { handle: handle.trim(), override: override?.trim() || null };
}).filter((e) => e.handle);

async function archetypeFor({ handle, override }) {
  if (override) return ARCHES.includes(override) ? override : null;
  try {
    const res = await fetch(`${HOST}/u/${encodeURIComponent(handle)}/credential.json`);
    if (!res.ok) return null;
    const cred = await res.json();
    const a = String(cred?.claim?.archetype || cred?.archetype || '').toLowerCase();
    return ARCHES.includes(a) ? a : null;
  } catch { return null; }
}

const guests = [];
for (const e of entries) {
  const archetype = await archetypeFor(e);
  guests.push({ handle: e.handle, archetype });
}

const revealed = guests.filter((g) => g.archetype);
const unrevealed = guests.filter((g) => !g.archetype);

// Shuffle revealed guests into pairs; odd one out pairs with the host.
const pool = [...revealed].sort(() => Math.random() - 0.5);
const pairs = [];
while (pool.length >= 2) pairs.push([pool.shift(), pool.shift()]);
if (pool.length === 1) pairs.push([pool.shift(), { handle: 'brightseth', archetype: 'deepdiver' }]);

function cardUrl(a, b) {
  const p = new URLSearchParams({ mode: 'pair', a: a.archetype, b: b.archetype, an: a.handle, bn: b.handle, d: '45', c: '6', l: '4', s: '120' });
  return `${HOST}/api/og?${p}`;
}

let md = `# 🎲 BLIND PAIRING REVEALS — Terminal Party\n\n`;
pairs.forEach(([a, b], i) => {
  md += `## Reveal ${i + 1}: @${a.handle} × @${b.handle}\n\n`;
  md += `![${a.handle} × ${b.handle}](${cardUrl(a, b)})\n\n`;
  md += `*${a.archetype} × ${b.archetype} — (host: one line on why this pair works)*\n\n---\n\n`;
});
if (unrevealed.length) {
  md += `## 🎁 Not yet revealed\n\n`;
  for (const g of unrevealed) md += `- @${g.handle} — reveal live at the party → ${HOST}\n`;
}

mkdirSync('research', { recursive: true });
const out = `research/party-reveals-${new Date().toISOString().slice(0, 10)}.md`;
writeFileSync(out, md);
console.log(md);
console.error(`\n→ saved to ${out} (${pairs.length} pairs, ${unrevealed.length} unrevealed)`);
