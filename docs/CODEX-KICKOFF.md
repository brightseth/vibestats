# Codex Kickoff: vibestats Wave 1

**You're picking up vibestats.io to add persistent identity.** This doc is everything you need to start.

Read this, then `README.md`, then `docs/ROADMAP.md`. In that order.

---

## What vibestats is

A Claude Code personality engine. Users upload insights in the browser or run the GitHub-backed CLI command against the real Claude Code `/insights` output in `~/.claude/usage-data/` (`session-meta/`, `facets/`, `report.html`), get an archetype + a shareable card. The CLI opens browser approval against the existing GitHub session; Settings token copy is only a fallback. Privacy-first: raw insight/session data stays local, only aggregate counts go to Redis.

Live: [vibestats.io](https://vibestats.io). Repo: `brightseth/vibestats`.

## What you're building

**Wave 1: Persistent identity.** Sign in with GitHub → `vibestats.io/u/<gh-handle>` profile → re-upload anytime, evolution timeline.

Full Wave 1 spec is in `docs/ROADMAP.md`. The constraint: **don't break the privacy promise.** The raw JSON still never leaves the browser. Only derived metrics get persisted, and only for authenticated users who opt in (default opt-in is fine, but the toggle must exist).

---

## Architecture you're inheriting

**Front-end:** static HTML pages with inline JS (`home.html`, `wrapped.html`, `dashboard.html`, `compare.html`, `genome.html`). All scoring math is in `home.html`. The other pages duplicate slices of it — keep duplicates in sync OR (better) lift scoring to `lib/scoring.js` and import.

**Back-end:** Vercel Functions in `api/`:
- `api/stats.js` — POST archetype + 5 averages to Upstash Redis (aggregate counters, rate-limited 1/IP/hr).
- `api/og.js` — Satori-rendered SVG → PNG for share cards.
- `api/card.js` — share landing page (`/card?a=…`), reads URL params, renders OG + redirects.
- Wave 1 branch adds `api/auth/*`, `api/me.js`, `api/uploads.js`, `api/u/[handle].js`, and `api/settings*`.

**Storage:** Upstash Redis (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) for anonymous aggregates; Neon Postgres for authenticated derived metrics.

**Hosting:** Vercel project `lets-vibe/vibestats`, aliased to `vibestats.io`. `vercel.json` has `cleanUrls: true` and a strict CSP — read it before you add external resources.

**Auth:** Wave 1 branch adds custom GitHub OAuth with a signed `vibestats_auth` cookie.

**Conventions:**
- Branch discipline: feature branch → PR → merge to main. Don't push to main directly.
- Pre-push hygiene: scan diff for secrets, transcripts, internal notes.
- ESM everywhere (`"type": "module"` in package.json).
- No build step today — static files + Vercel Functions. If you need a build step (for example, to bundle React for `/u/<handle>`), commit to it deliberately and update the README.

---

## Wave 1 specifics

### Tech choices (recommended, not mandatory)

- **Auth:** Auth.js (NextAuth) with the GitHub provider. Or roll a tiny custom OAuth flow — vibestats is static so NextAuth pulls in Next.js, which is a bigger commitment than you might want. **Lean recommendation: tiny custom OAuth flow + signed session cookie (HS256 JWT, `VIBE_SESSION_SECRET`).** Same pattern as the rest of the /vibe stack. For Wave 1, request GitHub identity only: no repo, commit, private data, or email scopes.
- **DB:** Fresh Neon Postgres project for vibestats under the same Vercel/team ownership, not the shared `/vibe` database. Keep the schema small and portable so a future shared identity layer can be intentional. Use `postgres` (the lightweight client) or `@neondatabase/serverless`. Avoid Prisma — overkill here.
- **Migrations:** plain SQL files in `db/migrations/000X_description.sql`. Run via a simple `npm run migrate` script. No ORM.
- **Frontend for `/u/<handle>`:** keep it static HTML + JS for consistency, OR introduce a single Next.js route if you need server-rendered profile pages. Pick the simpler thing.

### Schema (copy into `db/migrations/0001_init.sql`)

```sql
create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  gh_id bigint unique not null,
  gh_handle text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  privacy text default 'unlisted' check (privacy in ('public','unlisted','private'))
);

create table uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  archetype text not null,
  scores jsonb not null,
  metrics jsonb not null,
  raw_meta jsonb,
  uploaded_at timestamptz default now()
);

create table profile_settings (
  user_id uuid primary key references users(id) on delete cascade,
  weekly_digest_opt_in boolean not null default false,
  digest_email text,
  email_consent_at timestamptz,
  weekly_digest_sent_at timestamptz,
  looking_for text not null default 'idle',
  looking_for_expires_at timestamptz,
  contact_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index uploads_user_time_idx on uploads(user_id, uploaded_at desc);
create index users_handle_idx on users(gh_handle);
```

### New endpoints to add

- `POST /api/auth/github/start` → redirects to GitHub OAuth.
- `GET /api/auth/github/callback` → exchanges code, upserts user, sets cookie.
- `POST /api/auth/logout` → clears cookie.
- `GET /api/me` → returns current user (or 401).
- `POST /api/uploads` → authenticated; body is `{ archetype, scores, metrics, raw_meta }` (NOT the raw JSON). Inserts row.
- `GET /api/u/:handle` → returns user + their last 50 uploads (respecting `privacy`).

### Frontend changes

- **`home.html`**: after archetype reveal, if user is logged in, show a "Saved to your profile →" pill linking to `/u/<handle>`. If logged out, show "Sign in with GitHub to save & track" CTA next to the share buttons. Don't block the share flow on auth.
- **New: `u.html`** or `pages/u/[handle].astro` or whatever you pick. Render: avatar + handle, archetype card (reuse OG card markup), evolution sparkline (last 12 uploads, primary archetype score), 5 community-relative stats ("you're in the top 12% of Orchestrators by commitsPerDay").
- **New: `/settings`** (gated). Privacy toggle, delete account, download my data (return uploads as JSON).

### What to ship in week 1

1. OAuth + cookie + `/api/me` + a login button in the nav.
2. Schema migration + the two new POST/GET upload endpoints.
3. `/u/<handle>` minimum-viable: card + sparkline + percentile chip.
4. README + ROADMAP updates if anything changes shape.

The `feat/wave-1-identity` branch has a first pass of these pieces. Continue from there rather than rebuilding them.

What to **not** ship in week 1: leaderboards, compatibility, embed badge, weekly email. Those are Wave 2 and 3.

---

## Things to be careful about

1. **The privacy promise.** Audit your flow: raw `/insights` exports and session metadata should still never leave the browser or local CLI host. Compute archetype client-side or locally, send only the derived `{archetype, scores, metrics, raw_meta}` to `/api/uploads` or `/api/sync`. Add a visible note in the upload UI: "We save your archetype and 5 derived metrics. We never see your raw insights file."
2. **The 8-archetype canon.** Don't add a 9th archetype. It cascades through scoring, OG, share URLs, community aggregates, compatibility math. Sub-archetypes (Wave 3) are additive and fine.
3. **CSP in `vercel.json`.** Strict. If you add an external resource (analytics, fonts, anything), update CSP explicitly. Don't widen to `*`.
4. **CLI tradition.** vibestats is "no build step" today. If you reach for Next.js, justify it in the PR — it changes deploy semantics, dev experience, and the README.
5. **Rate limiting.** `api/stats.js` already rate-limits anonymous POSTs 1/IP/hr. Authenticated uploads should rate-limit per-user, e.g. 5/day. Don't let someone spam evolution rows.
6. **Cross-machine consistency.** Seth works across multiple machines. If you change file layout, update README + add a `npm run setup` script.
7. **Coordinate with /vibe.** vibestats may eventually share auth with `www.slashvibe.dev`. If you implement GitHub OAuth, keep the session cookie name distinctive (`vibestats_auth`, not `vibe_auth`) until that integration is intentional.

---

## How to talk to Seth

- **Branch:** `feat/wave-1-identity` (or split: `feat/auth-github`, `feat/profile-page`, `feat/uploads-api`).
- **PRs:** small. Three PRs for Wave 1 is fine. One mega-PR is not.
- **State updates:** post to `~/.seth/inbox/$(date +%s)-vibestats.json` with `{type: "update", from: "vibestats", summary: "…"}`. The @seth coordinator picks them up.
- **Open questions:** comment on the PR or wire a state-sync. Don't wait for Slack — the wire protocol is the fast path.

Default answers from the roadmap review. Implement these unless Seth overrides:

1. GitHub OAuth scope — identity only. The app needs `id`, `login`, and `avatar_url`; it does not need commit reads in Wave 1. If credential proof matters later, add an explicit verification step or CLI token flow instead of widening the first permission ask.
2. Database — fresh Neon project for vibestats. Do not mix product data with `/vibe` until shared auth and retention semantics are designed.
3. Privacy default — `unlisted`. Users still get `/u/<handle>` and can share it, but directory visibility and leaderboard inclusion should require an explicit public toggle.
4. Naming — keep `vibestats` as the brand. Ship matchmaker as `/match` or `/u/<handle>/pair`; revisit sub-branding only after Wave 4 has real pull.
5. Anthropic relationship — yes, ask about `/insights` deep-linking and signed exports, but do not block Wave 1 on it. The CLI is the fallback path.

Ship a stub answer in code and call them out in the PR description.

---

## First commands

```bash
git clone git@github.com:brightseth/vibestats.git
cd vibestats
git checkout -b feat/wave-1-identity
npm install
vercel link --project vibestats --scope lets-vibe
vercel env pull .env.local
npm run dev          # Vercel routing, homepage metadata, and api/*
```

Then read `home.html` end-to-end. It is the source of truth for archetypes, scoring, and the share flow. Everything you build is a layer over it.

Good luck. Ship the profile.
