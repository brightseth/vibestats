# vibestats — Claude engineering charter

Claude (Fable 5+) is the primary author of this codebase as of June 2026. Codex built
Wave 1 (see docs/CODEX-KICKOFF.md, historical) and remains the cross-model reviewer.
This file is the operating system for any Claude session here. Read docs/HANDOFF.md and
docs/AUTONOMOUS-BACKLOG.md next.

## ⚠️ This repo is PUBLIC
- Never commit user data, outreach lists, strategy-with-names, or social-graph data.
  All of that lives in `research/` (gitignored) or `~/.seth/`.
- "Unlisted" users may NEVER be named in any tracked file. (This was violated once and
  force-erased — see memory `vibestats-public-repo-rule`.)

## The verifier loop (how every goal ships)
1. Rubric first — pass/fail criteria in `docs/rubrics/` before code.
2. Implement minimal, matching surrounding style; escape all user-facing values.
3. Verify with EXECUTED evidence: `npm test` green + headless playwright for UI
   (visitor-mode must assert NO raw-count leak) + live curl after deploy.
4. Privacy-touching or large goals: spawn an INDEPENDENT grader subagent in a fresh
   context with the rubric, instructed to refute. Ship only on VERDICT: SATISFIED.
5. Cross-model: `/codex review` for privacy-boundary or security-sensitive diffs.
6. Log result in docs/AUTONOMOUS-BACKLOG.md (date · goal · commit · live check).

HARD STOP and wait for Seth if: tests fail twice, a privacy/security change is
uncertain, scope exceeds what you can verify, or an action spends money / contacts
people. NEVER send DMs/posts/emails — outreach is human-only. Copy/voice changes to
public surfaces need Seth's pick (propose variants in research/).

## Privacy moat (the product IS this)
- Raw `/insights` never leaves the user's machine. Server sync is derived-only.
- Boundaries are ALLOWLISTS, not denylists (`api/_lib/facet-signals.js` is the model:
  closed keyspace, enforced on local-aggregate AND server-write AND public-read).
- Free-vocab fields (friction_counts etc.) can contain things like `secret_leak` —
  unrecognized keys are dropped, never stored.
- Visitors get bucketed/percent data; exact counts gate behind `show_raw_counts`.
- Do-Not-Drift (docs/GOAL.md): no 9th archetype, no DMs/swipe/tokens, no fake rarity.

## Mechanics that bite
- **Deploys are MANUAL**: `vercel --prod --yes` from `feat/wave-1-identity` (prod does
  NOT auto-deploy from git; main is 300+ commits behind and not the prod branch).
- **cleanUrls static-shadow trap**: a static `foo.html` beats a `/foo` rewrite. That's
  why wrapped-template.html and the /scoreboard (not /dashboard) route exist.
- **Copy strings are asserted** in scripts/smoke.mjs AND scripts/launch-audit.mjs —
  change copy and its needles in the same commit.
- Prod secrets: `VIBE_SESSION_SECRET` is write-only sensitive (unpullable); `.env.local`
  has stale values for it. DB access works via `.env.local` DATABASE_URL.
- Tests: `npm test` (facet-signals + funnel-events + compat + smoke). Harnesses in
  `scripts/verify-*.mjs`. Playwright: module + chromium paths via PW_MODULE/PW_CHROMIUM
  (defaults in the verify scripts).
- Funnel/scoreboard: `/scoreboard` (owner-gated), `vercel env run -e production --
  npm run traffic:launch`. Client beacons = humans; server-only hits = usually bots.

## Current state pointers
- docs/HANDOFF.md — session-to-session state
- docs/AUTONOMOUS-BACKLOG.md — goals + Definition of Done + log (loop reads top
  unchecked `- [ ]`)
- docs/FLYWHEEL-REVIEW.md — the growth diagnosis everything traces to
- research/ (gitignored) — outreach, drafts, graph data, DM launcher
