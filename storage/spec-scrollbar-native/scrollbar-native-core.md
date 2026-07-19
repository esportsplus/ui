---
type: refactor
recommended-model: opus
status: PENDING
depends-on: none
api-impact: breaking
files-own: [src/components/scrollbar/index.ts, src/components/scrollbar/scss/index.scss, src/components/scrollbar/scss/variables.scss, src/components/select/index.ts, src/viewer/index.ts, src/viewer/actions/index/index.ts, src/viewer/actions/index/components/scrollbar.ts]
---

# Native CSS scrollbar core — single-element factory, native styling, select slot collapse, viewer migration

## Rationale

The scrollbar component is a JS-driven synthetic overlay: an `onscroll` handler mutates reactive height/translate state on every scroll frame, a runtime measurement writes `--scrollbar-width` to `document.body`, and a negative-margin/padding hack pushes the real native bar out of view. Native CSS (`::-webkit-scrollbar` + `scrollbar-width`/`scrollbar-color`) reproduces the exact current look with ZERO runtime JS — the whole point is to delete the render-loop work. This item is atomic across the factory and its two in-repo TS consumers because `@esportsplus/template`'s `Attributes` is a CLOSED type (`node_modules/@esportsplus/template/src/types.ts:6` — no string index signature): once the factory's attribute type drops the `scrollbar` / `scrollbar-container-content` slots, the literal slot keys still passed by `select` and the viewer become excess-property `tsc` errors, so no intermediate split of these files compiles.

## Changes

The scrollbar component collapses from a 3-div structure (container > content + synthetic bar) to a single element carrying the `.scrollbar` styling class; its stylesheet swaps synthetic-overlay rules for native two-path scrollbar styling; the select dropdown and the viewer (scrollspy, full-height site class, demo entry) migrate off the collapsed attribute slots and old class vocabulary in the same change.

## Design

All decisions below are settled; target file contents are exact (Mode 4, file-localized).

**1. `src/components/scrollbar/scss/variables.scss`** — replace entire contents:

```scss
.scrollbar {
    --scrollbar-border-width: 1px;
    --scrollbar-color: var(--color-black-300);
    --scrollbar-width: 4px;
}
```

Old `--background` / `--height` / `--translate` / `--width` are deleted with the synthetic bar.

**2. `src/components/scrollbar/scss/index.scss`** — replace entire contents:

```scss
@use 'variables';

.scrollbar {
    overflow: auto;
    scroll-behavior: smooth;
    scrollbar-color: var(--scrollbar-color) transparent;
    scrollbar-gutter: stable;
    scrollbar-width: thin;

    @supports selector(::-webkit-scrollbar) {
        scrollbar-color: auto;
        scrollbar-width: auto;

        &::-webkit-scrollbar {
            width: var(--scrollbar-width);
        }
        &::-webkit-scrollbar-button {
            display: none;
            height: 0;
            width: 0;
        }
        &::-webkit-scrollbar-thumb {
            background: var(--scrollbar-color);
            border-radius: var(--scrollbar-border-width);
        }
    }

    &.--flex-column {
        overflow-x: hidden;
    }
    &.--flex-row {
        overflow-y: hidden;
    }

    &--full {
        height: 100%;
    }
    &--hidden {
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }
    &--snap {
        overflow: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: both mandatory;

        > * {
            scroll-snap-align: center;
            scroll-snap-stop: normal;
        }
    }
}
```

Settled decisions baked into this file:
- Two-path recipe per the reference demo (d:/ui/scrollbar-native-demo.html, panel 4): Firefox keeps base `scrollbar-width: thin` + `scrollbar-color`; inside `@supports selector(::-webkit-scrollbar)` both are reset to `auto` FIRST (Chromium ignores all `::-webkit-scrollbar` pseudo-elements while either is set), then the pseudo-elements deliver exact 4px width, no arrows, square thumb with `var(--scrollbar-border-width)` radius.
- ORDERING IS LOAD-BEARING: the modifier rules (`--full`, `--hidden`, `--snap`) must compile AFTER the `@supports` block. `.scrollbar--hidden` and the `@supports .scrollbar` reset have equal specificity (0,1,0), so source order is what lets `--hidden`'s `scrollbar-width: none` beat the `auto` reset; `::-webkit-scrollbar { display: none }` covers WebKit regardless.
- `.scrollbar` is a STYLE-ONLY class — it never imposes display/flex/position/width; consumers own their layout via the existing `--flex-*` utilities or their own scss. The positioning context and column layout the old container provided move onto the consumers (see consumer-layout-reconcile). `scroll-behavior: smooth` and `scrollbar-gutter: stable` stay on the base — scroll-related, not layout.
- Axis-scoping is delegated to the existing `--flex-*` utilities via compound rules: `.scrollbar.--flex-column { overflow-x: hidden }` and `.scrollbar.--flex-row { overflow-y: hidden }` (specificity 0,2,0 — they beat both the base and the `--flex-*` utility regardless of bundle order), so a `--flex-column` scroller scrolls only vertically and a `--flex-row` scroller only horizontally, while a bare `.scrollbar` keeps `overflow: auto` on both axes. The native recipe styles BOTH axes' bars identically, and the `scrollbar --flex-row` composition is what replaces the deleted `.--scroller` utility (the compound rule even pins `overflow-y: hidden` exactly as `.--scroller` did). The `--snap` modifier keeps its own `overflow: auto`.
- The GLOBAL `::-webkit-scrollbar { background: transparent }` mobile reset is REMOVED, not scoped: it existed to hide every native bar for the synthetic overlay and would fight the new styled bars. Explicit hiding is now `.scrollbar--hidden`.
- `--full` replaces `scrollbar-container--full` (height: 100%). `--hidden` becomes native hiding (still scrollable). `--snap` carries the old `scrollbar-container-content--snap` behavior verbatim. `--fixed` is DROPPED — zero consumers (grep-verified repo-wide).
- No height on the base: the element scrolls when externally constrained (inline style, `--full`, or consumer CSS), matching today's effective behavior.

**3. `src/components/scrollbar/index.ts`** — replace entire contents:

```ts
import { html, type Attributes } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory<Attributes>(
    function(this: { attributes?: Attributes }, attributes, content) {
        return html`
            <div class='scrollbar' ${this?.attributes} ${attributes}>
                ${content}
            </div>
        `;
    }
);
export type { Attributes };
```

Settled: factory/bind shape is preserved so `sidebar/site/overlay/frame = scrollbar.bind({ attributes: { class } })` keep working unchanged — the template engine merges the static `class='scrollbar'` with preset/call-site classes exactly as it merged `class='scrollbar-container'` today. `omit`, `reactive`, the module-level `root`/`width` state, and the `OMIT` list are all deleted. The `Attributes` named type export is KEPT (now the plain template `Attributes`) so external `import { Attributes } from '@esportsplus/ui/scrollbar'` still resolves.

**4. `src/components/select/index.ts`** — slot collapse (public-API change to select's attribute surface):
- Line 6: `import scrollbar, { Attributes as Attr } from '~/components/scrollbar';` → `import scrollbar from '~/components/scrollbar';`
- `OMIT`: delete the `'scrollbar',` and `'scrollbar-container-content',` entries (list becomes arrow, options, option, tooltip-content).
- Type `A`: delete the `scrollbar?: Attributes;` and `'scrollbar-container-content'?: Attributes;` members; the trailing `& Attributes & Attr` becomes `& Attributes` (`Attr` is now the same plain type — redundant).
- `sb` bind: `sb = scrollbar.bind({ attributes: { class: 'tooltip-content --flex-column' } });` — the `--flex-column` that lived in the collapsed content slot moves onto the single element's class.
- `sb(...)` call (lines 174–175): delete the `scrollbar: attributes.scrollbar,` and `'scrollbar-container-content': attributes['scrollbar-container-content'],` lines. Everything else (tooltip-content merge, class array with direction suffix, onclick, onconnect, style) is untouched.

**5. `src/viewer/index.ts`** — line 27: `site({ class: 'scrollbar-container--full' }, index)` → `site({ class: 'scrollbar--full' }, index)`. NO `--flex-*` class on this call — `.viewer-main` lays itself out (own `display: flex; flex-direction: column` in src/viewer/actions/index/scss/index.scss; a block/margin child works identically), and `.site`'s clipping/positioning is reconciled in consumer-layout-reconcile.

**6. `src/viewer/actions/index/index.ts`**:
- Line 18: `main.closest('.scrollbar-container-content')` → `main.closest('.scrollbar')` — `main` sits inside the site() root element, which now carries `.scrollbar` and IS the scrolling container, so the IntersectionObserver root resolves to the same scroll region as today.
- Sidebar call (lines 60–64): delete the `'scrollbar-container-content': { class: '--flex-column' }` property and merge the class into the element's own class: `class: 'sidebar--floating sidebar--w --active --flex-column'`.

**7. `src/viewer/actions/index/components/scrollbar.ts`** — line 27 (hidden-bar variant): `scrollbar({ scrollbar: { class: 'scrollbar--hidden' }, style: box }, rows(14))` → `scrollbar({ class: 'scrollbar--hidden', style: box }, rows(14))`.

Discretion point: SCSS formatting/nesting details are the implementer's, criterion: the EMITTED CSS rule order must be base declarations → `@supports` reset + pseudo-elements → modifiers, and declarations stay alphabetized within each rule.

## Reads

- src/components/template/index.ts — factory/bind contract the rewrite must preserve
- node_modules/@esportsplus/template/src/types.ts — closed `Attributes` shape; why the TS flip is atomic
- src/components/sidebar/index.ts — bind consumer; preset class merge must keep working
- src/components/site/index.ts — bind consumer with `onclick` preset
- src/components/overlay/index.ts — bind consumer
- src/components/frame/index.ts — bind consumer
- scrollbar-native-demo.html — reference for the two-path native recipe (panel 4); NOT an edit target

## Acceptance

Scoped to this item's files: the synthetic-overlay structure is gone repo-wide (`scrollbar-container` token absent from src), the two-path native recipe and the three `--scrollbar-*` variables are present, `tsc --noEmit` exits 0, and the collapsed slots no longer appear in select or the viewer. Visual fidelity (critic): the base rule imposes no layout (display/flex/position/width-free — the style-only contract); the viewer scrollbar entry renders a 4px, square, track-less thumb in `var(--scrollbar-color)` with ~1px radius and no arrows in Chromium; Firefox falls back to thin + colored; the hidden variant shows no bar but still scrolls; content does not shift when the bar appears.

## Checks

- `grep -rq "scrollbar-container" d:/ui/src && exit 1 || exit 0`
- `grep -q "onscroll" d:/ui/src/components/scrollbar/index.ts && exit 1 || exit 0`
- `grep -q "reactive" d:/ui/src/components/scrollbar/index.ts && exit 1 || exit 0`
- `grep -q "window-inactive" d:/ui/src/components/scrollbar/scss/index.scss && exit 1 || exit 0`
- `grep -q "overflow: auto" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q "&.--flex-column" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q "&.--flex-row" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q "scrollbar-width: thin" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q "scrollbar-gutter: stable" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q "::-webkit-scrollbar-thumb" d:/ui/src/components/scrollbar/scss/index.scss`
- `grep -q -- "--scrollbar-color: var(--color-black-300)" d:/ui/src/components/scrollbar/scss/variables.scss`
- `grep -q -- "--scrollbar-width: 4px" d:/ui/src/components/scrollbar/scss/variables.scss`
- `grep -q "Attributes as Attr" d:/ui/src/components/select/index.ts && exit 1 || exit 0`
- `grep -q -- "--flex-column" d:/ui/src/components/select/index.ts`
- `grep -q "closest('.scrollbar')" d:/ui/src/viewer/actions/index/index.ts`
- `grep -q "scrollbar--full" d:/ui/src/viewer/index.ts`
- `grep -q "class: 'scrollbar--hidden'" d:/ui/src/viewer/actions/index/components/scrollbar.ts`
- `cd d:/ui && npx tsc --noEmit`

## Notes

- Breaking surfaces: the component's rendered DOM (3 divs → 1), the `scrollbar` / `scrollbar-container-content` attribute slots (gone from scrollbar AND select), the `.scrollbar-container*` class vocabulary, and `.scrollbar--fixed`. External stylesheets targeting the old classes and external callers passing the old slots must migrate on the next release.
- Behavior delta (user-accepted): the old content-div's `overflow-x: hidden` clip no longer lives on the base — the app-shell horizontal clip moves to `.site` (consumer-layout-reconcile). A BARE `.scrollbar` with no `--flex-*` now shows a natively-styled horizontal bar when content overflows x (previously clipped); any `--flex-column`/`--flex-row` scroller pins its cross-axis to `hidden`, matching the old clip behavior exactly.
- Between this item and consumer-layout-reconcile, sidebar/overlay temporarily keep `overflow: hidden` and cannot scroll natively — expected mid-run state, resolved by the dependent item; do not "fix" it here (their scss is not in this item's files-own).
- The critic should exercise the viewer (`pnpm dev`) scrollbar entry, the select dropdown, and the site page scroll; judge against scrollbar-native-demo.html panel 4.
