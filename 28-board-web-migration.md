# MAN CAVE SPORTS BOOK — 28-BOARD WEB MIGRATION

Started: 2026-11-14
Status: Phase 1 started; source audited, library preview deployed. **Full 28-board web runtime NOT DEPLOYED yet.**

## Immutable source authority

Google Drive production folder:
https://drive.google.com/drive/folders/1l05Mc7ZsSJXgBsKiSTMvPmsyuoj7GVVi

Source: `MAN_CAVE_28_BOARD_WINDOWS_PRODUCTION_v1_FROM_LOCKED_v8l_20261018.zip`, delivered as SIX parts plus installer.
Source ZIP: 218,548,858 bytes, SHA-256:
`e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f`.

Archive's approved v8l source: 700 members, 218,368,357 bytes, SHA-256:
`6a8368ce182542f3e790f0aad09163bb5ca9e3d5277bdb0ba9b4d211eb8fe3e3`.

Source provenance and behavior documented in
`MAINTENANCE_HANDOFF.md`, `CHANGELOG_AND_ADAPTERS.md`,
`VERIFICATION_REPORT.md`, `START_HERE_PRODUCTION.txt`, and `PACKAGE_MANIFEST.json`
in the production folder.

**All 28 designs are user-approved and locked. Never reconstruct them from mockups,
replace artwork or change approved runtime data selection merely to simplify deployment.**

## Existing approved behavior to retain

- Seven teams/sports in order: Broncos (NFL), Celtics (NBA), Bruins (NHL), Red Sox (MLB), Fever (WNBA), Arizona Football (CFB), Arizona Basketball (CBB).
- Each team has Pages 1–4; within-team ordering preserved.
- 30-second full-board slots, about 14 minutes for all 28.
- Page 4 Spotlight interval **7 seconds**, retaining source-specific transitions and player queues.
- A player becomes seen when its display starts; never consume players during hidden preloads.
- Preload one next board; keep last valid board when load fails, retry, then give recovered board a complete slot.
- Existing feed source logic and last-good response backoff are part of the production behavior.
- Portrait 9:16 at 720×1280 target, scaling to compatible portrait resolutions.
- Source has known pre-existing Red Sox Page 3 MutationObserver and Arizona CFB Page 3 loadSchedule warnings; don't silently edit locked source.

## Phase 1 (completed)

- Locate and compare v8l review, production handoff, delivery checksum, file inventory, and verification notes.
- Deploy standalone `board-library-preview.html` with 7 teams, Pages 1–4, assignment target LEFT / RIGHT / BOTH, one-team rotation and all-28 rotation **selection previews**.
- Create `28-board-library-manifest.json` with source identity and fail-closed production state.
- No Firebase writes, no production Game Wall modifications, no TV receiver modifications.

## Phase 2 — verified web package

- Obtain six *production* archive parts and validate all part SHA-256 hashes and the assembled ZIP hash before any extraction or deployment.
- Extract exact approved source files, manifests, assets and nested Arizona CFB site.
- Audit local-server endpoints, request-time Spotlight adapters, relative/absolute asset paths, CORS and any Python-only data dependencies. The source HTML cannot be treated as self-sufficient without this step.
- Build a browser/host-compatible adapter **outside** the `approved_v8l` directory; preserve approved bytes.
- Separate source static assets from dynamic API and state behavior. Don't expose local server endpoints or secrets.
- Verify 28/28 routes at portrait resolution with exact source assets and existing live data, including Page 4 fade/next-player lifecycle.
- Test several complete 28-board rotations and source recovery before claiming parity.

## Phase 3 — real remote control

- Add `TEAM BOARD LIBRARY` section to the existing controller **only after Phase 2 pages load**.
- Use the existing Firebase `screens/left` and `screens/right` assignment pattern with a new explicitly validated type, e.g. `team-library`; keep the current `team`, `upcoming`, `live` handling untouched.
- LEFT and RIGHT independent; allow a single page, a team's 4-page rotation, and all 28 pages. Preserve manual hold and automatic return options.
- Never emit an unverified board URL. Hold final game player boards until manually reassigned as already approved.
- Build cross-device Spotlight state consistency where needed; client-only localStorage does not provide the same persistence as today's Windows disk-backed service.
- Validate on both Fire TV Silk receivers, iPhone controller and portrait resolution before enabling a production switch.

## Release rule

A green controller tile is *not* evidence a board has been deployed or loaded.
The preview must never send a command. Track verified hosted board URLs and
distinct ready/unavailable status; fail safely when not yet hosted.

Do not overwrite original Drive archives or change the approved Game Wall
controller/header/visual style without user review.

## Phase 2a — browser and live-source proof (2026-11-14)

- Preserved original approved NBA Page 2 HTML and 2026-10-18 runtime byte-for-byte:
  - `migration/source/boards/page2_nba.html` — Git blob `2e3ad2f231c16add5dd7a8b89211121a321c404a`
  - `migration/source/runtime_nba_p2_v7p.js` — Git blob `ef368631ace4bb940c2ff177c48581b93ad1fb04`
- Reused pre-existing, unpublished **Man Cave NBA Page 2** Floot project for a **development-only** render at `/__dev/nba-v8l`, leaving its published/home page and Game Wall untouched. A new hosting project and branching were unavailable on the free account; do not require the user to upgrade to proceed with GitHub staging.
- Original NBA arena, original trophy and a pixel-identical lossless-WebP version of the original neon logo were loaded into that existing project's assets. This does not modify original source files.
- Exact original `page2_nba.html` DOM/CSS adapted ONLY in the development page's in-memory copy for asset URLs; original live runtime currently disabled in that visual test.
- In the running browser, original stage exists, the arena background is applied, and 30/30 image elements loaded. This is a static visual compatibility check, **not** 28-board acceptance or live stats certification.
- Created development-only read-only API endpoint `/_api/__dev/nba-v8l-probe` in the existing Floot project. It obtains current NBA season from ESPN scoreboard and the six original Page 2 leader categories using the same ESPNs statistical keys as the verified Python source.
- Initial and repeat cloud checks: HTTP 200, 6/6 available qualified leader records, verified current-season context; frontend/endpoint typecheck clean. Original Python server's DNS was blocked in this container, but cloud source requests succeeded.
- The dev preview shows the six live-source health results **below** the original locked board; it does **not** inject them into the approved design. MVP, team-leader panels, ticker data, and production API parity remain to be built and independently validated.
- No Firebase commands, TV receiver changes, or edits to the live Game Wall controller occurred.

**Next:** Reproduce the original NBA Page 2 feed JSON contract (including six leader details, valid team panels, credible award-watch source, 48-hour ticker selection and last-good behavior), then enable the unchanged runtime adapter against an isolated route. Do not show live NBA stats over frozen 2025–26 FINAL footer text; validate correct season and labels first. Only after full acceptance should a controller tile send this hosted board to a TV.
