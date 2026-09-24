# Brand kit

`rate-radar-brandkit.png` is a 3×3 overview of the Rate Radar identity: mark, mark construction, the live site, the promise, color, type, a front-desk printout, image direction and system parts. The rules behind it live in [DESIGN.md](../../DESIGN.md); this board only shows them.

It is rendered from `board.html`, which is plain HTML and CSS using the self-hosted Geist fonts in this folder (SIL Open Font License, see `GEIST-LICENSE.txt`). `site.png` is a screenshot of the landing page.

To re-render after editing `board.html`, run this from the repo root in Git Bash on Windows (the path conversion and the encoded space matter; a plain `$(pwd)` renders an error page):

```bash
R="$(cygpath -m "$PWD")"; "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --hide-scrollbars --allow-file-access-from-files --window-size=1920,1200 --virtual-time-budget=3000 --screenshot="$R/docs/brand/rate-radar-brandkit.png" "file:///${R// /%20}/docs/brand/board.html"
```

Any Chromium browser works the same way. Refresh `site.png` when the landing page changes.

Every figure on the board is sample data from the invented demo hotel (`lib/demo.ts`).

## Exploration: warm charcoal

`rate-radar-brandkit-warm-charcoal.png` (from `board-warm-charcoal.html`) is a proposal, not the current system. It swaps Instrument Navy for Warm Charcoal `#1F1D1A`, warms every neutral to match (Daylight `#F6F6F4`, muted `#4A4843`), and replaces the pale blue used on dark panels with Stone `#C9C3B8`, which leaves Signal Cobalt as the only blue. Charcoal and ink collapse into one color. `site-warm-charcoal.png` is the live landing recolored in the browser to this palette; no source file was changed to make it.

## Exploration: dark mode

`dark-mode/` holds the landing page in dark, keeping the current navy and cobalt theme. It is a mockup: the live page was recolored in the browser from the app's own `.dark` tokens in `app/globals.css`, and no source file was changed. Page `#0A121E`, cards `#131B2E`, data panels a bluer `#0D1E34` so they stay distinct from cards, text `#F0F0F7`, muted `#9BA4B4`. Cobalt stays the fill on buttons and chips; as text it becomes `#ADC6FF`, because cobalt text on navy fails contrast. State colors take their dark versions (`#67DCA8`, `#FBBF24`, `#FFB4AB`).
