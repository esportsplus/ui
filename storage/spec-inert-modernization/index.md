# Inert Modernization Fix Spec

## Clarifying Questions

> Answer inline under each **A:**, then tell me you're done. Blocking questions gate the feature files
> they list; optional questions already have a sensible default applied — fill one in only to override.
> I'll apply your answers and move each answered question to the Answered log (I won't ask it again).

### Open — Optional
- **Q1** · consumer-convention docs · affects: [consumer-inert-convention] · assumed: author src/components/README.md documenting the convention.
  Consumer-driven components (modal/sidebar/frame/overlay/direct anchor) can't be migrated at the library level and have no in-repo stateful consumer to retrofit. Do you want a documented consumer inert-pairing convention, and where should component-library docs live (src/components/README.md, a top-level docs/ file, or skip)?
  **A:**

## Metadata
- **Generated**: 2026-07-18
- **Synthesizer**: claude-fable-5 · seat roles.synthesizer · router HARD
- **Research sources**: in-conversation audit (Mode 4, no external sources)
- **Total features**: 7
- **Model mix**: opus 1 · sonnet 6
- **Deferred — out of scope by constraint** (compat below the ~Baseline 2022–2023 bar, or intentionally excluded; do not author items for these): native `scrollbar-color`/`scrollbar-width` (Safari 18.2, late-2024) · `content-visibility: auto` (Firefox 125 / Safari 18, 2024) · `text-wrap: pretty` · button `pointer-events` (decorative `::after` + non-interactive loading skeletons — no hidden focusable content) · checkbox/radio/switch/select `-tag` hidden inputs (correct visually-hidden pattern)

## Features

- alert-inert
- select-dropdown-inert
- tooltip-menu-inert
- consumer-inert-convention
- page-width-overflow
- loader-explicit-transition

## Feed
run,scope,unit,ordinal,slug,event,state,detail,elapsed_ms,ts
