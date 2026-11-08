---
name: Canary Cage for MCP
description: A documentary record that is also the live console. Paper ground, white panels, hairline rules, IBM Plex.
colors:
  paper: "#F5F4EF"
  surface: "#FFFFFF"
  ink: "#16181A"
  ink-2: "#4A4C48"
  ink-3: "#6B6D66"
  rule: "#D9D6CD"
  rule-2: "#E8E6DF"
  red: "#B3261E"
  red-bg: "#FBE9E7"
  green: "#0E6A4E"
  green-bg: "#E2F1EA"
  amber: "#8A5A00"
  amber-bg: "#FBF0D9"
  blue: "#1F4E8C"
  blue-bg: "#E9EEF4"
  code-ground: "#16181A"
  code-text: "#E8EDF2"
typography:
  display:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(32px, 5.6vw, 62px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 34px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  stat:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.08em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  tag: "3px"
  nav: "4px"
  control: "6px"
  panel: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "28px"
  section: "44px"
  hero-top: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "42px"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 36px 0 12px"
    height: "42px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "14px 18px"
  badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  badge-warn:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  badge-ok:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  tag-window:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  tag-err:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
    rounded: "{rounded.tag}"
    padding: "4px 7px"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  code-block:
    backgroundColor: "{colors.code-ground}"
    textColor: "{colors.code-text}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  textarea:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.panel}"
    padding: "12px"
---

# Design System: Canary Cage for MCP

## Overview

**Creative North Star: "The Lab Record"**

Canary Cage reads like the printed record of an experiment that happens to still be running. The page is one column of warm paper with white panels set on it, separated by hairline rules rather than by shadow or colour. Headlines are set tight in IBM Plex Sans Condensed, prose in IBM Plex Sans, and every identifier, hash, label and column header in IBM Plex Mono. The surface is dense but calm, since the reader is a reviewer who wants evidence, not persuasion.

Colour is withheld on purpose. Almost everything is ink on paper. Red appears only where the tool did something it should not have, green only where enforcement kept the result. Two auxiliaries exist in the build and carry no verdict. Amber marks provenance caveats (cached, FIXTURE, tracer not attached, newly observed in the window) and blue is reserved for focus rings, links and text selection. Nothing decorative is coloured.

Motion is a single gesture. The seven-stage rail fills left to right as a run progresses and the hero table rows settle upward once when the run completes. Everything else is static or a 150 ms border change on hover. Under reduced motion the rows simply appear.

**Key Characteristics:**
- Warm paper ground (#F5F4EF) with pure white panels and 1px hairline borders.
- Three IBM Plex faces with fixed roles. Condensed for headlines and big numbers, Sans for text, Mono for labels and identifiers.
- Red and green are verdict colours only. Amber is a caveat, blue is a browser affordance.
- Uppercase mono labels at 11px with 0.08em tracking name every table column, field and sub-section.
- One content column, 1040px, every section closed by a hairline rule.
- Flat throughout. No box shadows anywhere in the stylesheet.

## Colors

A warm neutral ramp carries the whole page; two verdict hues and two auxiliary hues sit on top with paired pale backgrounds.

### Primary
- **Observed Red** (`red`, #B3261E). The second line of the headline, hero-table discovery cells whose text reports something observed, attempted or exceeded, failed replay cells, errno tags, the unverified identity label, the error line under the contract editor, and stats counting gateway catches or an unattached tracer. Paired with **Red Wash** (`red-bg`, #FBE9E7) as the cell or tag fill.
- **Kept Green** (`green`, #0E6A4E). Replay cells where the result was preserved or the access denied, completed rail stages (border, numeral disc and stage name), the verified identity label, the ok badge, and the denied-by-kernel stat. Paired with **Green Wash** (`green-bg`, #E2F1EA).

### Secondary
- **Caveat Amber** (`amber`, #8A5A00 on `amber-bg`, #FBF0D9). Badges and tags that qualify provenance. Cached run, FIXTURE probe or explanation, no inference key, strace not attached, newly observed in the tool-call window, caught at our gateway, divergence for human review. Amber never states a verdict.
- **Affordance Blue** (`blue`, #1F4E8C on `blue-bg`, #E9EEF4). Links, the 2px focus-visible outline, and text selection. Not used for any run content.

### Neutral
- **Paper** (`paper`, #F5F4EF). Page ground, sticky top bar, select fields, badges and tags at rest, read-only textareas, rail numeral discs.
- **Surface** (`surface`, #FFFFFF). Every panel, table, console, step cell and stat cell.
- **Ink** (`ink`, #16181A). Body text, primary button fill, active rail stage, selected tab, code block ground.
- **Ink 2** (`ink-2`, #4A4C48). Lede, sub-paragraphs, hero-table discovery column, step and list body text, status line.
- **Ink 3** (`ink-3`, #6B6D66). Labels, column headers, hints, pending states, the brand suffix, counters, footer.
- **Rule** (`rule`, #D9D6CD). Panel borders, section dividers, column header underlines, grid gutters in the stats strip and steps grid.
- **Rule 2** (`rule-2`, #E8E6DF). Row dividers inside tables, the status line separator, nav link hover fill.
- **Code Ground / Code Text** (#16181A on #E8EDF2). The one dark surface, used only for `pre` blocks of transcripts, strace rows, profiles and JSON.

### Named Rules
**The Verdict Colour Rule.** Red says what the tool did that it should not have. Green says what enforcement kept. Neither appears on chrome, headings other than the hero consequence line, icons or decoration. If a surface needs emphasis without a verdict, use Ink.

**The Caveat Amber Rule.** Any state that qualifies the evidence (cached, FIXTURE, tracer not attached, window attribution) is amber, never red or green, so a reader cannot mistake a provenance note for a result.

**The Wash Pair Rule.** A verdict or caveat colour on text is always paired with its own pale wash as the fill (`red` on `red-bg`, `green` on `green-bg`, `amber` on `amber-bg`). Saturated fills with white text are not used.

## Typography

**Display Font:** IBM Plex Sans Condensed (with Arial Narrow, system-ui)
**Body Font:** IBM Plex Sans (with system-ui, Segoe UI)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Menlo, Consolas)

**Character:** Condensed bold headlines read like a report title, the Sans body is plain and unhurried, and Mono does the labelling so that hashes, column names and tags look like they came from the machine that produced them. Loaded weights are Condensed 600 and 700, Sans 400, 500 and 600, Mono 400 and 500. Nothing heavier or lighter exists on the page.

### Hierarchy
- **Display** (700, clamp(32px, 5.6vw, 62px), 1.02, tracking -0.015em). The hero headline only, capped at 24ch, balanced wrapping. The consequence line inside it is red and becomes its own block below 640px.
- **Headline** (600, clamp(26px, 3.4vw, 34px), 1.12, tracking -0.01em). Section h2s. Capability contract, Evidence, How it works, What this shows.
- **Stat** (700, 34px, 1, tabular numerals). The six numbers in the stats strip. Drops to 28px below 640px. A pending stat is set instead in Sans 400 14px Ink 3.
- **Brand** (700, 19px, 1, Condensed). The wordmark in the top bar, with the suffix in 600 Ink 3.
- **Lede** (400, 19px, 1.55, Ink 2). The one-paragraph promise under the headline, max 66ch. 17px below 640px.
- **Body** (400, 16px, 1.6). Root size. Hero-table cells at 16px/1.4, sub-paragraphs at 16px capped at 70ch.
- **Body Small** (400, 14.5px to 13px). Explanations, step text, console task and status, hints, footer at 13.5px, nav links at 14px.
- **Rail Stage** (600, 14px/1.2 Sans) with a 12px Ink 3 description beneath.
- **Label** (500, 11px, 1, tracking 0.08em, uppercase, Mono). Field labels, every th, and every h3. The h3 is 12px.
- **Mono** (400 or 500, 12.5px, 1.5). Hashes, matrix cells, code blocks, textarea, contract hash, step counters, stats note (12px, 500).

### Named Rules
**The Mono Label Rule.** Anything that names a column, a field or a sub-section is 11px uppercase Plex Mono with 0.08em tracking in Ink 3. There are no sentence-case or Sans column headers.

**The One Display Rule.** Plex Sans Condensed appears in exactly four places. The brand, the h1, the h2s and the stat numbers. Body copy never uses it.

## Layout

One centred column of 1040px with 20px side padding (`.wrap`). The top bar is sticky, 56px tall, paper-coloured with a hairline bottom border, and holds the brand, a flat text nav and a right-aligned meta string. The hero has 56px top and 36px bottom padding, then every section is 44px top and bottom, each closed by a 1px Rule border. The footer runs 28px to 56px.

Vertical rhythm inside panels is 14px to 18px. Panels use 14px 18px padding (identity, register bodies, step and stat cells use 16px 18px), hero-table cells 14px 20px, the console 18px 20px 16px. Gaps between grid items are 6px (rail, tabs, badges), 8px (actions, register details), 14px to 18px (console grid, record stack), and 28px between two-column pairs.

Grids. The console is `1fr 1fr auto` with the task, status and badges rows spanning full width. The rail is seven equal columns. The stats strip is six equal cells and the steps grid three, both drawn as a 1px Rule gutter between white cells inside a rounded, clipped border. The contract section is `1.35fr 1fr`, other two-column sections `1fr 1fr`.

Breakpoints. At 900px the steps grid drops to two columns, the stats strip to three, the rail to four with an 18px row gap, and the text nav is hidden. At 640px the console, two-column pairs and steps become one column, the rail two columns, the stats strip two columns, buttons stretch to fill the actions row, the hero padding tightens to 36px 28px, and summaries wrap.

## Elevation & Depth

Entirely flat. The stylesheet declares no box-shadow. Depth comes from three layers of tone and a single hairline. Paper is the ground, white panels sit on it with a 1px Rule border and 8px corners, and the dark Ink code block is the only surface that reads as recessed. Hover on a control is a border darkening from Rule to Ink 3, not a lift. The only transform in the system is the 1px press on an active button and the 6px settle of hero-table rows.

### Named Rules
**The Hairline Rule.** Separation is always a 1px line in Rule or Rule 2. Never a shadow, never a tinted band, never a gap larger than the grid gutter.

## Shapes

Softly squared. Panels, tables, the console, textareas and the stats and steps grids use 8px corners. Controls (buttons, selects, pre blocks) use 6px. Nav links and the skip link use 4px, badges and tags 3px, the focus outline 3px. The register and identity tabs are full pills (999px) and the rail numerals are 16px circles with a 2px border. Every surface carries a 1px border in Rule; nothing is borderless and nothing is sharp-cornered. The disclosure chevron is a 7px rotated square with 1.5px Ink 3 strokes, not a glyph. The brand mark is an inline SVG, a 26px rounded square frame with three faint bars and a red 4.5px dot at centre.

## Components

### Buttons
- **Shape:** 42px tall, 6px corners, 1px border, 600 weight 15px Sans, 0 18px padding.
- **Primary:** Ink fill, paper text, Ink border. Hover goes to pure black. Used for Run the loop and Approve contract and replay.
- **Secondary:** Surface fill, Ink text, Rule border. Hover darkens the border to Ink 3. Used for Show the last recorded run.
- **Active / Disabled:** Active presses down 1px. Disabled is 50% opacity with no transform. Transitions are 150ms on border, background and transform with the house ease `cubic-bezier(.2, .7, .2, 1)`.

### Tabs
- **Style:** 30px pills, Surface fill, Rule border, 13px text. Hover darkens the border.
- **State:** The selected tab is Ink fill with white text. Used to switch between runs A, B and C in the MCP and strace panels.

### Badges and Tags
- **Badge:** 11.5px Mono 500, 5px 8px padding, 3px corners, Paper fill, Rule border, Ink 2 text. The `warn` variant is amber on amber wash with a #E3C67A border, the `ok` variant green on green wash with #A9D3BE. Badges sit in a row under the console status and after the explanation and ledger label.
- **Tag:** 11px Mono 500, 4px 7px padding, 3px corners, same neutral colours, nowrap. The `window` variant is amber (newly observed in the window, caught at our gateway, divergence for human review), the `err` variant red on red wash with an #E6B3AE border (errnos, validator violations).

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Surface on Paper.
- **Shadow Strategy:** none, see Elevation.
- **Border:** 1px Rule.
- **Internal Padding:** 14px 18px, or 16px 18px in grid cells.

### Inputs / Fields
- **Select:** 42px, 6px corners, Paper fill, Rule border, 14.5px text, inline SVG chevron 12px from the right. Hover border Ink 3. Labelled above by an 11px Mono uppercase label with 6px gap.
- **Textarea (contract editor):** Mono 12.5px/1.5, 12px padding, 8px corners, Surface fill, resizable vertically, tab-size 2. Read-only state is Paper fill with Ink 2 text.
- **Focus:** 2px Blue outline offset 2px with 3px radius, everywhere.
- **Error:** a red 13.5px line beneath the editor that collapses when empty.

### Navigation
- **Top bar:** sticky, 56px, Paper with a hairline bottom. Brand at left in 19px Condensed with the suffix in Ink 3. Text nav links 14px Ink 2 with 6px 10px padding and 4px corners; hover fills Rule 2 and darkens to Ink. Meta string right-aligned in 13px 500 Ink 3. Nav hidden below 900px, meta hidden below 640px. A skip link to the record appears on focus as an Ink pill at top left.

### Run Console (signature)
White panel, 8px corners, grid of two selects and an action group aligned to the bottom, then a full-width task line (14px Ink 3), a status line (14px Ink 2, hairline top border, `aria-live`), and a badge row that hides when empty. The status line is the one place that speaks in sentences during a run.

### Stage Rail (signature)
Seven columns, each a 2px top border in Rule with a 16px numbered circle sitting on the line. Stage name 14px 600 Sans, description 12px Ink 3. The active stage turns border and disc to Ink with a white numeral. A done stage turns border, disc and stage name to Green. Transitions are 400ms on the house ease, so the rail is seen to fill rather than jump.

### Replay Identity (signature)
White panel holding a disclosure. The summary line is 600 weight and coloured by state, green when verified, red when not, Ink 3 while pending, with a right-aligned hint in 13px Ink 3 and a chevron drawn with borders. Opened, a key-value table (13.5px, 160px key column in Ink 3, Rule 2 row lines) lists the four hashes in Mono. The contract hash sits apart beneath in 12.5px Mono Ink 3.

### Hero Table (signature)
White panel, 8px corners, two equal columns headed Discovery, run B and Enforced replay, run C in Mono labels. Cells are 16px/1.4 with 14px 20px padding and a Rule 2 vertical divider; the discovery column is Ink 2. Row state drives colour. A discovery cell reporting something observed, attempted or exceeded is red text. A replay cell with state preserved or denied is green on green wash at 500 weight, a failed one red on red wash, a pending one Ink 3. Rows enter once, fading in and rising 6px over 500ms, staggered 60ms per row. The explanation paragraph beneath is 14.5px Ink 2 behind a hairline and ends with a badge carrying the explanation label.

### Stats Strip (signature)
A `dl` of six white cells in a hairline-gutter grid. The number is 34px Condensed 700 with tabular numerals above a 13px Ink 2 caption (visual order reversed with `column-reverse`). A pending value is Sans 14px Ink 3. Red is applied to a count that signals a problem the tool caused or evidence lost, green to the denied-by-kernel count. A 12px Mono note beneath names the run id, probe provenance and tracer state.

### Matrix Table
Inside a rounded, scrollable white container. Column headers are Mono labels with 10px 12px padding. Cells are Mono 12.5px, 8px 12px padding, Rule 2 row lines, first column Ink 3 and nowrap. Labels inside cells are tags. Used for the observed window matrix in the contract section and for strace events in the register.

### Register Details
Each panel is a white 8px container with a 600 weight summary row (14px 18px padding, chevron, right-aligned hint in 500 Ink 3). Opened, the summary gains a Rule 2 bottom border and the body gets 14px 18px 18px padding. Bodies hold muted 13.5px Ink 3 notes, tabbed pre blocks, and 13.5px tables with Mono label headers. Pre blocks are the dark Ink surface, 12.5px/1.55 Mono in Code Text, 6px corners, 440px max height. A checkbox filter row uses Ink as its accent colour.

### Steps Grid
Three white cells per row (two at 900px, one at 640px) in a hairline-gutter grid. Each step opens with a two-digit Mono counter in Ink 3, then 14.5px/1.5 Ink 2 text with the step name in 600 Ink.

## Do's and Don'ts

### Do:
- **Do** set every column header, field label and h3 in 11px uppercase Plex Mono, 0.08em tracking, Ink 3.
- **Do** put every panel on Surface white with a 1px Rule border and 8px corners, on the Paper ground.
- **Do** pair any coloured text with its wash (red on red-bg, green on green-bg, amber on amber-bg).
- **Do** label cached and FIXTURE states with an amber badge wherever the content appears.
- **Do** keep the single motion gesture, a 400ms rail fill and a one-time 500ms row settle, and honour prefers-reduced-motion.
- **Do** keep element ids and data-shot attributes exactly as shipped; app.js and the film capture depend on them.
- **Do** write copy without em dashes, mid-sentence colons or exclamation marks, and never the words safe or malicious.

### Don't:
- **Don't** use red or green on anything that is not a verdict about what the tool did or what enforcement kept.
- **Don't** add box shadows, gradients or tinted section bands. Separation is a hairline.
- **Don't** set body copy or labels in Plex Sans Condensed. It belongs to the brand, h1, h2 and stat numbers only.
- **Don't** add icon fonts or glyph icons. The only icons are the inline SVG brand mark and the CSS chevrons.
- **Don't** load weights beyond Condensed 600 and 700, Sans 400 to 600, Mono 400 and 500.
- **Don't** let a surface imply the model decided a verdict. Labels come from deterministic code and are shown as exact strings in tags.
