# Vibestats Design + GTM Brief

Use this packet to brief design, product, and marketing collaborators on how to package vibestats for first-time users.

Repo: https://github.com/brightseth/vibestats  
Live product: https://vibestats.io  
Current profile example: https://vibestats.io/u/brightseth  
Anonymous reveal example: mint a fresh `/r/...` link before sharing publicly.

## One-Sentence Product

Vibestats reveals your coding-agent personality from Claude Code `/insights`, keeps raw data local, and turns the result into a shareable identity card.

## Current Launch State

Vibestats is live and launch-audit green.

The strongest current path:

1. User runs `/insights` in Claude Code.
2. User runs the terminal helper:

   ```bash
   curl -fsSL https://vibestats.io/cli.sh | sh -s --
   ```

3. Terminal derives metrics locally and opens the web reveal.
4. User sees a wrapped-style archetype result before publishing anything.
5. User can copy the private preview URL, create an anonymous `/r/...` link, or optionally claim a durable GitHub-backed profile.

The current privacy promise:

- raw `/insights` stays on the user's machine
- anonymous reveal links store derived public-safe fields only
- `/r/...` links are public unlisted and expire in 30 days
- GitHub claim is optional and should not be the first wall
- public profile surfaces hide exact counts unless the owner opts in

## Core Reframe

Do not frame this as "upload your analytics file."

Frame it as:

> Claude Code already has the signal. Reveal what kind of builder you are.

The product should feel like a reveal, not a chore.

## Primary Audiences

### 1. Heavy Claude Code User

They use Claude Code often, but may not know `/insights` exists.

Job to be done:

- "Show me something surprising about how I build."
- "Give me a result worth sharing."
- "Do not make me feel like I am leaking my work."

Design problem:

- Explain `/insights` without turning the page into docs.
- Make the terminal command feel inspectable and legitimate.
- Get to first reveal fast.

### 2. Share Recipient

They clicked a profile, anon reveal, card, or screenshot.

Job to be done:

- "What is this?"
- "What type am I?"
- "How do I compare with this person?"

Design problem:

- Every shared page must be a landing page.
- The next action should be visible above the fold.
- Mobile users need a useful page even if they cannot run a command yet.

### 3. Curious Lurker

They do not have Claude Code data, or they are on mobile.

Job to be done:

- "Can I understand the world before participating?"

Design problem:

- Show the eight archetypes.
- Let them browse sample pairings.
- Give them a reason to come back on desktop.

## What Designers Should Review

### Homepage FTUE

Current risk:

- The user still has to understand Claude Code, `/insights`, a terminal command, browser reveal, anonymous sharing, and optional claim.

Design asks:

- Can the first screen make "Reveal who you are" clear in 5 seconds?
- Can we reduce perceived steps without hiding important privacy details?
- Can the command block look trustworthy, not sketchy?
- Can mobile users save/send themselves the desktop action?
- Can the demo path communicate value without stealing attention from the real reveal?

### Browser Reveal

Current strength:

- It opens immediately after the terminal flow and shows the wrapped result before publishing.

Design asks:

- Is the final archetype card emotionally satisfying enough to screenshot?
- Is the "Create anonymous share link" action obvious at the peak moment?
- Is "Copy preview URL" clear as a private/testing option, distinct from public `/r/...`?
- Does the privacy copy reassure without adding friction?
- Should the final slide include a cleaner "What next?" panel?

### Anonymous `/r/...` Reveal

Current strength:

- No GitHub required, public unlisted, derived-only, expires in 30 days.

Design asks:

- Does the page feel like a real share destination, not a debugging artifact?
- Does it make "anonymous but public" clear?
- Does it invite recipients to compare/reveal their own type?
- Does the OG card make sense in Slack/X/iMessage?

### Profile `/u/<handle>`

Current strength:

- Durable identity, badge/embed/credential surfaces, compare-first routing.

Design asks:

- Does the profile explain rarity honestly?
- Does it distinguish archetype rarity from signature-combo rarity?
- Does it lead recipients into "compare with me" rather than passive viewing?
- Does it feel like a collectible builder card?

### Terminal UI

Current strength:

- It works without npm install and derives locally.

Design asks:

- Does the output feel polished and scannable?
- Is the first line reassuring?
- Are there too many links after success?
- Should the terminal card be formatted more like a shareable receipt?
- Is "inspect first" visible enough for security-conscious users?

## Messaging Pillars

### Reveal

Claude Code has already observed how you build. Vibestats turns that signal into a result you can understand and share.

### Privacy

Raw `/insights` stays local. Public links use derived metrics only.

### Identity

Your archetype is not a score. It is a builder identity: how you move through ambiguity, tools, systems, and collaboration.

### Comparison

The viral question is not "look at me." It is "how would you pair with me?"

### Scarcity

Do not overclaim archetype rarity. Rarity lives in signature combos, moments, first-mover status, streaks, and weekly surfaces.

## Copy Rules

Use:

- "Reveal your Claude Code builder type."
- "Raw `/insights` stays local."
- "Create an anonymous share link."
- "Public unlisted link, expires in 30 days."
- "Compare with this archetype."
- "I am a 1-of-1 high-velocity Deep Diver combo this month."

Avoid:

- "Upload your analytics file."
- "Rare Deep Diver" unless distribution proves that exact claim.
- "No-npm" as user-facing language.
- "Join /vibe" until `/vibe` has a ready receiving flow.
- "Claim with GitHub" as the main CTA before the reveal.

## GTM Creative Strategy

### Launch Hook

```text
Claude Code users: which one are you?

Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, or Builder.
```

This is the "tag yourself" hook. It works even for people who cannot run the command immediately.

### Primary Post Shape

Lead with a link and visual. Put the terminal command second.

```text
Claude Code users: which one are you?

Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, or Builder.

I am a 1-of-1 high-velocity Deep Diver combo this month:
https://vibestats.io/u/brightseth

Anonymous example, no GitHub:
<fresh /r/... link>

On desktop:
1. Run /insights
2. Then:
curl -fsSL https://vibestats.io/cli.sh | sh -s --

Raw /insights stays local.
```

### Creative Assets To Produce

1. Eight-archetype grid
   A simple "tag yourself" graphic with one sentence per archetype.

2. Animated reveal clip
   10-15 seconds from terminal command to browser card.

3. Privacy proof card
   "Raw `/insights` stays local. Derived metrics only."

4. Before/after flow graphic
   "Private Claude Code signal -> local reveal -> anonymous share/profile."

5. Profile card screenshot
   One strong example with honest rarity language.

6. Pairing teaser
   "Deep Diver x Shipper: what would this pair build?"

7. Mobile-lurker card
   "On desktop later: run `/insights`, then reveal yours."

### Channel Plan

First 5:

- DM Claude Code power users.
- Watch where they hesitate.
- Measure time to first reveal.
- Fix repeated confusion before broader posting.

Next 15:

- Ask for their archetype, not just "try this."
- Prompt them to send back their `/r/...` link or screenshot.

Public:

- Post the eight-archetype grid and a fresh anonymous example link.
- Put the shell command after the link, not as the first CTA.
- Avoid pushing GitHub claim in launch copy unless credentials have been rotated and confirmed.

Design/community:

- Ask people to quote-post their archetype.
- Invite remixes of the archetype grid.
- Collect objections around privacy and terminal trust.

## Metrics To Watch

Activation:

- homepage view -> command copy
- command run -> browser reveal opened
- browser reveal -> anonymous link created
- browser reveal -> GitHub claim

Virality:

- `/r/...` views per created link
- profile views per share
- compare-starts per shared profile
- new reveals from shared profile recipients

Friction:

- missing `/insights` rate
- Node version failures
- users who stop at terminal output
- users who open browser reveal but never create a link

Trust:

- privacy page views
- "inspect first" usage or questions
- delete requests for anonymous links

## Design Deliverables Requested

1. Revised first-screen information hierarchy.
2. Browser reveal final-slide treatment.
3. Anonymous `/r/...` page visual polish.
4. Terminal output style direction.
5. Eight-archetype grid visual system.
6. Mobile share-recipient landing treatment.
7. Launch post graphics and short motion asset.
8. Copy polish for privacy, reveal, and comparison.

## Product Constraints

- Do not add a ninth archetype.
- Do not upload raw `/insights`.
- Do not add in-app DMs.
- Do not add swipe matching.
- Do not build token/XP gamification.
- Do not route to `/vibe` until the receiving flow is ready.
- Do not make GitHub auth the first step.
- Preserve anonymous share as a first-class path.

## Key Files For Review

- `home.html` - homepage, browser reveal, local preview, share actions
- `api/reveal.js` - anonymous `/r/...` reveal page
- `bin/vibestats.js` - terminal onboarding output and browser handoff
- `u.html` - public profile shell
- `genome.html` - archetype distribution page
- `docs/SHARE-PLAYBOOK.md` - launch copy and posting rules
- `docs/AGENT-SETUP-GUIDE.md` - copy-paste guide for setup agents
- `docs/ECOSYSTEM-INTEGRATION.md` - later `/vibe`, vibeconf, Coltrane handoffs

## Open Questions For The Team

1. Should the homepage lead with a demo visual, the command, or the eight-archetype grid?
2. Should "Create anonymous share link" be the primary final-card CTA over screenshot/share buttons?
3. What is the cleanest language for URL-hash preview vs hosted `/r/...` share?
4. How do we make `curl | sh` feel inspectable without scaring users?
5. What is the best mobile fallback for users who discover vibestats away from their laptop?
6. Which archetype names/taglines need sharper emotional resonance?
7. What would make the reveal feel less like analytics and more like identity?
