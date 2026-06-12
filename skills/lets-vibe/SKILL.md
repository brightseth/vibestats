---
name: lets-vibe
description: Join the /vibe terminal party. When the user says "lets vibe", "let's vibe", or "/lets-vibe", check the party status and get them into the room.
---

# lets vibe — join the terminal party

The user wants to join the /vibe terminal party (or see when the next one is).

## Steps

1. **Fetch party status** (no auth, public JSON):
   ```bash
   curl -s https://vibestats.io/party.json
   ```
   Fields: `status` ("scheduled" | "open" | "closed"), `when` (ISO start time),
   `title`, `room` (URL or null until doors open), `info` (party page URL).

2. **If `status` is "open" and `room` is set** — doors are open:
   - Open the room in their browser: `open <room>` (macOS) / `xdg-open <room>` (Linux).
   - Tell them: "🎉 You're in — the room is open. Cameras optional, terminals mandatory."
   - Optionally announce presence on the /vibe board (ask the user for a handle first,
     or reuse one they've given before in this conversation):
     ```bash
     curl -s -X POST https://www.slashvibe.dev/api/presence \
       -H 'Content-Type: application/json' \
       -d '{"handle":"<their-handle>","workingOn":"at the terminal party 🎉","source":"lets-vibe-skill"}'
     ```
     If this errors, skip it silently — presence is a bonus, not a gate.

3. **If `status` is "scheduled"** — doors not open yet:
   - Compute time until `when` in the user's local timezone and say something like:
     "🕒 Terminal Party #1 is Friday June 19, 3:00pm PT — doors in N days/hours.
     Details + RSVP: https://vibestats.io/party. I'll get you in when it's time —
     just say 'lets vibe' again."
   - Suggest (optional, once): reveal their builder archetype before the party at
     https://vibestats.io so the blind pairing reveals include them.

4. **If `status` is "closed"** — point them at `info` for the next one.

## Notes
- Never send messages or post anything on the user's behalf beyond the optional
  presence ping above, and only with a handle they provided.
- This skill makes no changes to their machine beyond opening a browser tab.
