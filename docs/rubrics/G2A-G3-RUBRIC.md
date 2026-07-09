# Rubric — G2a (depth through browser-claim path) + G3 owner-view verification

Gradeable criteria for an independent verifier. Each criterion is pass/fail and must be
checked against actual executed evidence (test output, captured payloads), not code reading
alone. The grader runs in a fresh context and should try to REFUTE each claim.

## G2a — facet_signals survive the CLI→browser→server path

1. [ ] `bin/vibestats.js` `localWebPreviewData` includes `facet_signals` in the encoded
       preview metrics when the local insights contain them (counts-only; sanitized).
2. [ ] `home.html` `localPreviewFromHash` carries `facet_signals` into `localMetrics`
       (bounded: only the six known signal keys, integer values).
3. [ ] The browser claim POST body (`derivedUploadPayload` → `/api/uploads`) includes
       `metrics.facet_signals` when present — captured via a real headless-browser
       intercept, not inferred.
4. [ ] The captured POST body, fed through the REAL server boundary
       (`sanitizeUploadPayload`), yields stored `metrics.facet_signals` with allowlisted
       keys only; `publicUpload` then exposes percent-mode for visitors.
5. [ ] `secret_leak` and any non-allowlisted key injected into the hash do NOT survive to
       the stored payload (negative test executed).
6. [ ] Legacy preview hashes WITHOUT facet_signals still decode and save without error
       (backward compat test executed).
7. [ ] `npm test` fully green.

## G3 — /scoreboard owner-view verified (not just deny-path)

8. [ ] A session token minted with the app's own auth code (`api/_lib/auth.js`) and the
       local `VIBE_SESSION_SECRET`, for an OWNER handle, invokes the real
       `api/dashboard.js` handler and yields HTTP 200 HTML containing the funnel section
       ("Compare-intent funnel") and the owner handle.
9. [ ] The same harness with a NON-owner user yields 404 (no funnel data in body).
10. [ ] No session cookie yields 401 with sign-in prompt (regression of verified deny-path).
11. [ ] The harness runs against real `funnel_events` queries (live DB via env) OR proves
        the no-table graceful path renders the "not migrated" card — either is a pass,
        but which one executed must be stated.

## Hard constraints (auto-fail if violated)
- No raw `/insights` fields, free text, or non-allowlisted keys cross to the server.
- No production data mutated by the harness (read-only queries; no inserts to prod tables
  other than nothing at all).
- All evidence must come from executed runs (exit codes + captured output), not reasoning.
