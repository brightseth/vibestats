# Vibestats Ecosystem Integration

This is a planning note for how vibestats could eventually interoperate with `/vibe`, vibeconferencing/vibeconf, and Coltrane without weakening the v1 launch.

## Current Launch Rule

Do not send live launch traffic to `/vibe` until that service is ready for the traffic and the receiving flow matches the vibestats promise.

For v1, vibestats should stand alone:

- reveal locally
- share anonymously
- optionally claim a durable profile
- compare with another profile or archetype
- preserve the raw-data privacy boundary

## Product Roles

**vibestats** is the earned build-identity layer.

It answers: "How do you build with coding agents?"

It should own:

- derived profile credentials
- archetypes, signatures, facets, and moments
- privacy-safe share cards
- compare and match compatibility logic
- anonymous and claimed reveal surfaces

**/vibe** is the ambient social graph.

It should answer: "Who is around, what are they building, and where do I belong?"

It can receive vibestats identity as optional context, but should not require raw `/insights`, GitHub identity, or vibestats account state.

**vibeconf** is the live collaboration room.

It should answer: "Can we turn this match into a productive session right now?"

It can use vibestats compatibility as a room setup signal: likely roles, collaboration style, facilitation prompts, and intro framing.

**Coltrane** is the agentic representative and host.

It should answer: "What should happen next, and who should be connected?"

It can guide onboarding, explain archetypes, recommend intros, prepare rooms, summarize outcomes, and carry context across products with explicit user consent.

## Integration Principles

1. Keep vibestats sovereign.
   A vibestats profile must remain useful even if `/vibe` or vibeconf are down.

2. Never merge raw data boundaries.
   `/insights` raw data stays local. Other products receive derived, versioned profile fields only.

3. Use explicit handoffs.
   Each cross-product transition should say what data moves and why.

4. Do not share databases casually.
   Use small signed payloads, API reads, or exported credentials before considering shared persistence.

5. Preserve separate identities until there is a real account strategy.
   GitHub-claimed vibestats profiles, `/vibe` identities, and vibeconf participants can be linked later through user-approved account linking.

## Near-Term Handoffs

### Vibestats to /vibe

When `/vibe` is ready, reintroduce a CTA only after a reveal or profile view:

```text
Find other Deep Divers
```

Payload should be derived only:

- archetype
- signature combo
- facet radar
- match intent, if public
- profile URL or anonymous reveal URL

Avoid sending:

- raw `/insights`
- project paths
- prompt/session text
- exact private metrics beyond what the user already made public

### Vibestats to Vibeconf

The strongest first flow is not a generic "start meeting" button. It is a match-specific room setup:

```text
Open a pairing room for this match
```

Room context:

- host profile
- guest profile or anonymous archetype
- compatibility explanation
- suggested roles
- 3 starter prompts
- consent text for what Coltrane can remember

### Coltrane Across the Flow

Coltrane should act like a host, not a recommender feed.

Useful jobs:

- explain "what your profile means"
- suggest who to compare with
- draft a public share line
- invite a complementary builder
- open a vibeconf room with a match brief
- summarize the room outcome back into derived match feedback

## Data Contract

The common object should be a versioned derived profile credential, not an internal DB row.

Minimum shape:

```json
{
  "schema_version": "vibestats.derived_profile.v1",
  "profile_url": "https://vibestats.io/u/handle-or-r/slug",
  "identity_mode": "anonymous-or-claimed",
  "archetype": "deepdiver",
  "signature_combo": "shipper+deepdiver",
  "facets": [],
  "moments": [],
  "privacy": {
    "raw_insights": "local-only",
    "synced_fields": "derived-only"
  }
}
```

## Phased Roadmap

### Phase 0: Launch Hygiene

- Keep `/vibe` links hidden from vibestats launch traffic.
- Keep anonymous reveal and profile viewing independent.
- Log only vibestats-native events.

### Phase 1: Passive Interop

- `/vibe` can unfurl vibestats links.
- vibeconf can accept a vibestats profile URL as room context.
- Coltrane can read public profile/credential URLs.

### Phase 2: Explicit Handoffs

- Add "Find people like/complementary to me" once `/vibe` has a proper receiving page.
- Add "Open pairing room" once vibeconf can consume a match brief.
- Add Coltrane-generated intro copy.

### Phase 3: Account Linking

- Let users link vibestats, `/vibe`, and vibeconf identities.
- Keep the link revocable.
- Keep product-specific privacy settings separate.

### Phase 4: Outcome Graph

- Record intro accepted, room opened, session completed, and outcome sentiment.
- Store only bounded event types and derived summaries.
- Feed aggregate outcomes back into match quality.

## Non-Goals For Now

- No automatic `/vibe` account creation from vibestats.
- No raw `/insights` sharing with `/vibe`, vibeconf, or Coltrane.
- No cross-product DMs inside vibestats.
- No shared database until identity and deletion semantics are designed.
- No "agentic social score."

## Re-Enable Checklist

Before `/vibe` links come back into vibestats:

- `/vibe` receiving page exists and handles `archetype`, `signature`, and `profile_url`.
- The receiving page repeats the derived-only privacy boundary.
- Referral tracking is documented and bounded.
- User can continue without creating another account.
- A broken `/vibe` dependency cannot block vibestats reveal, share, or claim.
