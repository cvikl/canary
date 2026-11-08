---
name: Canary Cage for MCP
description: A record page that is also the live console. White ground, hairline rules, one green for what the enforced replay kept.
colors:
  paper: "#FFFFFF"
  ink: "#121314"
  ink-2: "#4E5156"
  ink-3: "#686C73"
  rule: "#E3E5E8"
  rule-2: "#EEF0F2"
  wash: "#F6F7F8"
  kept-green: "#0B6B43"
  kept-green-bg: "#EEF6F1"
  alert: "#9B2C23"
  pressed-black: "#000000"
typography:
  display:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(32px, 5.2vw, 56px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(24px, 3vw, 30px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  statistic:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  brand:
    fontFamily: "IBM Plex Sans Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1
  lede:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-list:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  small-table:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
  stage:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.2
  caption:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  code:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
  tag:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1
rounded:
  none: "0px"
  focus: "2px"
  control: "3px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  cell: "10px"
  lg: "12px"
  xl: "14px"
  2xl: "16px"
  3xl: "18px"
  gutter: "20px"
  block: "22px"
  column: "24px"
  4xl: "28px"
  5xl: "32px"
  6xl: "36px"
  section: "40px"
  section-lg: "44px"
  hero: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.pressed-black}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "28px"
    typography: "{typography.caption}"
  tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 34px 0 10px"
    height: "40px"
    typography: "{typography.body-compact}"
  textarea:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    typography: "{typography.code}"
  textarea-readonly:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
  badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "4px 7px"
    typography: "{typography.label}"
  badge-ok:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.kept-green}"
    rounded: "{rounded.none}"
    padding: "4px 7px"
  badge-warn:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "4px 7px"
  tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "3px 6px"
    typography: "{typography.tag}"
  tag-window:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "3px 6px"
  tag-err:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "3px 6px"
  code-block:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    typography: "{typography.code}"
  nav-link:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body-compact}"
  nav-link-hover:
    textColor: "{colors.ink}"
---

# Design System: Canary Cage for MCP

## Overview

**Creative North Star: "The Printed Record"**

The page is a record of one run, set like a printed report that happens to be live. The ground is white, the structure is hairline rules, the type is IBM Plex. Nothing is boxed, lifted or tinted to look important. Hierarchy comes from the Condensed display face, from weight, and from where the rules fall. The reader should feel they are looking at evidence laid flat on a desk, not at a dashboard.

Colour carries exactly one meaning. Green marks what the enforced replay kept, and appears only in the right column of the hero table, on done stages, on ok badges and on the verified identity line. A dark alert red exists for form errors and failed verdicts and for nothing else. The headline consequence line, the sentence that says the tool also read the SSH key, is grey ink, because the page states facts and does not shout them. Everything else is ink on paper in three greys.

Density is editorial rather than dashboard. One 960px column, generous section padding, tables that use rules instead of fills, and small mono labels in place of headings inside the record. Labels such as cached and FIXTURE are visible badges, never hidden, because the page never claims more than it recorded.

**Key Characteristics:**
- White paper ground, three ink greys, two hairline greys, one wash
- Hairline rules do all the structural work, no cards, no shadows, no fills behind content
- IBM Plex Sans Condensed 600 for display and headlines, Plex Sans for prose, Plex Mono for every identifier, label and hash
- One semantic colour, green #0B6B43, reserved for what the enforced replay kept
- Alert red only for form errors and failed verdicts
- Corners square or near square, 3px on controls, 2px on the focus ring
- Motion is a single staggered fade on hero rows and a 150ms ease on buttons, disabled under reduced motion

## Colors

A monochrome record with one green and one red, each permitted in a short list of places.

### Primary
- **Kept Green** (#0B6B43): the only chromatic colour the page uses by default. Right column of the hero table on preserved and denied rows, border of a done stage in the rail, text and border of an ok badge, the verified identity label.
- **Kept Green Wash** (#EEF6F1): text selection background only.

### Neutral
- **Paper** (#FFFFFF): page ground, control backgrounds, badge and tag backgrounds. There is no second surface colour.
- **Ink** (#121314): headlines, body copy, primary button fill, active stage border, tab on state, borders of the top rule on tables, the focus ring.
- **Ink 2** (#4E5156): lede, section sub lines, nav links, left column of the hero table, step text, badge text, read only textarea text.
- **Ink 3** (#686C73): mono labels, hints, pending states, table heads, stage names at rest, footer, the grey consequence line in the h1.
- **Rule** (#E3E5E8): primary hairline, section borders, table cell borders, control borders, rail borders at rest.
- **Rule 2** (#EEF0F2): secondary hairline between rows inside key value tables, matrix tables and the evidence register.
- **Wash** (#F6F7F8): background of pre blocks and read only textareas, and the secondary button hover.
- **Pressed Black** (#000000): primary button hover only.

### Alert
- **Alert Red** (#9B2C23): contract JSON errors, failed identity label, failed verdict in the hero table right column. Never on the headline, never on stats, never on badges.

### Named Rules
**The One Green Rule.** Green means the enforced replay kept something. It appears on the hero table right column, done stages, ok badges and the verified identity label, and nowhere else. New surfaces may not add green to buttons, links or decoration.

**The Grey Consequence Rule.** The headline's consequence line is Ink 3 grey. The page reports facts and leaves the reader to feel them. Red is held back for errors and failures the user must act on.

**The Paper Only Rule.** There is one surface colour. Content never sits on a tinted panel. Wash is for code and read only fields, which are material, not emphasis.

## Typography

**Display Font:** IBM Plex Sans Condensed (with Arial Narrow, system-ui)
**Body Font:** IBM Plex Sans (with system-ui, Segoe UI)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Menlo, Consolas)

**Character:** A documentary pairing. The Condensed face at 600 gives headlines and statistics a compact, printed weight without size. Plex Sans carries prose at a generous 1.6 line height. Plex Mono sets every label, hash, identifier and table head so machine facts read as machine facts.

### Hierarchy
- **Display** (600, clamp(32px, 5.2vw, 56px), 1.05, -0.015em): the h1 only, capped at 24ch. The second line is grey ink.
- **Headline** (600, clamp(24px, 3vw, 30px), 1.15, -0.01em): section h2.
- **Statistic** (600, 30px, 1, tabular-nums, -0.01em): numbers in the stats row. Drops to 26px under 640px. Pending stats fall back to 14px Plex Sans in Ink 3.
- **Brand** (600, 18px, 1): the wordmark, with the suffix in Ink 3.
- **Lede** (400, 18px, 1.6): hero paragraph in Ink 2, max 62ch. 16.5px under 640px.
- **Body** (400, 16px, 1.6): base text and hero table cells (1.4 in the table). Hero table drops to 14.5px under 640px.
- **Body list** (400, 15px, 1.5): steps, limits lists, button text (500).
- **Body compact** (400, 14.5px, 1.55): nav links, selects, explanation paragraph, empty states.
- **Small** (400, 14px): task and status lines under the console.
- **Small table** (400, 13.5px): key value table, register tables, muted notes, footer, form errors.
- **Stage** (500, 13.5px, 1.2): rail stage names.
- **Caption** (400, 13px, 1.3): stat labels, hints, matrix table base, tab buttons, filter row.
- **Code** (400, 12.5px, 1.5): pre blocks, textarea, inline code, matrix cells, contract hash.
- **Label** (500, 12px, 1, mono): field labels, table heads, h3 inside sections, badges.
- **Tag** (400, 11.5px, 1, mono): label chips inside the register.

### Named Rules
**The Mono Label Rule.** Anything that names a machine fact, a field, a column or a sub section inside the record is set in Plex Mono at 12px weight 500 in Ink 3. There are no uppercase labels and no letter spaced eyebrows.

**The Half Pixel Ramp Rule.** Sizes step in half pixels where the build does, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 16.5, 18. Do not round them to a cleaner scale.

## Layout

One centred column at 960px with 20px side padding. The top bar is 60px tall with a 28px gap between brand and nav, nav links 22px apart. The hero pads 64px above and 40px below. Every section pads 44px vertically and closes with a hairline rule, the record section pads 40px.

Inside the record, rhythm is set by hairlines and by short gaps of 6, 8, 10, 12 and 14px. The console is a three column grid (1fr 1fr auto) with 14px row and 18px column gaps. The stage rail is seven equal columns with 8px gaps, each stage topped by a 2px rule. The stats row is six equal columns with 24px gaps, label under number. Two column text blocks use 32px gaps, the contract block weights its columns 1.35fr to 1fr.

Breakpoints are 900px and 640px. At 900px stats become three columns and the rail four. At 640px the nav hides, the hero tightens to 40px over 28px, the console stacks, buttons stretch, two column blocks stack, stats become two columns, and table paddings drop from 24px to 14px.

## Elevation & Depth

There are no shadows. Depth is conveyed by rules and by two greys of rule. A 1px Ink rule tops the hero table and matrix tables to mark where the record starts. Rule separates sections and primary rows, Rule 2 separates secondary rows. The stage rail uses a 2px top border that turns Ink when active and Kept Green when done. Pre blocks and read only textareas sit on Wash with a Rule border, which is the only place a surface shade appears.

### Named Rules
**The Hairline Rule.** Structure is drawn with 1px rules in Rule or Rule 2 and 1px Ink where a table opens. No box shadow, no card, no border radius larger than 3px, no background fill behind text content.

## Shapes

Corners are square or near square. Controls (buttons, selects, textareas, tabs, pre blocks) carry a 3px radius. The focus ring is a 2px solid Ink outline offset 2px with a 2px radius. Badges and tags are square with a 1px border. Disclosure markers are 6px chevrons drawn with 1.5px borders and rotated, not glyphs. The brand mark is a 24px rounded square cage with three bars and a centre dot.

## Components

### Buttons
- **Shape:** near square (3px radius), 40px tall, 16px side padding, 500 weight at 15px
- **Primary:** Ink fill, Paper text, Ink border. Hover goes to Pressed Black. Transition 150ms on background and colour.
- **Secondary:** Paper fill, Ink text, 1px Ink border. Hover fills Wash.
- **Quiet:** Paper fill, Ink 2 text, Rule border. Used for the cached run control.
- **Disabled:** 45 percent opacity, not allowed cursor.
- **Focus:** 2px Ink outline, 2px offset.

### Tabs
- **Style:** 28px tall, 12px side padding, 13px text, Rule border, 3px radius. Hover darkens the border to Ink 3.
- **On:** Ink fill, white text, Ink border.

### Badges and Tags
- **Badge:** Plex Mono 12px, 4px by 7px padding, Rule border, Ink 2 text, Paper fill, square. Used for cached, FIXTURE and explanation labels.
- **Badge ok:** Kept Green text and border.
- **Badge warn:** Ink 3 border, Ink text. Used for cached and FIXTURE labels and for missing key notices.
- **Tag:** Plex Mono 11.5px, 3px by 6px padding, Rule border, Ink 2 text. Tag window raises the border to Ink 3 and text to Ink. Tag err raises both to Ink.

### Inputs / Fields
- **Select:** 40px tall, 1px Rule border, 3px radius, 14.5px text, Paper fill, custom 12 by 8 chevron in Ink 2 at the right. Hover border Ink 3.
- **Textarea:** Plex Mono 12.5px at 1.5, 12px padding, Rule border, 3px radius, vertical resize. Read only variant sits on Wash in Ink 2.
- **Label:** Plex Mono 12px 500 in Ink 3 above the field, 6px gap.
- **Error:** Alert Red at 13.5px, 8px vertical margin, collapses when empty.

### Navigation
- **Top bar:** 60px, Rule bottom border, Paper. Brand in Condensed 18px 600 with the suffix in Ink 3. Links in Ink 2 at 14.5px, hover Ink with underline. Hidden under 640px.
- **Skip link:** Ink fill, white text, appears on focus at 8px.

### Hero Table (signature)
Two equal columns, Discovery on the left and Enforced replay on the right, 1px Ink top rule, mono 12px heads, 16px cells at 1.4 with 13px vertical padding and Rule bottom borders. Left cells are Ink 2, or Ink when the row was observed. Right cells are Kept Green at 500 for preserved and denied rows, Alert Red at 500 for failed rows, Ink 3 for pending. Rows fade in over 450ms with a 60ms stagger, disabled under reduced motion. An explanation paragraph follows at 14.5px in Ink 2, clamped to two lines with a grey more marker until clicked. On load the table shows the last recorded run with a cached badge.

### Stage Rail (signature)
Seven stages, Inspect through Replay, each a 2px top rule in Rule with a 13.5px 500 name in Ink 3. Active turns the rule and name Ink. Done turns the rule Kept Green and the name Ink. Border colour eases over 400ms.

### Stats Row (signature)
Six figures in Condensed 30px 600 tabular numerals over 13px Ink 3 labels, separated from the table by a Rule top border. All figures are Ink regardless of meaning. Pending reads as 14px Plex Sans in Ink 3.

### Evidence Register (signature)
Stacked details elements separated by Rule hairlines, 14px padded summaries at 500 with a 6px chevron and a Ink 3 hint pushed right. Panels indent 20px and hold mono tables, tabs and pre blocks on Wash.

## Do's and Don'ts

### Do:
- **Do** draw structure with 1px rules in #E3E5E8 or #EEF0F2 and open tables with a 1px #121314 rule.
- **Do** reserve #0B6B43 for the hero table right column, done stages, ok badges and the verified identity label.
- **Do** keep the headline consequence line in #686C73.
- **Do** set every label, hash, column head and in record sub heading in IBM Plex Mono 12px 500 #686C73.
- **Do** keep the half pixel type ramp exactly, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 16.5, 18.
- **Do** label cached and FIXTURE states with a warn badge wherever they appear.
- **Do** use 3px radii on controls and the 2px Ink focus ring everywhere.

### Don't:
- **Don't** add box shadows, cards or tinted panels behind content.
- **Don't** use #9B2C23 outside form errors, failed verdicts and the failed identity label.
- **Don't** colour statistics by meaning. They stay #121314.
- **Don't** introduce uppercase or letter spaced labels, eyebrows or kickers.
- **Don't** use glyph icons. Chevrons are drawn with borders, the brand mark is inline SVG.
- **Don't** use a second surface colour. #F6F7F8 is for code and read only fields only.
