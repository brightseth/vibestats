# Implementation Plan — Top 3 Flywheel Fixes

Derived from `docs/FLYWHEEL-REVIEW.md`. Three changes, in dependency order:

1. **Keystone** — compare-intent landing renders the sender's real card + a live, in-browser pairing result (no terminal).
2. **Kill the fake percentile** — remove the self-referential "top X%" pill, promote the real population rarity, relabel any kept percentile as non-comparative.
3. **Depth aggregation** — mine the unused facet enum layer into a derived, counts-only `facet_signals` block and surface it.

All three respect the Do-Not-Drift guardrails: derived-only, no raw upload, no 9th archetype, no fake rarity, never sync free-text.

---

## Shared context (verified against source)

- **Client compat is already loadable in the browser.** `lib/compat.js` attaches `window.VibeCompat` with `profileCompatibility(visitorType, hostType, hostHandle, visitorSubject?, hostSubject?)` → `{ score, line, facet }`. The keystone needs no new scoring math.
- **The profile API already returns everything the card needs.** `GET /api/u/<handle>` (`api/u/[handle].js`) returns the latest upload (archetype, scores, metrics, raw_meta), `latestSignature`, and `rarity` (`profileRarityPayload` → `{ count, tier, window_days }`). For non-owners it slices to the latest upload and applies `metricVisibility`.
- **The card markup is built inline** in `home.html` slide 6 (`buildArchetypeCard` region ~1808–1900). It already renders BOTH:
  - a **fake** pill: `top ${pct}%` where `pct = scores._percentiles[archetype]` (home.html ~1881),
  - a **real** line: `${rarity}% of vibecoders are ${Name}s` from `getArchetypeRarity()` (backed by `/api/stats`, never null at launch — has an 847-row baseline).
- **`_percentiles`** is computed in `lib/insights-derived.js` `scoreArchetypes()` as `Math.max(1, round((1 - primarySignals[k]) * 100))` — a transform of the user's OWN sigmoid signal strength, with **zero population term**. It reads as a population rank but isn't one. This is the thing to kill.
- **Sync whitelist** is `METRIC_KEYS` in `api/_lib/export-upload.js` (`commitsPerDay, sessions, languages, msgsPerSession, days`). `_percentiles` is exported via `exportScores`. The depth block needs a new, explicit counts-only whitelist here — not a widening of free-text.
- **The extractor** `lib/claude-insights-extractor.js` `insightsFromClaudeUsage({sessions, facets})` today reads exactly one facet field: `friction_counts.buggy_code`. Every other facet enum is discarded before scoring.

---

## Fix 1 — Keystone: real card + live pairing on compare-intent landing

**Files:** `home.html` `renderComparisonIntent()` (~2071–2086) and `comparisonIntent()` (~2059); reuse `window.VibeCompat`; fetch `GET /api/u/<handle>`.

**Today:** `renderComparisonIntent()` only rewrites `.upload-title` / `.upload-sub` / `.drop-zone-text` to mention the handle, then drops the visitor on the same `/insights` → `curl|sh` wall. It never fetches the profile it names. The asymmetry the whole strategy banks on physically never fires.

**Target behavior:**
- `intent.kind === 'profile'`: `await fetch('/api/u/'+handle)`. On success, render the sender's **real** archetype mini-card (name, tagline, signature label, score ring/primary score, rarity tier) above the reveal steps, reusing the existing card CSS classes.
- Add an archetype `<select>` ("I'm a ___ → see our pairing"). On change, call `VibeCompat.profileCompatibility(picked, senderType, handle, null, senderFacetsIfPresent)` and render the chemistry **score + pairing line** instantly (e.g. "Orchestrator × Sprinter = Blitz Commander · 87%"). Zero terminal, zero upload.
- Keep the curl/JSON steps below, re-labeled as the "make it permanent with your real /insights" upsell.
- `intent.kind === 'archetype'` (no handle): same archetype-select → live `profileCompatibility(picked, intent.archetype, ...)`; no profile fetch needed.

**Data flow:**
```
URL ?compareTo=h&compareArchetype=t
  → comparisonIntent() {kind:'profile', handle, archetype}
  → fetch /api/u/h  → { upload:{archetype,scores,...}, signature, rarity }
  → render sender card from response (NOT from URL archetype — URL is a hint, API is truth)
  → <select> change → VibeCompat.profileCompatibility(picked, upload.archetype, h, null, facets)
  → paint score + line   (instrument a 'compare_view' analytics event — see telemetry)
```

**Edge cases / decisions:**
- **API archetype vs URL archetype mismatch:** trust the API's `upload.archetype` for the card; treat `compareArchetype` only as the initial `<select>` default. (Sender may have re-uploaded since the link was minted.)
- **404 / private / fetch failure:** fall back to the current text-rewrite + curl path (today's behavior). Never block the page on a failed fetch. `try/catch`, render skeleton → real-or-fallback.
- **Facet availability:** pass `upload.facets` to `profileCompatibility` only if present (≥3) — `compat.js` already guards via `hasExplicitFacets`; archetype-only pairing is the documented fallback.
- **Privacy:** the visitor's pick is local state; nothing is POSTed, nothing published. Inside the moat.
- **No layout regression for the default landing:** all of this is gated behind `comparisonIntent() !== null`.

**Tests:**
- Unit (node, `scripts/`): `VibeCompat.profileCompatibility` returns a finite 55–99 score and non-empty line for all 64 archetype pairs (assert no "Unknown Pairing" leaks to UI).
- Browite/gstack smoke: load `/?compareTo=brightseth&compareArchetype=orchestrator` → assert sender card text present, select present, picking an option paints a `%`. Load with a bogus handle → assert graceful fallback to curl steps (no thrown error in console).

**Effort:** M. **Wave:** 2.

---

## Fix 2 — Kill the fake percentile, promote real rarity

**Files:** `home.html` card region (~1881 the `top ${pct}%` pill; ~1820 `cardParams.set('p', pct)`); `api/card.js` (~249, OG/saved PNG param `p`); `api/og.js` `archetypeCard`; optionally `lib/insights-derived.js` (`_percentiles`) and `api/_lib/export-upload.js` (`exportScores` percentile export).

**Change:**
1. **Remove the `top ${pct}%` pill** from the slide-6 card. Promote the existing real line `${rarity}% of vibecoders are ${Name}s` (from `getArchetypeRarity`) to the headline position the pill occupied.
2. **Stop passing `p`** into `cardParams` (home.html ~1820) and into `api/card.js` (line 249) / `api/og.js`. The traveling OG/PNG image must not assert a fabricated rank.
3. **If we keep `_percentiles` at all** (it's also exported via `exportScores`): relabel any surfaced use as non-comparative — e.g. "Orchestrator intensity 95/100" — never "top X%". Simplest correct option: stop surfacing `_percentiles` in any user-facing string; keep the field server-side only if something depends on it (grep shows only display + export — safe to stop displaying).
4. **Tweet copy** in `buildArchetypeCard` uses `pct ? ` — top ${pct}%`` in two variants (~1838, ~1845). Remove the `top X%` fragment; lead with the real rarity line or signature instead.

**Edge cases:**
- `getArchetypeRarity` returns null only if `/api/stats` is unreachable AND no baseline — current code has an 847-row baseline so it's effectively always present; still guard `rarity ?` as today.
- Don't claim "rare Deep Diver" — the rarity line states the true population share, which can read as common (correct, per SHARE-PLAYBOOK). Scarcity language stays on the signature combo ("1 of 56"), unchanged.

**Tests:**
- Snapshot/assert: rendered card contains "% of vibecoders are" and does NOT contain "top " + digits + "%".
- `api/card.js` / `og.js`: request without `p` renders cleanly; assert no "TOP" string in output SVG.

**Effort:** S. **Wave:** 2 (image) / 3 (relabel).

---

## Fix 3 — Depth aggregation: the facet layer → derived `facet_signals`

The central bet. The extractor reads 1 of 11 LLM-judged facet fields. Aggregate the clean enums into counts-only signals, sync them through the existing derived-only boundary, and surface them as bar strips + Wrapped slides.

**3a — Extract (local).** `lib/claude-insights-extractor.js` `insightsFromClaudeUsage`: in the facet loop, tally enum distributions into `metrics.facet_signals`:
- `outcome_mix` { fully, mostly, partially, not_achieved, unclear }
- `helpfulness_mix` { essential, very_helpful, moderately_helpful, slightly_helpful, unhelpful }
- `session_type_mix` { multi_task, single_task, exploration, quick_question, iterative }
- `primary_success_mix` (7-way)
- `satisfaction_mix` { satisfied+likely_satisfied (positive), neutral, dissatisfied } — collapse `user_satisfaction_counts`
- `friction_taxonomy` — normalize free-vocab keys (merge `api_error`/`api_errors`), **drop `secret_leak` entirely**.
All values are integer counts. **No free text** (`underlying_goal`, `brief_summary`, `friction_detail`) is read into the payload.

**3b — Derive verdict locally (optional, ship after 3a).** A local-only theme/verdict line (e.g. "You don't avoid chaos. You surf it.") computed on-device from free-text; **only the single resulting string is eligible to publish**, and only behind an explicit toggle. Defer if it complicates the privacy review — 3a alone delivers the slides.

**3c — Sync (derived-only).** `api/_lib/export-upload.js`: add a dedicated `FACET_SIGNAL_KEYS` whitelist and an `exportFacetSignals()` that copies only the integer-count maps above (reuse `copyFiniteNumbers` per sub-map). Do **not** fold into free-form `raw_meta`. Update `api/_lib/credential.js` privacy note (currently lists "free-text friction details" as excluded) to assert facet signals are counts-only.

**3d — Render.** Bar strips on `u.html` (outcome mix, partnership grade, working mode, friction-is-human-not-machine). New Wrapped slides in `home.html`/`wrapped.html` built from `facet_signals`. OG card top moment (`api/og.js`) can pull the strongest verdict.

**Edge cases / guardrails:**
- **Debugger contradiction:** the `primary_success_mix` slide ("your superpower is proactive help, not debugging") may contradict the mechanical archetype. Frame as enrichment, not correction-of-the-badge; never use it to mutate archetype scoring.
- **Visibility:** facet bars are bucketed counts, not exact raw counts — not gated by `show_raw_counts`. But confirm with `metricVisibility` they aren't treated as raw.
- **Old uploads** lack `facet_signals` → all render paths must no-op gracefully when absent (Wave-1 profiles predate this).
- **`secret_leak` must never appear** in any synced or rendered structure — assert in tests.

**Tests:**
- Extractor unit: feed the 43 real `~/.claude/usage-data/facets` fixtures → assert `facet_signals` totals match hand-counted distributions and `secret_leak` is absent.
- Export unit: `exportFacetSignals` drops any non-whitelisted key and any string value; round-trips only integer counts.
- Render: profile with no `facet_signals` renders without the strips and without error.

**Effort:** M (3a/3c/3d) + L if 3b. **Wave:** 1 (extract+sync schema) → 3 (full render).

---

## Sequencing & risk

1. **Fix 2 first** (S, isolated, no deps) — stops asserting a false claim immediately; lowest risk.
2. **Fix 1 keystone** (M) — the loop-closing change; depends on nothing new.
3. **Fix 3** (M/L) — schema-touching; do 3a+3c (extract+sync) before any render so old/new uploads stay compatible.

**Risks:**
- Fix 3 touches the local→server boundary — the one thing the privacy moat depends on. The new whitelist must be additive and counts-only; review `export-upload.js` diff against the Do-Not-Drift list before merge.
- Fix 1's profile fetch adds a runtime dependency on `/api/u/<handle>` from the landing — must degrade to today's behavior on any failure (no hard dependency).
- Don't break the default (non-intent) landing or the existing reveal pipeline — all new UI gated behind `comparisonIntent()`/`facet_signals` presence.

## Acceptance

- A logged-out visitor opens `/?compareTo=<handle>&compareArchetype=<t>`, sees the host's real card and a live pairing % after picking an archetype — without a terminal.
- No vibestats surface renders a "top X%" claim; cards lead with true population rarity.
- A fresh CLI sync writes counts-only `facet_signals`; `u.html` shows outcome/partnership/working-mode/friction strips; `secret_leak` never crosses the boundary.
