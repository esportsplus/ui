---
type: docs
recommended-model: sonnet
status: PENDING
priority: P2
validation: critic
depends-on: none
files-own: src/components/README.md
---

# Consumer inert-pairing convention docs

## Rationale
A class of components — modal, sidebar, frame, overlay, and direct-use anchor — cannot be migrated to `inert` at the library level: they receive `--active` as a class STRING from consumers and own no reactive state (sidebar/frame/overlay are `scrollbar.bind({class})` wrappers; modal has no index.ts and consumers conditionally mount/unmount it; the viewer demos apply `--active` statically, so there is no in-repo stateful toggle to retrofit). The correct fix lives at the consumer, so the library should document the convention once instead of shipping an abstraction.

## Changes
Component-library documentation only: a concise convention doc for consumers pairing `--active` toggles with `inert`. NO component code changes.

## Design
Create `src/components/README.md` (verified absent at authoring time — this is a fresh file, not an append) documenting:

1. The CONVENTION: a consumer that toggles `--active` on any of these components via reactive state should pair it with `inert: () => !state.active` — citing the accordion/alert pattern (a reactive boolean binding; @esportsplus/template removes the attribute when the binding returns falsy, so there is no `inert="false"` footgun).
2. The two cases where the pairing is UNNECESSARY: (a) the component is fully unmounted when inactive (e.g. the modal demo pattern); (b) purely static/always-active showcase usage.
3. The DECISION AGAINST a shared helper/directive, recorded explicitly: YAGNI — the one-line binding is trivial, and a helper adds an abstraction over a 1-liner.

This item is bounded to authoring that doc; it changes NO component code.

## Acceptance
`src/components/README.md` exists and documents the consumer inert-pairing convention, the unmount/static exceptions, and the no-helper decision. `npx tsc --noEmit` still exits 0 (doc-only, no code change). 0 regressions.

## Verify
npx tsc --noEmit

## Notes
There is an OPEN OPTIONAL clarifying question about whether the user wants this doc at all and where component docs should live — see the index ## Clarifying Questions (Q1). Default applied: author it at src/components/README.md. The question is non-blocking, so this item starts PENDING.
