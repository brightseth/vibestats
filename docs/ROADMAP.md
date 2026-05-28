# vibestats Roadmap

**Target:** the social connective vanity credentializing matchmaker for Claude Code users.

This document is opinionated. It says what we should build and — more importantly — what we shouldn't.

---

## TL;DR

The current product is a **vanity moment without a return reason**. You upload, get an archetype card, tweet it, and never come back. That's a one-night stand, not a product.

The single biggest unlock is **persistent identity**: `vibestats.io/u/<gh-handle>` as the canonical surface. Everything else stacks on it.

After that, three loops in order:

1. **Return loop** — weekly evolution digest + streak tracking.
2. **Discovery loop** — browse other vibecoders, filter by archetype/stack/intent.
3. **Pair loop** — goal-driven matching ("find me a co-pilot for an open-source push this weekend").

The viral hook stays where it already works — the archetype card — but becomes **share-asymmetric**: when you send your card to a friend, *they* see "you'd be a 78% complement to seth" instead of just a static image. Spotify Blend, not a screenshot.

---

## Honest state assessment

### What's working

- **Archetype framing is sticky.** "I'm an Orchestrator" / "I'm a Shipper" is identity language people repeat. The 8 archetypes are well-differentiated and the scoring is non-trivially earned.
- **Tap-through (`/wrapped`) is great storytelling.** Spotify Wrapped lineage shows — the slides feel personal.
- **Privacy stance is correct.** JSON never leaving the browser is a real promise, not a fig leaf. Don't break this without thinking hard.
- **Dynamic OG cards work.** Twitter previews look like a designed product, not a screenshot.
- **Genome page exists** and is the seed of a community surface — it just doesn't connect to individuals yet.

### What's broken or thin

- **No persistent identity.** A user shows up, gets a moment, leaves. No way for them to return to themselves.
- **No social loops.** The share flow is unidirectional. A tweet is a dead-end for the recipient — no comparison, no leaderboard slot, no "I want one too."
- **Matchmaker (compare.html) is unusable in practice.** Both parties have to manually paste data simultaneously. Nobody does this.
- **Credentializing is weak.** Anyone can edit the JSON before uploading. No proof, no signature, no anchor.
- **No retention surface.** The user's archetype changes as their CC usage evolves but nothing pulls them back to see it.
- **8 archetypes is too coarse** to feel rare. "I'm an Orchestrator" is true for 5% of users — meaningful, but not scarce. Need sub-archetypes and rare combos for vanity scarcity.
- **Naming.** "vibestats" reads as analytics. The social product wants a sub-brand or a verb. "Get vibed." "Match on vibestats." TBD.
- **No CLI / no auto-import.** Manual download + upload is friction. `npx vibestats sync` would 10x retention.

---

## The four waves

Each wave is 1–2 weeks of focused dev. They're sequential because each depends on what came before.

---

### Wave 1 — Identity (1 week)

**Goal:** turn one-time visitors into persistent profiles.

**The pitch:** "Sign in with GitHub. Your archetype lives at vibestats.io/u/yourhandle. Re-upload anytime, watch it evolve."

**Deliverables:**

1. **GitHub OAuth.** Use NextAuth or a tiny custom flow. The handle is the only profile field that matters at first. Store: `{ gh_id, gh_handle, avatar_url, created_at, last_seen_at }`.
2. **Postgres on Neon** (reuse the slashvibe stack). Tables: `users`, `uploads` (archetype + metrics over time), `profile_settings` (privacy toggles).
3. **`/u/<handle>` profile page.** Renders the latest archetype card big, then evolution timeline (sparkline of primary archetype score over time), then community stats (percentile within archetype).
4. **Upload flow change.** Logged-in users get a "save to your profile" toggle, default on. Logged-out users keep the privacy-first ephemeral path.
5. **Privacy toggles.** Public profile / unlisted / private. Hide raw counts. Hide languages. Default: public, all visible.
6. **OG share at `/u/<handle>`.** Reuse `api/og.js` — same card, real handle.

**Non-goals:**
- No following / followers yet (Wave 2).
- No DMs (probably never inside vibestats — link out to /vibe or X).
- No edit-by-hand profile bio yet (Wave 3 — one sentence max).

**Schema sketch:**

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  gh_id bigint unique not null,
  gh_handle text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  privacy text default 'public'   -- public | unlisted | private
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  archetype text not null,
  scores jsonb not null,           -- {orchestrator: 73, shipper: 41, ...}
  metrics jsonb not null,          -- commitsPerDay, sessions, langs, etc — derived
  raw_meta jsonb,                  -- date range, total_sessions, etc (no PII)
  uploaded_at timestamptz default now()
);

create index on uploads(user_id, uploaded_at desc);
```

**Acceptance:** Seth signs in, uploads insights, lands on `vibestats.io/u/brightseth`, re-uploads a week later, sees a 2-point trend line.

---

### Wave 2 — Share-asymmetric virality (1 week)

**Goal:** every share creates discovery for the recipient.

**The pitch:** "When seth tweets his card, the people who click it don't see a dead-end — they see how they'd compare."

**Deliverables:**

1. **`/u/<handle>` enhancements:**
   - **"How do I compare?"** CTA → if recipient is logged in, instant compatibility math; if not, prompt to upload (existing flow) and auto-return to comparison.
   - **Compatibility tab:** show recipient their archetype vs. host's, with a 0–100 complement score and a one-liner ("You're a Shipper. seth is an Orchestrator. You'd build fast on their architecture.").
2. **Compatibility math lifted out of `compare.html`** into `lib/compat.js`, callable from any page.
3. **Embed card.** `<iframe src="vibestats.io/u/<handle>/embed">` for personal sites and GitHub READMEs. 600×320, lazy-loaded, link back to full profile.
4. **GitHub README badge.** Markdown snippet:
   `[![vibestats](https://vibestats.io/u/brightseth/badge.svg)](https://vibestats.io/u/brightseth)` →
   tiny SVG with archetype + primary score. This is the credential surface.
5. **Tweak share copy.** Tweet variants currently say "What's YOUR personality?" — change to "See how you'd pair with me: vibestats.io/u/<handle>". Same vanity, asymmetric ask.

**Non-goals:**
- No follower graph yet (overkill, Twitter does this).
- No DM-from-card (link out to X reply or /vibe).

**Acceptance:** karpathy clicks Seth's tweeted card → lands on `/u/brightseth` → sees an "upload yours to compare" CTA → uploads → lands on a `/u/brightseth/pair/karpathy` style page showing the math. Loop closed.

---

### Wave 3 — Vanity scarcity + retention (2 weeks)

**Goal:** make people *want* to come back. Streaks, leaderboards, rare combos, weekly digest.

**The pitch:** "You're 1 of 11 people with this exact 3-archetype signature this month. You're #4 on the Orchestrator leaderboard. Your Architect→Orchestrator transition is 73% complete."

**Deliverables:**

1. **Sub-archetypes (already partly built).** `parallel orchestrator`, `methodical architect`. Lift `SUB_PREFIXES` from `index.html` into `lib/scoring.js`, expose on profile.
2. **Rare combo detection.** Compute a fingerprint = top-3 archetypes + bucketed primary score. Show "1 of N this month" if N < 50. This is the scarcity vanity.
3. **Weekly leaderboards** per archetype: top 25 by primary score, with ties broken by recency. Reset weekly. Public at `/leaderboard/<archetype>`.
4. **Streak tracking.** Uploads more than 7 days apart break a streak. Show "47-day streak" on profile.
5. **Evolution badges.** Triggered when secondary archetype overtakes primary, or when a new archetype enters top-3. "🦋 Architect → Orchestrator transition" — share-worthy moments.
6. **Weekly digest email** (opt-in at signup). Subject: "your vibecoding evolution — week 23". One screenshot + 3 stats + leaderboard position. **This is the single most important retention lever in the whole roadmap.** Use Resend or Postmark — don't roll your own.
7. **Sub-archetype scarcity scoring** — display "rare" / "uncommon" / "common" badge next to each user's combo.

**Non-goals:**
- No notifications inside the app yet (email only — lower volume, higher trust).
- No gamified XP / levels (cheap, dilutes).

**Acceptance:** Seth gets a Monday morning email showing he climbed 3 spots on the Orchestrator leaderboard and his rare-combo count dropped to "1 of 6". He clicks the email, lands on his profile, refreshes for the dopamine.

---

### Wave 4 — Goal-driven matchmaking + CLI (2 weeks)

**Goal:** turn the directory into a productive surface. Find a pair, find a mentor, find a project.

**The pitch:** "I'm an Architect this weekend. I want to ship a side project with a Sprinter. Match me."

**Deliverables:**

1. **`looking_for` state on profile.** Enum: `pair-coding`, `co-founder`, `hire`, `mentor`, `mentee`, `idle`. TTL: 7 days by default, configurable. Set from profile UI in one click.
2. **`/browse` directory.** Filter by archetype, language, looking-for, location (optional, opt-in). Default sort: recently active. Real-time-ish (5min cache).
3. **Goal-driven match score.** Not just "compatibility" — instead "for what." Pairing a Sprinter with a Deep Diver scores high for pair-coding (complementary), low for co-founding (friction). Build a small matrix.
4. **`/match` flow.** Pick your goal → see top 10 matches in the directory with that goal. Click one → request intro (just generates a draft message you can copy to X / send via the user's preferred contact link).
5. **CLI: `npx vibestats sync`.**
   - Reads insights from `~/.claude/usage-data/agent-insights.json` (already on disk).
   - Computes metrics locally.
   - POSTs to `/api/sync` with a signed token (GitHub auth required).
   - Updates profile silently. **This unlocks weekly upload cadence without manual download/upload.**
6. **Cross-link with Anthropic's `/insights`.** Detect when CC users run /insights and surface a one-line CTA: "Push to vibestats." (Coordinate with Anthropic if they'll embed a CTA. Otherwise just ship the CLI and let users discover it.)

**Non-goals:**
- No in-app messaging. Link out.
- No paid features yet (Wave 5 vision below — premium recruiter access, anonymous founder intros — but only after the free product is gripping).

**Acceptance:** Seth sets `looking-for: pair-coding`, opens `/match`, picks a Sprinter from Berlin who's also pair-coding-available, copies a generated intro message, posts to X. Pair happens. Anecdote becomes the launch story.

---

## Wave 5 vision (not in scope, but worth flagging)

- **Recruiter view.** Post job, target archetype + stack + region. Paid.
- **Founder match.** Anonymous double-opt-in intros for people with `co-founder` looking-for. Heavy curation, gated.
- **Team rollups.** `vibestats.io/team/<org>` — composite archetype for a GitHub org. Companies will pay to claim theirs.
- **Verified org badges.** "Anthropic uses vibestats" type social proof.
- **Anthropic data partnership** (long shot). If Claude Code signs the insights JSON cryptographically, the credential becomes ironclad — recruiter-grade.

---

## What we're explicitly not doing

- **No swipe-style matching.** This is not a dating app. Friction is good — pair requests should feel intentional.
- **No DMs in vibestats.** Linking out to X / /vibe / email is the right surface. Don't reinvent inboxes.
- **No mobile app.** PWA is fine. Card-on-iPhone for sharing is the only mobile flow that matters.
- **No "AI-generated coaching."** Tempting, low value. The data is the value; advice is cheap.
- **No tokens / no crypto.** The vanity surface should feel mainstream-tech, not crypto-tech. (Even though Seth runs Spirit Protocol — different audience, different brand.)

---

## Naming question (open)

`vibestats.io` is good for the analytics framing. The matchmaker surface may want a sub-brand:

- `vibestats.io/match` ← simplest, ships first
- `pair.vibestats.io` ← sub-brand if we want it
- `getvibed.io` ← cringe but maybe right
- Rename whole product? Probably no — domain equity, search recognition, and the genome page all anchor here.

Default: keep `vibestats` as the brand, ship matchmaker as a feature surface. Revisit at Wave 4 if it's pulling its own gravity.

---

## Sequencing risk

The biggest risk is **building Waves 2–4 before Wave 1 is solid.** Without persistent identity, none of the rest matters. Resist the urge to ship leaderboards before profiles exist.

Second-biggest risk is **breaking the privacy promise.** The current "JSON never leaves the browser" stance is a real moat. Wave 1 must preserve it: only derived metrics get stored, never the raw JSON. Document this loudly.

Third risk: **8 archetypes feeling stale at scale.** Once we hit ~5K users, the diversity needs to come from sub-archetypes and rare combos, not by adding archetype #9. Wave 3 anticipates this.

---

## Open questions for Seth

1. **GitHub OAuth scope:** read-only public profile, or also read commit count for credentializing? Latter strengthens proof but raises permission ask.
2. **Pricing on Wave 5:** are we building this toward revenue or toward a /vibe community signal? Affects how aggressively we paywall.
3. **Naming:** rename or stay? (See above.)
4. **Anthropic relationship:** is there an opportunity to ask them to deep-link `/insights` to vibestats? Worth the ask?
5. **Genome page evolution:** keep as standalone community-stats page, or fold into `/u/<handle>` as "you vs. community"?

See `docs/CODEX-KICKOFF.md` for the Wave 1 starting task.
