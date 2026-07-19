---
type: fix
recommended-model: sonnet
status: PENDING
priority: P1
validation: critic
depends-on: none
files-own: src/components/alert/index.ts
---

# Alert: inert on inactive alert

## Rationale
The alert root contains a focusable close control. When inactive, the shared anchor styles only apply `opacity: 0` + `pointer-events: none`, which hides the alert visually but leaves its subtree in tab order and the accessibility tree — a keyboard/AT user can tab into invisible content. The accordion component already fixed this class of bug with a reactive `inert` binding; this item applies the same pattern.

## Changes
Alert component template: the hidden alert subtree is removed from pointer input, tab order, and the accessibility tree while inactive, driven by the component's existing reactive active state. No shared styling changes.

## Design
`src/components/alert/index.ts` owns `state = reactive({ active: false, ... })` and renders a root `<div class='alert anchor anchor--n ${() => state.active && '--active'} --flex-row'>` carrying `${omit(attributes, OMIT)}`. Add a binding object to that same root div, exactly as `src/components/accordion/index.ts` does:

`${{ inert: () => !state.active }}`

@esportsplus/template's attributes handling removes a boolean attribute when the binding returns false/null/'' and sets it otherwise — so `inert` is present while `state.active` is falsy and absent while truthy, with no `inert="false"` footgun. `inert` blocks pointer input, removes the subtree from tab order, and hides it from the a11y tree.

Do NOT modify the SHARED `src/components/anchor/scss/index.scss` — its inactive-state `opacity: 0` + `pointer-events: none` on `&, *` must stay (consumer-driven direct-use anchors with no reactive state still depend on it; this item is purely additive). Before finalizing, verify the new binding object does not collide with existing bindings on the root element (the reactive class interpolation and the `omit(attributes, OMIT)` spread).

## Reads
- src/components/anchor/scss/index.scss — the shared anchor inactive styles this inert augments; must remain unchanged
- src/components/accordion/index.ts — the reference inert binding pattern

## Acceptance
`npx tsc --noEmit` exits 0; the alert root gains `inert` when `state.active` is falsy and loses it when truthy; `src/components/anchor/scss/index.scss` is unchanged. 0 regressions.

## Verify
npx tsc --noEmit
