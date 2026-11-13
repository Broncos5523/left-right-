# LEFT RIGHT — Basketball active-five development checkpoint
Date: November 13, 2026

**Scope:** ESPN basketball `summary?event=` player selection for NCAA men's basketball, NBA and WNBA.  
**Branch:** `feature/basketball-active-five-20261113`  
**Production status:** NOT DEPLOYED. `main`, player pages, Firebase controller, other sports and approved scoreboard layout unchanged.

## Why the old five-player selector could fail
The prior implementation assembled each box-score statistics group into a flat array, counted `active=true` **rows**, and used those rows only if exactly five were active. A player repeated across statistics groups could make that count larger than five, incorrectly falling back to the first five box-score entries. The new code merges players by **athlete ID first** and then counts unique `active=true` athletes.

## New basketball-board.js rules
1. Load only the exact selected game/event ID and its selected team.
2. Deduplicate ESPN statistics-group records by player ID; preserve game-specific PTS/REB/AST and headshots.
3. NCAA college basketball **during a live game**: exactly five distinct `active=true` player IDs -> select those five. User visually compared these groups against North Alabama at Miami on November 13, 2026, with a matching moment.
4. Preserve positions of unchanged players when the active group changes; fill vacancies with new active IDs. This reduces headshot bouncing.
5. If a subsequent response lacks an exact five: hold last five (and current stats when available); never label the fallback as a verified live five.
6. Early/pre-game: prefer five marked starters if present; otherwise use the first eligible game participants with dashes for missing stats.
7. At final, hold the last lineup instead of swapping to box-score leaders when possible.
8. NBA/WNBA: remain **GAME PARTICIPANTS** until separately verified. `active=true` alone is insufficient to claim live on-court five.
9. Refresh every 20 seconds, skip overlapping requests, retain rendered rows on feed failure.
10. Do not touch shared HTML/CSS visual sizing, scoreboard design, or non-basketball content.

## Mocked response checks performed
- Two repeated statistics groups with 6 distinct athletes including five active -> **PASS**: 6 unique players, 5 active IDs.
- North Alabama fixture with Patton active / Lax not active -> **PASS**: Patton selected, Lax excluded from active-five group.
- Active-five substitution on next update -> **PASS**: new athlete selected; unchanged identities remain.
- Missing active flags on subsequent response -> **PASS**: prior five retained.
- NBA fixture with five `active` flags -> **PASS**: does not activate unverified on-court status.
- PTS and REB stored in separate statistical group entries -> **PASS**: current-game values selected.
- JavaScript syntax check -> **PASS**.
- Changes to approved header CSS and base row markup -> **NONE**.
- Duplicate legacy NCAA header-only fetch removed to avoid redundant requests.

## Remaining blockers
- Live ESPN game JSON could not be independently retrieved from the tool/runtime environment (DNS/network restrictions). We have user screenshots of the standalone Lineup Lab, but not enough independent feed samples to guarantee behavior for every NCAA game.
- Player substitutions and stale `active` flags need another actual-game verification, especially at halftime, game completion, and feed interruption.
- NBA and WNBA require independent on-court five validation before activating any new selection behavior.
- Public ESPN Site API is unofficial and subject to availability and shape changes. No paid service purchased.
- This branch is **not** included in the GitHub Pages production deployment. Promote only after one consolidated review, not during the user's live game.

## Paths
- `team-board.html` — updated only to load `basketball-board.js`; approved visual style intact.
- `basketball-board.js` — new shared basketball selector.
- `college-basketball-live-test.html` — existing production read-only lineup lab, unchanged by this feature branch.
