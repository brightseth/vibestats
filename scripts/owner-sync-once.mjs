// One-shot owner profile sync (run under: vercel env run -e production -- node scripts/owner-sync-once.mjs)
import { homedir } from "node:os";
import { join } from "node:path";
import { createSyncToken } from "../api/_lib/auth.js";
import { sql } from "../api/_lib/db.js";
import { readInsightsInput } from "../lib/claude-insights-extractor.js";
import { derivedUploadPayloadFromInsights } from "../lib/insights-derived.js";
const rows = await sql()`select id, gh_id, gh_handle from users where lower(gh_handle) = ${"brightseth"} limit 1`;
const owner = rows[0]; if (!owner) throw new Error("owner not found");
const token = createSyncToken(owner);
const data = await readInsightsInput(join(homedir(), ".claude/usage-data"));
const payload = derivedUploadPayloadFromInsights(data, { source: "cli" });
const res = await fetch("https://vibestats.io/api/sync", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
const body = await res.json().catch(() => ({}));
console.log("sync status:", res.status, body.ok ? "OK" : (body.error || ""));
console.log("profile_url:", body.profile_url || "(n/a)");
process.exit(res.status === 201 ? 0 : 1);
