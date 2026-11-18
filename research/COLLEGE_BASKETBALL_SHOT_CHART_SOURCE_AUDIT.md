# MAN CAVE SPORTS BOOK — College Basketball Shot-Chart Source Audit
Date: 2026-11-17 ET (2026-11-18 UTC)
Status: Research complete at provider/documentation level; live game-by-game coverage NOT yet verified. No production chart changes made.

## User requirement
Provide **individual player** and **whole-team** shot charts, built from every real field-goal attempt, for every college basketball game in the controller. Display made shots green, missed shots red, no invented locations. Preserve approved NBA V4 visuals and Fire TV assignments. Broadcast delay must apply to shot charts, score and scoring flash together.

## Critical finding
A team chart does NOT need another data provider if each shot has a team identifier. Filter the normalized game shot set by player ID for an individual chart or by team ID for a team chart.

**Coverage is the real blocker.** Live scores/box scores for every DI matchup do not guarantee live accurate X/Y for every shot. Neither the ESPN public API nor the researched commercial tiers have been proven to satisfy 100% real-time exact shot locations across all DI matchups. Do not market partial shot data as complete.

## Sources and feasibility

1. **ESPN Site v2 MBB game summary** (first live source)
   - `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={espn_game_id}`
   - The `plays` data can expose shootingPlay/scoringPlay, coordinates, team, athlete, game period/clock, score. Secondary ESPN CDN and core endpoints may mirror the same upstream data; mirrors do NOT fill truly missing events automatically.
   - Existing `team-board.html` already requests this endpoint for college basketball, but the NBA flash script early-returns for `sport !== 'nba'`.
   - Relevant third-party documented live wrappers: sportsdataverse.js, hoopR ESPN MBB PBP, sdv-py ESPN MBB.
   - Must audit raw live games for coordinate availability and identity completeness. Unofficial public endpoint; no SLA.

2. **NCAA stats.ncaa.org contest shot chart** (strong independent fallback; real NCAA chart JS)
   - Source: `https://stats.ncaa.org/contests/{ncaa_contest_id}/box_score`; parsed shot location via embedded `addShot(...)` JavaScript according to sportsdataverse/ncaa-mbb-hoops-data and sdv-py `ncaa_mbb_shot_locations`.
   - `hoopR::load_ncaa_mbb_shots` has per-shot coordinate and shooter; `shots.shooter_player_id` joins roster; `espn_game_id` in crosswalk helps match an ESPN game.
   - Data starts from ~2019 in the NCAA-derived dataset; not every current game has been verified live/up-to-minute. Important: NCAA and ESPN IDs are different.
   - Likely valuable for postgame repair/completion and smaller games; must test time-to-availability before using for live overlays.
   - Women's sister datasets also exist.

3. **NCAA LiveStats / Genius Sports** (upstream courtside capture)
   - Official NCAA collection tool records shot positions across men's and women's divisions; commercial Official NCAA Data is licensed by Genius Sports. The in-arena TV feed uses a LAN TCP connection (default port 7677); it is NOT a public remotely accessible API.
   - Genius live-stat charted data and hosted shot pages exist; `hoopR::genius_shots` documents a public `data/{match_id}/data.json` route for *finished* games, with x/y as full-court percentages. Identity crosswalk uses in-game tno/pno, and hosts may block cloud IPs.
   - Need licensed remote access and NCAA game-ID mapping for production-wide live coverage. Do not bypass gates.

4. **Sportradar NCAAMB/NCAAWB v8 API** (paid)
   - Game Play-by-Play documents event `location.coord_x`, `location.coord_y` and `action_area`, plus shooter/shot result. Coordinates use an 1128 x 600 in-court frame.
   - Full coverage includes live PBP for certain conferences/major tournaments and reliable broadcasts; **extended_boxscore games do not get PBP**. No 100% exact chart assurance.
   - Test whether target lower-tier matchups are designated full coverage before considering a contract.

5. **CollegeBasketballData.com API** (keyed/free limited or paid)
   - `/plays/game/{gameId}` and `/plays/date` documented with `shotInfo.shooter`, `made`, `range`, `location:{x,y}`, `teamId`.
   - Data site warns many shots lack locations. Free API key has 1000 requests/month and live timeliness is not guaranteed; higher tiers available. Good postgame completeness validation / alternative extraction.
   - Season named by ENDING year (2026-27 -> 2027).

6. **SportsDataverse hoopR/wehoop / ncaahoopR / SportsDataverse releases**
   - MBB `load_mbb_shots()` (ESPN), WBB `load_wbb_shots()` (ESPN), NCAA MBB and NCAA WBB shot events (stats.ncaa.org). Good cross-validation and backfill.
   - 2026-27 data release pages currently show daily freshness; daily releases are not a low-latency live stream.
   - Important coordinate difference: ESPN MBB release coordinates use full-court/center-court convention; **do not reuse NBA V4 x 0..50/y -3..34 projection blindly**.

7. **Other paid/website routes**
   - Stats Perform/Opta (formerly STATS) CBK event API docs reference per-game shot chart data; check access/tier/pricing.
   - SportsDataIO college live team/player stats does not itself establish exact event coordinates.
   - StatBroadcast ShotChartr charts in real time for schools using it, but per-school availability and remote export permissions need verification.
   - Paint Basketball, BasketballQuant, CBB Analytics and others show player/team charts (Paint advertises every DI men's game), but PUBLIC UI DOES NOT MEAN an embeddable licensed API. Contact providers for feed rights. Some rendered charts may derive from the same ESPN/NCAA upstream.
   - Video computer-vision tracking would require permitted footage, compute, calibration and quality review. Not a credible zero-cost guaranteed every-game fallback.

## Implementation architecture once coverage is measured
- Feed order: **live ESPN event shots -> second independent live licensed provider (if available) -> NCAA contest events when published -> historical reconciliation**.
- A common shot object:
  `{ gameId, source, sourceEventId, teamId, athleteId, made, isFieldGoal, shotValue, rawX, rawY, coordinateSystem, normalizedCourtX, normalizedCourtY, period, clock, observedAt, availableAt, precisionStatus }`.
- Dedupe across providers by stable source IDs or conservative event key (game/team/player/period/clock/shot type/score), never just player name. Verify FG attempts per team/player against box score. Count duplicates, missing IDs, missing coordinates, 2/3 discrepancies.
- Do not draw fake dots. If locations are missing, show known shot totals and explicit `SHOT LOCATIONS UNAVAILABLE` or honest zone-only analysis. Never convert a zone into a pretended precise point.
- If verified coordinates are partial, label chart `X of Y attempts located`, not complete.
- Team chart = all players' shots filtered by team; player chart = same game data filtered by athlete.
- Preserve 10-second fetch cadence but apply user-selected broadcast sync delay to score/shot data/flash in the same delayed snapshot.
- Never touch NBA gold master / existing CBB player rows until distinct preview and coverage tests pass.

## Coverage validation required before promising "every game"
1. Choose at least ten live DI men's games covering major network, ESPN+, no TV, high/mid/low-major conference, early season and tournament; expand to women if requested.
2. Fetch from first whistle and repeatedly during the game; log non-sensitive metadata `espnGameId, ncaaContestId, source, shotAttempts, located, playerAttributed, exactXYPct, updateDelay, scoreReconciled`.
3. Recheck each final after NCAA gamebook posts; see if NCAA or CBBD backfills missing ESPN shot coordinates.
4. Test browser CORS, access permissions and Cloudflare/Fire TV endpoint behavior; verify actual usable permissions before licensing.
5. Only use `FULL EXACT` if every non-free-throw attempt has real coordinates. Otherwise display `PARTIAL EXACT`, `ZONE ONLY` or `NO LOCATIONS`.

## Source links (checked in provider/public documentation)
- https://hoopr.sportsdataverse.org/articles/nba-college-basketball-shot-charts.html
- https://github.com/sportsdataverse/ncaa-mbb-hoops-data
- https://hoopr.sportsdataverse.org/reference/genius_shots.html
- https://developer.sportradar.com/basketball/reference/ncaamb-play-by-play
- https://developer.sportradar.com/basketball/docs/ncaamb-ig-live-game-retrieval
- https://www.collegebasketballdata.com/about
- https://api.collegebasketballdata.com/api/plays
- https://developer.geniussports.com/livestats/tvfeed/index_basketball.html
- https://www.geniussports.com/newsroom/gemini-sports-analytics-partners-with-genius-sports-to-power-predictive-analytics-with-official-ncaa-data/
- https://www.sportsdataverse.org/status
- https://paintbasketball.com/

## Research boundary
Web access could verify docs and source descriptions, but direct JSON fetching of the November 17, 2026 ESPN live MBB event summary was blocked in the research environment. Consequently real-time completeness across *every* game has NOT been empirically demonstrated. Do not claim a universal solution or imply one is deployed.
