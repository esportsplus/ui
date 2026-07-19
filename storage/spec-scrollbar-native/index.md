# Scrollbar Native Refactor Spec

## Clarifying Questions

### Answered
- **Q1** · styling — Keep the current look (4px wide, square, track-less, thumb `var(--color-black-300)`, ~1px radius), reproduced natively: `::-webkit-scrollbar` path for exact width/square/no-arrows in Chrome/Edge/Safari, `scrollbar-width: thin` + `scrollbar-color` as the Firefox fallback in the same rule, `scrollbar-gutter: stable` so content never shifts. CSS variables `--scrollbar-width` / `--scrollbar-border-width` / `--scrollbar-color`.
- **Q2** · API — `.scrollbar` becomes a styling class applied directly to the scrollable element itself. No wrapper, no `.scrollbar-container` / `.scrollbar-container-content` nesting, no synthetic overlay div. The `scrollbar` and `scrollbar-container-content` attribute slots collapse away. All runtime JS (onscroll handler, reactive height/translate state, `--scrollbar-width` measurement, negative-margin hiding hack) is deleted.

## Metadata
- **Generated**: 2026-07-19
- **Synthesizer**: claude-fable-5 · seat roles.synthesizer · router HARD
- **Research sources**: Mode 4 in-context evidence (RSC-v1 dispatch) · session reads of d:/ui/src, d:/ui/scrollbar-native-demo.html, node_modules/@esportsplus/template/src/types.ts · ownership map (core/snapshot.ts --ownership, 2026-07-19)
- **Threshold**: n/a — no perf items
- **Total features**: 4
- **Model mix**: opus 1 · sonnet 3

## Public API Changes
- [scrollbar-native-core.md](./scrollbar-native-core.md) — Native CSS scrollbar core: single-element factory, native styling, select slot collapse, viewer migration
- [remove-scroller-utility.md](./remove-scroller-utility.md) — Remove the .--scroller utility (replaced by scrollbar --flex-row)

## Features

- scrollbar-native-core
- consumer-layout-reconcile
- remove-scroller-utility
- readme-docs

## Feed
run,scope,unit,ordinal,slug,event,state,detail,elapsed_ms,ts
