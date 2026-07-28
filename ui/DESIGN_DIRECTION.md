# Superdev Control Center: design direction

This is the single design authority for everything under `ui/`. Every view obeys
it. If a view needs something this document does not name, extend this document
first, then build.

## 1. The concept

**Instrument Bay.** The control center is the panel you stand in front of while a
product is being built, not the report you read afterwards. Its ancestors are
machine-tool control panels, aircraft systems pages and technical drawings: a
warm graphite chassis, hairline structural rules that behave like drawn lines
rather than card borders, a monospaced chassis voice for everything the machine
measures (identifiers, counts, column headers, navigation, status), and a
humanist sans reserved for the sentences a person actually reads. One accent
only, an ember orange, and it means "you are here, this is live, this is
interactive", never "this is good" or "this is broken". Information runs edge to
edge at high density with almost no floating cards, because an operator wants the
whole panel legible at once, not a scroll through padded tiles. The previous
version was a calm, light, blue-grey printed briefing. This one is a dark-first
warm-carbon workbench that reads as equipment under load. Restraint here comes
from the palette and the flatness, not from emptiness.

### Deliberate moves away from the old direction

| Old | New |
|---|---|
| Cool blue-grey paper, light only in spirit | Warm carbon, dark-first, warm bone light theme |
| Command blue `#1c4b7a` accent | Ember orange signal, reserved for interaction and liveness |
| Mono for machine values only | Mono as the chassis voice; sans reserved for prose |
| Cards on a canvas, surface lift shadows | Flat panels divided by hairline rules; shadow only for true overlays |
| Comfortable report density | Operator density: 28 px table rows, 12 px chassis text |

## 2. Colour system

Authored in OKLCH so the two themes stay perceptually matched. `:root` carries
the light theme. `[data-theme="dark"]` overrides it. `system` is resolved to one
of the two before first paint by the inline script in `index.html`, so there is
never a flash and no CSS media query is involved in theming.

The `--sd-*` custom properties below are the source of truth. `src/index.css`
re-exports each one through Tailwind v4 `@theme inline` so components use plain
utilities (`bg-panel`, `text-ink-2`, `border-rule`, `text-signal`).

### Token table

| Token | Utility | Role |
|---|---|---|
| `--sd-substrate` | `bg-substrate` | Application background, behind everything |
| `--sd-panel` | `bg-panel` | Panels, sheets, popovers, table bodies |
| `--sd-panel-raised` | `bg-panel-raised` | Header, sidebar, sticky table headers, menus |
| `--sd-inset` | `bg-inset` | Wells, inputs, zebra rows, code blocks, canvas backdrop |
| `--sd-ink` | `text-ink` | Titles, values, anything that must be read first |
| `--sd-ink-2` | `text-ink-2` | Body prose, explanations, secondary values |
| `--sd-ink-3` | `text-ink-3` | Metadata, timestamps, units, placeholder, disabled label |
| `--sd-rule` | `border-rule` | Default hairline, table and panel division |
| `--sd-rule-strong` | `border-rule-strong` | Section boundaries, focused input, active node edge |
| `--sd-signal` | `text-signal` `bg-signal` | The one accent: selection, focus, live, primary action |
| `--sd-signal-ink` | `text-signal-ink` | Text placed on a solid `--sd-signal` fill |
| `--sd-signal-wash` | `bg-signal-wash` | Selected row, active nav rail, low emphasis signal |
| `--sd-signal-edge` | `border-signal-edge` | Border companion to `--sd-signal-wash` |

Status tokens, each with a `-wash` companion for chips and row tints:

| Token | Utility | Meaning |
|---|---|---|
| `--sd-state-complete` | `text-state-complete` | Complete, Verified, Applicable and Specified |
| `--sd-state-active` | `text-state-active` | In Progress, In Review, Verifying, Running, Live |
| `--sd-state-attention` | `text-state-attention` | At Risk, Awaiting a Decision, Stale, Reconnecting |
| `--sd-state-blocked` | `text-state-blocked` | Blocked, Failed, Conflict, Offline, Error |
| `--sd-state-idle` | `text-state-idle` | Draft, Ready, Paused, Cancelled, Not Applicable |
| `--sd-state-retired` | `text-state-retired` | Superseded, Deprecated, Deferred |

### Values

```css
:root {
  color-scheme: light;

  --sd-substrate:     oklch(0.957 0.006 80);
  --sd-panel:         oklch(0.992 0.003 80);
  --sd-panel-raised:  oklch(0.978 0.004 80);
  --sd-inset:         oklch(0.928 0.008 78);
  --sd-ink:           oklch(0.235 0.014 62);
  --sd-ink-2:         oklch(0.415 0.012 62);
  --sd-ink-3:         oklch(0.565 0.011 62);
  --sd-rule:          oklch(0.872 0.008 76);
  --sd-rule-strong:   oklch(0.775 0.011 76);

  --sd-signal:        oklch(0.565 0.163 45);
  --sd-signal-ink:    oklch(0.995 0.004 80);
  --sd-signal-wash:   oklch(0.938 0.036 60);
  --sd-signal-edge:   oklch(0.842 0.076 52);

  --sd-state-complete:  oklch(0.470 0.108 152);
  --sd-state-active:    oklch(0.505 0.128 245);
  --sd-state-attention: oklch(0.545 0.116 85);
  --sd-state-blocked:   oklch(0.505 0.170 22);
  --sd-state-idle:      oklch(0.520 0.008 76);
  --sd-state-retired:   oklch(0.500 0.098 305);

  --sd-state-complete-wash:  oklch(0.940 0.036 152);
  --sd-state-active-wash:    oklch(0.938 0.036 245);
  --sd-state-attention-wash: oklch(0.940 0.044 85);
  --sd-state-blocked-wash:   oklch(0.938 0.036 22);
  --sd-state-idle-wash:      oklch(0.928 0.006 76);
  --sd-state-retired-wash:   oklch(0.940 0.032 305);
}

[data-theme="dark"] {
  color-scheme: dark;

  --sd-substrate:     oklch(0.168 0.008 72);
  --sd-panel:         oklch(0.205 0.009 72);
  --sd-panel-raised:  oklch(0.243 0.010 72);
  --sd-inset:         oklch(0.186 0.008 72);
  --sd-ink:           oklch(0.948 0.010 84);
  --sd-ink-2:         oklch(0.790 0.011 84);
  --sd-ink-3:         oklch(0.630 0.011 84);
  --sd-rule:          oklch(0.318 0.010 72);
  --sd-rule-strong:   oklch(0.438 0.013 72);

  --sd-signal:        oklch(0.760 0.158 55);
  --sd-signal-ink:    oklch(0.190 0.030 55);
  --sd-signal-wash:   oklch(0.300 0.052 48);
  --sd-signal-edge:   oklch(0.430 0.090 50);

  --sd-state-complete:  oklch(0.775 0.140 152);
  --sd-state-active:    oklch(0.760 0.120 245);
  --sd-state-attention: oklch(0.815 0.135 85);
  --sd-state-blocked:   oklch(0.715 0.165 22);
  --sd-state-idle:      oklch(0.680 0.008 76);
  --sd-state-retired:   oklch(0.755 0.110 305);

  --sd-state-complete-wash:  oklch(0.288 0.048 152);
  --sd-state-active-wash:    oklch(0.288 0.046 245);
  --sd-state-attention-wash: oklch(0.292 0.048 85);
  --sd-state-blocked-wash:   oklch(0.288 0.056 22);
  --sd-state-idle-wash:      oklch(0.268 0.006 76);
  --sd-state-retired-wash:   oklch(0.290 0.044 305);
}
```

### The two colour rules

1. **The signal never carries state, state never uses the signal.** Ember means
   interactive, selected, focused or live. A record's health is only ever one of
   the six `--sd-state-*` tokens. Nothing is ever tinted for decoration.
2. **Contrast floor.** `--sd-ink` and `--sd-ink-2` clear 4.5:1 on `--sd-panel`
   and `--sd-substrate` in both themes. `--sd-ink-3` is for text at 12 px and
   above that is never the only carrier of meaning. Every `--sd-state-*` value
   clears 4.5:1 on its own `-wash` and on `--sd-panel`.

## 3. Type

Two families, no web fonts. This UI ships inside the plugin and must render
identically with no network, so the stacks resolve locally on every platform.

```css
--sd-font-chassis: ui-monospace, "SF Mono", "JetBrains Mono", "IBM Plex Mono",
                   "Cascadia Mono", Menlo, Consolas, monospace;
--sd-font-prose:   ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                   "Helvetica Neue", Arial, sans-serif;
```

`--sd-font-chassis` (`font-chassis`) is the voice of the instrument: navigation,
column headers, status chips, identifiers, counts, units, key/value metadata,
tabs, buttons, breadcrumbs, canvas node labels. It is set in uppercase with
tracking at the two smallest sizes and sentence case above that.

`--sd-font-prose` (`font-prose`) is the voice of the person: view titles, record
names, purposes, explanations, empty and error copy, question and answer text.
Prose fills its container. The 68ch cap was removed: it left descriptions ending halfway across cards that are 942 to 1188px wide.

**The voice rule.** If a person would read it as a sentence, it is prose. If it
is a reading taken off the product, it is chassis. Never set a paragraph in
chassis; never set a table's column header in prose.

### Scale

| Utility | Size / line height | Weight | Use |
|---|---|---|---|
| `text-display` | 26px / 1.15, `-0.02em` | 600 prose | One per view: the view title |
| `text-title` | 18px / 1.3, `-0.012em` | 600 prose | Panel and drawer headings |
| `text-subtitle` | 15px / 1.35 | 600 prose | Record names, card headings |
| `text-body` | 14px / 1.55 | 400 prose | Explanations, product language |
| `text-small` | 13px / 1.5 | 400 prose | Secondary prose, help text |
| `text-chassis` | 13px / 1.4, `0.005em` | 500 chassis | Values, ids, nav, buttons |
| `text-chassis-sm` | 12px / 1.35, `0.02em` | 500 chassis | Table cells, chips, meta |
| `text-label` | 11px / 1.3, `0.09em`, uppercase | 600 chassis | Column and field labels |

Numerals are always `font-variant-numeric: tabular-nums` so columns of counts
align. Applied globally to `.font-chassis`.

## 4. Spacing, radii, elevation

**Spacing** is the Tailwind 4px scale, restricted to a rhythm of `1 / 2 / 3 / 4 /
6 / 8 / 12` (4, 8, 12, 16, 24, 32, 48 px). Panel padding is `16px`; a dense list
inside a panel gets `12px`. Nothing gets more than `32px` of internal padding.

**Radii** are small, because this is equipment.

| Token | Value | Use |
|---|---|---|
| `--radius-sd-sm` (`rounded-sd-sm`) | 3px | Chips, badges, checkboxes, tags |
| `--radius-sd` (`rounded-sd`) | 5px | Buttons, inputs, selects, menu items |
| `--radius-sd-lg` (`rounded-sd-lg`) | 7px | Panels, dialogs, popovers, canvas nodes |
| `rounded-full` | pill | Only the connection dot and avatar initials |

**Elevation.** Flat by default. Structure comes from `--sd-rule` hairlines and
the `substrate / panel / panel-raised / inset` tonal ladder. Shadow is only ever
applied to something that genuinely floats above the page and can be dismissed.

| Token | Use |
|---|---|
| `--sd-shadow-overlay` (`shadow-overlay`) | Dropdown, select, popover, tooltip, command palette |
| `--sd-shadow-sheet` (`shadow-sheet`) | Dialog, sheet, record drawer |

```css
--sd-shadow-overlay: 0 1px 2px oklch(0 0 0 / 0.16), 0 12px 28px -14px oklch(0 0 0 / 0.42);
--sd-shadow-sheet:   0 2px 4px oklch(0 0 0 / 0.18), 0 32px 64px -28px oklch(0 0 0 / 0.55);
```

No shadow on a panel, a card, a table or a canvas node. A drop shadow is a
promise that the thing can be dismissed; do not make that promise falsely.

## 5. Focus

Focus is never removed and never invisible, including on dark backgrounds and
inside the canvas.

```css
--sd-ring: var(--sd-signal);
--sd-ring-offset: var(--sd-substrate);
```

The shared utility is `focus-ring`:

```css
.focus-ring:focus-visible {
  outline: 2px solid var(--sd-ring);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Rules: every interactive element carries `focus-ring`. Rows, canvas nodes and
list items that are selectable are real `<button>` or `<a>` elements or carry
`tabindex={0}` plus a role. A focused row additionally gets an inset
`--sd-signal` left edge (`box-shadow: inset 2px 0 0 var(--sd-signal)`) because a
2 px outline on a full-width row is easy to lose. Focus order follows visual
order. Every dialog, sheet and menu traps focus and restores it on close.

## 6. Motion

Motion clarifies where something came from. It never decorates and never delays
a person reading data.

| Token | Value | Use |
|---|---|---|
| `--sd-dur-1` | 120ms | Hover, chip and button state, tooltip |
| `--sd-dur-2` | 180ms | Menu, popover, tab underline, row expand |
| `--sd-dur-3` | 240ms | Sheet and drawer slide, dialog |
| `--sd-ease` | `cubic-bezier(0.22, 0.68, 0.36, 1)` | Everything |

Only `opacity` and `transform` are animated. No layout animation, no bouncing,
no looping attention effect. The single exception is the live connection dot,
which pulses opacity at 2s while the stream is live: it is a heartbeat, so it is
allowed to repeat.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Reduced motion removes the heartbeat pulse too; the dot stays solid and the
label still reads Live.

## 7. Status without colour

Every status is rendered by `src/components/shell/status.tsx` and is always
three channels at once:

1. **Glyph.** A distinct lucide icon per state, so the state survives greyscale,
   colour blindness and a printed page.
2. **Label.** Title Case plain language: `Complete`, `In Progress`, `Blocked`,
   `At Risk`, `Not Applicable`, `Superseded`. Never a raw enum, never an
   abbreviation, never a bare id.
3. **Colour.** The matching `--sd-state-*` token on a `-wash` background with a
   `currentColor`-derived hairline.

| State | Glyph | Token |
|---|---|---|
| Complete, Verified, Specified | `CheckCircle2` | `complete` |
| In Progress, In Review, Verifying, Live | `CircleDot` | `active` |
| At Risk, Awaiting Decision, Stale, Reconnecting | `AlertTriangle` | `attention` |
| Blocked, Failed, Conflict, Offline | `OctagonX` | `blocked` |
| Draft, Ready, Paused, Cancelled, Not Applicable | `Circle` | `idle` |
| Superseded, Deprecated, Deferred | `Archive` | `retired` |

Additional non-colour carriers: a blocked table row gets a repeating 4 px
diagonal hatch at 6 percent opacity in its leading cell; a superseded record gets
a strike on its identifier, not on its name. Progress meters print their fraction
as text next to the bar, so the bar is never the only reading.

## 8. Density

**Tables.** 28 px row height, 12 px horizontal cell padding, `text-chassis-sm`.
Header row is `bg-panel-raised`, `text-label`, sticky, with a `--sd-rule-strong`
bottom hairline. Rows are divided by `--sd-rule` hairlines, never zebra striped
and never boxed. Hover tints the row with `--sd-inset`; selection uses
`--sd-signal-wash` plus a 2 px inset `--sd-signal` left edge. Numeric columns are
right aligned and tabular. A table wider than its container scrolls inside its
own `overflow-x-auto` region; the page body never scrolls sideways. Below 768 px
a table becomes a stacked list of labelled key/value rows rather than a
horizontally scrolling grid, and each record keeps its status chip.

**Panels.** Panels butt against each other and share hairlines. Do not wrap every
group in a bordered card with a gap; use one bordered region divided internally.
A view has at most one scroll container of its own.

**Canvases.** `--sd-inset` backdrop with a 24 px dot grid at `--sd-rule`. Nodes
are `rounded-sd-lg`, `--sd-panel`, 1 px `--sd-rule`, minimum 180 px wide, and
carry type glyph, name in prose, identifier in `text-chassis-sm`, and a status
chip. Node shape encodes type; node colour never encodes type. Selected node gets
a 2 px `--sd-signal` border, its network stays at full opacity and everything
else drops to 35 percent. Edges are 1.5 px `--sd-rule-strong`, labelled when the
relationship is not obvious from position. Minimum hit target on any canvas
control is 32 px. Layout runs through dagre; manual positions win and persist via
`layout.save`. Every canvas has a keyboard equivalent: an adjacent list of the
same records, reachable by tab, that opens the same detail panel.

**Minimum targets.** 32 px for any pointer target, 24 px for a target inside a
28 px dense table row provided the whole row is also clickable.

## 9. The three principles

### I. The panel always answers

There is no blank region. Empty, loading, error, stale, unavailable and offline
are designed states, and each one says what happened, why, and the single next
thing the person can do, with a control to do it. A spinner alone is a defect. An
empty table that says "No results" without saying what was searched and how to
widen it is a defect. `src/components/shell/states.tsx` is the only way these are
rendered, so the promise cannot be broken view by view.

### II. Every number declares what it counts

No naked figure and no naked percentage. It is `7 of 12 acceptance criteria met`,
not `58%`. A progress meter always prints its fraction and what it counts, and
names what remains. Where a record has no declared completion contract the
interface prints `Not measurable` and explains that no completion criteria are
defined yet: never `0%`, never `100%`, never an empty bar. Every derived figure
can state its source revision and its freshness on demand.

### III. Plain language leads, the machine follows

A person reads the name first and the identifier second. `Provider routing`, then
`FEAT-0007` in `text-chassis-sm text-ink-3`. Human-facing statuses are Title
Case. No internal vocabulary appears without a plain-language gloss: not
`authored_projection` but `Hand editable, regenerated on request`. Timestamps are
relative with the absolute value in the `title` attribute. Nothing in the
interface requires the person to have read the schema.
