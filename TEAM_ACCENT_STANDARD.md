# MAN CAVE SPORTS BOOK — LEFT RIGHT
## Locked team-color accent standard
Date: November 14, 2026
Status: User-approved global portrait-board styling rule; implemented in production `team-board.html`.

**Applies to all seven sports:** NFL, NBA, NHL, MLB, WNBA, NCAA football, NCAA basketball.

### Visual scope
- Keep the approved 9:16 portrait board structure, top scoreboard, typography, team logo placement, player rows, and game-specific statistics **exactly unchanged**.
- Only apply the selected team's accent to existing CSS variable `--accent`. It colors the existing scoreboard underline, section band borders, player-stat divider, and any existing sport graphics that inherit that variable.
- LEFT uses its selected team; RIGHT uses its own selected team. Home/away is not itself a color rule.
- No independent league-wide green, red, or orange accents.

### Color selection
1. Use valid hex `match.team.color` from the selected ESPN event if contrast against black is at least 3.5:1.
2. Otherwise use `match.team.alternateColor` if it passes.
3. Otherwise use the documented known-team fallback map (Broncos, Celtics, Bruins, Red Sox, Fever, Arizona Wildcats, Indiana Pacers).
4. If all available official colors are too dark, lighten the selected team's own color enough to make the existing 1–3px accents visible.
5. If no valid team color is available, use **neutral silver** (#AEB8C5) rather than invent another team's color.

Never choose the opponent's color for a board. Never confuse sports-league colors with team colors.

### Release guard
- Keep all preview-only NFL/NHL player-personnel experiments isolated until separate approval for their engines.
- Never alter locked portrait CSS or player selection logic as part of a color-only change.
- Existing Firebase LEFT/RIGHT control messages, Game Wall design, and upcoming/live external board URLs remain unchanged.
- The approved fallback colors are used only when ESPN has not supplied a readable color.

### Production implementation
`team-board.html` contains the `normalizeAccent`, `accentContrast`, `lightenedAccent`, and `teamAccent` helpers and invokes `teamAccent(match.team)` from the shared `setHeader(match)` function. Every one of the seven live board sports calls this shared header function from its own existing ESPN summary processing path.
