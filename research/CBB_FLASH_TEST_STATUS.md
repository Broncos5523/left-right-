# CBB Scoring Flash — Regression Results

Run UTC: 2026-11-19T02:48:19.389Z
Test status: **FAIL**
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
✔ CBB production, NBA review, and CBB review share the same locked scoreboard layout (7.416993ms)
✔ CBB flash preserves the exact approved NBA V4 SVG, sizes, court and 6/8 second durations (1.089261ms)
✔ new Alabama three plays only on Alabama wing and returns in 8 sec (4.897249ms)
✔ new Kennesaw two flashes on its own side for six seconds (1.569189ms)
✔ two quick college scoring events queue in game order without duplicate playback (1.626775ms)
✔ late ESPN backfill still flashes a new basket even when a later timeout already arrived (1.631081ms)
✔ 30-second TV delay holds score and shot graphic in order without slowing 10-second feed (2.127565ms)
✔ a shot with no athlete ID does not trigger an invented player spotlight (1.169248ms)
✔ missing coordinates remain unplotted, and missing headshots use genuine college team logo (1.341353ms)
✔ first load of already-completed college game never auto-replays final baskets (1.245431ms)
✖ production team board differs from Gold Master preview only in title (7.30596ms)
✔ NBA scorer flashes only on own wing, from real ESPN plays, then returns to player board (7.030132ms)
✔ same ESPN snapshot updates scoreboard before a live NBA scoring flash (2.294081ms)
✔ when no NBA game is selected, other sports preserve their existing player boards (0.269699ms)
✔ 30-second NBA broadcast sync holds team score and shot flash together (1.499076ms)
✔ exact approved V4 black/red/green shot-chart and frameless headshot kept (1.109991ms)
✔ preview wing receivers use V4, approved live receivers are preserved (1.246213ms)
✔ historical archive contains real scorer and coordinates without assuming every event has a location (6.090983ms)
✔ live scoring engine flashes each new basket in order, not historical or duplicates (2.050421ms)
✔ production and approved preview use identical six-row NHL engine without touching layout (1.647926ms)
✔ six real IDs sort C/F/D/G and update when the live NHL lineup changes (220.652251ms)
✔ holding prior NHL verified players is clearly labelled when onIce temporarily disappears (332.237871ms)
✔ missing onIce never falsely labels arbitrary box score roster as current on ice (1.102509ms)
✔ end-of-period reporting keeps lineup visible without claiming players are currently skating (0.954489ms)
✔ power plays and overtime can show fewer players without inventing active players (0.787002ms)
✔ 30-second NHL broadcast sync holds live score and line changes without slowing fetch checks (1.003332ms)
ℹ tests 26
ℹ suites 0
ℹ pass 25
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 850.030949

✖ failing tests:

test at tests/nba-scoring-flash-live.mjs:13:1
✖ production team board differs from Gold Master preview only in title (7.30596ms)
  AssertionError [ERR_ASSERTION]: production board must load exact Gold Master
      at TestContext.<anonymous> (file:///home/runner/work/left-right-/left-right-/tests/nba-scoring-flash-live.mjs:14:9)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.start (node:internal/test_runner/test:1262:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

```
