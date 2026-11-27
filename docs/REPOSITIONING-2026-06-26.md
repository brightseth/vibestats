# /vibe Repositioning — The Three-Layer Open Stack
*Concentrated pass, 2026-06-26 (cc-seth). Supersedes the framing in VIBE_VISION.md (Feb 2026). Not yet ratified by Seth — this is the argument, not the canon.*

---

## TL;DR

Your instinct is right and the timing is the whole point. But the move is **not a build — it's a consolidation + rename.** All three layers already exist as half-finished fragments scattered across `~/Projects/vibe/` and `~/Projects/airc/`. The repositioning collapses ~8 overlapping artifacts into **three named open-source projects + one funnel**, and revives AIRC at the exact moment the market proved its thesis.

```
AIRC          = the protocol     (open spec — identity + presence + messaging + consent)
/vibe         = the backend      (open source — humans AND agents talk across sessions)
                 served to three clients at three friction tiers, over one handle/token:
                   lets-vibe skill  → zero-install, lives in CC as /vibe   (vibestats)
                   slashvibe-mcp    → claude mcp add, persistent in-session tools
                   VibeBuddy        → standalone app (iOS + macOS), ambient presence
conferencing  = the live room     (go-live surface you graduate into — already hot, §5)
```

The funnel is the right shape, and the front of it is now *lower-friction than the original "install" step* — the `lets-vibe` skill delivers presence + auth + DM with no `claude mcp add`, fed by vibestats.io's viral share loop. The only real open decision is **auth**, and it has a clean layered answer (below).

---

## 1. The timing read — why now is not arbitrary

Three signals converged, and they're the same signal:
- **Anthropic shipped tag-`@claude` in Slack.** Coordinating an agent inside a shared human channel is now a first-class product gesture from the frontier lab. That's social validation of the *exact primitive* /vibe shipped first ("type into your partner's Claude Code session — humans and AIs share the same channel").
- **The human-agent-teams blog** (claude.com/blog/building-effective-human-agent-teams) reframes the unit of work from "a person + a tool" to "a team of people and agents." That's the multiplayer thesis stated by the lab.
- **Vibecoding-in-terminal is at an all-time high.** The install base for an MCP-delivered social layer has never been larger, and it grows every week Claude Code does.

**The strategic consequence — and a correction (added after the M5 sweep, 2026-06-27):** AIRC was PARKED on May 19 (`~/Projects/airc/PARKED-2026-05-19.md`). But that doc is stale — **AIRC was already un-parked on the M5 in June** (9 commits, Jun 13–23) and the parked-status framing in this section is what was wrong, not the strategy. On the M5, AIRC got a new `VISION.md`, a `GOAL.md` with an executable M0–M5 ladder, the `airc-channel` plugin v0.2 (auto-Ed25519, signed, lossless polling, consent, typed payloads, `human_present`), a `/plugin` marketplace manifest, and a Jun 23 polish burst "for the Chad Fowler share" that wired the AIRC front-door to proxy `/api/*` to the live /vibe registry. It was then cleanly **shelved Jun 17** (`RESUME_HERE.md`) when focus shifted to Spirit/Coinbase prep. So: the recommendation below ("un-park AIRC") is *already executed* — the live question is whether to **resume it**, not revive it.

---

## 2. Ground truth — what already exists (so we don't rebuild)

Verified by direct repo exploration tonight. This is the inventory the reframe has to rationalize:

### AIRC (the protocol) — `~/Projects/airc/`
- **Spec is real and mature.** `core/AIRC_SPEC.md` + `core/docs/reference/AIRC_V0.2_SPEC_DRAFT.md`. Covers all four pillars: **Identity** (handle + Ed25519 keybind), **Presence** (heartbeats, privacy tiers), **Messaging** (signed JSON, typed payloads), **Consent** (request/accept anti-spam).
- **Auth model v0.2 is live on staging:** Ed25519 signing keys (rotatable) + recovery key (non-rotatable) + JWT sessions. SDKs in `ts/` (v0.2.0) and `python/`.
- **ERC-8004 = your "x8004".** Already designed as an *optional extension* (`core/extensions/erc8004.html`): three-registry model (Identity ERC-721 / Reputation / Validation), on-chain key anchor, IPFS registration file. AIRC works without it; agents that link gain verifiable on-chain reputation.
- **Status: ACTIVE (M5 sweep, Jun 13–23) — current rung M0.** Not parked. `VISION.md` + `GOAL.md` + `airc-channel` plugin v0.2 + `/plugin` marketplace manifest are all live and pushed to `git@github.com:brightseth/airc.git`. `conformance/north-star.test.js` is the executable goal (9/9 green, runs in CI). Shelved cleanly Jun 17, one open tap on return: activate `@seth`'s own room via `/plugin install airc@airc` + a CC restart.
- **AIRC's own VISION.md is sharper than this doc's frame — adopt its language.** It already states the reframe: *"A Claude Code session is not an agent, not a human — it is a room with two occupants. A message to `@seth` rings a room where a human and an AI are already mid-conversation, and either occupant can answer."* The product is a **switchboard for human–AI pairs**, where pure agents and pure humans are just rooms with one occupant. And — important for §4/§5 below — **VISION.md declares the `airc-channel` plugin itself the reference client** ("Claude Code is the human UI for AIRC"). That partially reframes VibeBuddy's role (see §5).
- `/vibe` is already named in the spec as **"the reference registry implementation"** of AIRC, and the Jun 23 work physically wired the AIRC front-door's `/api/*` to the live /vibe registry. The relationship Seth wants exists in *running code*, not just on paper.

### /vibe (the MCP server) — `~/Projects/vibe/`
- **The "PAUSED Mar 15" memory is STALE.** It was revived and is the *most recently developed* piece. Two copies exist:
  - `vibe/mcp` — npm `slashvibe-mcp` v0.4.10 (Feb 17), 9 tools, GitHub OAuth. The stable/published one.
  - `vibe/platform/mcp-server` — v0.5.0 (**May 19**), 15 tools, **already implements AIRC as "Matrix multiplayer rooms"** (`vibe_matrix_rooms/read/send`) against `matrix.slashvibe.dev`. Deprecated the old `vibe_pair/guest/call`.
- Both stdio, both GitHub-OAuth → bearer, both hit `slashvibe.dev`.
- **Tension:** two packages with the same name, diverged. Pick one.

### VibeBuddy (the client) — `~/Projects/vibe/`
- **macOS:** `vibe/buddy` — Tauri v0.5.2 (Mar 21), real buddy-list UI (`UnifiedBuddyList.tsx`), presence/DM/spectate, mid-migration from KV-polling → Matrix. Repo: `brightseth/vibe-buddy`.
- **iOS:** `vibe/app` — native SwiftUI, iOS 17+, TestFlight CI/CD (Feb 19). 5 tabs: Online/DMs/Rooms/Live/Feed.
- **Also lurking:** `vibe/terminal` (Tauri "Bloomberg for devs"), plus the whole conferencing family — `conferencing/wanderingstan-vc` (web, prod), `vibeconf-app` (Swift), `vibeconf-native`/VibeMic (menu-bar). These are the GTM-era sprawl.

### vibestats + the `lets-vibe` skill (the zero-install client + acquisition surface) — `~/Projects/vibestats/`
- **This is the piece the three-layer frame above was missing.** `vibestats.io` is a live, viral **share surface** — a Claude Code "vibecoding personality" engine (8 archetypes, facet radar, shareable OG cards, anonymous reveal links). It's already the top-of-funnel: people share cards, land on the site, and meet `/vibe`.
- **The `lets-vibe` SKILL is a *third* /vibe client — and the lowest-friction one.** `skills/lets-vibe/SKILL.md` turns any Claude Code session into a /vibe client with **zero install**: `curl .../api/v2/presence` (no auth) shows who's building right now; first message triggers a real GitHub OAuth login (localhost-callback capture, no copy-paste token), stored at `~/.vibe/config.json`; then text-only, consent-gated DMs. Same `slashvibe.dev` backend, same handle/token as the MCP server and VibeBuddy.
- **Active branch `feat/wave-1-identity`** (commits Jun 24–27): "party-door → full /vibe comms client" upgrade, then two onboarding fixes hardening the OAuth capture flow. This is the funnel's auth Step (§3) actually shipping.
- **Implication:** the /vibe *client* isn't one thing — it's a **friction ladder of three surfaces** (skill → MCP server → VibeBuddy app) over one protocol/backend. The skill makes the §4 "minimum lovable loop" achievable with no `claude mcp add` at all.

**The reframe's real job:** name `buddy`(macOS) + `app`(iOS) jointly as **VibeBuddy**; recognize the `lets-vibe` skill as the zero-install entry tier; and decide what conferencing *is* relative to all of them (see §5).

---

## 3. The auth fork — the one real decision

Step 2 of the funnel ("register + authenticate with AIRC via oauth/privy/x8004") is the only place the architecture genuinely branches. The trap is treating it as exclusive. It isn't — it's **layered**, and the layers already exist:

| Layer | Mechanism | Role | Status | When |
|---|---|---|---|---|
| **Protocol identity** | AIRC handle + **Ed25519** keypair | The canonical "who" — every message signed | Live (v0.2) | Always, invisible |
| **Human login** | **GitHub OAuth** | Day-1 zero-friction onboarding for the terminal crowd | Built (both MCP servers) | **Default now** |
| **Trust anchor** | **ERC-8004** (on-chain) | Optional portable, verifiable reputation for agents | Designed (extension) | Opt-in — *the Spirit moat* |
| **Wallet/payments** | **Privy** | Embedded wallets → tipping, gigs, micropayments | Memo only, not built | **Defer to phase 2** |

**Recommendation:**
1. **Default path = GitHub OAuth.** A dev vibecoding in a terminal will not do wallet ceremony to say hi. OAuth is built, it's one tool call, it matches the install moment. This is the funnel's Day-1 auth — full stop.
2. **AIRC handle + Ed25519 is the identity *underneath* OAuth** — issued automatically on first auth, signs every message. The user never sees it; agents live on it. This is what makes /vibe a *protocol* and not just another chat backend.
3. **ERC-8004 is the optional on-chain link — and it's your differentiation, not a tax.** This is where /vibe stops being "Discord for terminals" and becomes the identity rail for the agent economy. It's also the **direct Spirit Protocol tie-in**: Spirit Genesis agents get verifiable on-chain identity/reputation *through the same registry*. Make it a one-command upgrade (`vibe link --erc8004`), never a gate.
4. **Privy is a phase-2 bridge, not now.** Pull it in only when tipping/gigs go live (the old "Marketplace" thesis). Don't let payments rails block the social loop.

Net: **OAuth for humans today · Ed25519/AIRC as the spine · ERC-8004 as the opt-in agent-economy anchor · Privy deferred.** No fork — a ladder.

---

## 4. The minimum lovable multiplayer loop (build this first)

Everything above is consolidation. The *one thing to make undeniable* is the AIM moment — the cross-session message that lands in someone else's live Claude Code:

```
1. "lets vibe"   → skill runs; presence shows live (NO install, NO auth)
2. first DM      → GitHub OAuth (localhost capture) → AIRC handle minted, invisible
3. who's vibing  → see who else is vibecoding right now
4. vibe @stan "yo, look at this race condition"   → it surfaces IN Stan's session
5. Stan replies from his session → it surfaces in yours
```

That five-line loop *is* the product — and the key insight from the M5 sweep is **step 1 needs no install**: the `lets-vibe` skill (vibestats, `feat/wave-1-identity`) already delivers it. The original `claude mcp add vibe` path (the `slashvibe-mcp` MCP server, working in `platform/mcp-server` v0.5.0) is the **upgrade tier** — persistent `vibe_who`/`vibe_dm` tools for people who vibe often. **VibeBuddy's job is the third tier: ambient presence** — the always-on buddy list so you see who's around *without* a terminal focused, and get pinged when someone reaches into your session. Skill → MCP → app, one handle/token across all three. That's the "tag-claude, but peer-to-peer and cross-vendor" wedge.

Ship that loop rock-solid across the skill + one MCP package + one buddy client before touching rooms, spectating, conferencing, gigs, or session-graph.

---

## 5. What to kill / merge (the unglamorous half of the reframe)

The reframe only works if it *subtracts*. Proposed dispositions (all need Seth's call):
- **MCP server:** Promote `platform/mcp-server` v0.5.0 (has AIRC/Matrix) to canonical; fold/retire the standalone `vibe/mcp` v0.4.10. One package named `slashvibe-mcp`, one source of truth.
- **VibeBuddy:** `buddy`(macOS Tauri) + `app`(iOS Swift) become the two heads of one product, **VibeBuddy**, shared brand + shared AIRC/Matrix transport. Consider whether macOS should also go native Swift long-term, but don't block on it.
- **Terminal:** `vibe/terminal` (Tauri) overlaps VibeBuddy heavily. Either fold its session-graph features into VibeBuddy or park it. Two Tauri desktop apps is the sprawl tax.
- **Conferencing family — CORRECTION (M5 sweep, 2026-06-27): this is your most active surface, not a parked GTM bet.** Two repos are hot:
  - `vibe/vibeconferencing` (Stan's `wanderingstan/vibeconferencing`, branch `feat/llm-ack-prompt-tuning`) — **64 commits in 30d, last Jun 26.** The real-time engine: LLM ack/turn-taking tuning, **orchestrated multi-bot rooms**, **per-seat brain contracts (SAL/SOLIENNE defaults) with Bearer auth**, a `region-canvas` collaborative whiteboard + `/media` generative media (fal), and as of Jun 26 a **Runway avatar rendered into the Meet camera** (puppet-mode).
  - `vibe/conferencing` (`VibeCodingInc/vibe-conferencing`) — **17 commits in 30d, last Jun 25.** The house layer: `spirit-room-bot` (agents paint the board via `[[image:]]`/`[[video:]]`), a `house-bot` PM2 launcher for agent-server + `POST /generate` (one-call fal image/video), and a canvas-elevation plan **"The Produced Room / Director Mode."**
  So the earlier "keep conferencing out of the story" call was **wrong** — conferencing is precisely where the *multi-agent multiplayer* work is already running (per-seat brains = SAL and SOLIENNE as seated participants). The honest reframe: the async buddy-list loop (§4) is the **wedge**; conferencing is the **room you graduate into** — "go live" is not a someday feature, it's a built, voiced, avatar-capable surface today. The open question is sequencing and how loudly it features in the launch narrative, not whether it belongs.

---

## 6. The narrative (one paragraph, for the README / launch)

> Coding stopped being single-player. You're in a terminal with an agent; your collaborator is in theirs. **AIRC** is the open protocol that gives every human and agent a portable identity and a way to reach each other. **/vibe** is the open-source MCP server that puts that reach inside your session — `vibe_who`, `vibe_dm`, and your buddy types straight into your Claude Code. **VibeBuddy** is the open-source buddy list that keeps you present even when the terminal's closed. Install the server, say hi, download the client. Multiplayer, by default, across every vendor.

---

## 7. Open questions for Seth (not blocking the synthesis)

1. **Resume AIRC now?** (Already un-parked on M5 — the question is whether to pull the one open tap: `/plugin install airc@airc` + CC restart to light up `@seth`'s room. Recommend yes.)
2. **OK to make `platform/mcp-server` v0.5.0 canonical and retire `vibe/mcp`?**
3. **ERC-8004 as the explicit Spirit ↔ /vibe identity bridge** — is that a story you want to tell publicly, or kept quiet pre-TGE?
4. **Conferencing sequencing** — it's already a hot, voiced, avatar-capable surface (§5), so the question isn't "separate vs. fold" but *how loudly it features in the launch narrative*: lead with the async buddy loop and tease "go live," or show the produced room day one?
5. **Does the `lets-vibe` skill (zero-install client) become the canonical Day-1 entry point** over `claude mcp add`? (It already ships presence + OAuth + DM with no install — see §2/§4.)
6. Does VIBE_VISION.md get rewritten around this frame, or does this doc sit beside it as the v2 strategy?
