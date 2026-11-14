# LEFT RIGHT — NFL six-slot preview implementation
Date: 2026-11-13 (Eastern)
Status: Isolated NFL preview only. Do NOT change production TV renderer or the approved college preview without user approval.

## Locked game rules (identical to approved college version)
- Two display modes driven by verified current possession when live, separate persistent offense/defense player groups.
- Offense rows: QB protected; RB protected current-game rushing leader; RB dynamic by individually credited rush or catch; WR protected current-game receiving leader; WR dynamic; TE dynamic.
- Defense rows: EDGE protected; EDGE protected; LB dynamic; DL dynamic; S dynamic; CB dynamic.
- Kickoff initial players come from ESPN depth chart or eligible roster; verified current-game players and box-score data take priority as the game unfolds.
- Any new leading rusher or receiver takes protected slot first. Reconcile dynamic positions after leader change, never duplicate any player.
- No random swapping, no time-based player rotation, no unsupported on-field participation claims.
- EDGE eligible from EDGE/DE/RE/LE (including LDE/RDE); generic DL allowed as last-resort protected EDGE fallback as expressly approved. Only one player per position, even with DL fallback.
- S and CB can each use different generic DB players as fallback. Never double-assign one DB on a credited play.
- NFL stat lines same as approved college version: QB YDS/C-ATT/TD; protected RB ATT/YDS/TD; dynamic RB REC/YDS/TD after catch or ATT/YDS/TD after carry; WR/TE REC/YDS/TD; EDGE/DL TACK/SACK/TFL; LB TACK/TFL/SACK; S/CB TACK/PD/INT.
- Game-specific ESPN stats only; provisional per-play rushing and reception stats permitted when ESPN box score lags, never fabricated.
- Preserve previously displayed credible information on transient feed outages and final games.

## NFL-specific parsing
ESPN NFL feed differs from CFB:
- NFL depthcharts use `depthchart` (singular) instead of CFB `depthCharts`.
- NFL plays often have **no structured player participants**, no jersey number, and text such as `B.Nix pass short right to E.Engram ...` or `J.Dobbins left end ...`.
- Resolve initial+surname to unique athlete IDs from the selected team's official roster and game box score. Refuse ambiguous matches.
- Identify NFL `Pass Reception`/`Passing Touchdown` and `Rush`/`Rushing Touchdown` separately. Ignore `Penalty`/`No Play` credits.
- Identify named NFL defensive tackles in parentheses, including shared tackles `(D.Brown; T.Wharton)`; support interception/recovery named defenders.
- NFL play offense attribution from each play's `start.team.id` or current drive team where provided.
- NFL interceptions appear as separate `interceptions` statistical groups, not necessarily in `defensive`.

## Code and review
- NFL engine: `football-personnel-nfl-engine.js`
- NFL locked-layout portrait: `football-personnel-nfl-preview-board.html`
- NFL read-only two-board lab: `football-personnel-nfl-live-lab.html`
- NFL review URL: https://broncos5523.github.io/left-right-/football-personnel-nfl-live-lab.html
- Lab uses Broncos @ Panthers Nov 8, 2026, ESPN game `401873041` as an available verified replay, with a live NFL scoreboard selector and manual ESPN game ID.
- Lab-only `previewMode` switches both team views between offense/defense for completed games; auto attempts ESPN live possession. It does not control TVs.

## Real-game validation
Queried ESPN NFL game `401873041` (Denver Broncos 26, Carolina Panthers 21, Nov 8, 2026).
Actual completed-game feed + actual depth chart + roster, four permutations:
- Denver offensive display: Bo Nix; Jonah Coleman; J.K. Dobbins; Pat Bryant; Troy Franklin; Evan Engram.
- Denver defensive display: Zach Allen; Sai'vion Jones; Nik Bonitto; Malcolm Roach; JL Skinner; Ja'Quan McMillian.
- Carolina offensive display: Bryce Young; Chuba Hubbard; Trevor Etienne; Tetairoa McMillan; John Metchie III; Tommy Tremble.
- Carolina defensive display: Derrick Brown; Lee Hunter; Trevis Gipson; Bobby Brown III; Nick Scott; Chau Smith-Wade.
All 24 shown slots populated with unique athlete IDs in their respective six-row modes. These names reflect a replay of full event data, not a claim of literal on-field snap personnel. Real-game results may change with corrected ESPN records or more recent roster data.

## Release gate
**Do not copy the NFL preview engine to production `football-board.js` or change `team-board.html` without explicit user approval.** College preview and approved CSS are also frozen.
