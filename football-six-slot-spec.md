# LEFT RIGHT — Football six-slot rules (approved design)
Updated November 13, 2026 (Eastern). Applies to **NFL and NCAA football** team portrait previews.

## Nonnegotiable visual constraints
- Reuse the locked existing six-player portrait layout, headshots, player name, scoreboard, and three-stat lines.
- No changes to production `team-board.html`, TV assignments, Firebase controller, or other leagues until separate approval.
- Explicitly **do not claim live 11-player personnel**. This is a contributor display driven by current-game statistics and ESPN's credited play-by-play names.

## Offense, rows 1 through 6
1. **QB — protected:** starting/active QB from depth chart and current-game passing evidence.
2. **RB — protected:** leading rusher by **current game** rushing yards (depth chart fallback before any rushing activity). Show ATT/YDS/TD.
3. **RB — dynamic:** an eligible different RB credited with a carry or reception. When that RB is credited with a catch, show REC/YDS/TD; after a credited rush, show ATT/YDS/TD.
4. **WR — protected:** leading receiver by **current game** receiving yards. The first catch can establish the leader immediately.
5. **WR — dynamic:** latest eligible WR credited in play-by-play who is *not* the protected leading receiver.
6. **TE — dynamic:** latest eligible TE credited in play-by-play.

**Leader priority:** Update protected rush/receiving leader **before** dynamic slots. If a newly credited player takes over the protected slot, move the displaced player into the dynamic slot if eligible. Never duplicate a player across the six spots.

## Defense, rows 1 through 6
1. **EDGE — protected:** first depth-chart EDGE.
2. **EDGE — protected:** second depth-chart EDGE. Use depth-chart DE, and OLB fallback when exact EDGE roles unavailable.
3. **LB — dynamic:** credited linebacker.
4. **DL — dynamic:** credited DT/NT/DL (available unused DE fallback).
5. **S — dynamic:** credited safety.
6. **CB — dynamic:** credited cornerback.

Proposed position-specific stat lines, implemented in isolated preview:
- EDGE and DL: tackles / sacks / tackles for loss
- LB: tackles / tackles for loss / sacks
- Safety and CB: tackles / passes defended / interceptions

## Selection and updates
- Populate six positions *at kickoff* using eligible depth-chart/roster players. If fewer than six eligible verified players exist, display unavailable rather than invent identities.
- Dynamic spots change **only** when a newly credited play names a different eligible player at that position.
- **No time-based rotation, random changes, or duplicate players.**
- Switch the whole group by **current possession**; remember separate offense and defense lineups, so changing possession does not reset positions.
- When ESPN doesn't provide a reliable possession signal, hold the last known mode rather than guessing using last-snap offense.
- When ESPN does not clearly name a player, hold the current player.
- Preserve the game's selected display on final, and retain the last working rows through temporary ESPN feed failures.
- Prefer official **current-game box-score** values, not season stats. Play-text credit may show marked provisional reception/rushing statistics while the box score lags; never invent an unobserved number.
- No update to the approved layout or production sites without explicit approval.

## Preview code
- Development branch: `feature/football-personnel-engine-20261113`, file `football-board.js`.
- Main-branch isolated preview engine: `football-personnel-preview-engine.js`.
- Main-branch isolated portrait board: `football-personnel-preview-board.html`.
- Read-only preview and diagnostics: `football-personnel-live-lab.html`.
- Browser: https://broncos5523.github.io/left-right-/football-personnel-live-lab.html?v=sixslot366d5c12

## Verified with simulated ESPN fixtures
1. Six kickoff depth-chart players in QB/RB/RB/WR/WR/TE positions.
2. First completed pass to WR4 makes him protected receiving leader immediately; no duplicate.
3. Next 25-yard reception by another WR changes leader; previous leader enters dynamic WR.
4. First RB rush establishes leading rusher; other RB remains dynamic.
5. RB catch changes dynamic RB stat labels to REC/YDS/TD; later RB rush changes back to ATT/YDS/TD.
6. Official game possession switches defense, protecting EDGE1/EDGE2 while credited safety and LB appear in their own slots.
7. Missing possession holds previously known side; final holds lineup; source errors retain rows.
8. Provisional rushing stat 1/8 then 2/12 survives repeated and partial logs and yields to official stats.
9. No random timer rotation; no changes to production scoreboards, CSS, player-row markup, controller or Firebase.
10. Syntax checks passed.

**Remaining validation:** Actual live ESPN behavior and GitHub Pages serving were not independently verified in this test session; the code was committed and evaluated against simulated feed data.
