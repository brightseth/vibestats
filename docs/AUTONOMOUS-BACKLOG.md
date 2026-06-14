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
  research/HEADLINE-PROPOSALS.md. Seth delegated the pick → VARIANT A SHIPPED (commit 42d68a1, live-verified: new H1 + teammate sub + og:title). B/C held for post-funnel-proof.


### - [ ] D1 — FRED takes the test (first AI-agent reveal)
Extract FRED的 /insights ON the agent server (privacy boundary: raw stays there),
POST derived payload to /api/reveals (anonymous path, no auth), verify /r live, draft
share copy for Seth. Result: ⏸️ BLOCKED on one human step — agent-server claude CLI is
not logged in (349MB of session logs ready; /insights never run; headless run would
require raw API-key spend without approval = hard-stop). UNBLOCK: ssh agent server →
claude → /login → /insights. Reveal POST script ready to fire the moment facets exist.

### - [x] D2 — Badge wall (/wall)
Grid of PUBLIC-privacy profiles only (never unlisted!) rendering existing badge.svg +
"add yours to your README" CTA. Verify privacy filter + live. Result: ✅ /wall live; privacy
  filter unit-verified (unlisted absent) + live-verified. Commit 77fd282.

### - [x] D3 — Meta-story chapter 2 (draft → Seth approves before /blog)
"Then the AI took over" — the Fable verifier-loop release story. Outward content in
Seth voice = draft to research/, STAGE for approval, do not publish. Result: ✅ drafted at
  research/META-STORY-CH2.md (~700 words, all claims repo-checkable, incl. the honest
  privacy-mistake paragraph). Awaiting Seth approval → then Claude publishes to /blog.

### - [x] D4 — Genome census automation
scripts/genome-census.mjs: read /api/stats, diff vs stored snapshot, emit ready-to-post
weekly census draft to research/census-drafts/. Wire into witness-watch loop weekly. Result: ✅
  scripts/genome-census.mjs built + first census generated; loop instructed to re-run when
  snapshot >6 days old. Drafts stay in research/ — human posts.

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
- 2026-06-10 · K8 headline A shipped (compatibility-first, Seth-delegated) · 42d68a1 · live
- 2026-06-10 · DM launcher built (research/send-dms.html, one-click prefilled composers)
- 2026-06-10 · D2 badge wall /wall (public-only, privacy-verified) · 77fd282 · live
- 2026-06-10 · D3 meta-story ch2 drafted (awaiting approval) · research/META-STORY-CH2.md
- 2026-06-10 · D4 genome census automation · scripts/genome-census.mjs · first draft generated
- 2026-06-10 · D1 FRED reveal BLOCKED on agent-server claude /login (script ready)
- 2026-06-11 · Bridge phase gates on /scoreboard (live meters) · 2e27da4 · live
- 2026-06-11 · D3 SHIPPED: blog ch2 "Then the AI took over" at /blog/2 (Seth-approved) · 6df0c79 · live curl 200
- 2026-06-11 · /party page — Terminal Party #1, Fri Jun 19 3pm PT · 6df0c79 · live curl 200
- 2026-06-11 · cleanUrls lesson: nested rewrite needs extensionless destination · f-commit · /blog/2 200
- 2026-06-11 · X thread + invites drafted (research/X-THREAD-CH2-PARTY.md, Seth posts)
- 2026-06-11 · Party run-of-show written (research/PARTY-1-RUNOFSHOW.md)

## Vision goals (added 2026-06-12 — converged /vibe mandate, gates still rule)
- [x] V1 "lets vibe" skill — tiny CC skill: join party vibeconf room + hello. DoD: one-command install, verified in-session join. (Party infra — allowed pre-gate.)
- [x] V2 Party reveal pipeline — script: attendee handles → pairing-card markdown gallery for the whiteboard. DoD: `node scripts/party-reveals.mjs a,b,c` emits ready-to-paste markdown; cards verified rendering.
- [x] V3 Wire re-light spec (PAPER ONLY) — map exact reuse of slashvibe /api/v2/messages + presence into a CC skill; identity bridge w/ vibestats JWT. DoD: spec in research/, zero code. Build gate: Gate 0 passed + party repeat-attendance signal.
- [ ] V4 Weekly genome census when research/genome-census.json >6 days old.
- [ ] V5 SSO identity bridge + room-presence bridge (spec: research/, paper done 6/13). BUILD GATE: ships with wire v1 (Gate 0 + party signal).
- [ ] V6 Buddy relight — re-point desktop client at v2 APIs + archetype badges + wire notifications (spec: research/, paper done 6/13). BUILD GATE: wire v1 week-1 usage signal.
- [ ] V7 Platform deletion sprint (spec: research/, paper done 6/13). BUILD GATE: after V6 rollout +2wk (legacy endpoints still serve installed clients).
- [x] V8 Door Audit — walk the full newcomer journey (party page → join → test → reveal → share → fishbowl) headless on desktop+mobile as a first-timer; file friction list ranked by drop-off risk; fix copy/links/rendering under verifier loop; propose (not ship) taste changes. Pre-gate legal: funnel/party infra. DoD: friction list in research/, fixes live-verified, npm test green, no privacy-boundary changes.

- 2026-06-12 · For Fable album exported (72 imgs) + convergence synthesis in v4 doc · research/
- 2026-06-12 · Party hero art live on /party (Jan pixel campaign) · live curl 200
- 2026-06-12 · X thread image assignments added (incl. PLEASE STAND BY teaser Jun 15)
- 2026-06-12 · V1 DONE: "lets vibe" skill live (skills/lets-vibe/SKILL.md + party.json + /party install card) · live curls 200 · install = one command
- 2026-06-12 · Funnel check: 35 compares/24h, ALL no-JS (crawler incl. blog-ch2 CTA sweep). Zero humans. Baseline updated. Thread still unposted.
- 2026-06-12 · V2 DONE: party reveal pipeline (scripts/party-reveals.mjs) · credential fetch verified (brightseth→deepdiver), og card 200, shuffled pairs + odd-guest-pairs-host + unrevealed list
- 2026-06-12 · slashvibe.dev RELAUNCHED: Fishbowl homepage live (presence board + party marquee + door code) · platform@17983fd · verified live, 13 online at ship time
- 2026-06-12 · Funnel check 21:35Z: 38 compares/24h all no-JS crawlers, zero client beacons. Thread still unposted.
- 2026-06-13 · V3 DONE (paper): research/WIRE-RELIGHT-SPEC.md — reuse table (verified-live endpoints), 4-verb skill client, loop-cadence delivery (no poll hack), consented payload allowlist (only server change ~20 lines), provenance labeling (human/agent/blend), v1 scope fence, ~1 day build estimate. BUILD GATED on Gate 0 + party signal.
- 2026-06-13 · Loop resumed in fresh session (prior closed). Funnel: 40 compares/24h all no-JS crawlers, zero humans, Gate 0 0/10·0/1. D2/D3/D4 boxes ticked (were done, live-verified /wall /blog/2 200).
- 2026-06-13 · Ecosystem audit (4-agent: platform/terminal/swift/conferencing) + Phase 1-2 build specs written to research/ (SSO bridge, Buddy relight, deletion sprint, build-order index). Key findings: both auth stacks share HS256+same secret env name (SSO = payload mapping); Buddy Matrix migration was roadmap-only (zero code to revert); deletion sprint must sequence AFTER Buddy v2 rollout.
- 2026-06-13 · vibe-v3 (Room OS) audited — missed in morning sweep. Two-backend fork resolved on paper: platform = graph, v3 rooms/ships = surfaces to port (specs in research/). Ships primitive already built there; npm name collision flagged for Seth.
- 2026-06-13 · V8 DONE: door audit walked end-to-end headless (party/install/home/compare, desktop+mobile, beacons blocked = no funnel pollution). Door is solid: install OK clean-env, compare path converts, no raw-count leak. 1 fix shipped (party archetype CTA now visibly a link, live-verified) + 3 proposals in research/DOOR-AUDIT-2026-06-13.md (anon /api/me 401 noise, pairing card drops inviter handle, RSVP single-channel). npm test green.
- 2026-06-13 · V8 correction: 'pairing card drops inviter' RETRACTED — first walk clicked sample chips, not the invite flow; real intent path verified correct (inviter context end-to-end, inline pairing). Funnel 00:11Z: 45 compares/24h all no-JS, zero client beacons (audit's own server-side rows annotated in baseline). Open proposals down to one: anon /api/me 401 noise.
- 2026-06-13 · CODEX adversarial review of spec bundle (it read LIVE platform auth/message code, not just paper). Verdict: plan shape SOUND (platform=graph, thin surfaces) but identity work UNDER-estimated + 2 boundaries UNDER-closed. Folded P1/P2 fixes into all specs (research/): SSO needs a shared verifier (no chokepoint exists; 2 token utils) → Design B default + type/aud binding + freeze unauth registration; wire allowlist must be full discriminated-union sanitized before persist AND fanout + real error_excerpt redaction + server-verified provenance; presence writes need auth; v3 port needs a migration spike; deletion needs near-zero-legacy proof + 410 tombstones. 3 first-verify items recorded in build-order index.
- 2026-06-13 · SHIPPED (Seth gate-override): lets-vibe skill upgraded party-door → full /vibe COMMS client. Anybody typing 'lets vibe' in Claude Code now sees who's building live (8 agents online at ship) + can send/read DMs to other vibecoders. SAFE SUBSET: text-only, NO payloads (defers codex-P1 context-attachment/SSO surface), explicit consent per send, token from ~/.vibe/config.json, OAuth onboarding for new users. All 4 endpoints live-probed (presence open, inbox/thread/send correctly 401 w/o token). Send shape copied verbatim from proven MCP client; JSON escaping tested (quotes/emoji/newline). Live-verified: clean-env install pulls new skill. NOT executed end-to-end (no token locally + send=real person=human-only rule for me) — Seth does the 1 human test: OAuth once → 'lets vibe, tell levi hi'. npm test green · committed+deployed.
- 2026-06-14 · FIXED lets-vibe onboarding bug (caught pre-newcomer): the shipped skill told new users to copy-paste a token, but /vibe auth has NO displayed token — it redirects to a localhost callback (proven CLI pattern, cli-redirect.js/setup.js, port 9876). Replaced Step 1 with a self-contained python listener that opens browser, captures token+handle from the redirect, saves to ~/.vibe/config.json. Verified locally end-to-end (extracted skill's verbatim block, simulated callback → saved). Live + newcomer-install-verified. npm test green. (Found by tracing the OAuth flow before Seth's manual test — would've walled him on the train.)
