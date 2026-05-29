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
- One session secret: `VIBE_SESSION_SECRET`, `AUTH_SECRET`, or `NEXTAUTH_SECRET` with at least 32 bytes

Optional but launch-relevant:

- `VIBESTATS_URL` for a stable OAuth callback origin when host inference is not enough
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for aggregate community stats
- `CRON_SECRET`, `RESEND_API_KEY`, and `DIGEST_FROM_EMAIL` for weekly digest delivery

As of the latest audit, `lets-vibe/vibestats` only had the Redis/KV variables configured. Identity is not production-ready until the database, GitHub OAuth, and session secret variables are added.

## 2. Vercel Deployment Gate

Green GitHub checks are not enough if Vercel skips the preview build. Confirm the canonical `lets-vibe/vibestats` project is not configured with an ignored-build command:

```bash
vercel api /v9/projects/<project-id> --scope lets-vibe --raw
```

Expected project state: `"commandForIgnoringBuildStep": null`.

Then confirm the current branch preview is Ready, not Canceled:

```bash
vercel ls vibestats --scope lets-vibe
```

If preview protection is enabled, verify runtime endpoints through Vercel instead of direct `curl`:

```bash
vercel curl /api/identity-status --deployment <preview-url> --scope lets-vibe
```

The launch audit can also run through Vercel auth for protected previews:

```bash
npm run audit:launch -- --deployment <preview-url> --scope lets-vibe --handle <saved-gh-handle>
```

As of the latest audit, the canonical project ignored-build setting has been cleared and the latest preview is Ready. The identity readiness probe still reports unavailable profile saves until the database, GitHub OAuth, and session secret env vars are configured.

## 3. Local Env Doctor

Pull or provide env locally, then run:

```bash
npm run doctor:identity
```

The default doctor should pass before running migrations. It checks required env, rejects short session secrets, and does not print secret values.

The deployed app also exposes a non-secret readiness probe:

```bash
curl https://vibestats.io/api/identity-status
```

Before OAuth proof, it should return `"profile_save_available": true`. If it is false, the upload flow remains local and does not show a dead-end GitHub sign-in button.

Run the full launch audit against the public origin after a saved profile exists:

```bash
npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready
```

This checks identity readiness, no-store fallback headers, profile/embed/badge/card share surfaces, compare-first routes, browse/match/leaderboard surfaces, and public raw-field leak markers. Add digest readiness to the same gate once email delivery is configured:

```bash
npm run audit:launch -- --origin https://vibestats.io --handle <saved-gh-handle> --expect-ready --expect-digest
```

## 4. Database Migrations

Run migrations against the intended Neon database:

```bash
npm run migrate
```

Expected result after first run: every `db/migrations/*.sql` file is applied once. Expected result after a repeat run: every migration is skipped.

Then verify the live schema shape before dogfooding profile saves:

```bash
npm run doctor:identity -- --schema
```

The schema doctor checks the required tables, columns, indexes, constraints, foreign-key delete cascades, and `schema_migrations` rows, including the sync-token revocation column, the unlisted-by-default privacy column, HTTPS contact URL constraint, and cascading deletion of uploads/profile settings when an account is deleted.

## 5. Production Flow Proof

Before undrafting or merging the PR, prove these paths on the deployed app:

- GitHub sign-in returns to vibestats and sets a session.
- Uploading an insights file with profile save enabled stores only derived fields.
- `/u/<gh-handle>` renders the saved profile.
- Profile share CTA routes a new visitor to `/?compareTo=<handle>&compareArchetype=<type>`.
- Upload-to-compare saves the visitor profile and lands on `/u/<host>/pair/<visitor>`.
- Settings export contains derived uploads and settings, not raw insights JSON.
- Settings delete removes the user and cascades profile uploads/settings rows.
- Public profile, embed, badge, browse, match, and leaderboard surfaces hide exact metrics unless the owner opted in.

## 6. Weekly Digest Proof

With digest env configured, run a dry run first:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://vibestats.io/api/cron/weekly-digest?dryRun=1"
```

Confirm digest content links back to the profile and leaderboard, includes one-click unsubscribe, and uses only derived metrics.
