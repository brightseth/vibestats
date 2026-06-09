# Session Handoff → Fable 5

Read this first. Written by an Opus 4.8 session (2026-06-08/09) for the next session
(ideally Fable 5 / Mythos-class). Everything below is committed; nothing depends on the
prior session's chat memory.

## Where things stand
- **Branch:** `feat/wave-1-identity` (NOT merged to main; prod deploys from this branch via
  manual `vercel --prod`, not git-auto). All work committed + pushed. Live on vibestats.io.
- **The arc this session:** flywheel diagnosis → keystone (compare-intent landing renders
  real card + instant in-browser pairing) → killed the fake "top X%" percentile → depth
  layer ("How you build", counts-only facet signals, allowlist privacy boundary, codex-
  hardened) → shareable pairing artifact → funnel instrumentation → autonomous /loop that
  shipped G1–G3.
- **Key docs:** `FLYWHEEL-REVIEW.md` (diagnosis), `IMPLEMENTATION-PLAN-TOP3.md`,
  `AUTONOMOUS-BACKLOG.md` (goals + log + Deferred), `LAUNCH-BATCH.md` (outreach), this file.

## Done & live
- G1 — primary-share leak fixed (logged-in reveals share `?compareTo=<handle>`; anon unchanged). `96226d0`
- G2 — "How you build" leads with a one-line receipt. `a3d0090`
- G3 — owner-only funnel page at **/scoreboard** (gate: `requireUser` + `VIBESTATS_OWNER_HANDLES`, default `brightseth`). `58d3931`
- Funnel instrumentation: `/api/event` → `funnel_events`; `npm run traffic:launch` prints the compare-intent funnel.

## Deferred (need a verifier/harness — IDEAL FABLE WORK)
These were deferred *only* because the prior session self-judged with no independent verifier
or real environment. Fable's verifier-sub-agent + Outcomes + a real harness is built to close them:
- **G2a** — carry `facet_signals` through the CLI→browser claim path. Touchpoints in
  `AUTONOMOUS-BACKLOG.md` Deferred section. Blocked on a CLI→preview→login→save→/u round-trip harness.
- **G3 owner-view** — `/scoreboard` deny-path is verified (anon→401), but the authenticated
  owner render was never eyeballed (couldn't hold an operator session). Needs a headless
  auth'd grader OR a human login.

## Pending HUMAN actions (only Seth can do — not lost)
1. **Funnel smoke test:** open `https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver`,
   pick a type, confirm the counter ticks (`traffic:launch` → landed/saw +1). As of handoff the
   funnel had only 1 event (a test beacon) — **no real conversion data yet.**
2. **Re-run CLI sync** (`curl -fsSL https://vibestats.io/cli.sh | sh -s --`) so `/u/brightseth`
   shows the new "How you build" depth (currently absent — saved before the feature shipped).
3. **/scoreboard eyeball:** log in as brightseth, open `/scoreboard`, confirm numbers render.
4. **X post decision:** HOLD until the scoreboard shows people *sharing* (proof the loop
   converts). Don't spend the X audience on an unproven loop. Copy ready in `LAUNCH-BATCH.md`.

## The Fable upgrade plan (why the next session should run on Fable 5)
1. **Rebuild the autonomous loop around `/goal` + an Outcomes grader sub-agent** instead of a
   self-judged "Definition of Done." Each goal passes an independent verifier before check-off.
2. **Verifier-everywhere** for outward actions (deploys, campaigns, comms) — independent grader,
   not self-critique (per Anthropic's Fable post + our codex-review experience).
3. **MEMORY.md → distilled rules**, not a logbook (fail→investigate→verify→distill→consult).
4. **Long-horizon always-on agents on Claude Managed Agents (CMA) + Outcomes** (FRED/COLTRANE/
   LEVI/GRACE) for self-correcting multi-hour goals.
5. **Better facet judging** with a Fable-class on-device judge → deeper, truer "How you build"
   (still derived-only; respects GOAL.md "no AI coaching").

## First actions for the Fable 5 session
1. Run the **`/claude-api`** skill to pull exact specs for `/goal`, **Outcomes**, and **CMA
   memory** (the Fable post says Claude Code can do this). Design from facts, not this summary.
2. Read `AUTONOMOUS-BACKLOG.md` + this file.
3. **Re-attempt G2a and G3-owner-view using a real verifier/harness** — that's the highest-
   leverage proof-of-upgrade: close the exact work Opus had to defer.
4. Keep the standing guardrails: derived-only privacy moat, no Do-Not-Drift violations
   (GOAL.md), STOP-and-verify before shipping outward, never send DMs/post for Seth.
