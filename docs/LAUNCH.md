# Launch Readiness

Use this as the production gate for the identity loop. Green PR checks prove the code builds; they do not prove the deployed profile flow is ready.

## 1. Vercel Env

Inspect env names without printing secret values:

```bash
vercel env ls
```

Required for GitHub-backed profiles:

- One database URL: `DATABASE_URL`, `POSTGRES_URL`, or `NEON_DATABASE_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- One session secret: `VIBE_SESSION_SECRET`, `AUTH_SECRET`, or `NEXTAUTH_SECRET`

Optional but launch-relevant:

- `VIBESTATS_URL` for a stable OAuth callback origin when host inference is not enough
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for aggregate community stats
- `CRON_SECRET`, `RESEND_API_KEY`, and `DIGEST_FROM_EMAIL` for weekly digest delivery

As of the latest audit, `lets-vibe/vibestats` only had the Redis/KV variables configured. Identity is not production-ready until the database, GitHub OAuth, and session secret variables are added.

## 2. Local Env Doctor

Pull or provide env locally, then run:

```bash
npm run doctor:identity
```

The doctor should pass before running migrations or dogfooding the profile save flow.

The deployed app also exposes a non-secret readiness probe:

```bash
curl https://vibestats.io/api/identity-status
```

Before OAuth proof, it should return `"profile_save_available": true`. If it is false, the upload flow remains local and does not show a dead-end GitHub sign-in button.

## 3. Database Migrations

Run migrations against the intended Neon database:

```bash
npm run migrate
```

Expected result after first run: every `db/migrations/*.sql` file is applied once. Expected result after a repeat run: every migration is skipped.

## 4. Production Flow Proof

Before undrafting or merging the PR, prove these paths on the deployed app:

- GitHub sign-in returns to vibestats and sets a session.
- Uploading an insights file with profile save enabled stores only derived fields.
- `/u/<gh-handle>` renders the saved profile.
- Profile share CTA routes a new visitor to `/?compareTo=<handle>&compareArchetype=<type>`.
- Upload-to-compare saves the visitor profile and lands on `/u/<host>/pair/<visitor>`.
- Settings export contains derived uploads and settings, not raw insights JSON.
- Public profile, embed, badge, browse, match, and leaderboard surfaces hide exact metrics unless the owner opted in.

## 5. Weekly Digest Proof

With digest env configured, run a dry run first:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://vibestats.io/api/cron/weekly-digest?dryRun=1"
```

Confirm digest content links back to the profile and leaderboard, and that it includes only derived metrics.
