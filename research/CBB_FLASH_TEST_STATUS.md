# CBB Scoring Flash — Regression Results

Run UTC: 2026-11-19T02:50:20.149Z
Test status: **PASS**
Node tests passed: unknown
Node tests failed: unknown

Live ESPN summary check: ok
Real-event PBP shot attempts: 136
Real-event shots with X/Y: 136
Real-event shots with shooter IDs: 136

The code tests cover: locked NBA SVG parity, CBB live team matching, three-pointers (8 seconds), twos (6 seconds), first-load baseline, no duplicate flash, 30-second broadcast delay, unassigned-player skipping, missing coordinates, and NHL regressions.
Live output uses the college ESPN game summary. This is not a physical Fire TV acceptance test.

## Test log excerpt
```
✔ CBB production, NBA review, and CBB review share the same locked scoreboard layout (1.732708ms)
✔ CBB flash preserves the exact approved NBA V4 SVG, sizes, court and 6/8 second durations (3.638942ms)
✔ new Alabama three plays only on Alabama wing and returns in 8 sec (5.548382ms)
✔ new Kennesaw two flashes on its own side for six seconds (1.704607ms)
✔ two quick college scoring events queue in game order without duplicate playback (2.671721ms)
✔ late ESPN backfill still flashes a new basket even when a later timeout already arrived (2.290891ms)
✔ production college flash follows the already-delayed wing score with no second timer or stale animation backlog (2.551223ms)
✔ 30-second TV delay holds score and shot graphic in order without slowing 10-second feed (1.53143ms)
✔ a shot with no athlete ID does not trigger an invented player spotlight (1.005855ms)
✔ missing coordinates remain unplotted, and missing headshots use genuine college team logo (1.333864ms)
✔ first load of already-completed college game never auto-replays final baskets (0.977508ms)
✔ production team board differs from Gold Master preview only in title (2.735299ms)
✔ NBA scorer flashes only on own wing, from real ESPN plays, then returns to player board (4.903012ms)
✔ same ESPN snapshot updates scoreboard before a live NBA scoring flash (1.755725ms)
✔ when no NBA game is selected, other sports preserve their existing player boards (0.21108ms)
✔ NBA live wing uses one delayed scoreboard snapshot, with no second 30s wait or queued stale shot (1.274532ms)
✔ 30-second NBA broadcast sync holds team score and shot flash together (1.222534ms)
✔ exact approved V4 black/red/green shot-chart and frameless headshot kept (1.377898ms)
✔ preview wing receivers use V4, approved live receivers are preserved (1.615262ms)
✔ historical archive contains real scorer and coordinates without assuming every event has a location (1.35446ms)
✔ live scoring engine flashes each new basket in order, not historical or duplicates (2.672141ms)
✔ production and approved preview use identical six-row NHL engine without touching layout (4.70566ms)
✔ six real IDs sort C/F/D/G and update when the live NHL lineup changes (18.558772ms)
✔ holding prior NHL verified players is clearly labelled when onIce temporarily disappears (26.823893ms)
✔ missing onIce never falsely labels arbitrary box score roster as current on ice (2.079039ms)
✔ end-of-period reporting keeps lineup visible without claiming players are currently skating (1.042373ms)
✔ power plays and overtime can show fewer players without inventing active players (0.802677ms)
✔ 30-second NHL broadcast sync holds live score and line changes without slowing fetch checks (1.052961ms)
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 192.782483

```
