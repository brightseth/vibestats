# Agent Setup Guide For Vibestats

This is copy-paste text for coding agents, assistants, or support operators helping someone reveal their vibestats profile.

The agent's job is to guide the user to a local reveal without collecting raw Claude Code `/insights` data.

## Non-Negotiable Privacy Rules

- Never ask the user to paste raw `/insights` JSON.
- Never ask the user to upload `session-meta`, `facets`, `report.html`, project paths, prompts, session ids, or tool maps into chat.
- Never move raw Claude Code usage files off the user's machine.
- Do not create a GitHub-claimed profile unless the user explicitly chooses that after seeing the reveal.
- Prefer anonymous sharing when the user wants to share without identity.

## Main User Flow

Tell the user:

```text
In Claude Code, run:

/insights

Then in a terminal on the same machine, run:

curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

Expected result:

- the terminal reads Claude Code `/insights` output locally
- the terminal prints a local archetype reveal
- the browser opens a wrapped-style web reveal
- nothing is published automatically
- the user can create an anonymous public link or optionally claim a profile

## Security-Conscious User Flow

If the user is uncomfortable with `curl | sh`, say:

```text
Inspect the helper first:

curl -fsSL https://vibestats.io/cli.sh | less

Then run it only if you are comfortable:

curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

Explain:

```text
The helper downloads the vibestats local CLI, reads Claude Code /insights output from your machine, derives public-safe metrics locally, and opens the browser reveal. Raw /insights data should not be pasted into chat or uploaded.
```

## Troubleshooting Flow

If the reveal fails, ask the user to run:

```bash
curl -fsSL https://vibestats.io/cli.sh | sh -s -- status
```

Interpretation:

- `ready for reveal` means run the main command again
- `waiting for Claude Code /insights output` means they need to run `/insights` inside Claude Code first
- missing Node means they need Node.js 20+
- missing files means Claude Code may not have generated `~/.claude/usage-data/session-meta`, `~/.claude/usage-data/facets`, or `report.html`

Do not ask them to send the raw files. Ask for the status text only.

## Sharing Options To Explain

### Copy Preview URL

This copies the current browser reveal URL with a `#vibestatsPreview=...` hash.

Use it for:

- private testing
- sending to a collaborator
- confirming the web reveal state

Limits:

- it is a long hash URL
- it is not the cleanest public post format

### Create Anonymous Share Link

This creates a hosted `/r/...` URL.

Use it for:

- public sharing
- mobile-friendly viewing
- a cleaner link with a 30-day expiration

Explain:

```text
This is public and unlisted. Anyone with the link can view the derived snapshot until it expires. It does not include your name, GitHub handle, raw /insights data, prompts, project paths, session ids, or free text.
```

### Claim With GitHub

This creates a durable `/u/<handle>` profile.

Use it only when:

- the user wants a persistent profile
- the user understands the profile is identity-backed
- the user chooses to sign in after seeing the reveal

Do not make this the first step.

## Support Script For Agents

Use this when guiding a user live:

```text
Let's reveal this locally first. Do not paste any /insights files into chat.

1. In Claude Code, run:
   /insights

2. In Terminal on the same machine, run:
   curl -fsSL https://vibestats.io/cli.sh | sh -s --

3. Your browser should open a vibestats reveal. Nothing is published yet.

4. If you want to share without GitHub, click "Create anonymous share link."

5. If you only want to send this to me for review, click "Copy preview URL."

6. If something fails, run:
   curl -fsSL https://vibestats.io/cli.sh | sh -s -- status

Only send me the status output, not raw /insights files.
```

## Agent Copy For A User Who Already Has A Reveal

```text
You have three choices:

1. Keep it local: do nothing.
2. Share anonymously: click "Create anonymous share link" and use the /r/... URL.
3. Claim a durable profile: choose GitHub claim after reviewing the result.

For public sharing, use the anonymous /r/... link or your /u/<handle> profile, not the raw terminal output.
```

## Common User Questions

### Is this uploading my Claude Code data?

No. The reveal is derived locally. Anonymous links and claimed profiles store bounded derived fields only.

### Do I need GitHub?

No. GitHub is only for a durable claimed profile. Anonymous sharing works without GitHub.

### Can I delete an anonymous link?

There is currently a manual takedown path. Ask the vibestats operator to run:

```bash
npm run reveal:delete -- <reveal-slug>
```

### Can I use this from SSH or a remote machine?

The local helper must run on the machine that has Claude Code `/insights` output. A future SSH/TUI route may coordinate the flow, but extraction still needs to happen locally.

### Should I use npm?

No npm install is required for the main flow. Use:

```bash
curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

## Agent Success Criteria

The setup is successful when:

- the user sees their archetype in the browser reveal
- the user understands raw `/insights` stayed local
- the user can create an anonymous `/r/...` link if they want to share
- the user is not pressured into GitHub claim
- no raw data was pasted into chat

## Do Not Say

- "Upload your Claude Code analytics file."
- "Paste your `/insights` JSON here."
- "Sign in with GitHub first."
- "This is completely private" when discussing `/r/...` links. They are public unlisted links.
- "Rare Deep Diver" unless current distribution proves that exact claim.
