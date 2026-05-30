# vibestats

**Find your vibecoding personality.** Run Claude Code `/insights`, reveal with the vibestats CLI or legacy JSON drop, then get an archetype + a shareable card.

Live: [vibestats.io](https://vibestats.io)

---

## What it is today (May 2026)

A single-page personality engine for Claude Code users. The user runs `/insights` inside CC, uploads locally in the browser or runs the vibestats CLI, and gets:

- **An archetype** (1 of 8: Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, Builder).
- **A derived signature combo** (top archetype + secondary signal, plus anonymous monthly rarity counts; no 9th archetype).
- **Collectible profile badges** named from public-safe rarity, leaderboard, facet, moment, streak, and evolution signals.
- **A facet radar** (7 derived axes) so profiles show a personality shape, not just one label.
- **Facet-aware comparisons and matches** so pair scores use the profile shape, not only the top archetype.
- **A profile recap surface** (`/u/<handle>/recap`) for shareable weekly-style return moments without email delivery.
- **An owner-only weekly digest preview** (`/api/digest/preview`) so the return-loop email can be inspected before delivery env is enabled.
- **Profile evolution badges** that show score movement or archetype shifts between saved uploads.
- **A scored breakdown** across all 8 (sigmoid + power-law normalized).
- **A Spotify-Wrapped-style tap-through** (`/wrapped`).
- **A shareable card** with dynamic OG image (`/card?a=…`) → Twitter intent prefilled.
- **Compare-first homepage previews** (`/?compareTo=<handle>&compareArchetype=<type>`) that unfurl as "pair with @handle, then reveal yours" instead of generic homepage copy.
- **A community genome page** (`/genome`) — archetype distribution + community averages.
- **A compatibility view** (`/compare`) — two pasted profiles side-by-side.
- **Person-backed pair links** (`/u/<host>/pair/<visitor>`) for share-asymmetric comparisons.
- **A portable profile badge** (`/u/<handle>/badge.svg`) for GitHub READMEs and personal sites; copied Markdown clicks through to compare.
- **An embeddable profile card** (`/u/<handle>/embed`) for personal sites, with a link back to compare.
- **Weekly public archetype leaderboards** (`/leaderboard/<archetype>`) from opt-in public profiles only, with rank shown on `/u/<handle>`.
- **A public directory** (`/browse`) that filters opt-in profiles by archetype and active intent, showing only coarse derived activity.
- **Public metric controls** so exact activity counts and language count stay hidden from visitors unless the owner opts in.
- **A public match surface** (`/match`) for explicit, short-lived `looking_for` profile intent.
- **A local sync CLI** that reads the real Claude Code `/insights` output in `~/.claude/usage-data/` (`session-meta/`, `facets/`, and `report.html`), computes derived metrics locally, and posts them with a signed sync token.

**Privacy stance:** the insights JSON never leaves the browser. Community stats receive only aggregate metrics, and signed-in profile saves persist only derived fields: archetype, scores, coarse metrics, and signature metadata. Public surfaces hide exact counts and language count by default.

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
├── home.html          # reveal + archetype result, served through /api/home for dynamic share previews
├── wrapped.html       # Spotify-Wrapped tap-through
├── dashboard.html     # detailed metric view
├── compare-template.html # two-profile side-by-side, served through `/api/compare-page`
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
│   ├── sync.js        # CLI sync endpoint for derived metrics
│   ├── sync-token.js  # signed token generator for local CLI sync
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
├── bin/vibestats.js   # local sync CLI
├── .claude/commands/  # project-local Claude Code `/vibestats` reveal command
├── lib/               # html2canvas + shared browser helpers
├── fonts/             # self-hosted Inter + JetBrains Mono
└── vercel.json        # cleanUrls, CSP, headers
```

## Run locally

```bash
git clone git@github.com:brightseth/vibestats.git
cd vibestats
npm install
npm run dev
```

The homepage is served through `/api/home` so compare-first links can render dynamic share metadata. Use `vercel dev` or `npm run dev`; a plain static server will not exercise the production route order.

Copy `.env.example` to `.env.local`. You'll need:

- `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for aggregate community stats.
- `DATABASE_URL`, `POSTGRES_URL`, or `NEON_DATABASE_URL` for Neon-backed profiles.
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` for OAuth.
- `VIBE_SESSION_SECRET`, `AUTH_SECRET`, or `NEXTAUTH_SECRET` for the signed session cookie. Use at least 32 bytes.
- `VIBESTATS_URL` for a stable OAuth callback origin when request-host inference is not enough.
- `CRON_SECRET`, `RESEND_API_KEY`, and `DIGEST_FROM_EMAIL` for the opt-in weekly digest cron.

Pull shared Vercel env when available:

```bash
vercel link --project vibestats --scope lets-vibe
vercel env pull .env.local --scope lets-vibe
```

When testing a Preview deployment, make sure the identity env vars are scoped to Preview, not only Production. `vercel env pull .env.local --environment=preview --scope lets-vibe` pulls the same env scope used by PR previews.

Run database migrations:

```bash
npm run migrate
```

Weekly digest delivery is scheduled in `vercel.json` at `/api/cron/weekly-digest`. The route requires `Authorization: Bearer $CRON_SECRET` and sends via Resend when `RESEND_API_KEY` + `DIGEST_FROM_EMAIL` are configured. Users can save digest consent before delivery is configured; those opt-ins become eligible once the email env is enabled.

Run one-command local sync after `/insights`. The no-subcommand claim flow prints a GitHub device code, creates a revocable sync token automatically after approval, and never requires copying a token out of Settings. The `sync` subcommand still works and can force the older local browser callback with `--browser`:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal
npx --yes github:brightseth/vibestats#feat/wave-1-identity
npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal --json
npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command
```

The unscoped npm package name `vibestats` is currently owned by another publisher, so do not use `npx vibestats` for this project until a scoped package is published or package ownership changes.

Settings still exposes a manual token command as a fallback. Sync tokens are revocable from Settings:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity --token "$VIBESTATS_SYNC_TOKEN"
```

Terminal-first onboarding is intentionally short:

```bash
# after running /insights in Claude Code
npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal
npx --yes github:brightseth/vibestats#feat/wave-1-identity
```

`reveal` is the local, no-sign-in result. Running the GitHub-backed npx command without a subcommand is the terminal-first sync flow. `join` and `onboard` remain explicit aliases. They reveal locally first, then ask the user to open GitHub's device login page and enter a short code only when publishing the derived profile. No website upload is required. Use `--browser` if you explicitly want the local callback approval flow instead.

By default the CLI reads the real Claude Code `/insights` output directory at `~/.claude/usage-data/`. It aggregates `session-meta/*.json` and `facets/*.json` into the same derived payload shape as the browser reveal, then posts only derived fields to `/api/sync`; prompts, session summaries, project paths, session ids, tool maps, and language maps stay local. Use `reveal` to show the derived result locally without a token or network request; it also prints an archetype-only compare link, copy-ready reveal text, X share URL, complementary pairing preview, and `/vibestats` install command that can be used before claiming. Use the no-subcommand command to claim/publish from the terminal after the reveal. Use `reveal --json` to inspect the exact derived payload, and `--file path/to/agent-insights.json` only for legacy JSON exports. `--dry-run` remains a legacy alias for `reveal`. A successful sync mints a GitHub-claimed, derived-only profile and prints the profile URL, compare-first invite URL, copy/paste share line, X share URL, optional public-discovery opt-in link, match intent link, leaderboard/match return links, recap URL, README badge Markdown, and profile embed HTML.

Claude Code users can also invoke the `/vibestats` command from `.claude/commands/vibestats.md`. Install it into `~/.claude/commands/vibestats.md` with `npx --yes github:brightseth/vibestats#feat/wave-1-identity install-claude-command`; use `--force` only if you want to replace an existing local command. It checks for `/insights` output, runs the CLI reveal to show derived results first, and only publishes after the user explicitly asks to claim the profile.

Run local smoke checks:

```bash
npm test
npm run doctor:identity
npm run doctor:identity -- --schema
```

After deploying, audit the live viral and identity surfaces without printing secrets. The audit covers identity readiness, profile/embed/badge/card share paths, compare-first routes, browse/match/leaderboard surfaces, and public raw-field leak markers:

```bash
npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready
```

For protected Vercel previews, run the same audit through `vercel curl`:

```bash
npm run audit:launch -- --deployment <preview-url> --scope lets-vibe --handle <saved-gh-handle>
```

## Deploy

```bash
vercel --prod
```

CI runs the smoke harness on pull requests and pushes to `main`.

## Conventions

- **Branch discipline:** feature branches → PR → merge to main. Don't push to main directly.
- **Pre-push hygiene:** scan diff for secrets, transcripts, internal notes before pushing. `.env.local` is git-ignored — keep it that way.
- **All scoring math lives in `home.html`** for now (single-page tradition). When duplicated in `api/*.js`, keep the duplicate in sync until Wave 1 lifts it to `lib/scoring.js`.
- **Compatibility math lives in `lib/compat.js`.** Keep `/compare` and profile inline pairing on the shared helper.
- **8 archetypes are canonical.** Adding a 9th is a breaking change (touches scoring, OG, share URL params, community aggregates, compatibility math). See ROADMAP Wave 3 for sub-archetypes — those are additive.
- **Framing policy:** non-embed pages stay unframeable through CSP `frame-ancestors 'none'`. Do not restore a global `X-Frame-Options: DENY`; it would break `/u/<handle>/embed`.

## Docs

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — strategic direction, 4 waves of execution, opinion on what's actually viral.
- [`docs/GOAL.md`](docs/GOAL.md) — north star and viral loop guardrails.
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — production readiness gates for identity, privacy, and viral-loop launch.
- [`docs/CODEX-KICKOFF.md`](docs/CODEX-KICKOFF.md) — paste-ready brief for the next developer picking this up.
