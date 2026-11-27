# Flywheel Review — vibestats

Synthesis stage of the ultra review. The product is well-built: nine surfaces, four shipped waves, a correct derived-only privacy boundary, a versioned cross-product credential. It gets no viral momentum for one structural reason — **every share path dead-ends at a shell command, and the one number people screenshot is fake.** This document maps the loop, names the keystone fix, ranks the shippable repairs, lays out the depth bet (mining the untouched facet layer), and records what not to build.

---

## 1. Flywheel diagram

Two loops matter: the **ecosystem flywheel** across the sibling products, and the **internal reveal→share→return loop** inside vibestats. Only one edge of the first is live; the second is amputated at both ends.

### Ecosystem flywheel (cross-product)

```
                  derived_profile.v1 credential (the ONLY thing that crosses)
                  archetype · signature · scores · facets · rarity · privacy block

  ┌────────────┐   LIVE    ┌──────────────┐  SCAFFOLDED   ┌─────────┐
  │ vibe-check │──────────▶│  VIBESTATS   │ - - OFF - - ▶ │  /vibe  │
  │ (/insights │  local    │  identity    │   (Phase 1)   │ social  │
  │  local DB) │  extract  │   layer      │               │ graph   │
  └────────────┘           └──────────────┘               └─────────┘
   reads ~/.claude            BREAK: loop never              BREAK: no "Find
   usage-data on-device       returns INTO here              other Deep Divers"
   raw never leaves           from a web visitor             CTA exists in any
   ✓ this edge works          (see internal loop)            HTML surface; grep
                                                             finds slashvibe only
                                  │                          in docs/ + 2 scripts
                                  │
                                  ▼ (Phase 2+, ASPIRATIONAL — zero runtime code)
                          ┌──────────────┐               ┌──────────┐
                          │   vibeconf   │◀ - - - - - - ▶│ Coltrane │
                          │  pairing room │   host opens  │  host /  │
                          └──────────────┘   room w/ brief│ outcomes │
                           BREAK: no "Open a              └──────────┘
                           pairing room" handoff;          BREAK: no host
                           vibeconf can't consume          anywhere; outcome
                           a match brief yet               graph is Phase 4
```

**State:** only `vibe-check → vibestats` exists. Every downstream edge is doc-only (grep for `vibeconf`/`slashvibe`/`coltrane` hits `docs/` and `scripts/smoke.mjs`, `scripts/launch-audit.mjs` — zero in any HTML surface or runtime API handler). The transport is ready (`api/_lib/credential.js` emits `vibestats.derived_profile.v1`); nothing downstream reads it.

### Internal reveal→share→return loop (inside vibestats)

```
   ┌──────────────────────────── THE LOOP THAT MUST CLOSE ────────────────────────────┐
   │                                                                                    │
   │   (1) REVEAL          (2) SHARE             (3) ASYMMETRY        (4) CREATION       │
   │   card/wrapped   ───▶ X tweet / README ───▶ recipient lands  ───▶ recipient gets   │
   │   "feel seen"        badge / copy-invite    on /?compareTo=     their OWN profile   │
   │       │              "how you'd pair         or /compare           │               │
   │       │               with me?"                  │                 │               │
   │       │                                          │                 │               │
   │       ▼                                          ▼                 ▼               │
   │  BREAK 2: the "top X%"       BREAK 1a: recipient   BREAK 1b: ONLY next step is      │
   │  badge is FAKE — it's        NEVER sees sender's   `/insights` then `curl … |sh`.   │
   │  round((1−sig(your_own))     real card. home       No web reveal. Phone user or     │
   │  ×100), self-referential,    rewrites headline to  any machine w/o Claude Code      │
   │  zero population compare     "compare with @h" but hits a WALL. k-factor → ~0       │
   │  (home.html:1316-1319).      never fetches         regardless of share volume.     │
   │  The REAL number             /api/u/<handle>       The one no-terminal path (JSON   │
   │  (/api/stats) returns        (renderComparison     drop-zone) is hidden in a        │
   │  null at launch & hides.     Intent 2073-2076).    <details> labeled "legacy".      │
   │                                                                                    │
   │              (5) RETURN ◀──────────────────────────────────────────┘               │
   │              evolution / rarity / weekly digest — moot until 1-4 close              │
   └────────────────────────────────────────────────────────────────────────────────────┘
```

**The loop terminates at "copy a shell command for later" instead of at an in-browser result.** Discovery cannot mint the next identity, which is the entire point of a flywheel.

---

## 2. The keystone fix

**Make the compare-intent landing render the sender's real card AND an instant in-browser pairing result — before any terminal ask.**

> File: `home.html` `renderComparisonIntent()` (~2071-2089), reusing `/api/u/[handle].js` (already returns the payload) and `lib/compat.js` `pairingScore()`.

Today `renderComparisonIntent()` does a text-only headline rewrite ("Compare with @handle") and then drops the visitor onto the same two-step curl wall. It never fetches the profile it names. So the **one asymmetry the entire strategy banks on — recipient sees sender, wants to pair — physically never fires.** The recipient sees a stranger's name and a shell command.

The fix, in one surface:
1. For `intent.kind==='profile'`, `await fetch('/api/u/'+handle)` and render the sender's **real** archetype card (name, tagline, signature label, score ring, rarity tier) above the reveal steps, using the card markup the wrapped slide already builds.
2. Add an archetype `<select>` ("I'm a ___ — see our pairing") wired to `lib/compat.js pairingScore(sender, picked)`, so the visitor sees a live chemistry % and pairing name (`Orchestrator × Sprinter = Blitz Commander, 87%`) the instant they pick — **no terminal**.
3. The curl/JSON steps stay below as the "make it permanent with your real data" upsell.

**Why this unlocks everything else:** it converts share-link taps that today 100% dead-end into archetype-picks. It fires the desire end (you see who invited you) and the payoff end (instant Spotify-Blend result) in the same view, entirely inside the privacy moat (compat synthesizes 7 facets from archetype weights — no upload, nothing published). Every other ranked fix below either feeds this landing (richer cards, real percentile, unified compare destination) or extends the same pattern to the other surfaces (wrapped, /compare, mobile). Close this one break and the loop has a return path for the first time.

---

## 3. Ranked improvements

| # | Surface / file | Change | Loop effect | Effort | Wave |
|---|---|---|---|---|---|
| 1 | `home.html` `renderComparisonIntent` ~2071; `/api/u/[handle].js`; `lib/compat.js` | **Keystone.** Fetch + render sender's real card; add archetype-select → live `pairingScore` chemistry %/name; demote curl to upsell below. | Fires Stage-3 asymmetry + Stage-4 payoff in-browser. k-factor off ~0. | M | 2 |
| 2 | `home.html` `renderComparisonIntent` 2070-2086; `lib/compat.js` `VibeCompat` | For `compareArchetype` deep-links, render real archetype-vs-archetype pairing inline (stars, complement score, pairing name) with a one-tap archetype selector. Curl becomes the "exact profile" upgrade. | Closes know-thyself/show-thyself for the unclaimed majority on a phone. | M | 2 |
| 3 | `home.html` `buildArchetypeCard` 1808-1858; `getArchetypeRarity` 2802-2806 | **Kill the fake percentile.** Promote the real population rarity (`getArchetypeRarity`, backed by the 847-strong baseline in `api/stats.js`, never null) to the headline pill: "4% of vibecoders are Orchestrators." Relabel the self-referential `_percentiles` value to a non-comparative phrase ("Orchestrator intensity 95/100") so it never reads as a population rank. | Restores the "objectively true about me vs the world" contract at the emotional peak; satisfies no-fake-rarity. | S | 3 |
| 4 | `api/card.js` line 249; `home.html` cardParams 1814-1820 | Mirror #3 in the OG/saved PNG: stop passing `p` from `_percentiles`; pass `r` = real rarity and render "4% are Orchestrators." | The image that travels furthest on X now asserts a true claim. | S | 2 |
| 5 | `api/og.js` `archetypeCard`, `sanitizeOgQuery`; `api/profile.js` 184-192; `api/reveal.js` 60-68 | Replace the 4 generic stats on the auto-attached OG card with `raw_meta.moments` (m1/m2/m3 via `publicMoments(...,{exact:true})`) + signature subtitle ("methodical Architect"). Fall back to coarse stats only when no moments. | Makes the timeline card a have-to-post: the brag-worthy detail that today lives only in Seth's wrapped now travels on every share. | M | 2 |
| 6 | `lib/claude-insights-extractor.js` ~128; `lib/insights-derived.js` `derivedUploadPayloadFromInsights`; `lib/share-kit.js`; `u.html` | **Depth root unlock.** Aggregate the clean facet enums into a derived, count-only block: `outcome_mix`, `helpfulness_mix`, `session_type_mix`, normalized `friction_taxonomy` (merge api_error/api_errors, drop `secret_leak`). Render as bar strips on `u.html`. Update `rawLeakProof` to assert no free-text. | Deepens Stage-1 Vanity from mechanical to narrative; raises top-of-funnel share rate. See §4. | M | 1→3 |
| 7 | `home.html` `revealMine` ~1063, `#reveal-hint` 928, new `#reveal-mobile` ~935 | Device-aware branch: `pointer:coarse`/UA → don't show the curl steps; auto-run `runDemo()`, show "See how you'd pair" → `/compare`, plus one secondary self-handoff button. Desktop unchanged. | Converts the dominant share-click context (mobile) from hard wall to in-session result + forward action. | M | 1 |
| 8 | `home.html` legacy `<details>` 949-957 | Unhide the in-browser JSON drop-zone out of the "Have a legacy JSON export?" details into a first-class Step-3 reveal ("No terminal? Paste the JSON /insights printed"). Pure promotion — the client-side `runAnalysis`→`scoreArchetypes`→`generateSlides` pipeline already ships. | The ONE structurally-valid no-curl reveal becomes discoverable; closes Stage-4/5 for desktop. | S | 1 |
| 9 | `compare-template.html` `renderRevealCta` 365-406, missing-handle branch ~516; `lib/compat.js` | Add an in-browser paste path to the compare invite (the highest-intent share); when a handle isn't minted, still compute the visitor's side live against the archetype preview instead of a flat "not minted yet." | Repairs Stage 3→4 on the asymmetric-share edge — compare invite becomes a minted-candidate path. | M | 2 |
| 10 | `home.html` `shareClickUrl` 1826-1843; `wrapped.html` 860 | **Unify the compare destination.** Route home tweets and wrapped's link to `/compare?a=&b=` (the real pairing surface) instead of `/?compareArchetype=` (home SPA / curl wall), matching home chips and genome. | Eliminates the two-front-doors split that sends half of all shares back to the curl wall. | S | 2 |
| 11 | `wrapped.html` (add `?handle` fetch; lines ~692, ~877) | Read `?handle`, fetch `/api/u/<handle>`, hydrate the 7 slides from that derived payload; keep the static Orchestrator sample only when no handle, with a persistent "Reveal your own wrapped →" footer. Fix slide-7/X-share compare links to the unified destination. **Constraint:** respect `metric_visibility.show_raw_counts` (default bucketed) — do NOT force `exact:true` for visitors. | Turns the most-screenshot-shared artifact from a dead photo of Seth's stats into a per-person Return+Creation entry. | M | 3 |
| 12 | `match.html` contactUrl line 554 | When `contact_url` is absent, render "No direct contact set — start with a comparison →" routing to the compare page + copy-intro opener, instead of silently dumping the seeker on a bare `/u/<handle>`. No in-app DM. | Closes the Stage-3 match dead-end; a failed contact becomes another compare view feeding the loop. | S | 4 |

---

## 4. Depth upgrade — mining the facet layer into a "feel seen" narrative

This is the central bet. **The product reads exactly ONE of eleven LLM-judged facet sub-fields** (`friction_counts.buggy_code`) and discards the other ten. The richest self-knowledge the tool could deliver is already sitting on disk, already computed by an on-device LLM, already privacy-safe once aggregated. Today the user "learns" an archetype label, 8 scores, four lifetime sums, and up to three mechanical moments ("Marathon session", "Terminal heavy", "Debug battles") — every one a count of an action they could already feel. None tells them anything non-obvious.

Worse, the mechanical layer can **contradict the truth**: the engine can crown someone Debugger and hand them a "Debug battles" moment while the facet data shows `good_debugging` is their *rarest* success mode (3 of 43 sessions). The badge dresses a friction count as an achievement.

### What is actually on disk (43 facet files, real distributions)

- **`outcome`** (5-way): 13 fully / 17 mostly / 5 partially / 3 not_achieved / 5 unclear — *do my sessions land?*
- **`claude_helpfulness`** (5-way): 22 very_helpful / 6 essential / 10 moderately / 2 slightly / 3 unhelpful — *how good is the partnership?*
- **`session_type`** (5-way): 22 multi_task / 12 single_task / 4 exploration / 4 quick_question / 1 iterative — *a real taste/working-mode signal.*
- **`primary_success`** (7-way): 13 proactive_help / 12 multi_file_changes / 7 good_explanations / 3 good_debugging / 6 none / … — *what you actually accomplish.*
- **`user_satisfaction_counts`**: 126 likely_satisfied : 5 dissatisfied — *the emotional register of your work.*
- **`friction_counts`** (free-vocab): buggy_code 8, wrong_approach 8, api_error 5, misunderstood_request 4 — *where the partnership rubs* (note: AI-collaboration friction `wrong_approach`/`misunderstood_request` is distinct from code/infra friction).
- **`goal_categories`**: 130 distinct ad-hoc labels across 43 sessions — effectively a fingerprint of what you work on, ripe for coarse theme clustering.

### The privacy split (why this is safe and on-strategy)

- **SYNC (counts only):** enum distributions and merged friction taxonomy. These are LLM-derived aggregates computed locally; only counts leave. Fully inside "derived-only."
- **NEVER SYNC (free text):** `underlying_goal`, `brief_summary`, `friction_detail`, plus session-meta `first_prompt` / `project_path` — they embed collaborator names, project codenames, deadlines, and a `secret_leak:1` key. **Derive-from, never publish verbatim.** The `secret_leak` friction key is itself sensitive and gets dropped, not merged.

This violates **zero** Do-Not-Drift guardrails: it is derived-only, never syncs free-text friction/goal details, adds no 9th archetype, no score-selling, no fake rarity.

### The deeper Spotify-Wrapped slides (vivid, specific)

The pipeline can compute these locally from the free-text and publish only the verdict. Example slides for a real profile:

- **Slide — "How your sessions land."** A 5-segment bar: *71% mostly-or-fully achieved.* Headline: **"You finish what you start — 30 of 43 sessions landed."** (from `outcome` distribution, counts only.)
- **Slide — "Your partnership grade."** **"Claude was *essential* in 6 sessions and *very helpful* in 22. You build *with* it, not *at* it."** (from `claude_helpfulness`.) Satisfaction footnote: *126 satisfied signals : 5 frustrations.*
- **Slide — "Your working mode."** **"You're a multi-tasker: 22 sprawling sessions vs 12 single-shot. You hold many threads at once."** (from `session_type` — a taste signal no telemetry can produce.)
- **Slide — "Where it rubs."** Two-bar contrast: **"Your friction is human, not machine — `wrong approach` (8) and `misunderstood request` (4) outweigh `buggy code`."** This reframes friction as a *collaboration* axis, the genuinely non-obvious truth. (normalized `friction_taxonomy`, `secret_leak` dropped.)
- **Slide — "What you actually ship."** **"Your superpower is *proactive help* (13) and *multi-file changes* (12) — not debugging (3)."** This is the slide that *corrects* the mechanical archetype rather than contradicting it.
- **Slide — verdict, derived locally from the free-text but published as a single coarse line:** **"You don't avoid chaos. You surf it."** — generated on-device from `friction_detail`/`brief_summary` theme clustering, with the raw prose never leaving the machine.

The mechanism: extend `lib/claude-insights-extractor.js` to aggregate the five clean enums + merged friction into `metrics.facet_signals` (#6 above), surface bar strips on `u.html` and as wrapped slides, and pipe the top moment + verdict line into the OG card (#5). The "have-to-post" object finally carries a *story* — "30 of 43 landed, Claude essential 6×, friction is human not machine" — instead of "you changed N lines, archetype=debugger."

---

## 5. Ecosystem — the first full loop to light

**Light the smallest closed self-loop on the one live edge, entirely inside vibestats. Do not wait on /vibe, vibeconf, or Coltrane.**

```
   anonymous reveal (/r/<slug>)        share asymmetric            compare on /compare
   migration 0015 + api/reveal.js  ──▶ "compare with me" link  ──▶ (real card + live
   (derived snapshot, raw stays    ──▶ (keystone #1 landing)   ──▶  pairing %)
    local)                                                            │
        ▲                                                             │
        └──────────── that page's in-browser reveal converts ◀────────┘
                      the visitor into their OWN reveal (#2/#8)
```

**The derived payload that crosses every boundary already exists and is correct:** `api/_lib/credential.js` emits `vibestats.derived_profile.v1` (`DERIVED_PROFILE_SCHEMA`) — archetype, signature{label,combo,secondary}, scores, facets, activity, rarity, leaderboard, achievements, links, plus an explicit privacy block (`raw_claude_code_sessions:'local-only'`, `synced_profile_fields:'derived-only'`, `no_raw_usage_fields:true`) — served at `/api/derived-profile-spec` and `/u/<handle>/credential.json`. The transport is ready; nothing downstream reads it.

**Why this loop first:** it is the only loop where every node is shipped code on the one working edge. Lighting it requires exactly one prerequisite — replacing the curl dead-end with an in-browser reveal (keystone #1 + #2 + #8). Once a visitor can convert without a terminal, discovery→collaboration mints the next identity, which is the definition of a flywheel turning. The downstream ecosystem edges (`vibestats→/vibe→vibeconf→Coltrane→outcome graph`) are deferred plumbing, not launch dependencies, and are gated behind "do not route live launch traffic to /vibe until its receiving page re-states the derived-only boundary." Treat them as future plumbing.

---

## 6. Do NOT build

These were considered and killed. Each is recorded with the guardrail or fact that protected against it.

- **"Standardize every share hop on `/?compareTo=`."** Backwards: `/compare` IS the interactive pairing page; `/?compareArchetype=` enters the home SPA whose only effect is the curl wall. Standardizing on the home param pushes shares *into* the wall it claims to escape. (Correct direction is #10: unify on `/compare?a=&b=`.)

- **"Label the population source on the card to preserve no-fake-rarity."** Already shipped — `home.html:1881` renders "`${communityTotal} vibecoders analyzed`." The premise ("captured but never shown") is false; nothing to build.

- **"Surface an Outcome & Collaboration panel reading `raw_meta.facet_signals`."** `facet_signals` does not exist in the derived payload yet (`lib/insights-derived.js` emits only dateRange, source, version, signature*, moments). Populating it naively means syncing raw-insight detail — crosses the derived-only moat. *Must* be built via #6 first (aggregate enums into counts), not by widening the boundary.

- **"Replace the 'Debug battles' moment with a `primary_success` good_debugging moment."** Diagnosis is correct (the moment dresses a friction count as a badge), but the fix depends on `facet_signals.primarySuccess`, which the extractor/payload/moments module never produce or read today. Cannot ship until #6 lands.

- **"Use session-type counts to drive a real compat axis."** Fabricated premise: no `session_type` counts exist in the derived payload; the claimed "true taste signal" would be synthesized like the existing `FACET_DEFS` table. Blocked by the same missing aggregate.

- **"Add outcome-rate/satisfaction to the weekly digest + recap."** `facet_signals` is not in the synced whitelist (`METRIC_KEYS = commitsPerDay, sessions, languages, msgsPerSession, days`). Would require widening the local→server privacy boundary plus net-new week-over-week snapshot storage. Right direction, unshippable as written.

- **"Render the `_percentiles` `p` param as a 'top X%' badge on the OG card (`100-pct`, gate `pct>=80`)."** Semantically inverted: `insights-derived.js:102` already stores `p` as a top-percentage, so the proposed transform shows "TOP 95%" to the *most common* users — fabricating rarity for the median, the opposite of the guardrail. (`api/card.js` already does it correctly; `og.js` should mirror that, per #4.)

- **"Personalize `wrapped.html` via `?handle` with `publicMoments(..., {exact:true})`."** As written it leaks exact raw counts ("47,213 Bash commands", "8h 14m session") to any visitor, bypassing the `show_raw_counts` opt-in that `public-profile.js:125` gates behind `isOwner || show_raw_counts`. The core idea is on-strategy and shippable (#11) **only if** exact moments respect `metric_visibility.show_raw_counts` (default bucketed) instead of forcing `exact:true`.

### Standing guardrails honored by every surviving proposal

Never upload/store raw `/insights` JSON (derived-only, local extraction is the moat) · no 9th archetype · no in-app DMs (link out to X/email) · no swipe matching · no tokens/XP/crypto/gamification · no fake rarity and never call `/r` links "completely private" (they are public-unlisted) · no single hireable competence score and no selling employer people-search · Debugger score must not reward producing bugs · never sync free-text friction/goal details (`underlying_goal`, `brief_summary`, `friction_detail`, `secret_leak`) · matchmaker stays a feature surface, not a rename · GitHub claim is never the first ask (anonymous-first) · no mobile-reveal promise (the in-browser path reveals from a pasted/derived file the user already has, and explicitly defers the full local reveal to the coding machine).
