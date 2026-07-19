---
type: fix
recommended-model: sonnet
status: PENDING
priority: P1
validation: critic
depends-on: none
files-own: src/components/select/index.ts
---

# Select: inert on closed dropdown

## Rationale
The select dropdown is conditionally rendered once (`state.render` latches true on first interaction) and then PERSISTS in the DOM; open/close only toggles `state.active`, which drives CSS opacity. The closed dropdown's option elements therefore remain in the accessibility tree, and its hidden content is only suppressed by pointer-events/opacity — not removed from tab order or the a11y tree. Binding `inert` to the same reactive state removes the closed dropdown's subtree properly.

## Changes
Select component template: the closed dropdown panel is removed from pointer input, tab order, and the accessibility tree, driven by the component's existing reactive active state. No scrollbar component or styling changes.

## Design
In `src/components/select/index.ts`, the dropdown is the `sb(...)` scrollbar-bound tooltip-content rendered inside the `${() => { if (!state.render) return; ... return sb({...}, keys.map(...)) }}` block, where `state` (owning `active`) is in lexical scope. Add one entry to the sb() FIRST-ARG attributes object literal, alongside the existing `class` / `onclick` / `onconnect` / `style` entries (insert after `class:` to keep the keys alphabetized):

`inert: () => !state.active`

Verified mechanics: `sb = scrollbar.bind({ attributes: { class: 'tooltip-content --flex-column' } })`, and `src/components/scrollbar/index.ts` forwards the call-site attributes object directly onto its single `.scrollbar` root via `<div class='scrollbar' ${this?.attributes} ${attributes}>` — there is no omit list (the component is now a native styling class, not a container wrapper), so the `inert` binding lands on the rendered dropdown root. The object is a plain object literal in which reactive function values are already legal (the existing `class: [...]` array and `onclick:` handler entries; the reference reactive-boolean binding is `src/components/accordion/index.ts`). Result: the closed dropdown (containing the `<div class='link select-option'>` options) carries `inert`; opening (`state.active` true) removes it.

## Reads
- src/components/scrollbar/index.ts — confirms sb() forwards its attributes object to the rendered element
- src/components/accordion/index.ts — the reference inert binding pattern

## Acceptance
`npx tsc --noEmit` exits 0; the closed select dropdown carries `inert`, the open dropdown does not. 0 regressions.

## Verify
npx tsc --noEmit
