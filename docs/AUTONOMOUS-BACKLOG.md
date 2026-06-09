# Autonomous Backlog

Claude works this list **top-to-bottom**, one goal per loop iteration. Each goal is
taken all the way to done (code → tests → commit → push → deploy → verify), then
checked off, then the next one starts.

Edit this file anytime to re-prioritize, add, or remove goals. The loop reads the
top unchecked `- [ ]` goal each iteration.

## Definition of Done (every goal)
- [ ] Code change is minimal, matches surrounding style, escapes user-facing values.
- [ ] `npm test` is green (add/extend tests for the change).
- [ ] Privacy moat intact: no raw `/insights`, derived-only, allowlist on the boundary.
- [ ] Browser-verified if it touches UI (playwright headless check).
- [ ] Committed + pushed, then deployed per the deploy rule below.
- [ ] Verified live (curl/health), result logged in this file under the goal.

## Standing guardrails (never violate)
- Do-Not-Drift (docs/GOAL.md): no 9th archetype, no DMs/swipe/tokens, no fake rarity.
- STOP and wait for a human if: tests fail twice, a change is security/privacy-sensitive
  and uncertain, or scope exceeds what can be verified.
- Never send DMs / post / contact anyone — outreach is the human's job.

---

## Goals (priority order)

### - [x] G1 — Fix the primary-share leak (`shouldShareProfile`)
When a logged-in user reveals their own card, the share/copy buttons route to
`?compareArchetype=` (archetype-only) and lose the person. Make the primary reveal
share carry the sender (`?compareTo=<handle>&compareArchetype=<type>`) when the user
has a claimed handle, falling back to archetype-only for anonymous users.
- Files: `home.html` (`shouldShareProfile`, `shareClickUrl`, tweet variants ~1820).
- Acceptance: logged-in reveal → share link is `?compareTo=<handle>…`; anon → unchanged.
- Result: ✅ flag gated on claimed handle; browser-verified both states; tweet keeps Profile credential anchor (smoke-enforced). Commit 96226d0, live.

### - [x] G2 — Depth for everyone + a brag-worthy one-liner
Two parts: (a) the "How you build" facet signals only flow via CLI sync; carry them
through the browser-claim/preview path so browser-claimed profiles show depth too.
(b) Turn the bar charts into one opinionated, screenshot-worthy line (codex note:
"needs one sentence + one receipt, not more chart surface").
- Files: `bin/vibestats.js` preview hash (~311), `home.html` browser upload payload
  (~2324), `u.html` `renderFacetSignals`, `api/og.js` (optional: put the line on the card).
- Acceptance: a browser-claimed profile renders "How you build"; the section leads with
  a single verdict line; privacy unchanged (counts-only, allowlist).
- Result: ✅ (b) shipped — "How you build" now leads with a big gradient receipt line,
  bars are supporting detail. Browser-verified. Commit a3d0090, live.
  ⏸️ (a) split to G2a in Deferred section — couldn't verify the full claim→DB round trip headless.

### - [x] G3 — One-click private scoreboard
Replace "run a scary terminal command" with an owner-only page that shows the
compare-intent funnel (landed → saw pairing → shared → reveal) and top attributed
sources. Reuse the existing `traffic:launch` query logic server-side.
- Files: new `api/dashboard.js` (owner-gated via session), small client page or JSON.
- Acceptance: owner opens the page, sees live funnel numbers; non-owners get 404/401.
- Result: ✅ at **/scoreboard** (not /dashboard — a pre-existing dashboard.html shadows
  that path via cleanUrls). Gated by requireUser + owner allowlist
  (VIBESTATS_OWNER_HANDLES, default brightseth). Verified live: anon → 401 + sign-in,
  no data leak. ⚠️ Owner-authenticated view couldn't be headless-verified (no operator
  session) — reuses the proven requireUser pattern + funnel queries; needs a one-time
  eyeball: log in as brightseth, open https://vibestats.io/scoreboard. Commits f2ea6b2, 58d3931.

---

## Deferred (NOT loop-eligible — need a human or a verification harness first)

### - [x] G2a — Carry facet_signals through the CLI→browser claim path — DONE 2026-06-09
Closed via the Fable verifier pattern: rubric (`docs/rubrics/G2A-G3-RUBRIC.md`) →
implement (CLI encoder + hash decode + extractInsights + POST payload) → executable
harness (`scripts/verify-g2a-roundtrip.mjs`: real CLI encoder, real headless browser
clicking the real claim button, network intercept, real server sanitize) → independent
grader sub-agent in a fresh context re-executed all evidence → VERDICT: SATISFIED.
Negative (injected secret_leak/junk dropped) + legacy-hash compat both executed.
G3 owner-view also machine-verified the same day (`scripts/verify-g3-owner.mjs`: real
session token + real handler + live DB — owner 200 with live funnel, non-owner 404,
anon 401), retiring the "needs human eyeball" note. Commit 0a6e200, live.

## Log
(Claude appends a one-line entry per completed goal: date · goal · commit · live check.)
- 2026-06-08 · G1 primary-share leak · 96226d0 · live (home 200, share-fix present)
- 2026-06-08 · G2 depth receipt one-liner (G2a deferred) · a3d0090 · live (receipt code present)
- 2026-06-08 · G3 /scoreboard owner funnel page · 58d3931 · live (anon→401; owner view needs eyeball)
- 2026-06-09 · G2a depth via browser claim + G3 owner-view machine-verified (rubric + independent grader, VERDICT: SATISFIED) · 0a6e200 · live
- 2026-06-09 · K0 owner profile synced with depth (act-for-owner, app sanitizer + sync-equivalent insert; prod secret is write-only sensitive so token mint impossible) · upload 30ef631f · live
- 2026-06-09 · K1 OG card carries signature + moments (visually verified live PNG) · 9f5065b · live
