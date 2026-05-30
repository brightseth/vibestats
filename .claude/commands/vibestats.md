---
description: Reveal and optionally publish a privacy-preserving vibestats profile from Claude Code /insights.
allowed-tools: Bash
---

# vibestats Reveal

Use this when the user wants to find out their vibecoding personality from Claude Code.

The core promise is: reveal first, publish only if the user chooses, and never expose raw Claude Code session data. The user can complete onboarding from the terminal; no manual website upload is required.

## Commands

Use these exact commands:

```bash
/insights
npx --yes github:brightseth/vibestats#feat/wave-1-identity status
npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal
npx --yes github:brightseth/vibestats#feat/wave-1-identity sync
```

## Flow

1. Run the terminal preflight:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity status
```

   It checks whether Claude Code `/insights` output appears to exist at `~/.claude/usage-data/` using directory existence and file counts only. Do not print or inspect raw session JSON.
2. If `/insights` output is missing, tell the user to run `/insights` in Claude Code, then rerun `/vibestats`.
3. If it exists, run:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal
```

4. Use the local reveal output directly. Summarize only derived fields if needed:
   - archetype
   - signature, if present
   - behavioral moments, if present
   - coarse derived metrics such as sessions, days, languages, commits per day, messages per session
5. Ask whether to publish/claim the result. Frame this as claiming a GitHub-backed, derived-only profile, not uploading analytics.
6. Only after the user agrees, run:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity sync
```

7. Report the profile URL, compare invite URL, and any README badge, embed, or recap links printed by the CLI.
8. If the user wants to appear in `/match`, ask for their public contact URL and whether they want public discovery. Only after they agree, run a command shaped like:

```bash
npx --yes github:brightseth/vibestats#feat/wave-1-identity intent pair-coding --contact-url https://x.com/their-handle --public
```

   The `intent` command updates short-lived matchmaker availability through the revocable sync token. It does not read `/insights` data.

If the user does not want to publish yet, keep the reveal useful: point them to the archetype-only compare link, pasteable terminal card, copy-ready reveal text, X share URL, complementary pairing preview, and `/vibestats` install command printed by the CLI.

## Privacy Rules

- Do not `cat`, summarize, paste, upload, or quote files under `~/.claude/usage-data/session-meta/` or `~/.claude/usage-data/facets/`.
- Do not mention `agent-insights.json` as the normal path. That was a legacy/dead path.
- Treat the vibestats CLI as the only extractor. It computes locally and uploads only derived metrics.
- If the user asks what would be uploaded, run `npx --yes github:brightseth/vibestats#feat/wave-1-identity reveal --json` and answer from that derived payload shape only: archetype, scores, five profile metrics, signature metadata, and sanitized behavioral moment ids/values.
- If publishing fails, keep the reveal useful. The user can still share their archetype manually or retry `sync`.
