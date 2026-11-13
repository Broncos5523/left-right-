# LEFT RIGHT — Football probable personnel engine

**Status:** agreed selection rules; data integration and live validation pending.
**Scope:** NFL and NCAA football. Six existing player rows per team, unchanged approved scoreboard and headshot/stat layout.
**Presentation:** `PROBABLE LAST-SNAP PERSONNEL`; never claim every player is confirmed on-field.

## Data priority (for the selected game only)

1. Official game-day active/inactive eligibility and confirmed out status; never select a confirmed unavailable player.
2. Per-play participation and substitutions, when identified by player ID and team.
3. Last retained lineup, unless a confirmed unavailability/substitution invalidates it.
4. Available team depth chart, checked before kickoff; this must populate the rows before any stats exist.
5. Recent game and current-game usage; recent snap-count percentage may help rank uncertain candidates, but last game's counts are **not** live snap counts.
6. Situation and package tendencies when available; do not pretend a formation is verified when inferred.

**Unavailable data:** hold the previous eligible selection. Missing box-score stats alone must never clear a headshot. Do not assume `questionable` means inactive; distinguish team injury designation from game-day inactive list.

## Offense

- Exactly six slots: stable QB and WR1/WR2, plus three adaptive skill positions.
- QB remains until confirmed substitution, injury/out status, or strong replacement evidence.
- WR1/WR2 start as top **eligible** receivers on the game-specific depth chart; remain stable unless unavailable or reliably replaced.
- Three adaptive positions may show RBs, WR3–WR5, TEs1–TE3, or other eligible skill players depending on real last-play information and inferred personnel package.
- Allow 00 (five WR), 01, 10, 11, 12, 21 and other packages; do not hardcode a three-WR requirement.
- RB must dynamically switch between **current-game rushing** ATT/YDS/TD and **current-game receiving** REC/YDS/TD after a confirmed rushing or receiving action. Never substitute season totals for game stats.
- For no new player/role evidence, retain the last eligible displayed dynamic player; don't flip based solely on lack of target or tackle.

## Defense

- Stable candidates include CB1, CB2, EDGE1, EDGE2, S1, LB1, with final six positions selected in context. Unlike QB, defensive anchors can rotate.
- Prioritize actual last-play credited defenders, then team-specific nickel/dime/base package tendency, eligibility and recent snap share.
- Additional LB, CB/nickel, S and EDGE players can replace other six-slot selections when supported.
- Defense stats by role from current game where present: LB tackles/TFL/sacks, EDGE sacks/QB hits/TFL, CB/S tackles/PD/INT. Use `—` for unavailable values.
- No tackle/box-score entry is **not** evidence the defender came off the field.

## Game/state behavior

- Away team on LEFT TV, home team on RIGHT TV unless manually swapped.
- A selected team's board shows its probable **offense** when in possession and probable **defense** when opponent possesses, with no change to assignments.
- Ignore kickoffs, punts, conversions, timeouts and other non-scrimmage events for last-snap personnel updates when classifications are available.
- Use ESPN's exact selected event ID; never fall back to a different team matchup.
- At kickoff or without stats: choose eligible depth-chart players and show names/headshots + dashes for statistics.
- After each new scrimmage play, add positively identified player participation; update adaptive slots as evidence supports.
- A play lacking participant IDs does not erase previous player selections.
- At game end, hold last selections until another game is manually selected.
- On feed failure, preserve prior data; avoid arbitrary blank screens and false verification labels.

## Implementation order

1. Fetch/normalize ESPN depthcharts, rosters and game-day availability for the selected team; coverage may vary for NCAA.
2. Build pure, game-specific personnel state and stable player IDs, seeded by eligible depth chart. Separate **confirmed** from **inferred** internally.
3. Read selected game's ESPN play-by-play with play IDs and participant IDs, where supplied; apply updates to dynamic slots only on new evidence.
4. Merge player headshots and current-game stats; implement dynamic RB rushing/receiving line and defensive stats.
5. Validate with recorded games across NFL and college plus an actual live game; inspect network CORS and refresh timing on TV browsers.
6. Do not promote or alter `main` until visuals and behavior are reviewed together.

## Acceptance checks

- No stats yet -> names/headshots from eligible depth chart if provider supplies it.
- WR1 officially inactive -> eligible next man is selected, not injured starter.
- No participant IDs on next play -> unchanged selected dynamic headshots.
- New verified RB reception -> same RB shown with current-game receiving totals.
- Five-WR package supported without forcing a TE or RB in the six slots.
- Last eligible lineup held on feed outage and at final.
- No changes to approved header CSS, six-player row markup, other sports, Firebase control, or existing secondary boards.

## Source reliability note

Public ESPN Site API endpoints are unofficial/unsupported interfaces, and football depth chart / injury coverage may be missing or inconsistent for some teams and college programs. Do not advertise guaranteed live personnel. No pricing or paid API requirement approved.
