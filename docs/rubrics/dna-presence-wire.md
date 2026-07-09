# Rubric — dna presence wire (archetype → /vibe board)

*Staged 2026-07-08 by the /vibe container session (CONTAINER.md ratified; wire
greenlit by both lanes). Build in a fresh session through the verifier loop —
this is an identity-boundary change touching an external network: codex review
required before ship.*

## Goal

When a user has a **claimed, public** archetype (GitHub-linked upload with
public visibility), vibestats beats the /vibe presence bus once so the
archetype appears next to their handle on every /vibe surface (Buddy, iOS,
terminal footer). The shareable self and the live self become the same self.

Mechanism: fire-and-forget POST to `https://www.slashvibe.dev/api/v2/presence`
with body `{ dna: { top: <archetype> } }`, authorized by a JWT vibestats signs
itself with `VIBE_SESSION_SECRET` (already in prod env) for the RESOLVED
handle. The server COALESCE-merges, so the beat carries nothing else and
overwrites nothing else.

## Pass/fail

- [ ] **Resolution, never assumption**: the /vibe handle comes from
      `GET https://www.slashvibe.dev/api/handles/by-github?username=<gh_handle>`
      (live since Jul 8). On 404 → no beat, no error surfaced. NEVER assume
      handle == gh_handle.
- [ ] **Consent boundary**: beat fires ONLY for uploads that are already
      public (`publicUpload` visibility says archetype is visible to
      non-owners). Private/unlisted archetypes never leave.
- [ ] **Allowlist discipline**: the outbound body is exactly
      `{dna:{top}}` — a closed keyspace, per the facet-signals model. No
      scores, no facets, no activity.
- [ ] **Failure isolation**: network/JWT errors never affect the user flow
      (claim/upload succeeds regardless); no retries beyond one.
- [ ] **Unlisted-user rule**: respects the public-repo rule — no handles in
      tracked fixtures/tests.
- [ ] **Evidence**: `npm test` green; live curl showing `dna` present in
      `GET /api/v2/presence` for a test handle; codex review verdict on the
      identity boundary.
- [ ] **Re-beat on archetype change**: a new public upload with a different
      archetype updates the board (same path, COALESCE handles it).

## Insertion point (analysis, verify before build)

The moment "archetype becomes publicly associated with gh_handle" — where
`publicUpload(upload, visibility, {isOwner:false})` first yields a visible
archetype for a GitHub-linked user (likely export-upload completion for an
authed user, or the visibility flip). Confirm by reading
`api/_lib/credential.js` + `api/export-upload.js`; wire at that seam via a new
`api/_lib/vibe-presence.js` (single export, fire-and-forget).

## Do-Not-Drift

No new archetypes, no auth coupling (the JWT is scoped to this beat), no
reading anything back from /vibe. One-way: vibestats → board.

---
**UPDATE Jul 9 — platform tombstone SHIPPED** (presence-service.js 122e1ec0, deployed): `POST /api/v2/presence {clear_dna:true}` forces dna_category to NULL (not COALESCE-merged). Remaining vibestats obligation: on public→private/unlisted downgrade, fire a clear_dna beat + assert the board shows no DNA. Clear path proven server-side; wire the trigger.
