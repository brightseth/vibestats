# Vibestats Briefing Packet

Use this as the front door for collaborators helping with first-time user experience, onboarding, launch creative, and agent setup.

## Read First

1. `docs/LAUNCH.md`
   Binding launch gates. If another doc appears to conflict with this file on safety, readiness, or credential posture, `docs/LAUNCH.md` wins.

2. `docs/DESIGN-GTM-BRIEF.md`
   The comprehensive design and marketing brief: product framing, current flow, audiences, FTUE review prompts, creative strategy, metrics, and constraints.

3. `docs/AGENT-SETUP-GUIDE.md`
   Copy-paste instructions for coding agents or support helpers setting up vibestats for a user without violating the raw-data privacy boundary.

4. `docs/SHARE-PLAYBOOK.md`
   Current launch copy, claims to avoid, anonymous-link rules, and DM/public-post sequencing.

## Strategy Context

- `docs/GOAL.md` - north star and current viral loop
- `docs/ROADMAP.md` - wave plan
- `docs/FUTURE-DIRECTIONS.md` - longer-term source-agnostic identity and credential direction
- `docs/ECOSYSTEM-INTEGRATION.md` - future `/vibe`, vibeconf, and Coltrane interop
- `docs/SSH-ROUTE.md` - planned no-install terminal social shell

Internal implementation context:

- `docs/CODEX-KICKOFF.md` - engineering kickoff brief. Useful for developers, but not required for design/GTM review.

## Design Team Ask

Help make the first-time experience feel like:

```text
Claude Code already knows how you build.
Reveal who you are.
Share without leaking raw data.
Compare with people who build differently.
```

This is a review pass first. The immediate target is the path from cold landing page to browser reveal to anonymous share link. Production deliverables should wait until the review identifies the highest-friction points and the team agrees on the changes.

## Launch Scope

In scope:

- homepage FTUE
- browser reveal polish
- anonymous `/r/...` share page
- terminal output tone and hierarchy
- eight-archetype public naming, tagline, and visual system
- mobile share-recipient path
- creative assets for a controlled launch

Out of scope for the first pass:

- adding a ninth archetype
- routing users to `/vibe`
- in-app DMs
- swipe matching
- generic XP/tokens
- raw data upload or agent-mediated raw data collection

Creative naming note: the internal eight archetype keys must stay stable for launch because they back scoring, URLs, and audits. Public-facing display names, taglines, art direction, and campaign language are open for critique and rebrand exploration if each proposal preserves a one-to-one mapping to those eight keys.

## Current Command To Test

```bash
curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

Security-conscious reviewers can inspect first:

```bash
curl -fsSL https://vibestats.io/cli.sh | less
```

## What Good Feedback Looks Like

Please prioritize:

- where a new user hesitates
- which labels feel unclear
- which CTAs compete
- whether privacy is believable
- whether the reveal feels worth sharing
- whether mobile recipients know what to do
- whether the terminal output feels polished

Avoid broad redesigns that require changing the privacy model, the eight-archetype canon, or the local-first extraction boundary.
