# @esportsplus/ui

A reactive component library built on compile-time template transformations. Provides typed, tree-shakeable UI components with integrated SCSS theming.

## Installation

```bash
pnpm add @esportsplus/ui
```

## Dependencies

- `@esportsplus/frontend` - Tagged template literals with compile-time transforms and reactive state management
- `@esportsplus/action` - Response/error handling
- `@esportsplus/utilities` - Core utilities

*https://github.com/Chainlift/liftkit* temporarily trying liftkit rules

## Quick Start

```typescript
import { button, form, input, select } from '@esportsplus/ui';
import { html } from '@esportsplus/frontend';

// Simple component
html`${button({}, 'Click Me')}`;

// Form with validation
html`
  ${form.action({
    action: async ({ input: data }) => {
      const result = await api.submit(data);
      return result.ok ? { errors: [] } : { errors: result.errors };
    }
  }, html`
    ${input({ name: 'email', type: 'email' })}
    ${button({}, 'Submit')}
  `)}
`;

// Select with reactive state
html`
  ${select({
    options: { a: 'Option A', b: 'Option B' },
    selected: 'a'
  }, (state) => html`Selected: ${state.selected}`)}
`;
```

## Components

### Form Controls
| Component | Description | Variants |
|-----------|-------------|----------|
| `input` | Text input with validation state; `input.scrub` is a numeric `input` whose label scrubs the value on drag (Shift ×10, Alt ×0.1, optional pointer lock) over a tape measure; arrows step, Escape restores | `input.scrub`, `input.scrub.field`, `input.scrub.label` |
| `textarea` | Multi-line text input | - |
| `checkbox` | Checkbox with label; `checkbox.group` builds a checklist with a select-all header (mixed state), optional counter, and Shift-click ranges | `checkbox.group` |
| `radio` | Radio button group | - |
| `range` | Range slider; `range.filter` is a range filter with rolling-digit values, a Clear button, a ghost preview of where a click would stretch the selection, and scale ticks; a number `value` gives one thumb, a pair gives two that stop at each other; `fields` adds editable min/max `input` fields, `disabled`; `state.low`/`state.high`, `format`, `prefix`, `step`, `ticks` | `range.filter` |
| `datalist` | Inertial wheel picker (scroll-snapped listbox) | - |
| `select` | Dropdown with custom options; `select.menu` is a macOS-style listbox opening with the selected option over the trigger, with typeahead and hover scrolling | `select.menu` |
| `switch` | Toggle switch; `switch.group` builds the same group as `checkbox.group` with switches, the select-all knob resting midway when mixed | `switch.group` |
| `tasklist` | Checklist that strikes through checked tasks and moves them below the open ones | `tasklist.checkbox` |
| `form` | Form wrapper | `form.action`, `form.input` |
| `cc` | Payment card form (`input` fields) with a live card preview that flips for the CVC, brand detection, caret-safe formatting and Luhn/expiry validation; `onvalid` receives brand, last 4, expiry and name | `cc.field`, `cc.submit` |
| `colorPicker` | Saturation pad, hue/opacity sliders (`range`), hex field (`input`), and an animated recent-colors row (hidden while empty); `value` is required, no surface of its own, so place it in a `card` | `colorPicker.swatch` |
| `inlineEdit` | Click-to-edit text that swaps in an `input` (or `textarea` with `multiline`) without moving a glyph; Enter/blur saves, Escape cancels, `onsave` fires. `inlineEdit.rich` edits markdown in place: `features` whitelists what each field allows (bold, italic, strike, code, highlight, link, heading, quote, codeblock, bullet, ordered, task, clear, copy), and only those appear in its selection toolbar, shortcuts, pastes and saved markdown | `inlineEdit.display`, `inlineEdit.field`, `inlineEdit.rich.editor`, `inlineEdit.rich.toolbar`, `inline-edit--seamless` |
| `tagInput` | Chip field (`input`) turning typed or pasted text into tags that form in place, nudge on duplicates, and go on a double Backspace; `name` submits `name[]` | `tagInput.field` |

### Interactive
| Component | Description | Variants |
|-----------|-------------|----------|
| `button` | Standard button; `button.hold` confirms on a press-and-hold, inverting the whole button as it fills, or only the label with `button--hold-text` (`--fill-color`); `button.morph` is an async save (`onsave`) that morphs into a spinner circle, confirms with a check and shakes on failure, with `--morph-background` for its colour | `button.fan`, `button.hold`, `button.morph`, `button--hold-text` |
| `tooltip` | Popup content; `tooltip.onhover` also opens on keyboard focus and closes on Escape, and `tooltip.onhover.trigger({ delay, state })` is the same behaviour to spread on your own `.tooltip` element; `delay: { open?, close? }` (ms, on `tooltip.onhover` and `tooltip.shared`; each left out is instant) holds the pointer before opening and after leaving, and for 500ms after a delayed tooltip closes the next opens at once, without its entrance; `tooltip.menu` is a keyboard menu (arrows, Home/End, Escape returns focus, Tab closes) that closes once an option is chosen; `tooltip.nestedMenu({ animate, items, onselect, state })` is a drill-down menu whose `items` nest to any depth: a branch's panel grows out of its row over the dimmed parent, and its header or the parent's scrim goes back; arrows/Home/End move, Right/Left drill and return, Escape goes back a level then closes (`animate: false` skips the motion, `tooltip.nestedMenu.trigger` styles the button); `tooltip.shared({ delay, direction, dismiss, interactive, keep, state })` is one tooltip for any number of triggers: spread `tip.bind(content)` on a trigger (a string, or a function returning a template, rendered on every open unless `keep`), or `tip.delegate({ content, edge, selector })` on a container to make every matching descendant a trigger (default `[data-tooltip]`, its value the content; `edge` lines the tooltip up past the container's edge), and place `tip.render(attributes)` once; it opens in the top layer beside the trigger, flips when out of room, and glides between triggers while its content slides in the direction of travel; `interactive` makes it a card the pointer can enter, toggled by taps and keys, with Tab carried into it; `keep` mounts each bound trigger's content on its first open and keeps it for reopening until that trigger unmounts; `dismiss` is a selector whose clicks inside close it (`'a[href]'` for navigation); `state.active` is whether it is open and `state.index` which bound trigger, numbered in `bind()` order (-1 for none), and setting it opens that trigger | `tooltip.context`, `tooltip.menu`, `tooltip.nestedMenu`, `tooltip.onclick`, `tooltip.onhover`, `tooltip.onhover.trigger`, `tooltip.shared` |
| `accordion` | Collapsible sections | - |
| `clipboard` | Copy to clipboard | `clipboard.copy`, `clipboard.write` |
| `command` | ⌘K/Ctrl+K command palette on `overlay` + `input`: substring-then-subsequence matching with highlighted runs, grouped results, arrow/Enter keys, `onrun`; `tabs` adds a row of tabs under the search, marked by `highlight`, whose views are `frame--swap`s, drifting in from their side, and cycle with Tab/Shift+Tab (All leads with recent commands, persisted through any `store` implementing `get`/`set`, then lists every command; each command group gets its own tab; a Shortcuts tab lists `shortcuts`); setting `state.tab` (`'all'`, `'shortcuts'` or a group name) switches views and clears the search. Icons are sprite ids; `.command-trigger` also styles standalone search buttons | `command.dialog` (e.g. `overlay--blur`), `command.input`, `command.option`, `command.trigger`, `command--centered` |
| `alert` | Notifications | error, info, success types |
| `dock` | macOS-style `card` shelf whose icons swell toward the cursor on a spring, with delayed `tooltip` labels (`group` shares one gliding `tooltip.shared` label) and a hop-and-squash launch that lights a running dot (per-item `state.running`, `onlaunch`) | `dock.button`, `dock--square` |
| `card.expand` | List of `card--expand` cards that each morph into their own `card` `overlay` and fly back into their slot through a view transition (a plain `overlay` fade where unsupported, a cross-fade under reduced motion); `state.open` is two-way | `card.expand.trigger` |
| `pagination.dots` | Page indicator driven by a continuous `state.progress`; the pill stretches between dots like a worm, with an optional autoplay countdown | `pagination.dots.dot`, `pagination--dots-large` |
| `pullToRefresh` | Rubber-band pull gesture (touch and mouse) with a stepped tick spinner; new items above the old first one slide in | - |
| `sortable` | Drag-and-drop reordering of an element's children, across containers with `group` | `sortable--{effect}` modifiers |
| `storyProgress` | Auto-advancing stories with segmented progress bars, tap halves to navigate, press-and-hold or Space to pause | `storyProgress.toggle` |
| `swipeDeck` | Card stack decided by swipe, arrow keys, or buttons, with undo | - |

### Display
| Component | Description |
|-----------|-------------|
| `autosave` | Save status driven by `state.status` (`unsaved`, `saving`, `saved`) and `state.savedAt` |
| `counter` | Rolling-digit number with locale-aware currency formatting, sized by the surrounding `font-size`; `--color` sets the digits (`counter--inherit` takes the text color) and a `--fill` gradient replaces it (`counter--shade`); screen readers get the formatted value |
| `loader` | Loading spinner |
| `loading` | Border loading indicator |
| `typewriter` | Animated typing effect |
| `typewriterRetype` | Headline word that is selected and typed over with a jittered, human rhythm; shares the `typewriter` caret variables and `--block`/`--glow`/`--hard`/`--underscore` modifiers, crossfades under reduced motion |
| `highlight` | Layer that glides behind its parent's children on hover and focus and rests on the `--active` one (`target` for nested items, `hover: false` for the active layer only); `line: 'bottom' \| 'left' \| 'right' \| 'top'` adds an edge line to the active layer with both fills kept `--line-inset` clear of it, `fill: false` drops the active background, `--glide-tail-duration-active` longer than `--glide-duration-active` stretches it toward the next item, `--inset-block` / `--inset-inline` pull the fill in from the item |
| `ellipsis` | Animated dots |
| `icon` | SVG sprite wrapper |
| `number` | Number formatting |
| `truncate` | Text truncation |
| `json` | JSON display |
| `announcement` | Animated top-of-page container (`state.active`) that slides its content in and collapses the space it held; the content and close control are the consumer's |
| `undoToast` | List whose deletes wait behind an Undo toast (`toast.*` with a countdown ring) before committing |
| `textProgress` | `progressbar` whose label fills with ink on a spring (`state.value`), with rolling digits and a drawn check on done |
| `wordRotator` | Rotating word (`state.index`, `state.paused`) whose shared letters glide into place while the others blur out and in |
| `heatmap` | Calendar of daily values that sweeps in by column; one `tooltip.shared` delegated across the cells renders each day through your `tooltip(day, index)` template (`describe(day)` names the cell), drag-to-scroll via `scrollbar.drag`, roving-tabindex grid keys and `heatmap.legend`; `heatmap--blue` |
| `relativeTime` | Self-updating `<time>` ("4 min ago") that wakes once per visible change and rolls its digits; full date in a `tooltip` on hover/focus; `state.now` pins the clock |
| `metric` | Card with a title, value, delta and an SVG line chart that draws itself in, with a scrub readout for pointer, touch and arrow keys (`state.active`, `state.index`). Fills its container (`--width: 100%`) and redraws at its measured size on every resize, so the stroke, dot and tip keep their size; the plot height tracks the card width between `--plot-height` bounds, and the delta wraps under the value in narrow cards. A `ReactiveArray` as `data` is live: every mutation (`push`/`shift` for a sliding window, `splice` to replace) redraws the card, which rests on the newest point unless it is being read. Lay cards out with `grid`; `metric--accent` |

### Layout
| Component | Description |
|-----------|-------------|
| `scrollbar` | Native scrollbar styling; `--scrollbar-horizontal` scrolls x only; `--scrollbar-fade` / `--scrollbar-blur` edges driven by scroll timelines, with `scrollbar.fade()` / `scrollbar.blur()` (`@esportsplus/ui/css-utilities/scrollbar`) adding a JS fallback only where those are unsupported; `scrollbar.drag('horizontal' \| 'vertical' \| 'both')` adds mouse drag-to-scroll (`--scrollbar-drag`) |
| `card.scss` | Surface (background, radius, shadow and padding variables); `card--morph` makes it a shell that morphs between stacked `card-morph-layer`s inside a clipping `card-morph-viewport`: size it through `--morph-width`/`--morph-height`, each layer is a `frame frame--swap` (mark the shown one `--active`, set `--i` on the viewport and `--n` on each layer), `--instant` snaps; `--morph-*` variables tune the motion |
| `frame.scss` | Sibling frames sharing one spot, the `--active` one shown: instant by default, `frame--slide` / `frame--scroll` move them like a horizontal / vertical track, `frame--swap` crossfades in place with a directional drift and blur (the `tooltip.shared` swap); shared by `command`, `tooltip.shared`, `card--morph` and `typewriterRetype` |
| `overlay` | Native `<dialog>` driven by `state.active` (Esc and backdrop click close it), placed by `overlay--c` (default), `overlay--n`, `overlay--s`, `overlay--w` or `overlay--e`; edges slide in from their side on the iOS drawer curve and square the corners they touch unless `overlay--floating`. Every overlay but a rail drags to dismiss (toward its edge, or downward when centered) past 25% or on a flick, rubber-bands inward and fades the backdrop with the drag; when its own content scrolls, touch drags only from `overlay.handle`. Overlays opened over one another stack: each covered layer shrinks, dims and peeks out from under the one above (`--stack-scale`, `--stack-dim`, `--stack-peek`) and follows the top layer back as it is dragged away; an `overlay-page` direct child of `<body>` (or of a non-modal overlay's container) recedes the same way; `modal: false` opens without a backdrop, leaves the page interactive and sits in its positioned container; `rail: true` keeps it open non-modal and widens it while a mouse hovers or keyboard focus is inside (or `state.active` is set) from `--width-closed` to `--max-width`, clipping rows rather than reflowing them. Motion: `overlay--fade`, `overlay--scale`, `overlay--spring`, `overlay--alert`, `overlay--blur` |
| `breadcrumb` | Path trail that folds middle segments into a `tooltip.menu` as space runs out, the rest sliding over as each one closes; `onnavigate` intercepts links; `separator: 'chevron' \| 'slash'` (default `'slash'`) |

### Utility
| Component | Description |
|-----------|-------------|
| `back` | Back navigation link |
| `root` | Global event coordination (`root.onclick`) |
| `template` | Template factory helper |

## Component Patterns

### Frame

Import `@esportsplus/ui/frame.scss`. Give sibling elements the `.frame` class
and mark the shown one `.--active`; without a modifier the switch is instant.
Set `--n`, its own index, on each frame and `--i`, the active index (`0`, `1`,
`2`, …), once on the parent. The modifiers animate the switch, stacking the
frames in one grid cell so the tallest sets the height:

- `.frame--slide` / `.frame--scroll` move the frames together like a
  horizontal / vertical track.
- `.frame--swap` crossfades in place, like `tooltip.shared` content: a waiting
  frame sits one `--swap-shift` off to its side, faded and blurred, so the
  incoming frame drifts in while the outgoing one carries on out the other way.
  Frames without an index set the direction themselves through `--travel-x` /
  `--travel-y` and mark the outgoing frame `--leaving`. `--swap-*` variables
  tune it, with `--swap-exit-*` for the outgoing frame.

```html
<div style="overflow: hidden; --i: 1;">
    <div class="frame frame--swap" style="--n: 0;" inert>First frame</div>
    <div class="frame frame--swap --active" style="--n: 1;">Second frame</div>
</div>
```

Moving frames need a clipping parent. Keep inactive frames `inert` and update
tab/panel ARIA attributes alongside the active class. `--scrollbar` thumbs clear
on inactive frames, and on the incoming frame while it carries `.--moving` (set
it on the frame's `translate` transitionrun, clear it on its
transitionend/transitioncancel). The docs include reactive switching examples.

### Sortable

Spread `sortable()` onto any element to make its immediate children draggable.
A dashed `.sortable-placeholder` holds the slot while siblings shift around it,
and the held item swings with the drag's momentum, pivoting on the grab point.
Anything with `.sortable-overlay` inside an item only shows while it is held.

```typescript
html`
    <div class='toolbar sortable--bouncy sortable--jiggle' ${sortable({ handle: '.grip', onsort: (item, from, to) => {} })}>
        <button>…<span class='sortable-overlay'>Reload</span></button>
    </div>
`;
```

Give several containers the same `group` to let items move between them. The
placeholder follows the pointer into whichever group container it is over, and
the `onsort` of the container the drag started in receives the source and target:

```typescript
let options = { group: 'board', onsort: (item, from, to, source, target) => {} };

html`
    <ul ${sortable(options)}>…</ul>
    <ul ${sortable(options)}>…</ul>
`;
```

Combine up to one modifier of each kind:

- Swing (movement-driven): `bouncy`, `damped`, `floppy`, `heavy`, `rigid`, `snappy`, `subtle`, `wobbly`;
  or tune `--swing-angle`, `--swing-damping`, `--swing-stiffness`, `--swing-strength`.
- Animation (while held): `breathe`, `drift`, `float`, `heartbeat`, `jelly`, `jiggle`, `orbit`, `pop`,
  `settle`, `shimmy`, `sway`, `tremble`, `wiggle`; or set `--drag-animation`.

The DOM is reordered directly; reactive lists should update their data in `onsort`.

### Factory Pattern

Components use `template.factory()` supporting flexible call signatures:

```typescript
// No arguments
component()

// Attributes only
component({ class: 'custom' })

// Content only
component(html`<span>Content</span>`)

// Both
component({ class: 'custom' }, html`<span>Content</span>`)
```

### Reactive State

Components can accept and return reactive state:

```typescript
import { reactive } from '@esportsplus/frontend';

let state = reactive({ active: false });

accordion({ state }, html`
  ${() => state.active ? 'Open' : 'Closed'}
`);
```

### Form Integration

```typescript
form.action({
  action: async ({ input, response }) => {
    // input: parsed FormData with dot-notation support
    // response: error handling utilities
    return { errors: [] };
  }
}, content);

// Input with error state
form.input(element, { error: 'Required field' });
```

## Styling

### CSS Layers

Styles are organized into layers for proper cascade:

```
@layer normalize
@layer components
@layer themes
@layer css-utilities
```

### Importing Styles

```scss
// All component styles
@use '@esportsplus/ui/*.scss';

// Specific component
@use '@esportsplus/ui/button.scss';

// CSS utilities
@use '@esportsplus/ui/css-utilities.scss';

// Design tokens
@use '@esportsplus/ui/tokens.scss';

// Theme
@use '@esportsplus/ui/themes/dark/*.scss';
```

### Icons

The icons the components use are exported from `@esportsplus/ui/svg/*.svg`, so a site can match them:

```typescript
import check from '@esportsplus/ui/svg/check.svg';
import { icon } from '@esportsplus/ui';

icon({ class: 'my-check' }, check);
```

Like the components' own SVG imports, these resolve to sprite symbol ids through `@esportsplus/vite`'s svg
plugin. `check.svg` carries no stroke styling, so set `fill: none` and a `stroke` on the rendered `svg`.

### Design Tokens

Located in `tokens.scss`:

- **Colors**: `--color-{name}-{300|400|500}` (black, white, red, green, blue, purple, yellow, grey)
- **Sizing**: `--size-{300-800}` (12px-80px)
- **Spacing**: `--spacing-{0-600}`
- **Border**: `--border-radius-{100-900}`, `--border-width-{100-700}`
- **Typography**: `--font-size-*`, `--font-weight-*`; line height adjusts automatically to each element's font size.

### CSS Utilities

```html
<!-- Layout -->
<div class="--flex --flex-center --gap-200">

<!-- Spacing -->
<div class="--margin-400 --padding-200">

<!-- Typography -->
<p class="--text-uppercase --color-grey-400">

<!-- States -->
<div class="--skeleton --disabled --hidden">
```

### Component Variables

Each component exposes CSS custom properties:

```scss
.ui-button {
  --background: var(--color-blue-400);
  --color: var(--color-white-400);
  --border-radius: var(--border-radius-300);
  --padding-horizontal: 16px;
  --padding-vertical: 8px;
}
```

## Theming

```typescript
// JavaScript
import '@esportsplus/ui/themes/dark';

// SCSS
@use '@esportsplus/ui/themes/dark/*.scss';
```

Themes override component variables. Create custom themes by overriding CSS custom properties.

## Build

```bash
pnpm build         # Full build (SCSS + TypeScript)
pnpm build:vite    # SCSS compilation only
pnpm build:ts      # TypeScript compilation only
```

### Output Structure

```
build/
├── components/
│   ├── {component}/
│   │   ├── index.js
│   │   ├── index.d.ts
│   │   └── scss/index.scss
│   └── index.js
├── css-utilities/
│   └── font/
└── themes/
    ├── dark/
    └── light/
```

## Fonts

Import the font stylesheet and apply its family class to `html` or `body`:

```typescript
import '@esportsplus/ui/css-utilities/font/montserrat.scss';

document.documentElement.classList.add('--font-montserrat');
```

`@esportsplus/ui/css-utilities/font/geist.scss` includes Geist Sans and Geist Mono,
selected with `--font-geist` and `--font-geist-mono`. The aggregate
`@esportsplus/ui/css-utilities.scss` includes all three families.

Family classes define `--font-family` and their `--font-weight-*` token maps.
Components consume these variables through their own `font-family` and
`font-weight` declarations. Nested family classes override the inherited tokens.
The root component no longer chooses Montserrat automatically.

Fonts are bundled as local assets for the consuming app to serve; no runtime CDN
is required. Geist Sans and Geist Mono include variable weights 100–900 in normal
and italic styles. The previous `@esportsplus/ui/fonts` entry point has been removed.

## TypeScript

Full type safety with zero `any` types:

```typescript
import type { Attributes } from '@esportsplus/frontend';

// Components are generic
template.factory<A extends Attributes, C>(fn);

// State types are explicit
type State = {
  active: boolean;
  error: string;
};
```

## Performance

- **Compile-time transforms**: Template expressions optimized at build
- **Tree-shakeable**: Import only what you use
- **WeakMap caching**: Memoized formatters and icons
- **Object pooling**: Reused queue structures
- **RAF batching**: Coalesced DOM updates
- **CSS layers**: Efficient cascade resolution

## Credits

Many interaction designs (carousels, pickers, text effects and more) are ported from
[ui-lab](https://github.com/xevrion/ui-lab) by Yash Bavadiya, MIT licensed, © 2026 Yash Bavadiya.

## License

MIT
