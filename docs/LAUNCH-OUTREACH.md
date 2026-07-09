# Vibestats Launch Outreach

Copy-paste launch assets and sequencing. Pairs with `docs/SHARE-PLAYBOOK.md` (posting rules) and `docs/LAUNCH.md` (the production/readiness gate).

## Posture

Warm the loop first, spike later. A launch is a **sequence**, not a day.

- **Wave 0 — dogfood (DMs/Discord):** 5 → 15 people, collect fast qualitative feedback and **8–10 real, varied archetype examples** + a couple of genuine "whoa" quotes. These become the launch proof.
- **Wave 1 — social warm-up (X):** seed reveals, build ambient curiosity, gather UGC.
- **Wave 2 — amplifiers (HN, then PH next day):** ride the proof from Waves 0–1. Never launch these cold.
- **Sustain:** weekly evolution hooks, leaderboard moments, the pairing beat.

**Do not lead PH/HN cold.** A Show HN with live examples and a present founder is a front-page candidate; the same link with no examples dies at 3 points.

## Campaign beats (don't spend it all at once)

- **Day 1 — "Which one are you?"** The 8-archetype grid is the lead artifact (it's the meme; it works on mobile with no data). Seth's profile is *proof*, not the lead.
- **Day 2–3 — "Who would you build best with?"** The pairing/compare hook. Gives the campaign a second beat and a reason to re-engage.

## Channel copy, separated

Each channel leads with a different truth. Do not cross the streams.

| Channel | Lead with | One-liner |
|---|---|---|
| Hacker News | Local-first / derived-only architecture | "Local derived Claude Code stats. No raw upload." |
| Product Hunt | Delight / Wrapped | "Spotify Wrapped for how you build with Claude Code." |
| X / Twitter | The meme | "Tag yourself. What are you?" |
| Discord / r/ClaudeAI | Low-friction participation | "Run this, paste your archetype." |

---

## Show HN

**Treat HN as a technical audit, not just a channel.** If HN likes it, great. If HN attacks it, the useful signal is *what* they attack — unclear privacy language, weak methodology, or a trust gap. Mine the thread for findings. **Founder presence in comments is non-negotiable** (be there live for hours; HN rewards a responsive maker and punishes a drive-by).

Post Tue–Thu, ~8–10am PT.

**Title:**
```
Show HN: Vibestats – your Claude Code coding personality, derived locally
```

**First comment (the make-or-break — post immediately as the maker):**
```
Maker here. Vibestats reads your Claude Code /insights output on your own
machine, derives a "coding archetype" (one of eight) plus a handful of
bucketed metrics, and shows you a wrapped-style result you can share.

The design constraint I cared most about: your raw /insights never leaves
your computer. The helper runs locally and only ever sends derived,
public-safe fields (archetype, bucketed scores, a few metrics) — and only
if you choose to publish. Anonymous share links are unlisted, store
derived-only snapshots, and expire in 30 days. No prompts, project paths,
session ids, or free text are ever uploaded.

It's a curl | sh helper — inspect it first if you'd rather:
  curl -fsSL https://vibestats.io/cli.sh | less
then, if you're comfortable:
  curl -fsSL https://vibestats.io/cli.sh | sh -s --

On methodology: the archetypes are derived from observable behavior
(commit cadence, session depth, tool/grep usage, language spread, etc.),
not a self-report quiz — which is the part I find interesting: it's a
typology you can't really game. It's also opinionated and imperfect, and
I'd genuinely like the critique. Source is open; tear into the privacy
model and the scoring.

Reveal runs on desktop (the data lives in your local ~/.claude). No
mobile reveal yet — on a phone you can browse the eight archetypes and
send yourself the command for later.
```

**Be ready to defend, live:**
- `curl | sh` → lead with "inspect first," it's already in the comment.
- methodology → "opinionated, derived from behavior, here's what feeds it, critique welcome." Don't overclaim science.
- privacy → point to derived-only + the explicit "not stored" list. Never say "completely private" about `/r` links (they're public-unlisted).

---

## Product Hunt

Launch 12:01am PT, **a different day than HN** (HN first, fragile; PH next, riding the proof). Need a hunter or self-hunt, a rallied first-hour crew, and a strong gallery.

**Tagline (≤60 chars):**
```
Spotify Wrapped for how you build with Claude Code
```

**Maker's first comment:**
```
I wanted a fun, honest mirror for how we actually build with AI — so
vibestats turns your Claude Code activity into a "coding personality"
reveal. Eight archetypes (Orchestrator, Shipper, Architect, Debugger,
Polyglot, Sprinter, Deep Diver, Builder), a wrapped-style result, and a
card you can share.

The twist vs. a personality quiz: you don't answer questions — it's
derived from how you actually code. And it's privacy-first by design:
your raw data never leaves your machine; shareable links carry derived
metrics only and expire in 30 days.

Try it on your desktop (that's where your Claude Code data lives), or
tap through the eight archetypes to find your type. Which one are you?
```

**Gallery shot list (produce in this order):**
1. **8-archetype grid** — the tag-yourself hero (glyphs + names + one-line each). This is the thumbnail.
2. **Animated reveal clip (10–15s)** — terminal command → wrapped reveal → archetype card. The delight.
3. **Archetype card** — one strong example (a real reveal), glyph + territory color, screenshot-worthy.
4. **Privacy proof card** — "Raw /insights stays local. Derived metrics only."
5. **Pairing teaser** — "Deep Diver × Shipper: what would you build?" (sets up the day-2 beat).
6. **Anonymous share `/r` page** — shows the recipient experience + "reveal yours to compare."

## 8-archetype grid spec

This is the day-1 lead artifact. It should work as a screenshot, X image, PH thumbnail, Discord drop, and mobile-native "tag yourself" meme even before someone can run the desktop reveal.

**Format:**
- Primary: 1600 × 1200 PNG, dark background, 2 × 4 grid.
- Secondary: 1080 × 1350 vertical crop for X/mobile.
- Safe area: keep names/taglines inside the center 85%; thumbnails will crop edges.
- Top copy: `Which Claude Code archetype are you?`
- Bottom copy: `You did not take a quiz. Your actual coding revealed it.`
- Footer microcopy: `Reveal yours on desktop at vibestats.io`

**Card language and visual source:**

| Key | Public name | Glyph | Color | One-line |
|---|---|---:|---|---|
| orchestrator | Orchestrator | `||` | `#6B8FFF` | You don't code. You conduct. |
| shipper | Shipper | `>>` | `#22c55e` | Done is better than perfect. |
| architect | Architect | `[]` | `#0891b2` | You plan before you build. |
| debugger | Debugger | `??` | `#f59e0b` | You don't guess. You investigate. |
| polyglot | Polyglot | `{}` | `#ff79c6` | One language is never enough. |
| sprinter | Sprinter | `!!` | `#ef4444` | Fast, focused, ferocious. |
| deepdiver | Deep Diver | `__` | `#3b82f6` | You go deep, not wide. |
| builder | Builder | `++` | `#84cc16` | You build things that didn't exist before. |

Use the current values from `lib/archetype-identity.js` as the binding source. If design changes a public name, tagline, glyph, or color, update that module first and regenerate the grid from the new source.

---

## X launch thread

Lead tweet = the **grid** (mobile-friendly, no data needed). Card/profile is proof, comes after.

**Tweet 1 (the meme — attach the 8-archetype grid image):**
```
Claude Code users: which one are you?

Orchestrator · Shipper · Architect · Debugger · Polyglot · Sprinter · Deep Diver · Builder

You didn't take a quiz. Your actual coding revealed it.
```

**Tweet 2 (proof + how):**
```
Here's mine — derived locally from my Claude Code /insights, raw data never left my machine:
https://vibestats.io/u/brightseth

Reveal yours on desktop:
1. /insights in Claude Code
2. curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

**Tweet 3 (privacy + share):**
```
Raw /insights stays on your computer. You can share anonymously (no GitHub, unlisted, expires in 30 days) or claim a profile. Your call.

On a phone? Tag yourself from the grid above, run the reveal on your laptop later.
```

**Tweet 4 (the ask):**
```
Drop your archetype below 👇 and @ two people whose type you can't guess.
```

**Day 2–3 follow-up (the pairing beat):**
```
Round 2: it's not "look at me," it's "who would you build with?"

Architect × Builder = the rarest, most productive pairing.
Deep Diver × Shipper = depth meets velocity.

Find your complement → compare from any profile.
```

---

## DM scripts (warm loop)

**Wave 1 — first 5 (treat as live QA; goal is honest friction feedback):**
```
Hey — built a small thing and you're exactly who I want to test it on.

It reads your Claude Code /insights *locally* and reveals your "coding
archetype" (raw data never leaves your machine). Takes ~1 min on desktop:

1. /insights in Claude Code
2. curl -fsSL https://vibestats.io/cli.sh | sh -s --

Brutally honest feedback welcome — where did you hesitate, what was
unclear, did the result feel true? Send me your archetype or a screenshot.
```

**Wave 2 — next 15 (after fixing Wave 1 hesitation; goal is shares):**
```
What's your Claude Code archetype?

Reveal it on desktop after running /insights:
curl -fsSL https://vibestats.io/cli.sh | sh -s --

You can share anonymously, no GitHub needed. Send me your /r link or
archetype — collecting types before we post this publicly.
```

---

## Reddit (r/ClaudeAI is the bullseye)

Post as a member sharing something fun, not an ad. r/SideProject secondary. Avoid r/programming.

**Title:**
```
I made a thing that reveals your "Claude Code coding personality" from /insights (runs locally, nothing uploaded)
```

**Body:**
```
Been coding a lot with Claude Code and got curious whether /insights could
say something about *how* I build, not just how much. So I made vibestats:
it reads your /insights output locally, derives one of eight archetypes
(Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep
Diver, Builder) plus a few metrics, and gives you a wrapped-style reveal.

Privacy was the main constraint: raw /insights never leaves your machine,
and anything you share is derived-only + expires in 30 days. It's a
curl | sh helper — inspect first if you want:
  curl -fsSL https://vibestats.io/cli.sh | less

Runs on desktop (that's where the data is). Curious what everyone gets —
drop your archetype. Which one are you?
```

---

## Pre-launch checklist

Do not amplify until every box is checked.

- [ ] **`/r` create→view round-trip verified under real traffic** (the migration-0015 500 must never recur on a spike) + a post-deploy canary on the create path.
- [ ] **Rate limit pressure-tested.** The default 12/hr/IP reveal-link cap is good abuse protection but may block legit creation behind shared NATs / coworking / launch-day repeat testing. Verify it will not throttle real users, or set `REVEAL_LINKS_PER_HOUR` higher for the launch deployment. The app clamps it to `1..240`.
- [ ] **8–10 real, varied archetype examples collected** (the launch proof / gallery / first comments).
- [ ] **Fresh `/r` slugs minted at blast time** (30-day window covers the campaign; never reuse stale testing slugs in launch copy).
- [ ] **Every public surface sets the "reveal on desktop" expectation** (no mobile-reveal promise).
- [ ] **"Inspect first" line present on every technical launch surface** (HN, Reddit, docs).
- [ ] **8-archetype grid image produced** and is the day-1 lead artifact.
- [ ] **Founder available to sit in the HN thread for hours.**
- [ ] **Capacity check:** Vercel function + Neon limits can absorb a front-page spike of `/r` writes.
- [ ] **Rarity claims only where live `/genome` distribution supports them.**
- [ ] **GitHub-claim gate is cleared** (`docs/LAUNCH.md` is the authority — cleared 2026-06-01).

## Launch Traffic Pulse

Run this after each wave: after the tweet, after the first 5 DMs, after the next 15, and during any HN/PH spike.

```bash
vercel env run -e production -- npm run traffic:launch
```

Watch for:

- `/u views` climbing with no `compares`: profile interest exists, but the profile CTA is not pulling people into "reveal yours."
- `compares` climbing with no `created`: people are curious but the desktop/terminal step is the wall.
- `created` climbing with no `/r views`: users reveal but do not publish/share the anonymous link.
- Any 429s in Vercel logs: raise `REVEAL_LINKS_PER_HOUR` during the launch window.
- Any 500s in Vercel logs: pause amplification until fixed.

Vercel log checks:

```bash
vercel logs --environment production --since 1h --status-code 429 --scope lets-vibe --no-branch
vercel logs --environment production --since 1h --query "status:500" --scope lets-vibe --no-branch
```

---

## What NOT to say

- ❌ **No fake rarity.** Don't say "rare Deep Diver" unless live distribution proves that exact claim. Rarity lives in signature combos, not base archetypes.
- ❌ **No privacy overclaim.** Never call anonymous `/r` links "completely private" — they're **public, unlisted**. Say so.
- ❌ **No mobile-reveal promise.** Reveal is desktop-only (data lives in local `~/.claude`). Mobile = browse + tag-yourself + send-to-desktop.
- ❌ **No "GitHub claim" as the first ask.** Anonymous-first; claim is optional and comes after the reveal.
- ❌ **No `/vibe` links in the primary launch UI** (the receiving flow isn't ready).
- ❌ **No ninth archetype** and no implying the eight are scientific/definitive — they're opinionated and derived.
- ❌ **No "upload your data" framing anywhere.** It's a reveal, not an upload; raw data stays local.
