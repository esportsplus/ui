---
type: fix
recommended-model: opus
status: PENDING
priority: P2
validation: critic
depends-on: none
files-own: src/components/tooltip/menu.ts
---

# Tooltip menu: inert on closed menu panel

## Rationale
The hidden `.tooltip-content` menu panel contains `<a href target='_blank'>` option links — genuinely focusable, so a keyboard/AT user can currently tab into the CLOSED menu (a real tab-trap-in-hidden-content bug). The inactive `.tooltip-content` styling only sets `pointer-events: none` on `&, *`, which does NOT remove the panel from tab order or the accessibility tree.

## Changes
Tooltip menu (click-triggered path): the closed menu panel is removed from tab order and the accessibility tree via a reactive `inert` binding that shares ONE reactive active object with the click-wrapper that drives `--active`, so the two stay synchronized by construction. The hover tooltip path is untouched.

## Design
State ownership today: `src/components/tooltip/onclick.ts` owns `state = attributes.state || reactive({ active: false })` and drives `--active`; `src/components/tooltip/menu.ts` wraps its content by calling `onclick(omit(attributes, OMIT), html\`...tooltip-content...\`)` and has NO access to that internal state.

SETTLED APPROACH — thread state through the existing `attributes.state` injection onclick already honors:

1. In `menu.ts`, create `let state = attributes.state || reactive({ active: false })` (menu's type `A` already declares `state?: { active: boolean }`).
2. Forward it into the attributes passed to onclick so onclick uses the SAME object — e.g. `onclick({ ...omit(attributes, OMIT), state }, html\`...\`)`. Verified: menu's own `OMIT` (`['options', 'option', 'tooltip-content']`) does not strip `state`, and onclick's `OMIT` (`['state', 'toggle']`) strips `state` from DOM attrs while still consuming it via `attributes.state || reactive(...)` — so injection reaches onclick and never leaks into the DOM.
3. Bind `${{ inert: () => !state.active }}` on the `.tooltip-content` div in `menu.ts` (reference binding: `src/components/accordion/index.ts`).

Because onclick's `--active` class and menu's inert now read one reactive object, they stay synchronized. `onclick.ts` requires NO change — verified by reading it (it already accepts `attributes.state`); any implementation finding that genuinely contradicts this is a deviation to flag, not a silent edit.

SCOPE: this covers click-triggered menus (menu.ts → onclick). The hover path (`src/components/tooltip/onhover.ts`) builds no `.tooltip-content` panel — only text-content tooltips with nothing focusable — and is explicitly OUT of scope; leave its pointer-events behavior alone.

Discretion point: the exact mechanism for guaranteeing `state` reaches onclick (spread-inject as sketched above vs. an explicit param) — implementer decides; criterion: onclick and menu observably share ONE reactive active object and inert toggles in lockstep with `--active`.

## Reads
- src/components/tooltip/onclick.ts — the state-owning wrapper whose attributes.state channel is threaded
- src/components/tooltip/onhover.ts — confirms the hover path is message-only (out of scope)
- src/components/accordion/index.ts — the reference inert binding pattern

## Acceptance
`npx tsc --noEmit` exits 0; a closed tooltip menu's `<a>` options are not tabbable (the panel carries `inert`); opening removes `inert`; onclick and menu share one reactive active state. 0 regressions.

## Verify
npx tsc --noEmit

## Notes
onclick.ts was verified at authoring time to require no change (its OMIT already strips `state` from DOM attributes while consuming it). If forwarding somehow requires a one-line touch there, flag it as a deviation and treat onclick.ts as a shared-file touch — do not silently expand scope.
