# CBB Scoring Flash — Regression Results

Run UTC: 2026-11-19T02:33:49.622Z
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
✔ CBB production, NBA review, and CBB review share the same locked scoreboard layout (4.594719ms)
✔ CBB flash preserves the exact approved NBA V4 SVG, sizes, court and 6/8 second durations (0.350277ms)
✔ new Alabama three plays only on Alabama wing and returns in 8 sec (9.640624ms)
✔ new Kennesaw two flashes on its own side for six seconds (2.034344ms)
✔ two quick college scoring events queue in game order without duplicate playback (2.62248ms)
✔ late ESPN backfill still flashes a new basket even when a later timeout already arrived (3.280481ms)
✔ 30-second TV delay holds score and shot graphic in order without slowing 10-second feed (3.074791ms)
✔ a shot with no athlete ID does not trigger an invented player spotlight (1.721543ms)
✔ missing coordinates remain unplotted, and missing headshots use genuine college team logo (2.3502ms)
✔ first load of already-completed college game never auto-replays final baskets (2.514648ms)
✔ production team board differs from Gold Master preview only in title (9.169287ms)
✔ NBA scorer flashes only on own wing, from real ESPN plays, then returns to player board (8.429548ms)
✔ same ESPN snapshot updates scoreboard before a live NBA scoring flash (2.982472ms)
✔ when no NBA game is selected, other sports preserve their existing player boards (0.828197ms)
✔ 30-second NBA broadcast sync holds team score and shot flash together (1.994474ms)
✔ exact approved V4 black/red/green shot-chart and frameless headshot kept (1.901525ms)
✔ preview wing receivers use V4, approved live receivers are preserved (2.589872ms)
✔ historical archive contains real scorer and coordinates without assuming every event has a location (3.920298ms)
✔ live scoring engine flashes each new basket in order, not historical or duplicates (4.809196ms)
✔ production and approved preview use identical six-row NHL engine without touching layout (2.255057ms)
✔ six real IDs sort C/F/D/G and update when the live NHL lineup changes (141.773344ms)
✔ holding prior NHL verified players is clearly labelled when onIce temporarily disappears (30.03638ms)
✔ missing onIce never falsely labels arbitrary box score roster as current on ice (1.386228ms)
✔ end-of-period reporting keeps lineup visible without claiming players are currently skating (1.456754ms)
✔ power plays and overtime can show fewer players without inventing active players (1.06247ms)
✔ 30-second NHL broadcast sync holds live score and line changes without slowing fetch checks (1.268741ms)
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 377.963252

```
