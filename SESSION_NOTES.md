# vibestats Session — Feb 10, 2026

## What Shipped

### vibestats.io (commit `34f80f7`)
- **DNA Fingerprint** — 8-bar colored barcode on archetype card showing full score distribution
- **Sub-archetype** — "You're a deep-session Shipper" derived from secondary scores
- **Evolution Prediction** — slide before reveal predicting archetype drift
- **Genome Page** (`/genome`) — community visualization with distribution bars, averages, archetype profiles, shuffled genome barcode
- **Phase 1 CTAs** — "Find other SHIPPERs on /vibe" buttons, enhanced footer with live presence, funnel tracking, tweet @slashvibe mentions
- **Compare page** — live pairing data from coding-dna API, /vibe CTAs

### slashvibe.dev (commit `3e8aad2`)
- **`/api/coding-dna`** — collaboration matching endpoint returning top pairings, recent archetypes, hot streak from Postgres

## Architecture

```
vibestats.io (no login, Vercel)
  ├── /api/stats — Upstash Redis aggregate stats
  ├── /api/card — server-rendered OG share page
  ├── /api/og — OG image generation
  ├── /genome — community coding genome page
  └── /compare — archetype pairing comparisons

slashvibe.dev (auth, Vercel + Neon + KV)
  ├── /api/coding-dna — collaboration matching (Postgres)
  ├── /api/archetype-stats — distribution counts
  ├── /api/presence — live online count
  └── /api/funnel — referral tracking
```

## Growth Funnel
```
Social → vibestats.io (zero friction) → archetype card → share (viral)
                                        ↓
                              "Find other SHIPPERs on /vibe" → join /vibe
```

## Key Decisions
- DNA barcode uses continuous scores (not just top archetype) for richer identity signal
- Genome page fetches from both vibestats /api/stats AND slashvibe.dev /api/archetype-stats via Promise.allSettled
- coding-dna API deduplicates symmetric pairings (a:b = b:a) server-side
- All cross-site CTAs include `ref=vibestats` + archetype params for funnel attribution

## Lessons Learned
- **TeamDelete wipes agent worktrees** — always commit agent work before deleting teams
- **`pnpm run deploy` requires Vercel auth** — use direct `vercel link --yes --project X && vercel --prod` instead

## What's Next (organic)
- coding-dna and archetype-stats will auto-populate as users flow through identity bridge
- Phase 3 when user base grows: archetype matchmaking, leaderboards, friend referrals
