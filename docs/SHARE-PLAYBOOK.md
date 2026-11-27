# Share Playbook

Use this when vibestats is being shared outside the first dogfood circle.

## Binding Launch Gate

`docs/LAUNCH.md` is the binding source for launch gates and credential posture. If this playbook appears to conflict with `docs/LAUNCH.md`, follow `docs/LAUNCH.md`.

Practical campaign rule:

- Anonymous reveal links and existing profile links are safe to share before GitHub secret rotation is confirmed: viewing those pages does not touch GitHub OAuth, and anonymous reveal publishing does not require auth.
- Do not actively promote "claim your GitHub profile" until `docs/LAUNCH.md` says that gate is clear.

## Claims To Avoid

Do not say "rare Deep Diver" unless the live distribution makes that true. Deep Diver can be mid-pack. The scarcity claim belongs to the signature combo:

- Good if verified against live data: "I am a 1-of-1 high-velocity Deep Diver combo this month."
- Good: "rare combo: high-velocity Deep Diver"
- Avoid: "rare Deep Diver"

The `/genome` page starts from a transparent launch baseline and blends in live anonymous submissions. Treat the baseline as a product scaffold, not proof of real user count.

## Mobile-First Public Post

Lead with a link and the tag-yourself hook. Put the shell command second for desktop users.

```text
Claude Code users: which one are you?

Orchestrator, Shipper, Architect, Debugger, Polyglot, Sprinter, Deep Diver, or Builder.

My current vibestats profile:
https://vibestats.io/u/brightseth

Reveal yours from Claude Code:
1. Run /insights
2. Then on desktop:
curl -fsSL https://vibestats.io/cli.sh | sh -s --

Raw /insights stays local. You can share anonymously, no GitHub required.
```

## Anonymous Reveal Post

Mint a fresh anonymous reveal URL at blast time so the 30-day expiration window covers the campaign. Do not reuse old testing slugs in public launch copy.

```text
You do not need GitHub to share a vibestats reveal.

Anonymous example:
<fresh-launch-reveal-url>

Public unlisted link, expires in 30 days. Raw /insights never leaves your machine.

What are you?
```

## Anonymous Link Takedown

Support owner: the launch driver on call, currently Seth or Samer, must have production DB env access before each share batch starts.

Response target: delete requested anonymous reveal links within 15 minutes during launch windows.

```bash
npm run reveal:delete -- <reveal-slug>
```

Confirm the page returns 404 after deletion:

```bash
curl -I https://vibestats.io/r/<reveal-slug>
```

## DM Batch

Send to 5 people first. Treat that as live QA; fix hesitation points before sending the next 15.

```text
What is your Claude Code archetype?

Try this on desktop after running /insights:
curl -fsSL https://vibestats.io/cli.sh | sh -s --

You can share anonymously without GitHub. Send me your archetype or reveal link.
```

## 8-Archetype Grid Copy

Use this as the current working copy with a simple grid image or screenshot of the eight archetype cards. Design can propose more iconic public display names, taglines, or motifs as long as they preserve a one-to-one mapping to the eight internal archetype keys.

```text
Tag yourself:

Orchestrator - conducts agents and systems
Shipper - turns ambiguity into output
Architect - plans before building
Debugger - investigates before guessing
Polyglot - crosses stacks naturally
Sprinter - moves in fast bursts
Deep Diver - stays with hard problems
Builder - makes new things real

Claude Code already has the signal. Run /insights, then reveal yours.
```
