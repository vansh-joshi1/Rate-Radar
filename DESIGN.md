---
name: Rate Radar
description: Revenue management for independent hotels — recommends nightly rates, a human decides.
colors:
  signal-cobalt: "#085AC0"
  signal-cobalt-deep: "#06489C"
  signal-cobalt-wash: "#E5EEFF"
  instrument-navy: "#0B1C30"
  cold-daylight: "#F8F9FF"
  surface-white: "#FFFFFF"
  ink: "#1A1B20"
  ink-muted: "#44474D"
  hairline: "#C4C6CD"
  state-ok: "#029768"
  state-warn: "#B45309"
  state-bad: "#BA1A1A"
  heat-1: "#D3E4FE"
  heat-2: "#D8E2FF"
  heat-3: "#085AC0"
  heat-4: "#131B2E"
  level-low: "#84F9C3"
  level-mid: "#ADC6FF"
  level-high: "#FFDAD6"
typography:
  display-xl:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: "60px"
    letterSpacing: "-0.03em"
  display-lg:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "-0.02em"
  display-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.02em"
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  headline-mobile:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "normal"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "normal"
  title-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "normal"
  body-lg:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.05em"
  label-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.05em"
  micro:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.08em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  shell: "2rem"
  core: "calc(2rem - 0.375rem)"
  well: "1.25rem"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.cold-daylight}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.signal-cobalt}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.signal-cobalt-deep}"
    textColor: "{colors.surface-white}"
  button-small:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  chip:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "1px 10px"
  chip-demand-major:
    backgroundColor: "{colors.signal-cobalt}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.full}"
    padding: "1px 10px"
  chip-demand-meaningful:
    backgroundColor: "{colors.signal-cobalt-wash}"
    textColor: "{colors.signal-cobalt}"
    rounded: "{rounded.full}"
    padding: "1px 10px"
  table-header:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "8px 12px"
  table-cell:
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    padding: "10px 12px"
---

# Design System: Rate Radar

## Overview

**Creative North Star: "The Machined Instrument"**

Rate Radar looks like a piece of calm, precisely machined equipment. Its instruments report honestly and never raise their voice: a rate is a reading, a confidence percentage is a gauge, and a stale feed is an indicator that has stopped moving, not an alarm. The product's core promise is that it recommends and a human decides, so the interface behaves like equipment a professional trusts precisely because it never oversells itself. Quality shows in the fit and finish, not in volume.

The world is built from three materials. A cold near-white canvas is the lit bench. Panels sit on it the way a glass plate sits in an aluminium tray: a **double-bezel enclosure**, a faintly tinted outer shell holding a white core with its own inner highlight, lifted off the bench by one soft, navy-tinted ambient shadow. A deep navy is reserved for cores where the machine's own raw data lives (radar panels, parity readouts, the scoring pipeline, heat cells at the top of the ramp), and it is the only place the interface goes dark. One cobalt accent marks what the system concluded: the recommended rate, where you are, the "major" demand signal, the property's own pin. Everything else is ink, muted ink, and tinted air. Color is a verdict, not decoration.

The same screen must survive a ten-second glance and a two-minute audit. It is read by an owner at a desk, glanced at by front-desk staff mid-shift, and interrogated by a revenue manager who will not accept a number they cannot take apart. The system earns that by being ruthlessly consistent: tabular figures everywhere numbers appear, a Geist Mono label on every reading, and rejected evidence kept on screen and dimmed rather than deleted. The most characteristic thing this design system does is show its own discarded work.

**Key Characteristics:**

- One cobalt accent used as a verdict marker, never as decoration
- Deep navy reserved exclusively for raw-data cores
- Double-bezel frames only around instruments and plans; everything else sits open on the canvas
- One family: Geist for everything, Geist Mono for readings and labels
- Tabular figures on every number, without exception
- Pills for everything you can press or that reports a status; squircles for everything that holds data
- Spring motion on one curve, `cubic-bezier(0.32, 0.72, 0, 1)`
- Rejected and low-confidence information dimmed and kept, never hidden

### Migration status

The marketing surface (`app/page.tsx`, `app/not-found.tsx` and `components/landing/*`) and the sign-in / get-access screens (`components/AuthPanes.tsx`) are on this language today. The logged-in app still renders the previous "Instrument Panel" treatment: Sora + Inter, 1px Hairline borders, flat panels, 8px radii, Material Symbols. Migrate it page by page. Until a page migrates, its old treatment is expected, not a defect. The palette and every Named Rule under Colors apply to both, and nothing here changes a data component's behaviour.

## Colors

A cool, instrumented palette: one saturated cobalt against near-neutral greys with a blue cast, plus a deep navy that appears only where machine data is displayed.

### Primary

- **Signal Cobalt** (`#085AC0`): The verdict color. It marks the recommended rate, the active navigation item, the property's own pin on maps, the "major" demand chip, focus rings, and primary buttons. It is the answer to "where did the system land?" — which is why it appears sparingly.
- **Signal Cobalt Deep** (`#06489C`): The pressed and hovered state of anything filled with Signal Cobalt. Never used as a resting fill on its own.
- **Signal Cobalt Wash** (`#E5EEFF`): A tinted surface for cobalt-family emphasis that must not shout — the "meaningful" demand chip, selected rows, the active nav item's background.

### Secondary

- **Instrument Navy** (`#0B1C30`): Raw-data surfaces only. Radar panels, dark stat fills, map basemap chrome, and the top of the heat ramp. When this color appears, the user is looking at the machine's own readings rather than the product's interpretation of them. It is also the tint used in every shadow.

### Neutral

- **Cold Daylight** (`#F8F9FF`): The page canvas — a near-white with a deliberate blue cast so white cards read as objects sitting on a lit surface rather than as the page itself.
- **Surface White** (`#FFFFFF`): Every card, panel, input, and secondary button.
- **Ink** (`#1A1B20`): Primary text and all figures.
- **Ink Muted** (`#44474D`): Labels, secondary text, captions, and dimmed reasoning lines. Chosen dark enough to remain readable on a shared front-desk screen — it is a de-emphasis, not a fade-out.
- **Hairline** (`#C4C6CD`): The app's border and divider color until it migrates. Migrated surfaces do not draw grey hairlines (see The No-Grey-Hairline Rule); they separate with navy-tinted rings and dividers.

### Tertiary

Two ramps carry quantitative meaning and must never be used decoratively.

- **Heat ramp** (`#D3E4FE` → `#D8E2FF` → `#085AC0` → `#131B2E`): Demand and occupancy intensity, low to high. Steps 3 and 4 are dark enough to require white text.
- **Price-level dots** (`level-low #84F9C3`, `level-mid #ADC6FF`, `level-high #FFDAD6`): Relative price position on the watchlist grid.

### State

- **State OK** (`#029768`): Healthy sources, confidence fills, positive deltas.
- **State Warn** (`#B45309`): Stale data, degraded sources, "needs manual check". A warning, never a failure.
- **State Bad** (`#BA1A1A`): Genuine breakage only — a failed source, a destructive action.

### Named Rules

**The Verdict Rule.** Signal Cobalt marks conclusions, not surfaces. If an element is not the system's answer, the active location, or the user's own property, it is not cobalt. Audit test: on any screen, cobalt should cover well under 10% of the pixels, and you should be able to say in one sentence what each cobalt element concluded.

**The Navy Is Data Rule.** Instrument Navy appears only where raw machine readings are displayed. It is never a decorative dark section, never a hero background, never a footer. If a navy surface does not contain data the collector produced, it is wrong.

**The Warn-Not-Fail Rule.** "Needs manual check", "too small to matter", and stale data are truthful states and take State Warn or Ink Muted — never State Bad. Red is reserved for something that is actually broken. A product that cries failure at its own honest limitations teaches users to distrust it.

## Typography

**Family:** Geist (sans) and Geist Mono, self-hosted through `next/font` from the `geist` package. Pages opt in by putting `GeistSans.variable` and `GeistMono.variable` on their root and using `font-geist` / `font-geist-mono` (tailwind.config.ts).

**Character:** Geist is a precise, contemporary grotesk. It reads like an engraved equipment label at display sizes and stays neutral at 14px. Geist Mono carries every machine reading, so a label or a figure looks like it came off an instrument, not out of a sentence. The pairing is deliberately unromantic: one family, two cuts, no editorial flourish.

### Hierarchy (marketing surface)

Display type is set heavy and tight: weight 600, `tracking-tighter`, leading close to 1. Always a responsive pair, small at mobile and large from `md` up.

- **Hero** (44px → 68px, leading 1.02): the landing's H1, and nothing else.
- **Statement** (48px → 88px, leading 1): the single product-promise line, "It recommends. You decide." Nothing else gets this size.
- **Section** (36px → 52px, leading 1.05): section headings.
- **Panel title** (22–24px, weight 600, `tracking-tight`): headings inside an enclosure.
- **Lead** (17px, `leading-relaxed`, max 56ch): the paragraph under a section heading.
- **Body** (14.5px, `leading-relaxed`): panel copy, reasoning lines, list rows.
- **Figure** (34–72px, weight 600, `tracking-tighter`, tabular): the rate itself.
- **Mono label** (Geist Mono, 11.5–12px, sentence case): the name of a reading, sitting above it.
- **Chip** (Geist, 12px, weight 500, sentence case, pill): status markers.
- **Eyebrow** (15px, weight 500, muted, plain text): the hero only. No pill, no caps. A label over every heading is a template tell.

### App hierarchy (until migrated)

The app keeps its token steps (`text-headline-*`, `text-body-*`, `text-label-*`, `text-micro`, `text-data-mono`) in Sora + Inter. When a page migrates, it swaps the family and keeps the steps.

### Named Rules

**The Tabular Rule.** Every number the user might compare or scan vertically uses tabular figures (`tabular-nums`). Rates, deltas, percentages, scores, counts, dates. A column of proportional digits that shifts as values change is a defect in this system, not a nuance.

**The Mono Label Rule.** Every reading gets a Geist Mono label, in sentence case, naming what it is. All-caps micro text is not part of this language. A number without a label is not an instrument reading; it is a mystery. This is what makes a dense screen scannable in ten seconds.

**The One-Family Rule.** Geist for structure and content, Geist Mono for readings. No third typeface, and no serif for currency: money is expressed through tabular Geist and size, not through a change of voice. Inter, Roboto, Arial, Open Sans and Helvetica do not enter new or migrated surfaces.

**The Heavy-Not-Loud Rule.** Hierarchy comes from weight, tight tracking and size together. Display type never goes above weight 600; a bolder face would shout.

## Layout

The app sits inside a fixed 280px left rail against a Cold Daylight canvas. Below the `md` breakpoint (768px) the rail becomes an off-canvas drawer that slides in over a dismissable scrim; above it, the rail is permanent and content flows beside it.

Content is organised as a responsive bento: a 4-column grid on mobile, 8 at `md`, and 12 at `lg` (1024px), with cards spanning whole column groups rather than fractional widths. Gaps step from `md` (16px) to `lg` (24px) at the `md` breakpoint. The grid is the only layout mechanism for dashboard surfaces — cards are never absolutely positioned or floated.

Spacing follows a named 4px-based scale: `xs` 4px, `sm` 8px, `md` 16px, `gutter` 20px, `lg` 24px, `xl` 32px. Card internal padding is `md` (16px) on data-dense panels and 24px on prose or form panels. Vertical rhythm between sections is `lg` to `xl`.

**Marketing surface:** content sits in a 1200px container with a 16px gutter on phones and 24px from `md`. Sections breathe: 96px of vertical space at mobile, 160px from `md` (`py-24` / `md:py-40`). The hero clears the floating nav with 128px → 176px of top padding. Every multi-column layout collapses to a single `grid-cols-1` column below its breakpoint, and grids always declare their columns so a wide child can never push the page sideways.

Tables scroll horizontally inside their own container and never cause the page to scroll sideways. On dense data screens, density is a feature: a revenue manager wants everything visible at once, so resist adding whitespace that pushes rows below the fold.

### Named Rules

**The Grid-Only Rule.** Dashboard content lives in the 4/8/12 grid. If a layout needs an element to escape the grid, the layout is wrong.

## Elevation & Depth

**Surfaces have depth at rest, and it is machined, not floated.** Every major panel is a double-bezel enclosure (`Bezel` in `components/landing/Machined.tsx`):

- **Outer shell:** Instrument Navy at 3.5% as a tray, a navy ring at 5%, `p-1.5`, radius 2rem, and one ambient shadow `0 32px 64px -32px rgba(11, 28, 48, 0.22)`.
- **Inner core:** white (or Instrument Navy for data), radius `calc(2rem - 0.375rem)` so the curves stay concentric, with an inner top highlight: `inset 0 1px 1px rgba(255, 255, 255, 1)` on white and `… 0.12)` on navy.
- **Wells:** an area inside a core that holds a live instrument (the radar surface, the confidence gauge) is recessed one more step, with its own smaller radius and a faint tint or inset highlight.

### Shadow Vocabulary

- **Ambient** (`0 32px 64px -32px rgba(11, 28, 48, 0.22)`): the bezel's lift. One per enclosure, never stacked.
- **Island** (`0 12px 40px -16px rgba(11, 28, 48, 0.22)`): the floating nav pill.
- **Readout** (`0 16px 32px -16px rgba(5, 12, 24, 0.55)`): a white readout floating over a navy data surface.
- **Focus ring** (2px Signal Cobalt at 40%, offset from the element): keyboard focus. Focus is the one state allowed to use color and depth together.

### Named Rules

**The Navy Tint Rule.** No shadow in this system uses black. Every value is navy-tinted `rgba(11, 28, 48, α)`, or a deeper navy over a navy surface. A `rgba(0,0,0,…)` shadow is a defect.

**The No-Grey-Hairline Rule.** There is no 1px solid grey border in the language. Separation comes from the bezel, from navy rings at 8% or less, and from dividers tinted navy at about 6%. No dashed or dotted borders either. "Nothing here, honestly" is said with a quiet navy tint (about 5%) and muted text instead.

**The Blur-Is-Fixed Rule.** `backdrop-blur` belongs to fixed layers only (the island nav, the phone menu). Scrolling content never blurs its backdrop.

**The Background-Is-Instrument Rule.** The marketing canvas is not plain white and not decoration either. It carries the radar panel's own dot grid at ~7% navy, a fixed 3.5% grain layer (fixed only, never on a scrolling element), and, behind the hero, concentric range rings with one slow sweep in navy at 5 to 14%, echoed by a smaller, still set of rings behind the closing call to action so the page ends the way it began. Never cobalt, never a blob or gradient wash: the background concludes nothing. Components: `components/landing/Backdrop.tsx`.

## Shapes

The form language is squircle and pill. Radii step down as you go inward, and every nested pair is concentric.

- **Shell** 2rem, **core** `calc(2rem - 0.375rem)`: every enclosure.
- **Well** 1.25rem (radar surface) or 1rem (gauge well): instruments recessed inside a core.
- **Cell** 0.5rem: heat cells and small data tiles.
- **Pill** `9999px`: buttons, chips, the nav.

Circular geometry still belongs to identity and location: avatars, map pins, the property badge, the radar mark's concentric arcs.

### Named Rules

**The Pill-Or-Panel Rule.** If it can be pressed or it reports a status, it is a pill. If it holds data, it is a squircle panel. There is no in-between and no per-component improvisation.

**The Concentric Rule.** An inner radius is its outer radius minus the padding between them. Two curves that don't share a centre read as a manufacturing fault.

## Components

Components are **quietly tactile**: restrained but responsive. They acknowledge being touched without becoming playful — a hair of press scale, a 150ms color shift, a 4px nav nudge. Nothing bounces, nothing celebrates.

### Buttons

- **Shape:** a pill, `py-1.5 pl-6 pr-1.5`, 15px Geist weight 500 (`PillCta` in `components/landing/Machined.tsx`).
- **Button-in-button:** the trailing arrow (Phosphor `ArrowUpRight`, light weight) never sits naked beside the label. It lives in its own 36px circle, flush with the right padding: white at 15% on primary, navy at 5% on secondary.
- **Primary:** Signal Cobalt fill, white text; hovers to Signal Cobalt Deep.
- **Secondary:** white, navy ring at 8%, navy text; hovers to a cool tint.
- **Small:** `py-1 pl-4 pr-1`, 13px, 28px circle. Used in the nav.
- **States:** on hover the circle nudges 4px right, 1px up and scales to 1.05; on press the pill scales to 0.98. Everything moves on the spring curve over 500ms. Under reduced motion transitions are off; the press still registers.
- **Text links:** muted ink that darkens on hover, with the same focus ring as buttons. Inline links carry a navy-20% underline.

### Chips

- **Style (migrated surfaces):** fully rounded, `2px 10px` padding, 12px Geist weight 500 in sentence case, a tinted fill or a solid 40% ring in the current text color. The app keeps its 11px uppercase chips until it migrates.
- **Status tones:** OK, Warn, Bad and Neutral, each as colored text on a 5% tint of the same color.
- **Demand signal chips** are the system's signature status marker and encode score bands: `major` (≥70) is a solid Signal Cobalt fill with white text; `meaningful` (≥40) is Signal Cobalt Wash with cobalt text and no border; `minor` (≥15) is a 10% ink tint; `quiet` (<15) is a 4–5% navy tint with muted text and no border.
- **The quiet tint means "nothing here, honestly."** Muted text on a ~5% navy fill marks too-small-to-matter lines, quiet nights and the `sample data` badge, a chip that exists solely to admit a panel is not wired to a live feed. "Needs manual check" is State Warn text inside a solid 40% warn ring. No dashed or dotted borders anywhere.

### Enclosures (formerly Cards)

- **Frame instruments, not prose.** A Bezel goes around a live instrument (the radar, a data panel, the scoring pipeline) or a plan you can buy. Headings, lists, the closing call to action and the footer sit open on the canvas, separated by space and a tinted divider. Never a box inside a box inside a box: inside a Bezel, sub-areas are split by a divider, not wrapped again. `tone="data"` (navy core) only when every reading inside came from the collector.
- **Internal padding:** 28–40px (`p-7` to `p-10`) on marketing panels; data rows inside keep their own rhythm (`py-3`).
- **Dividers:** navy at 6% on light cores, white at 8% on navy cores. Never a grey hairline.
- **Grouping:** an asymmetric bento. A 7/5 split over a full-width row, never three equal columns.

### Inputs / Fields

- **Style:** Surface White fill, 1px Hairline border, 8px radius, `10px 14px` padding, 14px Ink text.
- **Focus:** Border shifts to Signal Cobalt with a 2px cobalt ring at 20% opacity. No outline, no glow.
- **Labels:** Sit above the field, 14px weight 600, 6px gap.
- **Migrated surfaces (sign-in):** the field is a pill like the buttons beside it: 48px tall, white, a navy ring at 12% with a faint inset shadow, 15px text. Focus is a 2px cobalt ring at 60%; a refused value turns the ring State Warn and puts the reason directly below the field in State Warn text. Labels are 14px weight 500, inset to line up with the text inside the pill.

### Navigation

- **Marketing: the island.** A glass pill floating 16px below the top edge (`fixed`, `w-max` from `md`, white at 70%, `backdrop-blur-xl`, navy ring 6%, Island shadow). It holds the mark, the section links, Sign in and the small primary CTA. The section currently under the middle of the viewport reads in Signal Cobalt (scroll-spy by IntersectionObserver, never a scroll listener).
- **Marketing, phone:** the island shrinks to the mark and a hamburger. Its two lines rotate about their shared centre into an X. The menu is a screen-filling glass layer (white at 80%, `backdrop-blur-3xl`) whose links rise 48px out of clipped boxes with a 50ms stagger. Escape closes it, focus moves in, and the page behind stops scrolling.
- **Layers:** phone menu z-30 < island z-40 < skip link z-50. Nothing else takes a z-index on the marketing surface.
- **App (until migrated):** the 280px rail with a Hairline right edge, the property switcher and icon-and-label links. Active links are Signal Cobalt on a 10% cobalt tint; the rail becomes an off-canvas drawer below `md` on `cubic-bezier(0.32, 0.72, 0, 1)` over 300ms. Icons are Material Symbols Outlined until the app migrates to Phosphor Light.

### Motion

- **One curve:** `cubic-bezier(0.32, 0.72, 0, 1)`, fast out of the gate with a long settle. No `ease-in-out`, no bounce, and no `linear` except for constant motion: the hero radar sweep (one turn every 18s) is linear because any ease would read as a stutter once per turn.
- **Durations:** 500ms for hover and press, 700–900ms for arrivals.
- **Scroll arrivals:** 4rem of rise, 12px of blur resolving to sharp, opacity 0 to 1, over 900ms (`.reveal` in globals.css, driven by `components/Reveal.tsx`). Children stagger by 30–120ms.
- **Only transform, opacity and a one-shot filter** animate. Never width, height, top or left.
- **Reduced motion:** every arrival lands instantly and fully visible; the radar sweep stops; drag stays 1:1 because that motion is the user's own.

### Data Tables

- **Header:** 11px uppercase, weight 600, widest tracking, Ink Muted, 1px Hairline bottom rule.
- **Cells:** 14px, top-aligned, tabular figures, 1px Hairline bottom rule, `10px 12px` padding.
- **No zebra striping.** Row separation is the hairline alone.

### Reasoning Card (signature)

The component that makes the product's promise visible, and the one to preserve most carefully. A standard 8px card splits into a two-column grid at `md` (1.5fr / 1fr): a bulleted list of the scoring's actual working on the left, a confidence gauge on the right.

- Bullets use a cobalt `•` set via a pseudo-element at a 20px indent.
- **Lines the scorer rejected are rendered in Ink Muted rather than removed.** Showing what was considered and discarded is the entire point of the component.
- The confidence gauge is a fully rounded 8px-tall track at 10% ink, filled with State OK to the confidence percentage, with the percentage in tabular figures above it and its basis in 12px muted text below.
- It closes with a permanent muted line: that Rate Radar never changes a price anywhere.

### Brand Mark

A radar sweep drawn as inline SVG on a 24px viewbox: two concentric arcs opening to the upper right, a sweep line to the corner, and a filled 1.2px center dot. Stroked in `currentColor` at 1.75 weight so it inherits from context. Shared by the marketing landing and the auth screens so the two cannot drift apart.

## Do's and Don'ts

### Do:

- **Do** give every number tabular figures and a Geist Mono label above it.
- **Do** frame instruments and plans in a double-bezel with concentric radii, and leave everything else open.
- **Do** tint every shadow with Instrument Navy, and give each enclosure exactly one.
- **Do** reserve Signal Cobalt for the system's conclusions: the recommended rate, where you are, the user's own property.
- **Do** reserve Instrument Navy for cores displaying raw collector data.
- **Do** render rejected, low-confidence and unavailable information in Ink Muted and leave it on screen.
- **Do** use State Warn for honest limitations ("needs manual check", stale data) and State Bad only for actual breakage.
- **Do** put the arrow of a CTA in its own circle.
- **Do** keep content visible under `prefers-reduced-motion`: arrivals land in place rather than leaving the page blank.

### Don't:

- **Don't** use a 1px solid grey border to separate anything. Use the bezel, a tinted ring or a tinted divider.
- **Don't** put a thick colored border on one side of a card. No `border-l-4` accent tabs.
- **Don't** use bounce, elastic, `linear` or `ease-in-out` easing. Instruments decelerate; use the spring curve.
- **Don't** reintroduce a serif or a third typeface.
- **Don't** use black shadows, gradient text, glowing cards, neon, or purple-to-blue washes.
- **Don't** blur the backdrop of anything that scrolls.
- **Don't** build toward dense BI/analyst tooling: no wall of widgets, no chart junk, no configuration surfaced as interface. This is for an operator, not an analyst.
- **Don't** adopt consumer-fintech playfulness: no confetti, mascots, streaks or celebratory microcopy. Someone's revenue is on the line.
- **Don't** import an external design system's `borderRadius` scale. It redefines `full` and would turn every avatar, pill and chip into a squircle app-wide. Radii are set at the call site.
- **Don't** wire dark mode to `prefers-color-scheme`. Night mode is opt-in via a `dark` class on `<html>`.

