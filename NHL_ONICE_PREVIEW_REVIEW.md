# MAN CAVE SPORTS BOOK — LEFT RIGHT NHL ESPN On-Ice Preview
Date: November 13, 2026 (Eastern)
Status: **Isolated preview created — NOT integrated into the production TV boards.**

## User-approved requirements
- Use **ESPN's reported six on-ice player IDs** for NHL, rather than the first six box-score names or a rotating list of leading scorers.
- Preserve the approved 9:16 portrait LEFT RIGHT scoreboard and six player-row design EXACTLY; no redesigns.
- Independently show the selected LEFT/RIGHT NHL teams.
- Show actual current-game statistics: skaters **G / A / +/-** and goalies **SV / SA / SV%**.
- Do not invent player identities, on-ice assignments, line changes, or game data.
- Do not alter LEFT RIGHT's production renderer, controller, Firebase selections, football/basketball engines, or other sports.

## Isolated files
- `nhl-onice-preview-engine.js` — independent NHL reader, guarded by `sport=nhl` and `nhlPreview=onice`.
- `nhl-onice-preview-board.html` — copy of the exact approved production CSS and initial scoreboard/six-row markup, with only the standalone NHL preview engine loaded.
- `nhl-onice-live-lab.html` — iPhone-friendly two-portrait, read-only lab with verified NHL game selection, ESPN reported on-ice IDs, statistics, status, and source diagnostics.
- Live review: https://broncos5523.github.io/left-right-/nhl-onice-live-lab.html?v=nhl-onice-v2

## Source/selection rules
- Fetch ESPN NHL summary for a selected ESPN event ID: `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=<ESPN_ID>`.
- Match each team by exact ESPN competition team identity, then select its `onIce[]` entry by **team ID**.
- Require exactly six distinct entries labeled `ROSTER_WHEREABOUTS_IN_PLAY` / `In Play`. Never make up a sixth player when a report is incomplete; hold the last known six.
- Resolve the IDs from the same selected-game ESPN box-score player groups (forwards, defenses, goalies). Play-by-play participant records may supply a missing name or headshot **only**, not season stats.
- Sort the six reported IDs by roster position for a readable display (C / LW / RW / other forward / D / G), but do not force 3F+2D+G. A six-skater, goalie-free group is allowed when ESPN reports it.
- Refresh every 20 seconds. Keep player positions when the same six IDs are reported; update their game stats each refresh and only rebuild player portraits if their identities / headshots change.
- Hold the last verified six across feed outages, invalid or incomplete ESPN reports, and on the final group after completion. Store the last valid group by sport+event+team on the individual preview device.
- Do not claim guaranteed real-time substitution accuracy: ESPN's `onIce` is a report and may lag physical play. On-ice reports are *not* crosschecked against a separate live tracking system.

## Validated data and behavior
Real ESPN events inspected:
- **Rangers @ Canucks**, ESPN event `401892706`, in progress when queried.
- **Canadiens @ Bruins**, ESPN event `401892696`, completed.

Four real teams × six IDs = **24/24 identifiable reported players**, with valid positions, unique IDs, matching game/side, correct 3-column skater and goalie stat labels, one timer, stable refreshes, and retention across incomplete reports / simulated temporary ESPN outages.

Controlled edge tests used *real Boston Bruins player IDs from that same game's box score* to simulate a six-skater/empty-net report and a return to a goalie report; both passed, as did rejection of a truncated five-ID report. **Those modifications were test-only simulations; they do not claim those lineup events happened in the real Bruins game.**

## Deployment gate
**Do not edit or merge NHL production board code until the user explicitly approves the NHL visual review and production release.** Public GitHub Pages serves only separate preview files here; production `team-board.html` remains unchanged.

After approval, create a development-branch integration and run a consolidated screen/side regression before requesting production deployment permission.
