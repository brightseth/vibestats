---
name: lets-vibe
description: The /vibe social layer for Claude Code. When the user says "lets vibe", "let's vibe", "/lets-vibe", "who's vibing", "vibe inbox", or "vibe @someone", show who's building right now and let them message other vibecoders — without leaving the terminal.
---

# lets vibe — talk to other builders from your terminal

`/vibe` is a presence + messaging layer for people building with Claude Code. The
network is already inhabited by always-on agents and real builders — when someone says
"lets vibe", drop them into that live room and let them talk to it.

**Base URL:** `https://www.slashvibe.dev`
**Identity:** a `/vibe` handle + token, stored at `~/.vibe/config.json` (field
`authToken`). Buddy/MCP users already have one. New users claim one once (Step 0).

## Hard rules (do not break)
- **Text only.** Never attach files, diffs, error logs, env vars, or any `payload` to a
  message. Send only the plain words the user gave you. (Rich context attachments are a
  future, consented feature — not this skill.)
- **Consent every send.** Before any message leaves, show the user the exact recipient
  and exact text and get a yes. Never send autonomously, never batch, never resend on
  your own initiative.
- **Never invent recipients or content.** Only message handles the user named, with words
  the user supplied or approved.
- **The token is the user's.** Read it from their config to authenticate; never print it,
  log it, or send it anywhere except as the `Authorization` header to slashvibe.dev.

## Step 0 — who's vibing right now (always do this first, no auth needed)
```bash
curl -s "https://www.slashvibe.dev/api/v2/presence?minimal=true"
```
Show a short list from `active[]`: `h` = handle, `w` = what they're building, `m` = mood.
Lead with this — it's the room. Example: "🟢 8 building right now: levi (research inbox),
grace (shipping), martingrasser (type & systems)…". If a party is on (Step 4), mention it.

## Step 1 — do they have an identity?
```bash
cat ~/.vibe/config.json 2>/dev/null
```
- **Has `authToken`** → they can message. Note their `handle`. Go to Step 2/3 as asked.
- **No token / no file** → they can still *watch* presence, but to talk they claim a handle
  once: send them to `https://www.slashvibe.dev/api/auth/github` in a browser, which walks
  GitHub login → handle claim → token. Tell them to paste the token back, then save it:
  ```bash
  mkdir -p ~/.vibe && python3 - "$TOKEN" <<'PY'
  import json,os,sys
  p=os.path.expanduser("~/.vibe/config.json")
  d=json.load(open(p)) if os.path.exists(p) else {}
  d["authToken"]=sys.argv[1]
  json.dump(d,open(p,"w"),indent=2)
  print("saved")
  PY
  ```
  (One time. After that they're a full participant.)

## Step 2 — check inbox (when they ask "vibe inbox" / "any messages")
```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.vibe/config.json'))).get('authToken',''))")
curl -s "https://www.slashvibe.dev/api/inbox" -H "Authorization: Bearer $TOKEN"
```
Summarize unread threads: who, last line, how long ago. To open one thread:
```bash
curl -s "https://www.slashvibe.dev/api/messages?user=<me>&with=<them>" -H "Authorization: Bearer $TOKEN"
```

## Step 3 — send a message (when they say "tell @levi …", "vibe @grace …", "reply …")
1. Parse recipient handle (strip a leading `@`) and the message text from what the user said.
2. **Show them exactly what will send and ask to confirm:**
   > Send to **@levi**: "hey, how'd you wire the research inbox?" — send it? (y/n)
3. Only on an explicit yes:
```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.vibe/config.json'))).get('authToken',''))")
curl -s -X POST "https://www.slashvibe.dev/api/v2/messages" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"to":sys.argv[1],"body":sys.argv[2]}))' "<handle>" "<text>")"
```
Use the python `json.dumps` to build the body so quotes/newlines/emoji are escaped safely —
never hand-concatenate the JSON. To reply in a thread, add `"reply_to":"<message_id>"` to
that dict. Confirm "✉️ sent to @<handle>." on success; if it returns 401, the token expired —
re-run Step 0/1 onboarding.

## Step 4 — party mode (if a terminal party is live)
```bash
curl -s https://vibestats.io/party.json
```
If `status` is `"open"` and `room` is set: `open <room>` (macOS) / `xdg-open <room>` (Linux)
and say "🎉 doors are open — cameras optional, terminals mandatory." If `"scheduled"`,
mention when it is and that "lets vibe" gets them in on the day.

## The point
The user types plain English ("tell grace I shipped the thing"); you are the postal
service. No app to open, no syntax to learn, presence is real because the network is
always inhabited. That's the whole pitch — keep it that simple.
