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
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: "60px"
    letterSpacing: "-0.03em"
  display-lg:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "-0.02em"
  display-sm:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.02em"
  display:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  headline-mobile:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "normal"
  title:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "normal"
  title-sm:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "normal"
  body-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.05em"
  label-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.05em"
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.08em"
  data:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
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

**Creative North Star: "The Instrument Panel"**

Rate Radar looks like a calm operations console. Its instruments report honestly and never raise their voice: a rate is a reading, a confidence percentage is a gauge, and a stale feed is an indicator that has stopped moving — not an alarm. The product's core promise is that it recommends and a human decides, so the interface behaves like equipment a professional trusts precisely because it never oversells itself.

The world is built from three materials. A cool near-white canvas is the lit workspace. White cards separated by a single hairline are where readings are laid out. A deep navy is reserved for surfaces where the machine's own raw data lives — radar panels, map chrome, heat cells at the top of the ramp — and it is the only place the interface goes dark. One cobalt accent marks what the system concluded: the recommended rate, the active nav item, the "major" demand signal, the property's own pin. Everything else is ink, muted ink, and hairline. Color is a verdict, not decoration.

Density is high but never dense for its own sake. This is read by an owner at a desk, glanced at by front-desk staff mid-shift, and interrogated by a revenue manager who will not accept a number they cannot take apart — so the same screen must survive a ten-second glance and a two-minute audit. The system earns that by being ruthlessly consistent: tabular figures everywhere numbers appear, uppercase micro-labels above every reading, and rejected evidence kept on screen and dimmed rather than deleted. The most characteristic thing this design system does is show its own discarded work.

**Key Characteristics:**

- One cobalt accent used as a verdict marker, never as decoration
- Deep navy reserved exclusively for raw-data surfaces
- Flat at rest; shadow means state or z-position, never style
- Tabular figures on every number, without exception
- Uppercase 12px micro-labels as the universal reading label
- Rejected and low-confidence information dimmed and kept, never hidden
- Two typefaces only — Sora for structure, Inter for everything else

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
- **Hairline** (`#C4C6CD`): Every border and divider in the system. The primary means of separating surfaces.

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

**Display Font:** Sora (with Inter, system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)

**Character:** Sora's geometric, slightly technical letterforms give headings the feel of equipment labelling; Inter carries everything else with maximum legibility at small sizes and excellent tabular figures. The pairing is deliberately unromantic — two contemporary sans faces, no editorial flourish. Fraunces (a serif previously used for currency figures) has been retired from the system; the two-face pairing is now the whole typographic vocabulary.

### Hierarchy

The scale splits in two. **Display steps belong to the marketing and auth surfaces**, where one heading has to carry a whole viewport; they are always used as responsive pairs, small at mobile and large from `md` up. **Headline and below belong to the app**, where hierarchy has to survive next to dense data.

Marketing display (Sora, 700):

- **Display XL / LG** (56px / 60px, −0.03em → 42px / 46px, −0.02em): The landing hero, and nothing else. `text-display-lg md:text-display-xl`.
- **Display MD / SM** (38px / 46px → 32px / 38px, −0.02em): Marketing section headings. `text-display-sm md:text-display-md`.

App hierarchy:

- **Display** (Sora, 700, 36px / 44px, −0.02em): The largest in-app title. Rare.
- **Headline** (Sora, 600, 28px / 36px, −0.01em): Section and page headers inside the app. Drops to the 24px / 32px `headline-mobile` step below `md`.
- **Title** (Sora, 600, 20px / 28px): Card and panel headings, and the hero figures on dashboard stat cards.
- **Title SM** (Sora, 600, 18px / 26px): Sub-headings inside a card that already has a Title.
- **Body LG** (Inter, 400, 16px / 24px): Marketing prose and long-form reading.
- **Body** (Inter, 400, 14px / 20px): The workhorse. All reasoning text, descriptions, table content.
- **Body SM** (Inter, 400, 13px / 18px): Compact UI text — button labels, dense list rows, helper text.
- **Label** (Inter, 600, 12px / 16px, +0.05em, uppercase): The universal micro-label sitting above or beside a reading. The single most repeated typographic element in the product.
- **Label SM** (Inter, 600, 11px / 16px, +0.05em, uppercase): Chips and table column headers.
- **Micro** (Inter, 600, 10px / 14px, +0.08em, uppercase): The smallest marker in the system — timestamps under a log line, the "current property" caption. Below this, stop shrinking and cut words instead.
- **Data** (Inter, 500, 14px / 20px, −0.01em, tabular figures): Dates, rate ranges, and any figure inside a table or aligned column.

### Named Rules

**The Tabular Rule.** Every number the user might compare or scan vertically uses tabular figures (`tabular-nums`). Rates, deltas, percentages, scores, counts, dates. A column of proportional digits that shifts as values change is a defect in this system, not a nuance.

**The Micro-Label Rule.** Every reading gets an uppercase 12px label naming what it is. A number without a label is not an instrument reading — it is a mystery. This is what makes a dense screen scannable in ten seconds.

**The Two-Face Rule.** Sora for structure, Inter for content. No third typeface enters the system without replacing one of these. In particular, do not reintroduce a serif for currency: money is expressed through tabular Inter and size, not through a change of voice.

## Layout

The app sits inside a fixed 280px left rail against a Cold Daylight canvas. Below the `md` breakpoint (768px) the rail becomes an off-canvas drawer that slides in over a dismissable scrim; above it, the rail is permanent and content flows beside it.

Content is organised as a responsive bento: a 4-column grid on mobile, 8 at `md`, and 12 at `lg` (1024px), with cards spanning whole column groups rather than fractional widths. Gaps step from `md` (16px) to `lg` (24px) at the `md` breakpoint. The grid is the only layout mechanism for dashboard surfaces — cards are never absolutely positioned or floated.

Spacing follows a named 4px-based scale: `xs` 4px, `sm` 8px, `md` 16px, `gutter` 20px, `lg` 24px, `xl` 32px. Card internal padding is `md` (16px) on data-dense panels and 24px on prose or form panels. Vertical rhythm between sections is `lg` to `xl`.

Tables scroll horizontally inside their own container and never cause the page to scroll sideways. On dense data screens, density is a feature: a revenue manager wants everything visible at once, so resist adding whitespace that pushes rows below the fold.

### Named Rules

**The Grid-Only Rule.** Dashboard content lives in the 4/8/12 grid. If a layout needs an element to escape the grid, the layout is wrong.

## Elevation & Depth

**Surfaces are flat at rest.** Depth comes from the hairline border and from tonal layering — Cold Daylight canvas, Surface White cards, Instrument Navy data panels. A shadow is never a style; it means one of exactly two things: the element is responding to interaction, or it is genuinely floating above the page.

Every shadow is tinted with Instrument Navy (`rgba(11, 28, 48, …)`), never neutral black. This keeps depth in the same cool key as the rest of the palette and is what stops the interface from looking like a generic admin panel.

### Shadow Vocabulary

- **Hover lift** (`box-shadow: 0 4px 12px rgba(11, 28, 48, 0.05)`): Appears on interactive cards on hover, alongside a `scale(1.02)` on stat cards. The card is flat until touched.
- **Overlay small** (`box-shadow: 0 8px 24px rgba(11, 28, 48, 0.08)`): Dropdowns, popovers, the property switcher, map tooltips.
- **Overlay large** (`box-shadow: 0 24px 60px -20px rgba(11, 28, 48, 0.45)`): The mobile navigation drawer and any full modal.
- **Focus ring** (`box-shadow: 0 0 0 2px rgba(8, 90, 192, 0.20)` plus a Signal Cobalt border): Keyboard and input focus. Focus is the one state allowed to use color and elevation simultaneously.

### Named Rules

**The Flat-At-Rest Rule.** If an element has a shadow and the user is not interacting with it and it is not floating above the page, delete the shadow. Resting elevation is expressed with the hairline border alone.

**The Navy Tint Rule.** No shadow in this system uses black. Every value is `rgba(11, 28, 48, α)`. A `rgba(0,0,0,…)` shadow is a defect.

## Shapes

The form language is softly squared, not pill-shaped — with one loud exception.

Radii step: `sm` 4px for small inline elements (heat cells, tooltips, date pills), `md` 8px for the default surface (cards, inputs, panels, buttons' container), `lg` 12px and `xl` 16px for large feature cards and hero panels. **Buttons and chips are fully rounded** (`9999px`), and that contrast is deliberate: interactive controls and status markers are visibly a different species from the rectangular surfaces that hold data.

Borders are always 1px Hairline. There is no 2px border anywhere in the resting system, and no colored side-tab accent — a thick colored edge on one side of a card is explicitly outside this language.

Circular geometry belongs to identity and location: avatars, map pins, the property badge, the radar mark's concentric arcs.

### Named Rules

**The Pill-Or-Panel Rule.** If it can be clicked or it reports a status, it is fully rounded. If it holds data, it is 8px. There is no in-between and no per-component improvisation.

## Components

Components are **quietly tactile**: restrained but responsive. They acknowledge being touched without becoming playful — a hair of press scale, a 150ms color shift, a 4px nav nudge. Nothing bounces, nothing celebrates.

### Buttons

- **Shape:** Fully rounded pill (`9999px`), 1px Hairline border, `8px 16px` padding, 14px Inter at weight 600.
- **Secondary (default):** Surface White fill, Ink text, Hairline border. Hovers to Cold Daylight.
- **Primary:** Signal Cobalt fill and border, white text. Hovers to Signal Cobalt Deep.
- **Small:** `6px 12px` padding, 12px text. Used inside tables and card headers.
- **States:** Color, background and border transition over 150ms ease; transform over 140ms `cubic-bezier(0, 0, 0.2, 1)`. Pressing scales to `0.97` — deliberately subtle, because these buttons are pressed often and anything larger reads as sluggish. Disabled buttons drop to 50% opacity and **do not move on press** — they did not hear anything. Under reduced-motion the press scale softens to `0.99` rather than disappearing.

### Chips

- **Style:** Fully rounded, `1px 10px` padding, 11px uppercase bold with wide tracking, 1px border in the current text color.
- **Status tones:** OK, Warn, Bad and Neutral, each as colored text on a 5% tint of the same color.
- **Demand signal chips** are the system's signature status marker and encode score bands: `major` (≥70) is a solid Signal Cobalt fill with white text; `meaningful` (≥40) is Signal Cobalt Wash with cobalt text and no border; `minor` (≥15) is a 10% ink tint; `quiet` (<15) is a **dashed** border with muted text and no fill.
- **The dashed border means "nothing here, honestly."** It also marks the `sample data` badge — a chip that exists solely to admit a panel is not wired to a live feed.

### Cards / Containers

- **Corner style:** 8px (`rounded-lg`); 12px on large feature panels.
- **Background:** Surface White on the Cold Daylight canvas; Instrument Navy when the card contains raw machine data.
- **Border:** 1px Hairline, always.
- **Shadow strategy:** None at rest. Interactive cards gain the hover-lift shadow over 300ms; stat cards additionally scale to `1.02`.
- **Internal padding:** 16px on data panels, 24px on prose and form panels.

### Inputs / Fields

- **Style:** Surface White fill, 1px Hairline border, 8px radius, `10px 14px` padding, 14px Ink text.
- **Focus:** Border shifts to Signal Cobalt with a 2px cobalt ring at 20% opacity. No outline, no glow.
- **Labels:** Sit above the field, 14px weight 600, 6px gap.

### Navigation

- **Rail:** 280px, Surface White, 1px Hairline right edge, brand block at top, then the property switcher, then icon-and-label links.
- **Links:** 14px, `md` gap between icon and label, `md`/`sm` padding. Inactive links are Ink Muted and hover to a Cold Daylight fill with Ink text. Active links are Signal Cobalt on a 10% cobalt tint.
- **Motion:** Links nudge 4px right on hover over 200ms; suppressed under reduced-motion.
- **Mobile:** Below `md`, the rail slides off-canvas and returns over 300ms on `cubic-bezier(0.32, 0.72, 0, 1)` — fast out of the gate, long settle. A 280px drawer travelling in Tailwind's default 150ms reads as a glitch rather than a movement. Reduced-motion shortens it to 150ms. The drawer is always dismissable by its scrim.
- **Icons:** Material Symbols Outlined, variable `FILL` axis; filled for active, outlined for inactive.

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

- **Do** give every number tabular figures and an uppercase 12px label above it.
- **Do** keep surfaces flat at rest and let the 1px Hairline border do the separating.
- **Do** tint every shadow with Instrument Navy (`rgba(11, 28, 48, α)`).
- **Do** reserve Signal Cobalt for the system's conclusions — the recommended rate, the active location, the user's own property.
- **Do** reserve Instrument Navy for surfaces displaying raw collector data.
- **Do** render rejected, low-confidence, and unavailable information in Ink Muted and leave it on screen.
- **Do** use State Warn for honest limitations ("needs manual check", stale data) and State Bad only for actual breakage.
- **Do** make controls and status markers fully rounded, and data surfaces 8px.
- **Do** suppress transforms under `prefers-reduced-motion` while keeping content visible — entry animations reset opacity to 1 rather than leaving the page blank.

### Don't:

- **Don't** put a thick colored border on one side of a card. No `border-l-4` accent tabs — the most recognizable tell of a generated interface, and outside this form language entirely.
- **Don't** use bounce or elastic easing (`cubic-bezier(0.34, 1.56, 0.64, 1)` and relatives). Real instruments decelerate smoothly; use exponential ease-out.
- **Don't** reintroduce a serif, Fraunces included. Money is expressed through tabular Inter and size, not a change of voice.
- **Don't** use black shadows, gradient text, glowing cards, or purple-to-blue washes.
- **Don't** build toward dense BI/analyst tooling — no wall of widgets, no chart junk, no configuration surfaced as interface. This is for an operator, not an analyst.
- **Don't** adopt consumer-fintech playfulness: no confetti, mascots, streaks, celebratory microcopy, or oversized rounded cards. Someone's revenue is on the line.
- **Don't** let the palette drift to undifferentiated enterprise grey. The navy data surfaces and the heat ramps are what keep this from becoming an anonymous admin panel.
- **Don't** import the external design system's `borderRadius` scale — it redefines `full` as 0.75rem and would turn every avatar, pill and chip into a squircle app-wide. Radii are set at the call site.
- **Don't** wire dark mode to `prefers-color-scheme`. Night mode is opt-in via a `dark` class on `<html>`; the dashboard is specified as a light surface and must not silently repalette on someone's OS setting.
