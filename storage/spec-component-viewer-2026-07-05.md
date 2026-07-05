# Component Viewer Dev App — Feature Spec

## Clarifying Questions

> Answer inline under each **A:**, then tell me you're done. Blocking questions gate the items they list; optional questions already have a sensible default applied — fill one in only to override. I'll apply your answers and move each answered question to the Answered log (I won't ask it again).

### Open — Optional
- **Q1** · viewer location + dev script · affects: [P1] · assumed: top-level `viewer/` directory; `"dev": "vite --config viewer/vite.config.ts"` added to root package.json scripts (alphabetical placement)
  Keep the viewer in a top-level `viewer/` dir with a root `pnpm dev` script?
  **A:**
- **Q2** · excluded components · affects: [P4, P5, P6, P7] · assumed: form, normalize, root, site, template excluded from the demo registry as infrastructure — the viewer shell itself demonstrates site/sidebar/root/normalize; 39 components demoed
  Exclude form/normalize/root/site/template from the registry?
  **A:**
- **Q3** · visual theme · affects: [P3, P4] · assumed: library defaults from root tokens (`--background: var(--color-grey-400)` light chrome); themes/dark button + link scss loaded so dark color variants appear as labeled variants; TS dark presets (input/select/textarea) shown as labeled "dark preset" variants where trivially safe; no full dark chrome
  Light default chrome with dark variants shown inline?
  **A:**
- **Q4** · sidebar labels · affects: [P2] · assumed: lowercase component names matching directory names; 'all' first, rest alphabetical
  Lowercase directory-name labels, 'all' first?
  **A:**

### Answered
(none yet — all four questions above proceeded on stated assumptions; items stay PENDING)

## Metadata
- **Generated**: 2026-07-05
- **Research sources**: in-context session findings (spec-creator Mode 4) — verified same-session by reading `d:\ui` source, `node_modules` type declarations (@esportsplus/template, @esportsplus/reactivity, @esportsplus/vite, @esportsplus/utilities), and consumer repos (esportsplus-archive/hollow-lands, blsh.trade) via gh api. No web research; no external `Sn` registry.
- **Threshold**: N/A (no performance features)
- **Benchmark command**: N/A

## Baseline
- **Commit**: record `git rev-parse HEAD` at execution start
- **Test suite**: none in repo (package scripts: `build` = `run-s build:vite build:ts` only). Regression gate for every feature: `pnpm build` stays green (library build untouched) — the viewer is dev-only and must never enter the publish path.

## Global constraints (apply to every feature)
- No new dependencies — everything needed is already installed.
- Do NOT modify root `vite.config.ts` (library scss build) or root `tsconfig.json`; the ONLY root-file edit in this spec is adding the `dev` script to `package.json` (P1).
- Viewer is dev-only: no production build target; acceptance = vite dev server behavior.
- User's global coding standards apply (4-space indent, LF, alphabetized-but-dependency-safe ordering, `let` for locals, `function` for internals / `const` arrows for exports, exports at bottom, zero `any`, comments only for non-obvious why).
- The 'All' page MUST render through the exact same `viewer/category.ts` component as single-category pages — one implementation, two call arguments (user requirement).
- Reactive signals drive category switching — no router.
- Dev consumes SOURCE scss/ts directly (not `build/` outputs), so the library's `@layer` wrapper (a build-plugin artifact) is ABSENT: CSS cascade correctness relies entirely on import order — normalize → fonts → css-only components → (TS component scss transitively) → themes/dark → css-utilities LAST. Never let an alphabetization pass reorder the side-effect scss imports in `viewer/index.ts` (dependency-safe rule: cascade order is a load-bearing dependency).

## Batch 1 — Scaffold & shell

### [P2] Viewer core: types, registry seed, category page, app shell, chrome scss
- **Type**: feature
- **Recommended-model**: opus
- **Status**: PENDING
- **Group**: infrastructure
- **Source**: session evidence §2, §5 (sidebar/site/scrollbar contracts), §6 (class vocabulary), §8 (user requirements), §9 (agreed architecture)
- **Rationale**: The chrome is the product: a floating left sidebar whose reactive state selects which components render on the main page, with ONE category-page component reused by both single-category and 'All' views (user requirement).
- **Changes**: new `viewer/types.ts`, `viewer/demos/index.ts` (seed), `viewer/category.ts`, `viewer/app.ts`, `viewer/index.scss`.
- **Design**:
  - `viewer/types.ts` — `type Entry = { name: string; variants: Variant[] }`, `type Variant = { render: () => Renderable; title: string }` (`Renderable` from `@esportsplus/template`); `export type { Entry, Variant };` at bottom. The `render` thunk is load-bearing: variants instantiate lazily at template evaluation, so component instances re-create on every category switch.
  - `viewer/demos/index.ts` (seed) — `import { Entry } from '../types';` then `const entries: Entry[] = [];` and named export `entries` at bottom (registry is a barrel-like aggregator: named export, no default). Demo batches (P4–P7) append default imports + array members, both alphabetical. Registry order IS sidebar order. Excluded by design (Q2): form, normalize, root, site, template — infrastructure; the viewer shell itself demonstrates site/sidebar/root/normalize, and form's scss loads transitively via input/checkbox/select imports.
  - `viewer/category.ts` — THE reused page: `(entries: Entry[]) => Renderable`. For each entry: a section with a header separator (`<h2>` styled in index.scss — this is the 'All' page's visual divider) followed by the entry's variants as cards, each card showing `variant.title` and `variant.render()`. Use library vocabulary: `.grid` (auto-fit columns, `--min-width: 200px` default) for the variant layout, `.card` for variant frames; viewer-owned classes (`viewer-entry`, `viewer-variant`, ...) for chrome styling. Single-category and 'All' views differ ONLY in the array passed in.
    - **Verify-on-contact**: confirm `html\`\`` interpolation accepts an array of Renderables (e.g. from `.map`) by grepping existing usage in `src/components/` or consumer repos; if not supported, compose via the template lib's documented list mechanism.
  - `viewer/app.ts` — module-level `let state = reactive({ category: 'all' });` (`reactive` from `@esportsplus/reactivity`). Imports `entries` from `./demos` and the component barrel via `~/components` (paths-mapped). Composition:
    - Sidebar: library component — `sidebar({ class: 'sidebar--floating sidebar--w --active' }, items)`. `sidebar` = `scrollbar.bind` class `'sidebar'`; scss: position absolute, `--width-default: 320px`, `--w` = left placement, `--floating` adds `--size-100` margins, explicit `.--active` is the safe state (state(default) sets `--width: var(--width-closed)` which defaults equal to `--width-default` — no visual collapse, but be explicit).
    - Items: `'all'` first, then `entries` names (already alphabetical, lowercase dir names per Q4). Each item a `.link` element that (a) binds `.--active` from `${() => state.category === name ? '--active' : ''}` and (b) writes `state.category = name` on click.
    - Content region: `<main class='viewer-main'>` containing a thunk binding — `${() => category(state.category === 'all' ? entries : entries.filter((entry) => entry.name === state.category))}` — reading `state.category` inside the thunk auto-tracks; the whole category page re-renders on switch. This one expression IS the 'All'-reuse requirement.
    - **Verify-on-contact (event-binding syntax)**: grep `src/components/tooltip/onclick.ts`, `src/components/clipboard/`, `src/components/button/` for the exact `html\`\`` event-binding syntax (`onclick=${...}` or equivalent) and copy it verbatim.
  - `viewer/index.scss` — minimal viewer chrome, token vars only, NO hardcoded colors: `.viewer-main` left offset clearing the floating 320px sidebar (sidebar's `--width-default` is scoped to `.sidebar`, so define a viewer-owned width var; spacing from `--size-*` tokens) + padding; entry header separator (border from `--color-border-*` tokens, spacing from `--size-*`); variant card/grid spacing. Implementer decides exact values; criterion: sidebar never overlaps content, headers read as separators on the 'All' page.
- **Layers**: types/data model, reactive state, UI composition, styling
- **Acceptance**: `tsc -p viewer/tsconfig.json` exits clean (P1's config). All viewer imports of library code go through `~/components...` — NEVER `'@esportsplus/ui'` (the vite alias exists only for the two self-importing library files; TS cannot resolve it). Visual acceptance lands in P3.
- **Context**: `src/components/index.ts` (barrel names), `src/components/sidebar/`, `src/components/scrollbar/`, `src/tokens/` (var names), `src/components/root/scss/variables.scss` (`:root` custom properties)
- **Depends-on**: P1
- **Verify**: `pnpm exec tsc -p viewer/tsconfig.json`
- **Notes**: Importing the `~/components` barrel transitively loads EVERY TS component's scss (root/index.ts among them imports the `:root` variables scss — required for anything to look right); this is intended and replaces explicit TS-component scss imports in P3. `state(...)` convention (tokens/scss/state.scss): `.--active` / `:not(.--active)` / `.--disabled` — toggling `.--active` drives sidebar/modal/anchor/tooltip visibility everywhere.

### [P3] Bootstrap entry: cascade-ordered css imports + render
- **Type**: feature
- **Recommended-model**: opus
- **Status**: PENDING
- **Group**: infrastructure
- **Source**: session evidence §3 (consumer bootstrap pattern), §4 (css-only inventory), §6 (themes/dark), §9 (agreed css order)
- **Rationale**: Dev mode has no `@layer` wrapper, so the cascade is import order — one wrong ordering and utilities lose to component rules. The entry also proves the whole toolchain (compiler plugin, aliases, paths) end to end.
- **Changes**: new `viewer/index.ts`; wire to P1's `index.html`.
- **Design**:
  - CSS imports, EXACTLY this cascade order (side-effect imports — order is load-bearing, exempt from alphabetization):
    1. `~/components/normalize/scss/index.scss`
    2. `~/fonts/montserrat` (its index.ts imports the @font-face scss; required for `--font-family: 'Montserrat'` to resolve)
    3. CSS-only component scss, alphabetical: anchor, banner, border, bubble, card, container, grid, link, modal, page, text, thumbnail — each as `~/components/<name>/scss/index.scss`
    4. (TS-component scss: NO explicit imports — arrives transitively via the `~/components` barrel that `app.ts` imports)
    5. themes/dark scss for button and link (**verify-on-contact**: glob `src/themes/dark/` for the exact scss file layout before writing these two import paths)
    6. `~/css-utilities/index.scss` — utilities LAST so they win the cascade
    7. `./index.scss` — viewer chrome last of all (distinct `viewer-*` class namespace; cascade-safe)
  - Then: `import { render } from '@esportsplus/template';`, `import { site } from '~/components';`, import the app from `./app`, and `render(document.body, site({ class: 'scrollbar-container--full' }, <app renderable>))` — the verified blsh.trade pattern (CURRENT signature is `render(parent, renderable)`; hollow-lands shows an older reversed order — do not copy it). `site` = `scrollbar.bind` class `'site'` + root onclick wiring. Implementer decides whether app.ts exports the composed renderable or a factory; criterion: index.ts stays a thin entry (css + one render call).
- **Layers**: entry point, css cascade, app mount
- **Acceptance**: `pnpm dev` renders the shell: Montserrat font active, `--background` grey-400 page, floating left sidebar showing 'all', empty main region ('all' with zero entries). Zero console errors — specifically NO `"html\`\` templates must be compiled"` throw (proves compiler plugin) and no unresolved `~/components/...` or `'@esportsplus/ui'` imports (proves paths + alias, closing P1's verify-on-contact). `tsc -p viewer/tsconfig.json` clean.
- **Context**: blsh.trade bootstrap pattern (evidence §3), `src/layer.scss` (library layer order the import order mirrors: normalize, components, themes, css-utilities)
- **Depends-on**: P1, P2
- **Verify**: `pnpm dev` → browser opens (dev config sets `open: true`), shell renders, console clean
- **Notes**: If any css-only scss path deviates from the `<name>/scss/index.scss` pattern, trust the filesystem over this spec (glob before writing imports).

## Batch 2 — Demo registry

### [P4] Demos: controls & forms (button, checkbox, clipboard, input, radio, range, select, switch, textarea)
- **Type**: feature
- **Recommended-model**: opus
- **Status**: PENDING
- **Group**: demos
- **Source**: session evidence §5 (component APIs), §6 (modifiers), §9 (registry design)
- **Rationale**: Interactive form controls are the highest-value demos and exercise the reactive factory APIs most heavily.
- **Changes**: new `viewer/demos/{button,checkbox,clipboard,input,radio,range,select,switch,textarea}.ts`, each default-exporting an `Entry`; register all nine in `viewer/demos/index.ts` (imports + array members, alphabetical).
- **Design**: Per-component variant plans (verified APIs — deviations only via verify-on-contact against the component source):
  - **button** — plain buttons are CSS: `<div class='button button--primary'>`. Variants: color row (`--primary/--secondary/--tertiary/--form` from themes/dark scss), modifier row (`--flat`, `--skeleton`, `--underline`), and `button.hold(attributes, (state: { holding, complete }) => Renderable)` — render label from `state.holding`/`state.complete` thunks.
  - **checkbox** — `checkbox({ checked?, value?, state? })` renders `div.checkbox` wrapping an input. Variants: default, pre-checked.
  - **clipboard** — `clipboard.onclick({ value: string, timeout?: number, ...attrs }, (state: { copied: boolean }) => Renderable)`: a button whose label flips on `state.copied`. (`clipboard.write(value) → Promise<boolean>` exists; onclick variant suffices.)
  - **input** — `input(attributes & { state? })`, default type 'text', focus toggles `.--active`. Variants: default, `type: 'password'`, and the dark preset `~/themes/dark/input` (an `input.bind` with `'input--primary --border --border-black --color-white'` + border-color style vars — a safe module-level bind, labeled "dark preset" per Q3).
  - **radio** — `checkbox.factory('radio')`, exported as `radio`; same attribute shape. Render 2–3 with a SHARED `name` attribute (required for exclusivity).
  - **range** — `range({ max: number, min: number, value?, state? })`, e.g. min 0 / max 100 / value 40; styled input[type=range] driving `--thumb-position`.
  - **select** — `select({ options: Record<string, Renderable | { content, selected }>, selected?, state?, option?, arrow?, 'tooltip-content'?: { direction? } }, contentFn?)`; dropdown built on tooltip+scrollbar, default direction 's'. Variants: simple string options; one option pre-selected via the `{ content, selected }` shape. Dark preset `~/themes/dark/select` optional (implementer decides; criterion: import is a bind/factory, not a side-effecting singleton).
  - **switch** — `checkbox.factory('switch')`, exported as `switch` — a RESERVED WORD: import with rename (`import { switch as ... } from '~/components'`). Variants: default, pre-checked.
  - Each demo file: `import { Entry } from '../types';` + component imports from `~/components` (rung 2 reuse — never re-implement), `const entry: Entry = { name: '<dirname>', variants: [...] };`, `export default entry;`. Variant `render` thunks create fresh instances per call.
- **Layers**: demo data, UI
- **Acceptance**: dev server: sidebar shows the nine new entries alphabetically after 'all'; clicking each renders only that component's variants; controls are live (checkbox/switch toggle, radio group is exclusive, range drags, select opens/selects, clipboard copies + label flips, hold button tracks holding). 'all' shows all nine with header separators. `tsc -p viewer/tsconfig.json` clean; zero console errors.
- **Context**: `src/components/<name>/index.ts` for each of the nine; `src/themes/dark/input.ts`, `src/themes/dark/select.ts`
- **Depends-on**: P2, P3
- **Verify**: `pnpm dev` → click through all nine categories
- **Notes**: Registry edits interleave alphabetically with later batches — keep both the import block and the entries array strictly alphabetical at every step so P5–P7 inserts stay mechanical.

### [P5] Demos: feedback & overlays (alert, ellipsis, loader, loading, modal, overlay, tooltip)
- **Type**: feature
- **Recommended-model**: opus
- **Status**: PENDING
- **Group**: demos
- **Source**: session evidence §5 (alert/loader/tooltip contracts), §6 (modal/overlay/anchor state classes), §9
- **Rationale**: Overlay-class components have the sharpest gotchas (fixed positioning, z-index 9/9999, self-removing animations, `.--active` state discipline) — they need deliberate demo staging, not naive inline rendering.
- **Changes**: new `viewer/demos/{alert,ellipsis,loader,loading,modal,overlay,tooltip}.ts` + register in `viewer/demos/index.ts`.
- **Design**:
  - **alert** — `alert(attributes)` returns a PER-CALL instance `{ content, deactivate(), error(messages, seconds?), info(), success() }` (messages: string | Renderable | array); renders `alert anchor anchor--n`, absolutely positioned. Demo: create the instance inside the variant's render thunk, place `instance.content` inside a `position: relative` stage container (so the absolute anchor stays inside the card), plus trigger buttons calling `instance.success('...')` / `instance.error('...')` / `instance.info('...')`. **Verify-on-contact**: read `src/components/alert/index.ts` for the exact mount contract (whether `content` is the renderable to place). Do NOT import `~/themes/dark/alert` (module-level styled SINGLETON — import is a side effect).
  - **ellipsis** — `ellipsis()`: three-dot loading indicator, zero config. One variant.
  - **loader** — `loader` is position:fixed FULL-SCREEN z-9999 and plays a one-shot reveal animation then removes itself from the DOM. MUST be user-triggered, never auto-rendered inline: variant renders a trigger button + a reactive flag; `${() => state.show ? loader({}) : ''}`. Gotcha: after self-removal the flag is still true — implementer decides the re-trigger mechanism (reset flag then set across frames, or remount via a counter); criterion: button re-plays the animation on every click.
  - **loading** — `loading(attributes?)`: spinner; verified class pattern `loading --border-width-700 --size-800` + `style: '--border-color: var(--color-border-500);'`. Variants: a couple of sizes/border widths.
  - **modal** — paired with overlay (the library pattern): trigger button sets a reactive flag; when set, render `overlay(...)` (scrollbar.bind class `'overlay'` — position:fixed full-viewport z-9) containing `<div class='modal --active'>` with content + a close button clearing the flag. `.modal` without `.--active` is opacity-0 + translateY — toggling `.--active` is the visibility mechanism (state convention).
  - **overlay** — own registry entry: same trigger pattern, simple fixed overlay with a close control (kept separate from modal because the registry demos every component, but reuse the same staging approach).
  - **tooltip** — `tooltip.{menu,onclick,onhover}`. onclick/onhover: `factory((attrs & { state?, toggle? }, content))` — content MUST include a `.tooltip-content.tooltip-content--<dir>` element; directions n, ne, nw, s, se, sw, e, en, es, w, wn, ws, c. Variants: onhover (direction 's'), onclick (direction 'n'), and `tooltip.menu({ options: (Attributes & { content })[], option?, 'tooltip-content': { direction? } }, trigger)` — options with `href` render as `<a class='link'>`.
- **Layers**: demo data, UI, reactive state
- **Acceptance**: dev server: alert triggers show/dismiss messages inside their card; loader plays full-screen on click and self-removes (and re-triggers); modal opens over the overlay and closes; tooltips open on hover/click with correct directions; menu renders options. No stray full-screen elements on initial render of the category or 'all' page. `tsc -p viewer/tsconfig.json` clean; zero console errors.
- **Context**: `src/components/alert/index.ts`, `src/components/loader/`, `src/components/tooltip/`, `src/components/overlay/`, `src/components/modal/scss/`
- **Depends-on**: P2, P3, P4
- **Verify**: `pnpm dev` → click through all seven categories, then 'all' and confirm nothing full-screen auto-plays
- **Notes**: Depends-on P4 is the shared-file serialization edge (both edit `viewer/demos/index.ts`) — honest ordering, not a logic dependency.

### [P6] Demos: layout & structure (anchor, banner, border, bubble, card, container, frame, grid, link, page, scrollbar, sidebar, text, thumbnail)
- **Type**: feature
- **Recommended-model**: sonnet
- **Status**: PENDING
- **Group**: demos
- **Source**: session evidence §6 (verified class vocabulary + css vars), §5 (frame/scrollbar/sidebar factories), §9
- **Rationale**: Mostly CSS-only components — demos are static markup exercising the documented class/var vocabulary; mechanical once the vocabulary is written down (it is, below).
- **Changes**: new `viewer/demos/{anchor,banner,border,bubble,card,container,frame,grid,link,page,scrollbar,sidebar,text,thumbnail}.ts` + register in `viewer/demos/index.ts`.
- **Design**: exact recipes (all class/var names verified from scss):
  - **anchor** — `position: relative` stage; children `.anchor.anchor--n` / `--s` / `--ne` / `--nw` / `--se` / `--sw`. GOTCHA: inactive (`:not(.--active)`) → opacity 0 — add `.--active` to every demoed anchor or the demo looks empty. Offsets via `--margin-vertical` / `--margin-horizontal` vars.
  - **banner** — bounded `position: relative` stage with content; `.banner` is absolute-full z:-1 behind it. Variants: `--gradient` (REQUIRES `--from`/`--to` color vars, use tokens), `--blur`, `--backdrop`.
  - **border** — a few `.border` separators between text blocks (+ `--offset-top` variant); include two consecutive `.border` elements to show the adjacent-collapse rule (`.border + .border` hidden).
  - **bubble** — stage with `.bubble` at `--top-left` / `--top-right` / `--bottom-left` / `--bottom-right`; set `--position-horizontal` / `--position-vertical` plus bg/border-radius/height/width vars.
  - **card** — `.card` (padding/radius/shadow vars), `.card.--flat` (no shadow), `.card--option`.
  - **container** — `.container` (flex-wrap centered) with a few children; show `--max-width`.
  - **frame** — TS factory: `frame = scrollbar.bind` class `'frame'` — fixed-height container with tall content to show the scroll frame.
  - **grid** — `.grid` with several `.grid-item` children (auto-fit; defaults `--min-width: 200px`, `--max-width: 1fr`, gaps `--size-400`); one variant overriding `--min-width`.
  - **link** — `.link`, `.link.link--underline`, and `.link-hover` with `--one`/`--two` swap layers.
  - **page** — GOTCHA: `.page` is min-height 100svh — do NOT drop a full `.page` inside a card; demo the typography classes instead: `.page-title` / `.page-subtitle` / `.page-suptitle` in a bounded stage.
  - **scrollbar** — TS factory `scrollbar(attrs & { scrollbar?: Attributes, 'scrollbar-container-content'?: Attributes }, content)`: fixed-height container + tall content; variants for modifiers `scrollbar--fixed` / `--hidden` / `--snap`.
  - **sidebar** — mini stage: `position: relative` fixed-height container (the component is position:absolute, height `calc(100% - margins*2)`, width `min(var(--width), ...)`, z-index 9 — it needs a bounded positioned parent). Render `sidebar({ class: 'sidebar--floating sidebar--w --active' }, content)`; second variant `--e` (right). Always add `.--active` (explicit safe state); `--offscreen` + inactive translates it out — can be a labeled variant with a toggle if trivial, else skip (implementer decides; criterion: no demo renders invisible-by-default).
  - **text** — `.text` blocks exercising color/font-size/weight/line-height vars from tokens.
  - **thumbnail** — `.thumbnail` with `--background` set to a CSS gradient (no external/network images), plus `--height`/`--width`/`--border-radius` vars.
  - All demos: token vars only, no hardcoded colors; each file exports a default `Entry` like P4.
- **Layers**: demo data, UI
- **Acceptance**: dev server: all fourteen categories render visibly (nothing opacity-0, nothing escaping its card into the viewport); frame/scrollbar/sidebar stages scroll/position correctly; 'all' page shows every entry under its header. `tsc -p viewer/tsconfig.json` clean; zero console errors.
- **Context**: `src/components/<name>/scss/` for each; `src/tokens/`
- **Depends-on**: P2, P3, P5
- **Verify**: `pnpm dev` → click through all fourteen categories + 'all'
- **Notes**: Depends-on P5 is the `viewer/demos/index.ts` serialization edge. Fourteen components but each demo is a small static file — still one commit-sized slice.

### [P7] Demos: content & utilities (accordion, back, counter, highlight, icon, json, number, truncate, typewriter)
- **Type**: feature
- **Recommended-model**: opus
- **Status**: PENDING
- **Group**: demos
- **Source**: session evidence §5 (factory contracts), §7 (available svg assets), §9
- **Rationale**: Remaining components mix reactive state plumbing (accordion), verify-on-contact sizing (icon), and pure utility rendering (number/truncate) — completes the 39-component registry.
- **Changes**: new `viewer/demos/{accordion,back,counter,highlight,icon,json,number,truncate,typewriter}.ts` + register in `viewer/demos/index.ts`.
- **Design**:
  - **accordion** — `template.factory((attributes: Attributes & { state?: { active: boolean | number } }, content))`; expansion driven by `--max-height` when `state.active` toggles. Demo NEEDS an external toggle: create `reactive({ active: false })`, pass as `state`, add a toggle button flipping it.
  - **back** — `back({ href }, content)` renders `a.back.link` with the arrow icon (`src/components/back/svg/arrow.svg`). Use `href: '#'`.
  - **counter** — `counter({ value: number, currency?: 'IGNORE'|'EUR'|'GBP'|'USD', decimals?, delay?, max?, suffix?, state? })` — animated odometer, defaults to USD formatting; `'IGNORE'` → plain locale number. Variants: USD default, IGNORE plain, suffix. **Verify-on-contact**: read `src/components/counter/index.ts` for how value updates flow (attribute vs `state`) and wire a button that changes the value so the odometer animates.
  - **highlight** — `template.factory((attributes & { background?: string }, content))` — IntersectionObserver-driven `--highlight` var; wrap a text block, optional custom `background` variant.
  - **icon** — `icon(attributes, svgImport)` → `div.icon` wrapping `svg.sprite(icon)`. Available svgs (evidence §7): `~/components/alert/svg/{check,close,error}.svg`, `~/components/back/svg/arrow.svg`. Existing usage passes class `'--size-500'` (utility sets `--size`) while `.icon` reads `var(--width)`/`var(--height)`. **Verify-on-contact**: read `src/components/icon/scss/variables.scss` — confirm it maps `--width`/`--height` from `--size`; if not, set `--width`/`--height` directly in the demo. svg module typings come from `@esportsplus/vite/global.d.ts` (already in the typecheck program via alert's import).
  - **json** — `json.download(content, name)` creates + clicks an `<a download>`. Demo: button triggering `json.download(<small object or string>, 'demo.json')`. **Verify-on-contact**: read `src/components/json/index.ts` for the `content` parameter type.
  - **number** — utilities re-export: render literal examples of `number.abbreviate(1234567)` and `number.ordinal(23)` as text.
  - **truncate** — utilities re-export: render `truncate.center(str, { prefix?, suffix? })`, `truncate.end(str, prefix?)`, `truncate.start(str, suffix?)` on a long sample string.
  - **typewriter** — `typewriter(_, content: string[])` — pass 2–3 strings; cycles typing/deleting automatically.
- **Layers**: demo data, UI, reactive state
- **Acceptance**: dev server: all nine categories render and behave (accordion expands via its toggle, counter animates, typewriter cycles, json downloads a file, icons visible at expected sizes). Registry now holds all 39 entries; sidebar lists 'all' + 39 names alphabetically. `tsc -p viewer/tsconfig.json` clean; zero console errors.
- **Context**: `src/components/{accordion,back,counter,highlight,icon,json}/index.ts`, `src/components/icon/scss/variables.scss`
- **Depends-on**: P2, P3, P6
- **Verify**: `pnpm dev` → click through all nine categories; confirm sidebar count = 40 items ('all' + 39)
- **Notes**: Depends-on P6 is the `viewer/demos/index.ts` serialization edge. `number` and `truncate` are pure-function demos — no interactivity required.

## Batch 3 — Verification

### [P8] End-to-end verification pass
- **Type**: feature
- **Recommended-model**: sonnet
- **Status**: PENDING
- **Group**: verification
- **Source**: session evidence §8 (user requirements), output contract
- **Rationale**: The viewer's acceptance is behavioral (dev server rendering), and the 'All'-page-reuse requirement is structural — both need an explicit final check, plus proof the library build/publish path is untouched.
- **Changes**: none intended — verification only; any defect found is fixed at its root within the feature that introduced it (and recorded as a deviation), never patched cosmetically here.
- **Design**: run and check, in order:
  1. `pnpm dev` — server boots, browser page renders with zero console errors and zero vite overlay errors.
  2. Sidebar: 'all' first, then all 39 demoed component names, lowercase, alphabetical (Q4).
  3. Category switching: click ≥6 categories spanning all four batches — main region swaps to only that component's variants, `.--active` follows the selected item, no page reload (reactive, not routed).
  4. 'All' page: every one of the 39 entries renders, alphabetical, each under its header separator; no full-screen component (loader/overlay/modal) auto-plays on load.
  5. Reuse requirement (structural): confirm `viewer/app.ts` has exactly ONE call site into `viewer/category.ts` serving both branches ('all' vs filtered) — grep, not eyeball.
  6. Instance freshness: switch away from and back to a stateful category (e.g. accordion) — variants remount cleanly (render-thunk contract).
  7. `pnpm exec tsc -p viewer/tsconfig.json` — clean.
  8. `pnpm build` — library build still green; `git status` shows no modifications to root `vite.config.ts`, root `tsconfig.json`, or anything under `src/` / `build/`.
- **Layers**: verification
- **Acceptance**: all eight checks pass. Any failure routes back to the owning feature as a root-cause fix, not a patch here.
- **Context**: entire `viewer/` tree
- **Depends-on**: P3, P4, P5, P6, P7
- **Verify**: the eight-step checklist above, executed in order
- **Notes**: This feature writes no product code; its commit (if any) is fixes attributed to prior features per the deviations rule.

## Summary
- **Total features**: 8
- **Completed**: 0
- **Reverted**: 0
- **Blocked**: 0
- **Net benchmark change**: N/A (no performance features)
