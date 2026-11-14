# MAN CAVE SPORTS BOOK — LEFT RIGHT
# Approved Football Six-Slot Integration — Development Review

Status: **Implemented and tested on development branch ONLY; NOT merged or deployed to production.**
Branch: `feature/approved-nfl-cfb-six-slot-integration-20261114`
Production site: https://broncos5523.github.io/left-right/
Production football board: `team-board.html` on `main` (unchanged)

## Technical implementation

- Added **`football-six-slot-combined.js`** (development branch), containing two independent guarded engines:
  - College football (`sport=cfb`) based on approved `football-personnel-preview-engine.js`.
  - NFL (`sport=nfl`) based on approved `football-personnel-nfl-engine.js`.
- Changed **exactly one script reference** in development-branch `team-board.html` to the combined engine. Replaced old football box-score renderer; no two football renderers run together.
- Removed NFL lab-only `previewMode` override from integration. The live view follows verified possession; final and unknown possession retain last known side.
- Did not edit scoreboard markup, player rows, CSS, approved assets, controller/Firebase code, or any NBA/MLB/NHL/WNBA/CBB implementation.
- State is isolated per selected sport/event/team. NFL and college parsers use separate ESPN endpoint paths.
- Existing global CSS and locked portrait design are byte-for-byte identical to production main.

## Approved position logic

Offense 1–6: protected QB; protected current-game rushing leader RB; credited-play dynamic RB (rush/REC stat modes); protected current-game receiving leader WR; credited-play dynamic WR; credited-play dynamic TE.

Defense 1–6: protected EDGE1 and EDGE2; credited-play dynamic LB, DL, safety, and CB.

Precedence: select current-game static leaders first, reconcile dynamic slots with **no duplicate IDs**. At kickoff, use eligible depth-chart/roster placeholders. Dynamic changes require an identifiable new credited play; no timed rotation. Maintain separate offensive and defensive lineups between possession switches.

Defensive eligibility: prefer explicit NFL ESPN roles when provided (EDGE/DE/RE/LE, CB, S/FS/SS); generic DL is the user-approved last-resort EDGE fallback, and generic DB can fill S or CB without duplication. ESPN roster labels do not necessarily establish actual snap alignment.

## Consolidated real-data regression

Source events used:
- College Football: Florida State @ Pittsburgh, ESPN event ID `401858293`.
- NFL: Denver Broncos @ Carolina Panthers, ESPN event ID `401873041` (Nov 8, 2026).

**Eight scenarios passed:** 2 leagues × 2 teams × 2 possession sides. All 48 position assignments were populated, with no duplicate IDs within any board. Each selected league invoked exactly one football engine timer; source requests stayed within the correct sport API endpoint.

**Additional scenarios passed:** NBA, WNBA, CBB, NHL, and MLB invoked **zero** new football-engine timers or data fetches.

**Same-instance possession regression passed for both leagues:** offense → defense → offense; previously chosen lineups retained independently; missing possession held last known display; final-game status retained the current side; temporary ESPN outage preserved the last valid six rows. No duplicate IDs.

Tests used **real ESPN game summaries, depth charts, and roster data**. To exercise both sides of a completed game, the test runner controlled the possession/status fields in a separate in-memory fixture. This validates mode behavior but is **not a claim that an actual live possession change was observed during the test**. Live user-device rendering under prolonged unattended conditions remains a final deployment acceptance check.

## Visual review

The production-ready branch is intentionally not hosted by GitHub Pages until user approval. These previously deployed preview pages show the exact approved portrait styling and independent league engines:

- NFL visual preview: https://broncos5523.github.io/left-right-/football-personnel-nfl-live-lab.html?v=nfl-six-v2
- College football visual preview: https://broncos5523.github.io/left-right-/football-personnel-live-lab.html?v=fsu-edge-cache-fix-v2

The branch contains the integrated runtime `team-board.html`, but GitHub Pages serves the `main` branch; opening the production `team-board.html` URL will **not** run branch changes before approval.

## Release gate / rollback

**No production deployment without explicit user go-ahead.** At release, merge only the reviewed `team-board.html` and `football-six-slot-combined.js` to `main`, allow Pages deployment, validate a single NFL and college game (or a controlled replay with ESPN data), and confirm LEFT and RIGHT assignments/controller still work. Rollback by reverting the single script-reference change in `team-board.html`; keep a copy of the existing `football-board.js` unchanged.

**Known limitations:** ESPN position nomenclature, missing headshots, attribution ambiguity, source delays, and NFL depth-chart data can vary per team. When an attribution is not reliable, hold the current player rather than guessing.

## NHL approved integration addendum — Nov 13, 2026 ET

The user visually confirmed that reported NHL on-ice players, their headshots, and current-game statistics update correctly in the iPhone preview. The approved NHL design is locked.

**Development-only integration:**
- Added `nhl-onice-engine.js` from the verified `nhl-onice-preview-engine.js`, modifying only its NHL-only preview guard so normal `sport=nhl` assignments can invoke it.
- Added its standalone script include to development-branch `team-board.html`.
- Disabled the old NHL fallback renderer by default on the development board to prevent simultaneous conflicting 45-second legacy and 20-second reported-on-ice updates. Legacy renderer remains available for explicit diagnostic mode `?nhlMode=legacy` on the development branch.
- Kept the existing football combined engine, basketball/MLB scripts, controller, Firebase assignments, asset paths and all approved scoreboard markup/CSS intact.
- Production `main` and GitHub Pages team board remain unchanged.

**Revalidation:** ESPN games Rangers @ Canucks (`401892706`) and Canadiens @ Bruins (`401892696`): 4 teams × 6 players = 24 distinct on-ice IDs, correct team attribution, skater G/A/+/- or goalie SV/SA/SV% labels, no duplicates, one NHL refresh timer, stable refresh, outage hold, and no wrong sport endpoint. This test used real ESPN summaries with a simulated feed failure; it does not establish continuous real-world NHL change latency or TV hardware acceptance.

**Release gate:** Do not merge or deploy these development changes to `main` without explicit authorization. NHL visual design is approved; development integration is not yet production deployed.
