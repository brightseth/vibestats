# vibestats

**Find your vibecoding personality.** Upload a Claude Code `/insights` JSON, get an archetype + a shareable card.

Live: [vibestats.io](https://vibestats.io)

---

## What it is today (May 2026)

A single-page personality engine for Claude Code users. The user runs `/insights` inside CC, downloads the JSON, drops it on vibestats.io, and gets:

- **An archetype** (1 of 8: Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, Builder).
- **A derived signature combo** (top archetype + secondary signal, plus anonymous monthly rarity counts; no 9th archetype).
- **Profile evolution badges** that show score movement or archetype shifts between saved uploads.
- **A scored breakdown** across all 8 (sigmoid + power-law normalized).
- **A Spotify-Wrapped-style tap-through** (`/wrapped`).
- **A shareable card** with dynamic OG image (`/card?a=…`) → Twitter intent prefilled.
- **A community genome page** (`/genome`) — archetype distribution + community averages.
- **A compatibility view** (`/compare`) — two pasted profiles side-by-side.
- **Person-backed pair links** (`/u/<host>/pair/<visitor>`) for share-asymmetric comparisons.
- **A portable profile badge** (`/u/<handle>/badge.svg`) for GitHub READMEs and personal sites.
- **An embeddable profile card** (`/u/<handle>/embed`) for personal sites, with a link back to compare.
- **Weekly public archetype leaderboards** (`/leaderboard/<archetype>`) from opt-in public profiles only, with rank shown on `/u/<handle>`.
- **A public directory** (`/browse`) that filters opt-in profiles by archetype and active intent, showing only coarse derived activity.
- **A public match surface** (`/match`) for explicit, short-lived `looking_for` profile intent.

**Privacy stance:** the insights JSON never leaves the browser. Community stats receive only aggregate metrics, and signed-in profile saves persist only derived fields: archetype, scores, coarse metrics, and signature metadata.

## Where it's going

A **public profile + matchmaker** for Claude Code users — see `docs/ROADMAP.md`.

The current product is a one-shot vanity moment. The next product is a **persistent identity** (`vibestats.io/u/<gh-handle>`) with an evolution timeline, leaderboards, and pair-finding. The vanity stays; the social tail gets built underneath it.

---

## Stack

- **Hosting:** Vercel (`lets-vibe/vibestats` project, aliased to `vibestats.io`).
- **Runtime:** static HTML/CSS/JS + Vercel Functions (`api/*.js`).
- **Storage:** Upstash Redis (KV REST API) for aggregate counters; Neon Postgres for authenticated profile history.
- **OG images:** `@vercel/og` via Satori (`api/og.js`) + `@resvg/resvg-js`.
- **Auth:** custom GitHub OAuth + signed `vibestats_auth` session cookie.
- **DB:** Neon Postgres. Raw insights JSON still never leaves the browser.

```
vibestats/
├── index.html         # upload + archetype reveal (~88KB, all client-side)
├── wrapped.html       # Spotify-Wrapped tap-through
├── dashboard.html     # detailed metric view
├── compare.html       # two-profile side-by-side
├── genome.html        # community genome page
├── leaderboard.html   # public archetype leaderboards
├── browse.html        # opt-in public profile directory
├── match.html         # public goal-driven match surface
├── u.html             # public profile shell (`/u/<handle>`)
├── settings.html      # authenticated settings shell
├── api/
│   ├── auth/          # GitHub OAuth start/callback/logout
│   ├── me.js          # current session
│   ├── uploads.js     # authenticated derived-metric uploads
│   ├── settings.js    # privacy/digest/delete account
│   ├── settings/      # export endpoint
│   ├── u/[handle].js  # profile JSON
│   ├── leaderboard.js # public leaderboard JSON
│   ├── browse.js      # public directory JSON
│   ├── match.js       # public active-intent match JSON
│   ├── stats.js       # POST aggregate, GET community averages
│   ├── og.js          # dynamic OG image (Satori SVG → PNG)
│   ├── badge.js       # portable SVG profile badge
│   ├── embed.js       # frameable profile card (`/u/<handle>/embed`)
│   └── card.js        # share landing page (`/card?a=…`)
├── db/migrations/     # plain SQL migrations
├── scripts/migrate.mjs
├── lib/               # html2canvas + shared browser helpers
├── fonts/             # self-hosted Inter + JetBrains Mono
└── vercel.json        # cleanUrls, CSP, headers
```

## Run locally

```bash
git clone git@github.com:brightseth/vibestats.git
cd vibestats
npm install
# Local static serve (any static server works):
npx serve .
# For API routes:
vercel dev
```

Copy `.env.example` to `.env.local`. You'll need:

- `KV_REST_API_URL` + `KV_REST_API_TOKEN` for aggregate community stats.
- `DATABASE_URL` for Neon-backed profiles.
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` for OAuth.
- `VIBE_SESSION_SECRET` for the signed session cookie.
- `VIBESTATS_URL` for the OAuth callback origin (`http://localhost:3000` locally).
- `CRON_SECRET`, `RESEND_API_KEY`, and `DIGEST_FROM_EMAIL` for the opt-in weekly digest cron.

Pull shared Vercel env when available:

```bash
vercel link --project vibestats --scope lets-vibe
vercel env pull .env.local
```

Run database migrations:

```bash
npm run migrate
```

Weekly digest delivery is scheduled in `vercel.json` at `/api/cron/weekly-digest`. The route requires `Authorization: Bearer $CRON_SECRET` and sends via Resend when `RESEND_API_KEY` + `DIGEST_FROM_EMAIL` are configured.

Run local smoke checks:

```bash
npm test
npm run doctor:identity
```

## Deploy

```bash
vercel --prod
```

CI runs the smoke harness on pull requests and pushes to `main`.

## Conventions

- **Branch discipline:** feature branches → PR → merge to main. Don't push to main directly.
- **Pre-push hygiene:** scan diff for secrets, transcripts, internal notes before pushing. `.env.local` is git-ignored — keep it that way.
- **All scoring math lives in `index.html`** for now (single-page tradition). When duplicated in `api/*.js`, keep the duplicate in sync until Wave 1 lifts it to `lib/scoring.js`.
- **Compatibility math lives in `lib/compat.js`.** Keep `/compare` and profile inline pairing on the shared helper.
- **8 archetypes are canonical.** Adding a 9th is a breaking change (touches scoring, OG, share URL params, community aggregates, compatibility math). See ROADMAP Wave 3 for sub-archetypes — those are additive.
- **Framing policy:** non-embed pages stay unframeable through CSP `frame-ancestors 'none'`. Do not restore a global `X-Frame-Options: DENY`; it would break `/u/<handle>/embed`.

## Docs

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — strategic direction, 4 waves of execution, opinion on what's actually viral.
- [`docs/GOAL.md`](docs/GOAL.md) — north star and viral loop guardrails.
- [`docs/CODEX-KICKOFF.md`](docs/CODEX-KICKOFF.md) — paste-ready brief for the next developer picking this up.
