# vibestats Future Directions

Source brief: https://spirit-artifacts-five.vercel.app/2026-05/2026-05-30-vibestats-future-directions.html

This is post-v1 strategy context. It should not interrupt the launch flow unless a v1 change would close off one of these paths or violate one of these constraints.

## North Star

Vibestats should become a sovereign, source-agnostic build identity for the agentic-coding era: earned from how someone actually builds, owned by the builder, and useful for matching on real complementarity.

The v1 card and viral loops are the wedge. The long-term product is the trusted derived identity object plus the population and connection graph around it.

## The Three Post-V1 Bets

1. **Attested signed credential, GitHub anchored.**
   Make the locally derived payload signed, bind it to GitHub identity server-side, and publish narrow credential claims with method, percentile, population, and trust tier. This is the first V2 bet because it turns the card from editable vanity into proof without uploading raw work.

2. **Source-agnostic identity.**
   Normalize Claude Code, Codex, Cursor, Aider, git, and terminal-derived signals locally into one versioned profile. This is the platform-risk hedge: a neutral identity survives any single coding-agent vendor cloning or changing its own stats surface.

3. **Connections and match feedback graph.**
   Start logging intro, accept, and outcome edges early, even before the model is sophisticated. Outcome history cannot be backfilled. This is what eventually moves matching from hand-tuned compatibility to empirical complementarity. V1 now stores only bounded match-intro/outcome event enums, not free-text intros, contact URLs, or headers.

4. **No-install terminal social shell.**
   Add an SSH/TUI route (`ssh ssh.vibestats.io`) for browsing, share kits, matchmaker discovery, and claim coordination without asking cold users to trust npm first. Keep extraction local; SSH is the product shell, not the raw `/insights` reader. V1 now exposes `/api/ssh/manifest` so that shell has a versioned command/privacy contract before the TCP service is deployed. See `docs/SSH-ROUTE.md`.

## Code Catches To Preserve

- **Debugger score must not reward producing bugs.** Reframe around resolution, recovery, or debug patience before ranking makes the incentive visible.
- **Never sync free-text friction or goal details.** Those fields can contain project names and secrets. Only fixed derived vectors, bounded histograms, and categorical aggregates should cross the boundary.
- **Stop discarding matchable signal, but do it with a spec.** Ship a versioned Derived Profile Spec before expanding beyond the current coarse metrics. The spec is the trust contract for source fusion and matching. V1 now exposes `/api/derived-profile-spec` and every credential links back to it.

## Product Constraints

- Keep the 8 public archetypes as a stable skin; expand identity through facets, signatures, rare combos, confidence, and trajectory.
- Do not introduce a single hireable competence score.
- Do not sell employer access to private people search. Matching and marketplace surfaces must be explicit, two-sided opt-in.
- Deletion and local-only reveal need to remain first-class.
- Public claims should be narrow, falsifiable, and reproducible from the derived spec.

## V1 Implication

Keep shipping the current v1 path: terminal-first reveal, GitHub-claimed profiles, share-asymmetric comparison, public opt-in discovery, match intent, badges, embeds, and weekly return hooks. The SSH route is worth planning now because it reduces install friction, but it should not interrupt v1 unless it adds a claim-session primitive that still preserves local-only extraction.

Only pull future work into v1 when it protects the privacy promise or prevents irreversible schema loss. The one likely early schema candidate is recording consented match-intro events once people can actually request intros.
