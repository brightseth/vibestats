# Vibestats Design Launch README

Use this as the quick product-status handoff for final website, FTUE, and launch creative polish.

## Current Status

Live product: https://vibestats.io

Repo: https://github.com/brightseth/vibestats

Branch: `feat/wave-1-identity`

As of June 1, 2026:

- Production is live on Vercel under `lets-vibe/vibestats`.
- Strict launch audit is green.
- The GitHub-claim launch gate is clear: OAuth production secret and session secret rotated and verified (cleared 2026-06-01). `docs/LAUNCH.md` is the authority for this gate's status.
- Anonymous reveal links, profile pages, compare routes, badge, embed, genome, share card, and dynamic OG image previews are working.

## Product In One Sentence

Claude Code already knows how you build; vibestats lets you reveal that build identity, share it safely, and compare with other builders.

## Core Funnel

1. User runs `/insights` inside Claude Code.
2. User runs the no-npm terminal helper:

   ```bash
   curl -fsSL https://vibestats.io/cli.sh | sh -s --
   ```

3. The helper derives a local profile from `~/.claude/usage-data`.
4. Raw `/insights` data stays on the user's machine.
5. The browser reveal opens.
6. User can:
   - create an anonymous `/r/...` share link,
   - claim a durable GitHub-backed `/u/<handle>` profile,
   - copy/share a profile card or comparison link.

## What Is Shareable Now

- Homepage: https://vibestats.io
- Seth profile: https://vibestats.io/u/brightseth
- Coding genome: https://vibestats.io/genome
- Sample pairing: https://vibestats.io/compare?a=orchestrator&b=shipper
- Archetype compare entry: https://vibestats.io/?compareArchetype=deepdiver

For a launch post, lead with a link and the "which one are you?" hook. Put the shell command second for desktop users.

## Privacy Promise

This is the moat. Do not dilute it.

What stays local:

- raw `/insights` files
- prompts
- project paths
- session ids
- free-text notes
- raw tool/language maps

What can be published:

- archetype
- scores across the 8 archetypes
- coarse derived metrics
- public-safe behavioral moments
- signature combo
- anonymous rarity/count context

Anonymous `/r/...` links are public unlisted derived snapshots. They do not include a name or GitHub handle and expire in 30 days.

GitHub claim is optional. It creates a durable identity and proof surface, but it should never be the first wall before the reveal.

## The Eight Archetypes

The internal keys are fixed for launch:

- `orchestrator`
- `shipper`
- `architect`
- `debugger`
- `polyglot`
- `sprinter`
- `deepdiver`
- `builder`

Design can critique or propose better public names, taglines, glyphs, colors, motifs, and campaign language, but proposals must preserve a one-to-one mapping to these eight keys. Do not add a ninth archetype for launch.

The current public identity source of truth is `lib/archetype-identity.js`.

## Design Priorities

Please focus on final touches that improve conversion without changing the product model:

1. Cold landing clarity
   - Is there one obvious primary action?
   - Does the page explain "reveal, not upload" fast enough?
   - Does mobile know this is a desktop reveal flow?

2. Browser reveal emotion
   - Does the result feel collectible?
   - Is the archetype card screenshot-worthy?
   - Does the user understand anonymous share vs GitHub claim?

3. Anonymous `/r/...` recipient path
   - Does a mobile recipient know what to do next?
   - Does "reveal yours to compare" feel honest and compelling?
   - Does the public/unlisted/30-day privacy copy land?

4. Archetype identity system
   - Are the names iconic enough?
   - Are colors and glyphs distinguishable?
   - Do descriptions sound like identity instead of analytics?

5. Launch creative
   - Tag-yourself 8-archetype grid.
   - Mobile-first social post.
   - Profile card / OG preview polish.
   - Short visual showing `/insights` -> reveal -> share.

## Do Not Reopen Before Launch

- Raw data upload to servers.
- A ninth archetype.
- Swipe matching.
- In-app DMs.
- Tokens or generic XP.
- `/vibe` links in the primary launch UI.
- Broad ecosystem integration work.
- Any flow where an agent or server reads raw `/insights` on the user's behalf.

## Suggested Review Path

Start here:

1. https://vibestats.io
2. https://vibestats.io/u/brightseth
3. https://vibestats.io/genome
4. https://vibestats.io/compare?a=orchestrator&b=shipper

Then, on a desktop machine with Claude Code data:

```bash
curl -fsSL https://vibestats.io/cli.sh | sh -s -- status
curl -fsSL https://vibestats.io/cli.sh | sh -s -- reveal
curl -fsSL https://vibestats.io/cli.sh | sh -s --
```

Security-conscious reviewers can inspect the helper first:

```bash
curl -fsSL https://vibestats.io/cli.sh | less
```

## Feedback Format

Best feedback is specific and launch-scoped:

- where a first-time user hesitates
- which button or sentence should change
- what the mobile recipient cannot do
- what feels untrustworthy
- what makes the reveal less shareable
- what visual/copy change would increase "I want to send this"

Production comps are welcome after the review pass, but the first ask is: identify the few changes that most improve first-time conversion before launch.

