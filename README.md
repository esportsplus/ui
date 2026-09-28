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
| `input` | Text input with validation state | - |
| `textarea` | Multi-line text input | - |
| `checkbox` | Checkbox with label; `checkbox.group` builds a checklist with a select-all header (mixed state), optional counter, and Shift-click ranges | `checkbox.group` |
| `radio` | Radio button group | - |
| `range` | Range slider | - |
| `datalist` | Inertial wheel picker (scroll-snapped listbox) | - |
| `select` | Dropdown with custom options | - |
| `switch` | Toggle switch; `switch.group` builds the same group as `checkbox.group` with switches, the select-all knob resting midway when mixed | `switch.group` |
| `tasklist` | Checklist that strikes through checked tasks and moves them below the open ones | `tasklist.checkbox` |
| `form` | Form wrapper | `form.action`, `form.input` |
| `cc` | Payment card form (`input` fields) with a live card preview that flips for the CVC, brand detection, caret-safe formatting and Luhn/expiry validation; `onvalid` receives brand, last 4, expiry and name | `cc.field`, `cc.submit` |
| `colorPicker` | Saturation pad, hue/opacity sliders (`range`), hex field (`input`), and an animated recent-colors row (hidden while empty); `value` is required, no surface of its own, so place it in a `card` | `colorPicker.swatch` |
| `dateRangePicker` | Two-month calendar (one below 540px) with presets, a hover-preview band, sliding month changes, full grid keyboard navigation and an Apply confirmation; `state.start`/`state.end` are ISO dates, `onapply` receives the range, `dateRangePicker.describe` formats it | `dateRangePicker.day` |
| `emailTypoFix` | Email field (`input`) that suggests a fix for common domain typos after a pause, applying it with a letter-morph; `state.sent` swaps the hint for a sent note | `emailTypoFix.field`, `emailTypoFix.suggest` |
| `inlineEdit` | Click-to-edit text that swaps in an `input` (or `textarea` with `multiline`) without moving a glyph; Enter/blur saves, Escape cancels, `onsave` fires | `inlineEdit.display`, `inlineEdit.field` |
| `multiStepForm` | Stepped `form.action` card (`input`, `radio`) with a progress bar, directional step transitions, focus moved into each step and a height that springs to fit; `state.panel`, `oncreate`, custom `plans` | `multiStepForm.input` |
| `rangeFilter` | Range filter with rolling-digit values, a Clear button, a ghost preview of where a click would stretch the selection, and scale ticks; a number `value` gives one thumb, a pair gives two that stop at each other; `fields` adds editable min/max `input` fields, `disabled`; `state.low`/`state.high`, `format`, `prefix`, `step`, `ticks` | - |
| `scrubInput` | Numeric `input` whose label scrubs the value on drag (Shift ×10, Alt ×0.1, optional pointer lock) over a tape measure; arrows step, Escape restores | `scrubInput.field`, `scrubInput.label` |
| `selectMenu` | macOS-style listbox opening with the selected option over the trigger, with typeahead and hover scrolling | - |
| `tagInput` | Chip field (`input`) turning typed or pasted text into tags that form in place, nudge on duplicates, and go on a double Backspace; `name` submits `name[]` | `tagInput.field` |
| `waitlistJoin` | Waitlist signup (`form.action`, `input`) with friendly email validation, a queue strip you drop into and hop along (FLIP), a rolling `counter` position and a referral link copied via `clipboard.write`; `onjoin` | `waitlistJoin.input` |

### Interactive
| Component | Description | Variants |
|-----------|-------------|----------|
| `button` | Standard button | `button.fan`, `button.hold` |
| `tooltip` | Popup content; `tooltip.onhover` also opens on keyboard focus and closes on Escape, and `tooltip.onhover.trigger({ delay, state })` is the same behaviour to spread on your own `.tooltip` element; `delay: { open?, close? }` (ms, on `tooltip.onhover` and `tooltip.shared`; each left out is instant) holds the pointer before opening and after leaving, and for 500ms after a delayed tooltip closes the next opens at once, without its entrance; `tooltip.menu` is a keyboard menu (arrows, Home/End, Escape returns focus, Tab closes) that closes once an option is chosen; `tooltip.shared({ delay, direction, interactive, state })` is one tooltip for any number of triggers: spread `tip.bind(content)` on a trigger (a string, or a function returning a template, rendered on every open), or `tip.delegate({ content, edge, selector })` on a container to make every matching descendant a trigger (default `[data-tooltip]`, its value the content; `edge` lines the tooltip up past the container's edge), and place `tip.render(attributes)` once; it opens in the top layer beside the trigger, flips when out of room, and glides between triggers while its content slides in the direction of travel; `interactive` makes it a card the pointer can enter, toggled by taps and keys, with Tab carried into it | `tooltip.context`, `tooltip.menu`, `tooltip.onclick`, `tooltip.onhover`, `tooltip.onhover.trigger`, `tooltip.shared` |
| `accordion` | Collapsible sections | - |
| `clipboard` | Copy to clipboard | `clipboard.copy`, `clipboard.write` |
| `command` | ⌘K/Ctrl+K command palette on `modal` + `input`: substring-then-subsequence matching with highlighted runs, grouped results, arrow/Enter keys, `onrun`; `sidebar` adds a tab rail whose views scroll vertically (`tabs--scroll`) and cycle with Tab/Shift+Tab (Home lists recent commands, persisted through any `store` implementing `get`/`set`; Commands lists every command; a keyboard view lists `shortcuts`); setting `state.tab` switches views and clears the search. Icons are sprite ids; `.command-trigger` also styles standalone search buttons | `command.dialog` (e.g. `modal--blur`), `command.input`, `command.option`, `command.trigger`, `command--centered` |
| `alert` | Notifications | error, info, success types |
| `dock` | macOS-style `card` shelf whose icons swell toward the cursor on a spring, with delayed `tooltip` labels (`group` shares one gliding `tooltip.shared` label) and a hop-and-squash launch that lights a running dot (per-item `state.running`, `onlaunch`) | `dock.button`, `dock--square` |
| `card.expand` | List of `card--expand` cards that each morph into their own `card` `modal` and fly back into their slot through a view transition (a plain `modal` fade where unsupported, a cross-fade under reduced motion); `state.open` is two-way | `card.expand.trigger` |
| `kanbanBoard` | Columns of cards dragged within and between lists (built on `sortable` groups), with keyboard moves | - |
| `morphingButton` | Async save button that morphs into a spinner circle, confirms with a check, and shakes on failure | `morphing-button--blue` |
| `pageDots` | Page indicator driven by a continuous `state.progress`; the pill stretches between dots like a worm, with an optional autoplay countdown | `page-dots--large` |
| `pullToRefresh` | Rubber-band pull gesture (touch and mouse) with a stepped tick spinner; new items above the old first one slide in | - |
| `selectionToolbar` | Contenteditable text with a floating bold/italic/link/highlight/copy toolbar that follows the selection | `selection-toolbar--white` |
| `shareButton` | Share pill that reshapes into copy-link (via `clipboard.write`), X, email and native share targets | `share-button--surface` |
| `snapCarousel` | Native scroll-snap card carousel with mouse flick, scroll-driven focus scaling, and edge-aware arrows | `snapCarousel.arrow`, `snapCarousel.card` |
| `sortable` | Drag-and-drop reordering of an element's children, across containers with `group` | `sortable--{effect}` modifiers |
| `statusPicker` | Avatar presence menu (`menuitemradio`) whose shaped badge spins into the next status | - |
| `storyProgress` | Auto-advancing stories with segmented progress bars, tap halves to navigate, press-and-hold or Space to pause | `storyProgress.toggle` |
| `swipeDeck` | Card stack decided by swipe, arrow keys, or buttons, with undo | - |

### Display
| Component | Description |
|-----------|-------------|
| `autosave` | Save status driven by `state.status` (`unsaved`, `saving`, `saved`) and `state.savedAt` |
| `counter` | Animated number with currency formatting |
| `loader` | Loading spinner |
| `loading` | Border loading indicator |
| `typewriter` | Animated typing effect |
| `typewriterRetype` | Headline word that is selected and typed over with a jittered, human rhythm; shares the `typewriter` caret variables and `--block`/`--glow`/`--hard`/`--underscore` modifiers, crossfades under reduced motion |
| `highlight` | Viewport intersection highlight |
| `ellipsis` | Animated dots |
| `icon` | SVG sprite wrapper |
| `number` | Number formatting |
| `truncate` | Text truncation |
| `json` | JSON display |
| `taskList` | Streaming log of an agent's tasks and steps |
| `webSearch` | Streaming trail of an agent's searches and the sources it opened |
| `announcement` | Animated top-of-page container (`state.active`) that slides its content in and collapses the space it held; the content and close control are the consumer's |
| `dynamicIsland` | Morphing pill that springs between idle, timer, music and ringer states (`state.mode`) with announced changes |
| `featureSpotlight` | Scroll-driven product tour: a pinned screenshot whose spring camera pans and zooms to the `data-spot` (or `region`) of the feature being read, with a dimming spotlight |
| `onboardingChecklist` | Setup checklist (`checkbox` rows, `accordion` details) with a spring progress ring, strike-through on done, and a celebration once every task is complete; `done`, `open`, `ondismiss`, `state.count` |
| `undoToast` | List whose deletes wait behind an Undo toast (`toast.*` with a countdown ring) before committing |
| `textProgress` | `progressbar` whose label fills with ink on a spring (`state.value`), with rolling digits and a drawn check on done |
| `wordRotator` | Rotating word (`state.index`, `state.paused`) whose shared letters glide into place while the others blur out and in |
| `contributionHeatmap` | Year of activity squares that sweep in by column, with a hover label (reuses `tooltip` styles), roving-tabindex grid keys and `contributionHeatmap.legend`; `contribution-heatmap--blue` |
| `relativeTime` | Self-updating `<time>` ("4 min ago") that wakes once per visible change and rolls its digits; full date in a `tooltip` on hover/focus; `state.now` pins the clock |
| `sparkline` | Inline SVG line chart that draws itself in, with a scrub readout for pointer, touch and arrow keys (`state.active`, `state.index`); `sparkline--accent` |
| `statCounter` | Metric cards whose numbers roll via `counter--ticker`, with trend chips and scrubbable mini sparklines; update through `state.stats` |

### Layout
| Component | Description |
|-----------|-------------|
| `scrollbar` | Native scrollbar styling; `--scrollbar-horizontal` scrolls x only; `--scrollbar-fade` / `--scrollbar-blur` edges driven by scroll timelines, with `scrollbar.fade()` / `scrollbar.blur()` (`@esportsplus/ui/css-utilities/scrollbar`) adding a JS fallback only where those are unsupported; `scrollbar.drag('horizontal' \| 'vertical' \| 'both')` adds mouse drag-to-scroll (`--scrollbar-drag`) |
| `card.scss` | Surface (background, radius, shadow and padding variables); `card--morph` makes it a shell that morphs between stacked `card-morph-layer`s inside a clipping `card-morph-viewport`: size it through `--morph-width`/`--morph-height`, mark the shown layer `--active` and the layers ahead of it `--before`, `--instant` snaps; `--morph-*` variables tune the motion |
| `tabs.scss` | Tab panels: instant by default, `tabs--slide` for horizontal motion, `tabs--scroll` for vertical motion |
| `sidebar` | Side navigation |
| `modal` | Native `<dialog>` modal driven by `state.active` (Esc and backdrop click close it) |
| `overlay` | Full-viewport overlay container |
| `breadcrumb` | Path trail that folds middle segments into a `tooltip.menu` as space runs out, the rest sliding over as each one closes; `onnavigate` intercepts links; `separator: 'chevron' \| 'slash'` (default `'slash'`) |
| `morphingNav` | Navigation bar whose dropdown panel morphs size, position and caret between sections on hover intent, with full keyboard support (`state.active`) |
| `scrollSpine` | Scale-drawing table of contents: bands sized to each section fill as you read, and a spring marker stretches between them |
| `sheet` | Bottom sheet on `modal` (`modal--sheet`) that drags to dismiss past 25% or on a flick, rubber-bands upward, and fades its backdrop with the drag (`sheet.handle`, `sheet--full`) |
| `slidingTabs` | Tab list whose underline stretches toward the new tab and gathers under it, with a hover pill and cross-sliding `tabs.scss` panels (`state.selected`) |
| `stickyStack` | Sticky cards that scale and dim as the next one slides over (scroll-driven animations, with a scroll-listener fallback) |

### Utility
| Component | Description |
|-----------|-------------|
| `back` | Back navigation link |
| `root` | Global event coordination (`root.onclick`) |
| `template` | Template factory helper |

## Component Patterns

### Tabs

Import `@esportsplus/ui/tabs.scss`. Put `.tabs-content` panels inside `.tabs`
and apply `.--active` to the selected panel. The default switch is instant.
For motion, add `.tabs--slide` (horizontal) or `.tabs--scroll` (vertical),
and set `--i` to the negative selected index: `0`, `-1`, `-2`, etc.

```html
<div style="overflow: hidden; height: 300px;">
    <div class="tabs tabs--scroll" style="--i: -1;">
        <div class="tabs-content" inert aria-hidden="true">First panel</div>
        <div class="tabs-content --active">Second panel</div>
    </div>
</div>
```

Animated tracks need a clipping parent; vertical tracks also need a definite
parent height. Keep inactive panels `inert` and update tab/panel ARIA attributes
alongside the active class. The docs include reactive switching examples.

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

### Task List and Web Search

Both stream an agent's work one unit at a time. A task is one unit for its
header plus one per step; a search step is one unit, plus one more for its
Sources row when it has `sources`. On their own they pace themselves
(`startDelay`, `stepInterval`, and per-step `dwell` for web search) and call
`onComplete` once the last unit lands. Pass `state` to drive them from real
events instead; the internal timer switches off.

```typescript
import { taskList, webSearch } from '@esportsplus/ui';

taskList({
    collapseOnComplete: 'all',
    onComplete: () => showAnswer(),
    tasks: [
        { runningTitle: 'Editing files', steps: [{ chips: [{ label: 'layout.tsx' }], label: 'Wired it into' }], title: 'Registered the toggle' }
    ]
});

let state = reactive({ revealed: 0 });

webSearch({
    state,
    steps: [
        { brand: 'reddit', label: 'Searched Reddit for', meta: '12 threads', query: 'design tokens' },
        { label: 'Opened the top results', sources: [{ brand: 'github', domain: 'github.com', href: 'https://github.com', title: 'Registry model' }] }
    ]
});

// Advance as each tool call resolves.
state.revealed++;
```

`working` relabels the trailing indicator, or `false` drops it. `brand` accepts
any of the 24 built-in site marks; anything else takes an `icon`.

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

Many interaction designs (kanban board, carousels, pickers, text effects and more) are ported from
[ui-lab](https://github.com/xevrion/ui-lab) by Yash Bavadiya, MIT licensed, © 2026 Yash Bavadiya.

## License

MIT
