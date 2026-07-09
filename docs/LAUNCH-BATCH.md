# Launch Batch — the compatibility experiment

Goal: get real traffic through the **compare-intent funnel** to test the hypothesis
*"who should I build with" beats "what kind of builder am I."* Every link below is
auto-instrumented (compare_intent_view → pairing_shown → shared → reveal_click).

Lead with **pairing**, not personality. Seth = **high-velocity Deep Diver** (rare combo).

## The lead link (the experiment)

```
https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver
```

Recipients land on an instant in-browser pairing: they pick their type, see chemistry +
a pairing name, and get a shareable receipt — no signup, no terminal. Desktop reveal of
their *real* profile is the upsell.

**Before blasting:** re-run your own CLI sync so `/u/brightseth` shows "How you build."

## Guardrails (from SHARE-PLAYBOOK / LAUNCH)

- Rarity claim belongs to the **combo**: "rare combo: high-velocity Deep Diver." Do NOT say "rare Deep Diver."
- Reveal runs **on desktop** (that's where /insights lives). Don't promise mobile reveal.
- "Inspect first" line on any `curl | sh` surface.
- Raw `/insights` never leaves the machine; anonymous sharing needs no GitHub.
- Consider raising `REVEAL_LINKS_PER_HOUR` for the window (default 12/hr/IP can throttle).

---

## DM — Wave 1 (first 5, treat as live QA)

```
built a small thing, want your eyes on it. it reads your Claude Code /insights
*locally* and tells you who you'd build best with — your "pairing chemistry."

see how you'd pair with me (pick your type, instant, no signup):
https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver

want your real one? run /insights in Claude Code, then on desktop:
curl -fsSL https://vibestats.io/cli.sh | sh -s --
(inspect first if you like: curl -fsSL https://vibestats.io/cli.sh | less)

brutally honest: did the pairing feel true? where did you hesitate?
```

## DM — Wave 2 (next 15, after fixing Wave-1 friction)

```
quick one — who would you build best with in Claude Code?

see your chemistry with me (pick your type, instant, no signup):
https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver

raw /insights never leaves your machine. send me your pairing 👀
```

---

## X thread (lead = compatibility)

**Tweet 1 (the hook):**
```
not "what kind of coder are you" — "who would you build best with?"

i'm a high-velocity Deep Diver. see how you'd pair with me 👇
(pick your type, instant chemistry, no signup)
https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver
```

**Tweet 2 (how + privacy):**
```
it reads your Claude Code /insights locally — raw data never leaves your machine.
you get a pairing like "Architect × Builder = Blueprints & Bricks · 94%."

reveal your real one on desktop:
/insights, then: curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

**Tweet 3 (the ask):**
```
drop your pairing with me below, and @ someone you'd want as a co-pilot 🤝
```

---

## Reddit / Discord (r/ClaudeAI, low-friction)

```
made a thing that tells you who you'd build best with in Claude Code (not just
"your type"). it reads your /insights locally — nothing uploaded. pick your type
and see your chemistry with mine, no signup:
https://vibestats.io/?compareTo=brightseth&compareArchetype=deepdiver

reveal your real one on desktop: /insights, then
curl -fsSL https://vibestats.io/cli.sh | less   (then | sh -s -- if you're good)
which pairing did you get?
```

---

## Read the funnel after each send

```
vercel env run -e production -- npm run traffic:launch
```

Watch the **Compare-intent funnel** block:
- `landed → saw pairing` low → the landing/selector isn't compelling.
- `saw → shared` low → the pairing result isn't share-worthy (the core hypothesis test).
- `saw → reveal click` low → people enjoy the toy but won't invest in their real profile.
- **Attributed sources** climbing on `u:brightseth` → pairing shares are creating new entrants (compatibility is spreading). That's the win condition.
