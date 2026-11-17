# Brand kit

`rate-radar-brandkit.png` is a 3×3 overview of the Rate Radar identity: mark, mark construction, the live site, the promise, color, type, a front-desk printout, image direction and system parts. The rules behind it live in [DESIGN.md](../../DESIGN.md); this board only shows them. `site.png` is a screenshot of the landing page.

**The type is out of date.** The product moved from Geist to IBM Plex Sans and Plex Mono on 2026-09-30. This board, `site.png` and the dark-mode mockup predate that and still show Geist; DESIGN.md is current. The board's HTML source and the Geist fonts were removed; recover them from git history if the board ever needs re-rendering.

Every figure on the board is sample data from the invented demo hotel (`lib/demo.ts`).

## Exploration: dark mode

`dark-mode/` holds the landing page in dark, keeping the current navy and cobalt theme. It is a mockup: the live page was recolored in the browser from the app's own `.dark` tokens in `app/globals.css`, and no source file was changed. Page `#0A121E`, cards `#131B2E`, data panels a bluer `#0D1E34` so they stay distinct from cards, text `#F0F0F7`, muted `#9BA4B4`. Cobalt stays the fill on buttons and chips; as text it becomes `#ADC6FF`, because cobalt text on navy fails contrast. State colors take their dark versions (`#67DCA8`, `#FBBF24`, `#FFB4AB`).
