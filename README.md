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
| `checkbox` | Checkbox with label | - |
| `composer` | Chat input with toolbar actions, send button and footer | - |
| `radio` | Radio button group | - |
| `range` | Range slider | - |
| `datalist` | Inertial wheel picker (scroll-snapped listbox) | - |
| `select` | Dropdown with custom options | - |
| `switch` | Toggle switch | - |
| `tasklist` | Checklist that strikes through checked tasks and moves them below the open ones | `tasklist.checkbox` |
| `form` | Form wrapper | `form.action`, `form.input` |
| `cardInput` | Payment card form (`input` fields) with a live card preview that flips for the CVC, brand detection, caret-safe formatting and Luhn/expiry validation; `onvalid` receives brand, last 4, expiry and name | `cardInput.field`, `cardInput.submit` |
| `checkboxGroup` | Checklist built on `checkbox` with a select-all parent (mixed state), drawn marks, and Shift-click ranges | - |
| `colorPicker` | Saturation pad, hue/opacity sliders (`range`), hex field (`input`), and an animated recent-colors row | - |
| `dateRangePicker` | Two-month calendar (one below 540px) with presets, a hover-preview band, sliding month changes, full grid keyboard navigation and an Apply confirmation; `state.start`/`state.end` are ISO dates, `onapply` receives the range, `dateRangePicker.describe` formats it | `dateRangePicker.day` |
| `emailTypoFix` | Email field (`input`) that suggests a fix for common domain typos after a pause, applying it with a letter-morph; `state.sent` swaps the hint for a sent note | `emailTypoFix.field`, `emailTypoFix.suggest` |
| `inlineEdit` | Click-to-edit text that swaps in an `input` (or `textarea` with `multiline`) without moving a glyph; Enter/blur saves, Escape cancels, `onsave` fires | `inlineEdit.display`, `inlineEdit.field` |
| `multiStepForm` | Stepped `form.action` card (`input`, `radio`) with a progress bar, directional step transitions, focus moved into each step and a height that springs to fit; `state.panel`, `oncreate`, custom `plans` | `multiStepForm.input` |
| `radioCards` | Native radio group (`radio`) laid out as cards with a selection ring that glides between them | - |
| `rangeSlider` | Dual-thumb slider whose thumbs stop at each other, glide on track clicks and keys, show a value tooltip while dragged or focused, and pair with editable min/max `input` fields; `state.low`/`state.high`, `format`, `prefix` | `rangeSlider.input`, `rangeSlider.thumb` |
| `scrubInput` | Numeric `input` whose label scrubs the value on drag (Shift ×10, Alt ×0.1, optional pointer lock) over a tape measure; arrows step, Escape restores | `scrubInput.field`, `scrubInput.label` |
| `selectMenu` | macOS-style listbox opening with the selected option over the trigger, with typeahead and hover scrolling | - |
| `tagInput` | Chip field (`input`) turning typed or pasted text into tags that form in place, nudge on duplicates, and go on a double Backspace; `name` submits `name[]` | `tagInput.field` |
| `waitlistJoin` | Waitlist signup (`form.action`, `input`) with friendly email validation, a queue strip you drop into and hop along (FLIP), a rolling `counter` position and a referral link copied via `clipboard.write`; `onjoin` | `waitlistJoin.input` |

### Interactive
| Component | Description | Variants |
|-----------|-------------|----------|
| `button` | Standard button | `button.fan`, `button.hold` |
| `tooltip` | Popup content | `tooltip.context`, `tooltip.menu`, `tooltip.onclick`, `tooltip.onhover` |
| `accordion` | Collapsible sections | - |
| `clipboard` | Copy to clipboard | `clipboard.copy`, `clipboard.write` |
| `command` | Command palette: modal + input, grouped live filtering, keyboard navigation | `command.input`, `command.item` |
| `alert` | Notifications | error, info, success types |
| `backToTop` | Floating back-to-top button with a scroll-progress ring and an arrow that lifts off; follows the window or any scroller | `back-to-top--dark`, `back-to-top--fixed` |
| `bookmarkButton` | Save toggle whose ribbon fills from the bottom and lands with a squash, with an optional rolling count | `bookmark-button--white` |
| `carousel3d` | Draggable 3D card ring that spins on a spring, throws with momentum, and flattens under reduced motion; `state.active` is two-way | `carousel3d.button`, `carousel3d.card` |
| `commandPalette` | ⌘K/Ctrl+K launcher on `modal` + `input`: substring-then-subsequence matching with highlighted runs, grouped results, arrow/Enter keys, `onrun` | `commandPalette.dialog`, `commandPalette.input`, `commandPalette.option`, `commandPalette.trigger`, `command-palette--blur`, `command-palette--centered` |
| `dock` | macOS-style dock whose icons swell toward the cursor on a spring, with delayed `tooltip` labels and a hop-and-squash launch that lights a running dot (per-item `state.running`, `onlaunch`) | `dock.button`, `dock--square`, `dock--subtle` |
| `expandingCard` | Card list whose cards morph (FLIP) into a `modal` detail dialog and fly back into their slot; `state.open` is two-way | `expandingCard.card` |
| `hoverCard` | Inline trigger with a delayed preview card (open 500ms, close grace 150ms); triggers sharing `hoverCard.group()` hand the card over instantly, travelling between them; tap, focus and Escape supported | `hoverCard.content`, `hoverCard.group`, `hoverCard.trigger`, `hover-card--fade` |
| `kanbanBoard` | Columns of cards dragged within and between lists (built on `sortable` groups), with keyboard moves | - |
| `morphingButton` | Async save button that morphs into a spinner circle, confirms with a check, and shakes on failure | `morphing-button--blue` |
| `pageDots` | Page indicator driven by a continuous `state.progress`; the pill stretches between dots like a worm, with an optional autoplay countdown | `page-dots--large` |
| `pullToRefresh` | Rubber-band pull gesture (touch and mouse) with a stepped tick spinner; new items above the old first one slide in | - |
| `selectionToolbar` | Contenteditable text with a floating bold/italic/link/highlight/copy toolbar that follows the selection | `selection-toolbar--white` |
| `shareButton` | Share pill that reshapes into copy-link (via `clipboard.write`), X, email and native share targets | `share-button--surface` |
| `shortcutSheet` | Searchable keyboard-shortcut reference on `modal` + `input`, opened with `?`; pressing a listed shortcut lights its row and keycaps (`Mod` = ⌘/Ctrl) | `shortcutSheet.dialog`, `shortcutSheet.input`, `shortcutSheet.row`, `shortcutSheet.trigger`, `shortcut-sheet--blur` |
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
| `announcementBanner` | Dismissible top-of-page announcement that slides in and collapses the space it held |
| `dynamicIsland` | Morphing pill that springs between idle, timer, music and ringer states (`state.mode`) with announced changes |
| `featureSpotlight` | Scroll-driven product tour: a pinned screenshot whose spring camera pans and zooms to the `data-spot` (or `region`) of the feature being read, with a dimming spotlight |
| `onboardingChecklist` | Setup checklist (`checkbox` rows, `accordion` details) with a spring progress ring, strike-through on done, and a celebration once every task is complete; `done`, `open`, `ondismiss`, `state.count` |
| `undoToast` | List whose deletes wait behind an Undo toast (`toast.*` with a countdown ring) before committing |
| `textProgress` | `progressbar` whose label fills with ink on a spring (`state.value`), with rolling digits and a drawn check on done |
| `wordRotator` | Rotating word (`state.index`, `state.paused`) whose shared letters glide into place while the others blur out and in |
| `codeMorph` | Stepped code tabs (`state.step`) diffed at token level: shared tokens glide to their new line and column, new ones fade in, removed ones flash red; copy via `clipboard.write` |
| `contributionHeatmap` | Year of activity squares that sweep in by column, with a hover label (reuses `tooltip` styles), roving-tabindex grid keys and `contributionHeatmap.legend`; `contribution-heatmap--blue` |
| `relativeTime` | Self-updating `<time>` ("4 min ago") that wakes once per visible change and rolls its digits; full date in a `tooltip` on hover/focus; `state.now` pins the clock |
| `sparkline` | Inline SVG line chart that draws itself in, with a scrub readout for pointer, touch and arrow keys (`state.active`, `state.index`); `sparkline--accent` |
| `statCounter` | Metric cards whose numbers roll via `counter--ticker`, with trend chips and scrubbable mini sparklines; update through `state.stats` |

### Layout
| Component | Description |
|-----------|-------------|
| `breadcrumb` | Navigation trail: `breadcrumb.list`, `.item`, `.link`, `.menu`, `.page`, `.separator`, `.ellipsis` |
| `scrollbar` | Native scrollbar styling |
| `tabs.scss` | Tab panels: instant by default, `tabs--slide` for horizontal motion, `tabs--scroll` for vertical motion |
| `sidebar` | Side navigation |
| `modal` | Native `<dialog>` modal driven by `state.active` (Esc and backdrop click close it) |
| `overlay` | Full-viewport overlay container |
| `breadcrumbs` | Path trail that folds middle segments into a `tooltip.onclick` menu as space runs out, sliding the rest over (FLIP); `onnavigate` intercepts links |
| `collapsibleSidebar` | Navigation rail that springs between labelled and icon-only widths, with a sliding highlight and `tooltip-message` tips while collapsed (`state.expanded`, `state.selected`) |
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
