# Rules

Component conventions. Reference implementation: `src/components/button`.


## Directory structure

```
src/components/{component}/
├── index.ts            barrel; imports './scss/index.scss' and exports the default object
├── {variant}.ts        one file per sub-component (copy.ts, kbd.ts, split.ts, ...)
├── {variant}/          a sub-component spanning several files (index.ts, template.ts, save.ts, ...)
└── scss/
    ├── index.scss      logic, rules, structure
    ├── variables.scss  css variables only
    └── _{partial}.scss optional partials when index.scss grows too large (see editor/code)
```

- SCSS always lives in `{component}/scss/`; CSS-only components may have nothing but `scss/`.
- `index.ts` imports sub-components alphabetically, then `./scss/index.scss`, and exports a typed object of them:
  `const button: { copy: typeof copy, ... } = { copy, ... }; export default button;`


## TypeScript

- Use CSS whenever it can do the job, so the browser does the work instead of the script. States (`:hover`, `:active`,
  `:focus-visible`, `:has()`), transitions, `@starting-style`, layout and `@media` preferences belong in SCSS. Keep TS
  for what CSS can't express, such as measuring layout or state CSS can't see.
- Build components with `@esportsplus/template` (`component`, `html`, attribute objects) and
  `@esportsplus/reactivity` (`reactive`, ...). We own both libraries; use them for as much as possible.
- Don't manipulate the DOM directly (`addEventListener`, `classList`, `setAttribute`, `appendChild`, manual `window`
  listeners, ...) when template has a way to do it. Template handles cleanup and lifecycle. For example, bind
  `onwindowkeydown` / `onpointerdown` and reactive `class: () => ...` in the attribute object, as `button/kbd.ts` does.
- Optimize with fine-grained reactivity: keep state in `reactive(...)` and bind functions only where a value changes,
  so updates touch only the affected node or attribute. Never re-render whole templates for a small change.
- Drop to raw DOM only when neither library covers the case (e.g. measuring layout). Keep it minimal and say why in a
  comment.


## index.scss vs variables.scss

- `index.scss` holds the logic: layout, properties, selectors, transitions, keyframes. Tunable values come from `var(--*)`, not literals.
- `variables.scss` holds only css variables (plus themed `%placeholder` extends such as `%background-primary`). They act as
  arguments: every tunable value is a variable so variants and consumers can finely control the component without
  touching the logic.
- A value is tunable when a variant overrides it or a consumer plausibly would: sizes, spacing, colours, radii,
  durations, easings. Structural constants stay literal in `index.scss`: `0`, `1`, `100%`, `none`, `grid-area: 1 / 1`,
  a local `z-index`, a 1px press offset, keyframe steps. A variable nothing overrides and no consumer would reach for
  is bloat; every declared variable costs bytes and style recalculation on each element that carries it.
- `index.scss` `@use`s `variables`; both `@use '/tokens'` and any `css-utilities/*` they need, alphabetically.
- Variants (`&--primary`, `&--kbd`, ...) should mostly be variable overrides in `variables.scss`; only add rules to
  `index.scss` when the structure actually changes.


## Variables

- Split multi-value properties into one variable per axis/side so the logic can compute with each part:
  `--padding-horizontal` / `--padding-vertical`, `--gap-horizontal` / `--gap-vertical`. A single `--padding` would need
  parsing of 1/2/4-value shorthands. Example from button:
  ```scss
  padding-block: max(0px, calc(var(--padding-vertical) - var(--border-width)));
  padding-inline: max(0px, calc(var(--padding-horizontal) - var(--border-width)));
  ```
- Variables live on the selector that consumes them, not on a parent with a prefix. The icon's size is `--size` set on
  `.button-icon` / `&-kbd-icon.icon`, not `--icon-size` on `.button` that reaches down into the child. Prefixes are
  only for distinct concerns of the same selector that would otherwise collide, e.g. `card--morph`'s `--morph-duration`,
  `--morph-fade-duration` alongside its own `--transition-duration`.
- Stateful values use a `-default` / `-hover` / `-active` / `-pressed` family, with the bare variable resolving to the
  current state: `--background: var(--background-default)`.
- Timing is always a pair: `--transition-duration` + `--transition-timing-function` (likewise `--{name}-duration` /
  `--{name}-timing-function` for animations, e.g. `--shake-duration`).
- Prefer tokens (`--size-*`, `--border-radius-*`, `--font-size-*`, `--color-*`) over raw values.
- Reduced motion is handled under `@media (prefers-reduced-motion: reduce)`. Default: zero the duration variable in
  `variables.scss` (`--spin-duration: 0s`), which leaves the logic alone. Use `transition: none` / `animation: none` in
  `index.scss` only when zeroing isn't equivalent: the resting value has to change too (a drawn icon's
  `stroke-dashoffset: 0`), the motion has no duration variable of its own, children inherit the variable and would
  lose their own easing (`.button-face` and its icons), a state or consumer sets the duration at higher specificity,
  a delay would outlive the zeroed duration, or script waits on an `animationend` that a 0s animation would fire.
- Scripts hand measurements and state to CSS as custom properties (`--place-x`, `--morph-top`, `--shared-width`), never
  as inline style properties. Prefix them with the feature that writes them, read them only in SCSS, and give each a
  default in `variables.scss` or a `var()` fallback unless the element only exists, or the rule reading it only
  matches, once the script has written it.
  - Custom properties inherit. One written every frame or pointer move on an element with a large subtree restyles
    the whole subtree: register it with `@property { inherits: false }` (at the top of `index.scss`), or keep the
    inline property on that hot path (the code editor's scroll offsets) and say why.
  - Inline properties also stay where they must outrank styles the component doesn't own: a consumer's element, or
    arbitrary consumer items mid-animation (`filter`'s leaving items).
  - A script-written name consumers may already set or read keeps its name, prefixed or not.


## Naming (BEM-like)

- Block: `.button`
- Modifier: `.button--kbd`, `.button--processing` (double dash)
- Element: `.button-face`, `.button-split-trigger` (single dash, not `__`)
- Element modifier: `.button-face--error`, `.button-icon--draw`
- Modifier element/sub-state: `.button--morph-error`, `.button--sidebar-right`
- States are the `.--active`, `.--disabled`, `.--hover`, `.--pressed` classes, matched through `tokens.state(...)`:
  `@include tokens.state(active pressed) { ... }` on the element carrying the state, or the function form
  `#{tokens.state(active, '.tooltip')} > &` when another element carries it. `hover`, `pressed` and `default` exclude
  `.--active`, and `pressed` also matches `:active`, so the mixin is not interchangeable with the bare class.
- Hand-write the state class (`&--reveal.--active > &-reveal`, `&.--placed`) where the mixin can't produce the selector
  that's needed: a state combined with a modifier and a child, a selector list mixing states with other conditions,
  a state the map doesn't define, or where the mixin's exclusions would change the result. Don't rewrite a working
  hand-written state selector into the mixin unless the compiled selector is the same.
- Always build names with `&--` / `&-` nesting rather than repeating the block name.
- Nested/chained selectors are fine when composing components or winning specificity regardless of load order
  (`& > &-menu > &-trigger`, `&-kbd-icon.icon`, `> .tooltip-menu-layer > .tooltip-menu-panel`). Use `:where()` for
  zero-specificity defaults that the other component should be able to override.


## Keyframes

- Name keyframes after the class that uses them when possible: `.button--processing` → `button--processing`. When a
  name describes the motion rather than a single class, prefix it with the block/element path (`button-icon-draw`,
  `button-morph-shake`).
- Place them either nested inside the class using them or at the bottom of `index.scss`.


## Ordering

Alphabetize everything: `@use` statements, selectors, properties, variables, transition lists, `@extend` lists.

Within a block, in this order. Two blank lines separate each group; one blank line separates rules within a group:

1. `@extend`s, then variables (`--*`), then properties — each alphabetical. Sass `$variables` the block's selectors
   need follow the properties as their own group.
2. Pseudo elements (`&::after`), nested `:where()` / descendant rules, `@media` for the block itself
3. Modifiers `&--*`, alphabetical
4. Elements `&-*`, alphabetical
5. State / relational selectors (`&:has(...)`, `&:not(...)`, `&[aria-*]`, `&.--placed`), `@include tokens.state(...)`,
   and descendant selectors (`.button-check`, `svg`)

- A selector list sorts by its first selector (`&--kbd, &--tactile` sorts as `&--kbd`), ahead of the single rule of the
  same name. An `@each` sits where the selectors it generates would, and a cluster of related rules (one per
  direction, an element and its qualified forms such as `&-toolbar.tooltip-content` then
  `&-toolbar--instant.tooltip-content`) stays together at its first selector's position.
- `@media (hover: hover) { &:hover { ... } }` is a state (group 5), not an `@media` for the block.
- The cascade outranks the alphabet. When two rules of equal specificity set the same property and the result depends
  on which comes later, keep the working order and say so in a comment on the rule that has to stay put. Never reorder
  such a pair to satisfy this section.
- `scripts/sort-scss.mjs` sorts by raw selector text and knows neither these groups nor the cascade exception. Don't
  run `--write` on components until it does.


## SCSS style

- Use nesting wherever possible: `&--`, `&-`, `&::before`, `&:focus-visible`, `@media` and `@include tokens.state()`
  nested inside the selector they affect.
- Reuse `css-utilities` placeholders via `@extend` (`%absolute-center`, `%hidden-visually`, `%icon-stroke`, ...) instead
  of rewriting their rules.
- Use `@each` loops for symmetric variants (`left`/`right`) instead of duplicating rules.
- When every entry of a transition shares one duration and easing, write the longhands instead of repeating the pair
  per property:
  ```scss
  transition-duration: var(--transition-duration);
  transition-property: background, border-color, box-shadow, color;
  transition-timing-function: var(--transition-timing-function);
  ```
  Keep the `transition:` list when entries differ in duration, easing or delay (`card--morph`), or when another rule
  sets `transition` on the same element (a state, variant, reduced-motion override or an extended placeholder such as
  `%text` on `.button`), since mixing shorthand and longhands changes what each one resets. A single-entry transition
  stays a shorthand; there is nothing to factor out.
- Vendor prefixes belong to autoprefixer. Write one by hand only when the property has no standard form
  (`-webkit-touch-callout`, `-webkit-font-smoothing`).
- Comments only for a non-obvious why (specificity tricks, timing choices, math); never restate the code.


## Performance

- Animate `opacity`, `translate`, `scale`, `rotate`, `filter` and `clip-path`. Transitioning a layout property (`width`,
  `height`, `padding`, `grid-template-columns`, `inset`) reflows every frame; do it only when the box really has to
  resize, and say why in a comment.
- Use the individual `translate` / `scale` / `rotate` properties rather than `transform`, so states and variants compose
  without restating each other's functions. `transform` is for what they can't express (`transform-box`, a matrix, a
  centring offset that must stay out of `translate`'s way).
- Anchor `:has()` with a combinator and a class (`.group:has(> .button--action)`), never a bare descendant search on a
  large container. A small leaf block may search its own few descendants (`.checkbox:has(input:checked)`), and must
  when consumers write or place that markup themselves. Avoid `*` outside a tightly scoped rule.
- In TS, read layout before writing it: take every measurement first, then write the variables, so one interaction costs
  one reflow. Observe with `ResizeObserver` / `IntersectionObserver` rather than polling or listening to `scroll` /
  `resize`.
- No `will-change` left on at rest; set it for the duration of the motion or not at all.


## Touching existing code

Every file you open is held to the rules above, not just the lines you came for. Apply these in the same change; the
result must behave identically, and the gate (`tsc --noEmit`, build) must stay clean.

- Modernize outdated techniques, bounded by the floor in `vite.config.ts` (`BROWSERS`: the first 2026 release of each
  browser, Chrome/Edge 144, Firefox 147, Safari/iOS 26.3). Anything every floor browser supports is fair game:
  `:has()`, `:is()`/`:where()`, `inset`, logical properties (`padding-inline`, `margin-block`), `gap` instead of margin
  hacks, `light-dark()`, `@container`, `@layer`, `@property`, `@starting-style` with
  `transition-behavior: allow-discrete`, `popover`, `aspect-ratio`, `clamp()`/`min()`/`max()`, `color-mix()`,
  `text-wrap: balance`, `dvh` units, anchor positioning (`anchor-name`, `position-anchor`, `anchor()`,
  `position-area`). Features above the floor are only allowed as progressive enhancement where the
  fallback is still correct, never to gate layout or visibility. Check caniuse against the floor before using anything
  not listed. Replace JS that only exists because CSS once couldn't: hover/focus/open state, entry/exit transitions,
  measuring for simple layout, resize listeners for things `@container` handles.
- Reduce lines of code wherever it keeps behavior and readability: collapse selectors into `&-`/`&--` nesting, replace
  hand-written rules with `css-utilities` placeholders, fold symmetric variants into `@each`, turn repeated
  `calc()`s into one variable, use shorthands only when every value is being set on purpose.
- Consolidate duplicate styling within a component. If two selectors, variants or rules achieve the same thing in
  different ways (one via `transform`, one via `margin`; two variants each re-declaring the same transition; the same
  `padding` math in `index.scss` and a partial), pick the one that fits these rules and delete the other. One mechanism
  per concern. Variants express their differences as variable overrides in `variables.scss`, not as a second copy of
  the logic.
- The same holds across components. A rule written identically in three or more components (a focus ring, the
  padding-minus-border math) becomes a `css-utilities` placeholder that each of them `@extend`s; two is not yet a
  pattern.
- Remove dead code. Before finishing, grep the component (and its consumers) for every selector, `--variable`,
  `%placeholder`, keyframe, mixin and exported TS member the file declares; anything with no reader is deleted.
  Variables declared in `variables.scss` but never read in `index.scss` or a partial, selectors no template renders,
  keyframes no `animation` references, and vendor prefixes that have a standard form (autoprefixer owns those) all count.
- Do not leave both the old and new approach in place "for safety". A superseded rule is removed in the same change.
