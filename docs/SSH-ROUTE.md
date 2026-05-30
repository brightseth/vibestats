# vibestats SSH Route

## Product Call

Treat SSH as a no-install terminal social shell and claim coordinator, not as the raw-data extractor.

The command we want users to remember is:

```bash
ssh ssh.vibestats.io
```

`ssh vibestats.io` is only viable if the apex DNS and TCP routing can send port 22 to an SSH service while HTTP(S) still goes to Vercel. With the current Vercel apex setup, plan on a dedicated SSH subdomain first: `ssh ssh.vibestats.io`.

## Why It Exists

Many Claude Code users will try a terminal interaction before they install or trust an npm package. SSH can be the lowest-friction front door for:

- viewing public profiles, leaderboards, matchmaker, and browse results;
- generating profile share kits without opening the website;
- explaining the raw-data privacy boundary in the medium where users already work;
- starting a claim session that a local helper can complete.

SSH does not remove the need for a local extractor. An SSH session runs on the vibestats server and cannot read the user's local `~/.claude/usage-data/` directory. Preserving the moat means raw `/insights` files never get pasted, uploaded, scp'd, or streamed to the SSH host.

## Privacy Invariant

The SSH host must never ask for raw `session-meta/*.json`, `facets/*.json`, `report.html`, prompts, session summaries, project paths, session ids, raw tool maps, or raw language maps.

The only allowed publish path is:

1. user runs `/insights` locally in Claude Code;
2. a local helper reads `~/.claude/usage-data/`;
3. the helper derives the same bounded profile payload as the web/CLI reveal;
4. only derived fields are posted to vibestats;
5. the SSH session receives a profile URL, credential URL, compare URL, and launch kit after the derived upload lands.

If we add a pipe-based command later, it must pipe only the derived payload:

```bash
vibestats reveal --json | ssh ssh.vibestats.io claim --derived-only
```

Do not support:

```bash
tar cz ~/.claude/usage-data | ssh ssh.vibestats.io
scp ~/.claude/usage-data/session-meta/*.json ssh.vibestats.io:
```

## User Flows

### Visitor Flow

1. User runs `ssh ssh.vibestats.io`.
2. TUI opens to "What are you? Claude Code already knows."
3. User can browse:
   - `view brightseth`
   - `leaderboard deepdiver`
   - `match pair-coding`
   - `compare builder shipper`
4. Every public profile screen shows a compare-first reveal CTA and copyable local commands.

### Claim Flow

1. User chooses `claim`.
2. SSH app creates a short-lived claim session:
   - random code, e.g. `VIBE-7K2Q-M9PA`;
   - 10 minute expiry;
   - no raw data fields;
   - optional intended GitHub handle after auth.
3. SSH app prints:

```bash
/insights
curl -fsSL https://vibestats.io/cli.sh | sh -s -- claim VIBE-7K2Q-M9PA
```

4. The local helper:
   - runs on the user's machine;
   - reads `~/.claude/usage-data/`;
   - shows the local reveal first;
   - asks for publish consent;
   - completes GitHub identity approval;
   - posts only derived metrics plus the claim code.
5. SSH app polls the claim session and reveals:
   - archetype + signature;
   - rarity and leaderboard placement;
   - `/u/<handle>`;
   - `/u/<handle>/credential.json`;
   - compare invite;
   - README badge and embed snippets;
   - match-intent prompt.

### Returning Owner Flow

1. User runs `ssh ssh.vibestats.io`.
2. User signs in through GitHub Device Flow or a web handoff.
3. TUI shows:
   - latest profile;
   - launch kit;
   - match intent status;
   - digest preview availability;
   - "refresh after more Claude Code work" command.

## Architecture

### SSH Service

Vercel Functions cannot host a long-lived SSH server. Ship this as a separate service on Fly.io, Railway, Render, a small VM, or a container behind a TCP load balancer.

The repo now includes a first deployable Node service at `services/ssh-shell/server.js`. It uses the same `/api/ssh/manifest` contract, accepts anonymous SSH sessions, and implements a line-oriented shell for `help`, `view`, `share`, `leaderboard`, `match`, `compare`, `claim`, and `status`. It talks only to HTTPS APIs on `VIBESTATS_URL`; it does not mount or inspect local Claude Code files.

Local dev:

```bash
PORT=2222 VIBESTATS_URL=https://vibestats.io npm run ssh:dev
ssh -p 2222 localhost
```

Production must set a stable host key:

```bash
SSH_HOST_KEY="$(cat ./vibestats_ssh_host_key)" VIBESTATS_URL=https://vibestats.io PORT=22 npm run ssh:dev
```

Implementation options:

- Go: Charm `wish` + Bubble Tea for the TUI.
- Node: `ssh2` server + Ink/Blessed-style rendering.

The current Node shell is the fastest path to a live no-install funnel. A Go/Bubble Tea implementation can replace it later if we want a richer native TUI under high concurrency.

### APIs To Reuse

The SSH service should call existing HTTPS APIs where possible:

- `GET /api/u/:handle`
- `GET /u/:handle/credential.json`
- `GET /api/browse`
- `GET /api/match`
- `GET /api/leaderboard`
- `POST /api/match-intros`
- `POST /api/sync` after local helper authorization
- `POST /api/sync-settings` for match intent

### New Backend Primitive

Add claim sessions, backed by Postgres:

```text
ssh_claim_sessions
- code_hash
- state: pending | authorized | synced | expired | revoked
- user_id nullable
- gh_handle nullable
- profile_url nullable
- compare_url nullable
- credential_url nullable
- created_at
- expires_at
- consumed_at nullable
```

Public API shape:

- `GET /api/ssh/manifest` returns the versioned SSH shell command, privacy, API, claim-flow, and viral-loop contract for the external TCP service.
- `POST /api/ssh/claim-start` creates a claim code.
- `GET /api/ssh/claim-status?code=...` returns bounded status for the SSH TUI.
- `POST /api/sync` accepts an optional `claim_code` when the local helper publishes derived metrics.
- `vibestats claim CODE` is the local helper command shape for a waiting SSH session.
- `GET /cli.sh` returns the no-npm bootstrap wrapper that downloads the repo tarball and runs the local helper with Node.

The manifest and status APIs must never serialize raw input fields or secret env names.

### Local Helper Shape

Keep the current CLI as the first local helper, but print the no-npm bootstrap first:

```bash
curl -fsSL https://vibestats.io/cli.sh | sh -s -- claim VIBE-7K2Q-M9PA
```

Keep npx as a fallback while the package is unpublished or users prefer npm's cache:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity claim VIBE-7K2Q-M9PA
```

Later, reduce shell-bootstrap friction with a signed binary:

```bash
vibestats claim VIBE-7K2Q-M9PA
```

SSH coordinates the reveal. Local code does the extraction.

## MVP Build Order

1. **Spec and copy guardrails.** Land this document, link it from the README/roadmap, expose `/api/ssh/manifest`, and test that docs say SSH is not the extractor.
2. **Read-only SSH TUI.** Browse public profiles, leaderboards, matchmaker, credential JSON links, and share kits using existing public APIs.
3. **Claim-session API.** Add short-lived codes, status polling, and sync attachment. No raw payload fields.
4. **Local helper command.** Add `claim CODE` to the existing CLI so a local publish can wake a waiting SSH session.
5. **Reveal handoff.** SSH TUI updates live after sync and prints the launch kit.
6. **Signed binary.** Only after the claim loop works, add a signed installed binary so SSH can print a command that does not need curl, npm, or a repo tarball.
7. **Ops hardening.** Rate limits, abuse handling, session expiry, host key pinning guidance, and launch audit checks against the SSH health endpoint.

## Acceptance

The first real success story should be:

1. a cold Claude Code user runs `ssh ssh.vibestats.io`;
2. browses Seth's profile and a leaderboard;
3. starts claim from the SSH TUI;
4. runs `/insights` plus one local helper command;
5. sees their profile reveal inside the SSH session;
6. copies a launch kit that drives friends into compare-first onboarding;
7. raw Claude Code session data never leaves their machine.
