# vibestats

**Find your vibecoding personality.** Upload a Claude Code `/insights` JSON, get an archetype + a shareable card.

Live: [vibestats.io](https://vibestats.io)

---

## What it is today (May 2026)

A single-page personality engine for Claude Code users. The user runs `/insights` inside CC, downloads the JSON, drops it on vibestats.io, and gets:

- **An archetype** (1 of 8: Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, Builder).
- **A derived signature combo** (top archetype + secondary signal, 56 possible combos, no 9th archetype).
- **A scored breakdown** across all 8 (sigmoid + power-law normalized).
- **A Spotify-Wrapped-style tap-through** (`/wrapped`).
- **A shareable card** with dynamic OG image (`/card?a=…`) → Twitter intent prefilled.
- **A community genome page** (`/genome`) — archetype distribution + community averages.
- **A compatibility view** (`/compare`) — two pasted profiles side-by-side.

**Privacy stance:** the insights JSON never leaves the browser. Only aggregate metrics (archetype + 5 averages) are POSTed to Redis for the community page, rate-limited 1/IP/hr.

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
├── u.html             # public profile shell (`/u/<handle>`)
├── settings.html      # authenticated settings shell
├── api/
│   ├── auth/          # GitHub OAuth start/callback/logout
│   ├── me.js          # current session
│   ├── uploads.js     # authenticated derived-metric uploads
│   ├── settings.js    # privacy/delete account
│   ├── settings/      # export endpoint
│   ├── u/[handle].js  # profile JSON
│   ├── stats.js       # POST aggregate, GET community averages
│   ├── og.js          # dynamic OG image (Satori SVG → PNG)
│   └── card.js        # share landing page (`/card?a=…`)
├── db/migrations/     # plain SQL migrations
├── scripts/migrate.mjs
├── lib/               # html2canvas (save card as image)
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

Pull shared Vercel env when available:

```bash
vercel link --project vibestats --scope lets-vibe
vercel env pull .env.local
```

Run database migrations:

```bash
npm run migrate
```

Run local smoke checks:

```bash
npm test
npm run doctor:identity
```

## Deploy

```bash
vercel --prod
```

CI is currently manual — Wave 1 adds GitHub Actions on push to `main`.

## Conventions

- **Branch discipline:** feature branches → PR → merge to main. Don't push to main directly.
- **Pre-push hygiene:** scan diff for secrets, transcripts, internal notes before pushing. `.env.local` is git-ignored — keep it that way.
- **All scoring math lives in `index.html`** for now (single-page tradition). When duplicated in `api/*.js`, keep the duplicate in sync until Wave 1 lifts it to `lib/scoring.js`.
- **8 archetypes are canonical.** Adding a 9th is a breaking change (touches scoring, OG, share URL params, community aggregates, compatibility math). See ROADMAP Wave 3 for sub-archetypes — those are additive.

## Docs

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — strategic direction, 4 waves of execution, opinion on what's actually viral.
- [`docs/GOAL.md`](docs/GOAL.md) — north star and viral loop guardrails.
- [`docs/CODEX-KICKOFF.md`](docs/CODEX-KICKOFF.md) — paste-ready brief for the next developer picking this up.
