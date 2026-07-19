---
type: refactor
recommended-model: sonnet
status: PENDING
validation: deterministic
depends-on: scrollbar-native-core
files-own: [src/components/sidebar/index.ts, src/components/sidebar/scss/index.scss, src/components/overlay/scss/index.scss, src/components/site/scss/index.scss]
---

# Consumer layout + overflow reconciliation for the layout-free scrollbar

## Rationale

The old 3-div structure gave every bound consumer three things for free: a `position: relative` outer container (the absolute-positioned `.sidebar` anchors to it, and `.site`'s `z-index: 0` was active on it), an inner content div that clipped horizontal overflow, and the content div's flex flow. With `.scrollbar` now a PURE style class (user decision — it imposes no display/flex/position/width), those responsibilities move onto the consumers themselves: sidebar bakes `--flex-column` into its bind, `.site` takes over the positioning context and app-shell horizontal clip, and sidebar/overlay drop the `overflow: hidden` that would kill native scrolling on the merged element.

## Changes

The sidebar becomes a self-sufficient vertical-column scroller (column layout baked into its bind, cross-axis pinned by the compound rule); the overlay keeps its own wrap layout and simply stops suppressing overflow; the site takes over the positioning anchor and horizontal clip the old container provided.

## Design

1. `src/components/sidebar/scss/index.scss` line 9: delete the `overflow: hidden;` declaration from the `.sidebar` rule (sole occurrence in the file). `.scrollbar` now supplies `overflow: auto`, and the baked `--flex-column` (step 2) pins `overflow-x: hidden` via the compound rule. The collapse animation (max-width/opacity/transform) and `.sidebar-content` are unaffected — touch nothing else in the file.
2. `src/components/sidebar/index.ts` — change the bind class from `'sidebar'` to `'sidebar --flex-column'`, making the sidebar a self-sufficient vertical-column scroller without every caller adding `--flex-column` (this matches what the viewer already passes; the compound `.scrollbar.--flex-column` gives it `overflow-x: hidden`).
3. `src/components/overlay/scss/index.scss` line 10: delete the `overflow: hidden;` declaration from the `.overlay` rule (sole occurrence in the file). `.overlay` keeps its own `display: flex; flex-wrap: wrap; justify-content: flex-start`; with `.scrollbar`'s `overflow: auto` and wrapping content (never overflows x) only the vertical bar shows — no `--flex-*` needed. Touch nothing else.
4. `src/components/site/scss/index.scss` — add `overflow-x: hidden;` and `position: relative;` to the `.site` rule, alphabetized: `overflow-x: hidden; position: relative; z-index: 0;`. The old outer container was `position: relative` (the absolute `.sidebar` anchors to it, and `z-index: 0` becomes active on a positioned element as before) and the old content div clipped horizontal overflow — both move onto `.site` now that `.scrollbar` is layout-free. `.site` scrolls vertically only and anchors the floating sidebar.
5. `src/components/frame/` needs NO change — it brings its own flex layout and never suppressed overflow.

## Reads

- src/components/scrollbar/scss/index.scss — the new compound `.scrollbar.--flex-*` rules this item relies on
- src/viewer/actions/index/index.ts — the viewer still passes `--flex-column` to its sidebar call; redundant with the baked bind, intentionally kept so no mid-run state lacks the column
- src/viewer/actions/index/scss/index.scss — `.viewer-main` lays itself out (`display: flex; flex-direction: column; margin-left`), which is why `.site` needs no flex

## Acceptance

The sidebar bind carries `--flex-column`; `overflow: hidden` is absent from the sidebar and overlay stylesheets; `.site` carries `overflow-x: hidden` and `position: relative`; `tsc --noEmit` exits 0.

## Checks

- `grep -q "sidebar --flex-column" d:/ui/src/components/sidebar/index.ts`
- `grep -q "overflow: hidden" d:/ui/src/components/sidebar/scss/index.scss && exit 1 || exit 0`
- `grep -q "overflow: hidden" d:/ui/src/components/overlay/scss/index.scss && exit 1 || exit 0`
- `grep -q "position: relative" d:/ui/src/components/site/scss/index.scss`
- `grep -q "overflow-x: hidden" d:/ui/src/components/site/scss/index.scss`
- `cd d:/ui && npx tsc --noEmit`

## Notes

- Between scrollbar-native-core and this item, sidebar/overlay briefly keep `overflow: hidden` and cannot scroll natively — expected mid-run state, resolved here.
- `.site`'s `overflow-x: hidden` beating `.scrollbar`'s `overflow: auto` (equal specificity) relies on the existing bundle-order convention: each consumer module imports scrollbar (and thus its scss) BEFORE its own `./scss/index.scss`, so consumer declarations win — the same ordering `.sidebar`'s old `overflow: hidden` already depended on.
