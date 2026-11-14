# Football probable-personnel branch — implementation checkpoint

**Branch:** `feature/football-personnel-engine-20261113`  
**Production deployment:** NO. Existing GitHub Pages and locked scoreboard CSS have not been edited.

## Implemented in football-board.js

- Fetch selected game's ESPN summary using its exact event ID.
- Retrieve depth charts and roster for selected team; refresh non-game sources at most every 10 minutes.
- Use league-wide injury report when team injury report is missing or empty; exclude explicitly "Out"/"Inactive"/IR/suspended candidates when report is applicable to the current game. An empty injury feed is UNKNOWN, not a clean bill of health.
- Seed six offense rows with QB, two eligible receivers, RB/receiver/TE flex choices, even before the first box-score stat.
- Seed six defensive rows with CB1, CB2, EDGE1, EDGE2, S1, LB1, with position-based fallbacks.
- Preserve prior selections in browser localStorage by event, team and phase (offense/defense); do not replace players when a new play lacks usable player IDs.
- Read ESPN embedded last-play participants when present; candidates identified in the most recent play can replace flexible players.
- RB rushing/receiving stats switch from latest positively identified rushing/pass play, using **current-game box-score totals** only.
- Show en dash for missing statistics and a note stating probable personnel, not an official on-field listing.
- Keep previously displayed rows during a total personnel-source outage if available.
- No edits to `team-board.html`, Firebase assignments, controller or other sports.

## Mock data checks executed in code workspace (not live-feed validation)

| Scenario | Result |
|---|---|
| Depth chart + roster, 0 game stats | PASS: six eligible offense rows |
| WR1 in league-wide injuries, marked Out | PASS: excluded and receivers promoted |
| RB identified on pass with receiving box-score stats | PASS: shows REC/YDS/TD rather than rushing stats |
| Opponent is last-play offense | PASS: selected board shows defensive anchors |
| Two starting EDGE candidates in depth chart | PASS: both displayed |
| New play without player IDs | PASS: prior eligible headshots/slots unchanged |
| JavaScript compilation | PASS |

## Still unverified and not ready for main

- ESPN's actual 2026 NFL and CFB depth-chart and injuries payloads, particularly smaller college programs.
- Real-world game-day inactive completeness; ESPN injury list is not guaranteed to equal official 90-minute game-day inactive report.
- Whether last-play participants exist inside browser-accessible summary JSON (if absent, the engine intentionally holds existing slots).
- Live swap timing and possession/drive matching during turnovers, official reviews and unusual plays.
- A live test for five-WR and multiple-TE packages. Those remain inferred, not established by current data.
- Screen behavior and performance on the user's Fire TV Silk devices.
- Historical finalized games may require event-dated depth charts and availability rather than today's roster.

**Next:** validate one real selected NFL event and one CFB event using actual returned JSON, then correct schema gaps before a consolidated visual review. No API subscription has been purchased or required.

## Offline replay diagnostic prepared (2026-11-13)

`football-replay.html` is an independent development-only browser page. It uses two known archived ESPN event IDs:

- NFL, Broncos @ Texans, November 2, 2025: `401772870`
- NCAA, Arizona @ Houston, October 18, 2025: `401756925`

It fetches the game summary, collects unique play records, lets the tester step forward/backward, and measures whether structured participant IDs are present. When a play lacks participant IDs it explicitly shows the previously confirmed IDs instead of inventing participation. It does not use final-game totals as simulated live stats and does not send TV commands.

**Validation status:** Replay page JavaScript passed a syntax check. Browser access to actual ESPN summary responses and the participant-ID coverage numbers have **not** been verified from this environment. A stored archived game is not sufficient to verify live-feed delay, 2026 game-day inactives, or correct historical depth charts.

This page is on the feature branch only; GitHub Pages production continues to serve the existing main branch.

## College football Friday live diagnostic — Nov 13, 2026

A separate **read-only** GitHub Pages lab was committed on `main` at `football-personnel-live-lab.html` together with isolated assets `football-personnel-preview-board.html` and `football-personnel-preview-engine.js`. This is **not** a promotion of the actual production football board. There are **no** changes to `team-board.html`, the locked scoreboard CSS, `left.html`, `right.html`, controller, Firebase, or other sports.

**Initial target:** Florida State @ Pittsburgh, Nov 13 at 7 p.m. ET, ESPN game ID `401858293` (ESPN-style game listing reported by third-party mirrored page). The lab checks that the fetched game summary contains Florida State and Pittsburgh before showing the pair of previews. Schedule discovery can replace the default. If the exact event cannot be validated, it shows an error instead of loading a different game.

Read-only lab shows:
- Last ESPN play classified as potential scrimmage play, its team and any credited athlete IDs.
- Difference between **offense on last credited snap** and **current possession** (important after turnovers).
- Total and percentage of candidate scrimmage plays with structured participant IDs — NOT the percentage of the eleven personnel identified.
- Depth-chart, roster and injury endpoint availability, using counts but never assuming completeness or game-day clearance.
- Two independent preview-only portrait iframes, with the approved scoreboard styling reused exactly, showing probable six-player choices from the feature engine.
- Twenty-second ESPN summary sampling; team context requests on first successful game selection. No background automation, persistent monitoring or TV control.

**Mock integration tests passed:** loading a sample scoreboard selects the intended game ID, both preview frames receive the exact correct team and side, play IDs/names are counted and displayed, last-snap offense is kept distinct from current possession, roster/depth/injury source counts render, JavaScript syntax compiles; approved CSS and player-row markup exactly match production; the live production football script reference and TV pages remain unchanged.

**Not yet verified:** accessing live ESPN JSON from this environment; actual source coverage, game status, player-ID completeness, correct six-player identities, timely substitutions or accurate depth-chart/injury data. The user may visually compare the preview against the game, but the engine must continue to say **probable**, never confirmed all on-field participants.
