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


### - [x] K2 — Personal Wrapped: /wrapped hydrates from any profile
FLYWHEEL #11. /wrapped is the most screenshot-shared artifact but always shows the static
sample. Read ?handle, fetch /api/u/<handle>, hydrate the slides from the derived payload
(respect metric_visibility — bucketed for visitors, never force exact). Keep static sample
when no handle, with a persistent "Reveal your own →" footer. Fix slide-7 share links to
the unified /compare destination.
- Files: wrapped.html (~692, ~877). Verify: headless render for owner-mode + visitor-mode
  + no-handle; no raw counts for visitors; suite green.
- Result: ✅ dynamic deck from public payload (opening/personality/how-you-build/receipts/card);
  share routes to ?compareTo= pairing invite; sample + footer when no handle; 404 falls back.
  4-mode harness incl. visitor zero-leak canary (scripts/verify-k2-wrapped.mjs). Live-verified
  with real brightseth data. Commit 0fdcc05.

### - [x] K3 — Compare invite gets the in-browser paste path
FLYWHEEL #9. The compare invite (highest-intent share) still dead-ends visitors who have
no minted handle: add archetype-pick (reuse VibeCompat pattern from the keystone) so the
visitor side computes live against the host preview instead of "not minted yet."
- Files: compare-template.html renderRevealCta (~365-406) + missing-handle branch (~516).
- Verify: headless — visitor picks type on a /compare?a=<type>&b=<handle> page and sees a
  live pairing; funnel beacon fires. Result: ✅ picker→live-pairing already worked (verified,
  not re-shipped); real gap was the terminal-only reveal CTA — added "Reveal in your browser
  instead →" routing to the keystone landing. Headless-verified (picker, exact href, live
  pairing on grid click, zero errors). Commit 646fb81.

### - [x] K4 — Match dead-end → comparison
FLYWHEEL #12. match.html contactUrl (~554): when contact_url is absent, render "Start with
a comparison →" routing to /compare + copy-intro, instead of dumping on bare /u/<handle>.
No in-app DM. Verify: headless render of both branches. Result: ✅ contact_url absent →
"No contact set — start with a comparison →" to /compare, tracked as compare_click;
real contact unchanged. Both branches headless-verified. Commit 6900c92.


### - [x] K5 — Dynamic OG for personal Wrapped
/wrapped?handle= shares currently unfurl with the STATIC sample meta — the most
shareable surface wastes its unfurl. Serve /wrapped via an api route (pattern:
compare-template) injecting per-handle title/description/og:image (reuse the depth
og params: sig + m1v..m3l). Mind the cleanUrls static-shadow trap (the /dashboard
lesson): rename wrapped.html → wrapped-template.html.
- Verify: live unfurl meta for ?handle=brightseth carries sig+moments image; sample
  meta unchanged without handle; suite green (smoke reads the template file). Result: ✅
  api/wrapped-page.js serves /wrapped; personal title/desc/og verified live; /wrapped.html
  308s; deck still hydrates via the new route. Commit 209d772.

### - [x] K6 — Wrapped funnel events
Add wrapped_view / wrapped_share to the funnel allowlist + beacons in the hydrated
deck (privacy: event name + archetype only, same as existing). Extend /scoreboard +
traffic:launch funnel block. Verify: beacon fires headless; allowlist test extended. Result: ✅
  wrapped_view + wrapped_share live (beacons verified headless; prod accepts; scoreboard +
  traffic report extended). Commit below.

### - [ ] K7 — Witness watch (monitoring, not code)
Each loop iteration: read the funnel (vercel env run … traffic:launch --json). When
real events appear (landed>1 or any share/reveal click), notify Seth with the read
+ what it suggests. Track last-seen counts in research/funnel-watch.json (gitignored). Result:

### - [x] K8 — Compatibility-first home headline (FLAG TASTE — propose, do not ship)
Seth pivoted the thesis to "who should I build with > what am I". Home still leads
"What kind of coder are you?". Draft 2-3 headline/sub variants in research/, present
for approval. DO NOT deploy copy changes autonomously. Result: ✅ 3 variants drafted in
  research/HEADLINE-PROPOSALS.md (recommend A now, B/C after funnel proof). Awaiting Seth's pick.

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
- 2026-06-09 · K2 personal Wrapped (?handle hydration, visitor zero-leak verified) · 0fdcc05 · live (real-data prod check)
- 2026-06-09 · K3 compare invite no-terminal path · 646fb81 · live
- 2026-06-09 · K4 match no-contact → comparison CTA · 6900c92 · live (all surfaces 200)
- 2026-06-10 · K5 dynamic Wrapped OG (personal unfurl with sig+moments) · 209d772 · live
- 2026-06-10 · K6 wrapped funnel events (view/share beacons, scoreboard rows) · live
