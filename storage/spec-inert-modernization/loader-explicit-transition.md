---
type: refactor
recommended-model: sonnet
status: PENDING
priority: P2
validation: critic
depends-on: none
files-own: src/components/loader/scss/index.scss
---

# Loader: explicit transition properties

## Rationale
`.loader` uses `transition: all 0.3s ease-in-out`, which transitions EVERY animatable property — a perf/correctness footgun (it includes layout-affecting properties and any future property change silently becomes animated). The loader's actual transition-driven animation is its fade only; enumerating the intended properties removes the footgun at zero visual cost. Universal browser compat.

## Changes
Loader stylesheet: the overlay's transition covers only the properties it intentionally animates (its fade); the keyframe-driven movement is unaffected.

## Design
In `src/components/loader/scss/index.scss`, `.loader`'s animated properties are its fade — `opacity` and `visibility` (the enter/leave transitions on the fixed full-screen overlay); the `transform` movement is driven by the `loaderMove` @keyframes, not this transition (verified at authoring time by reading the full file). Replace:

`transition: all 0.3s ease-in-out;`

with the enumerated list of only the intended properties:

`transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;`

Before finalizing, re-confirm from the full loader scss which properties are actually transitioned (not keyframed); if a property beyond opacity/visibility is genuinely transitioned via the `all`, include it in the enumerated list and note it.

## Acceptance
`.loader` transitions only the enumerated properties (no `transition: all`); the loader fade still animates; `pnpm build:vite` succeeds. 0 regressions.

## Verify
pnpm build:vite
