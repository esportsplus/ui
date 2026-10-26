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
    └── _{partial}.scss optional partials when index.scss grows too large (see tooltip)
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

- `index.scss` holds the logic: layout, properties, selectors, transitions, keyframes. Values come from `var(--*)`, not literals.
- `variables.scss` holds only css variables (plus themed `%placeholder` extends such as `%background-primary`). They act as
  arguments: every tunable value is a variable so variants and consumers can finely control the component without
  touching the logic.
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
- Reduced motion is handled by zeroing durations or removing transitions/animations under
  `@media (prefers-reduced-motion: reduce)`.


## Naming (BEM-like)

- Block: `.button`
- Modifier: `.button--kbd`, `.button--processing` (double dash)
- Element: `.button-face`, `.button-split-chevron` (single dash, not `__`)
- Element modifier: `.button-face--error`, `.button-icon--draw`
- Modifier element/sub-state: `.button--morph-error`, `.button--sidebar-right`
- States use the `tokens.state(...)` mixin (`--active`, `pressed`, ...), not hand-written state classes.
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

1. `@extend`s, then variables (`--*`), then properties — each alphabetical
2. Pseudo elements (`&::after`), nested `:where()` / descendant rules, `@media` for the block itself
3. Modifiers `&--*`, alphabetical
4. Elements `&-*`, alphabetical
5. State / relational selectors (`&:has(...)`, `&:not(...)`) and descendant selectors (`.button-check`, `svg`)


## SCSS style

- Use nesting wherever possible: `&--`, `&-`, `&::before`, `&:focus-visible`, `@media` and `@include tokens.state()`
  nested inside the selector they affect.
- Reuse `css-utilities` placeholders via `@extend` (`%absolute-center`, `%hidden-visually`, `%icon-stroke`, ...) instead
  of rewriting their rules.
- Use `@each` loops for symmetric variants (`left`/`right`) instead of duplicating rules.
- Comments only for a non-obvious why (specificity tricks, timing choices, math); never restate the code.
