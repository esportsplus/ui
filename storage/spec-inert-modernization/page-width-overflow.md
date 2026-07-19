---
type: fix
recommended-model: sonnet
status: PENDING
priority: P2
validation: critic
depends-on: none
files-own: src/components/page/scss/index.scss
---

# Page: 100vw width overflow fix

## Rationale
`100vw` includes the vertical scrollbar's width, so any page with a vertical scrollbar overflows horizontally and produces a horizontal scrollbar. `width: 100%` fills the container without counting the scrollbar. Universal browser compat — no tradeoff.

## Changes
Page stylesheet: the page root fills its container width without triggering horizontal overflow. Modern viewport/typography properties already present are left untouched.

## Design
In `src/components/page/scss/index.scss`, `.page` sets `width: 100vw`. Change it to `width: 100%` (the flex-column page fills its container without counting the scrollbar). Leave the existing `min-height: 100svh` and `text-wrap: balance` untouched (already modern/correct).

## Acceptance
`.page` no longer uses `100vw`; no horizontal overflow from the page width; `pnpm build:vite` succeeds. 0 regressions.

## Verify
pnpm build:vite
