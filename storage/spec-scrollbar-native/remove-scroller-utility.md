---
type: refactor
recommended-model: sonnet
status: PENDING
validation: deterministic
depends-on: scrollbar-native-core
api-impact: breaking
files-own: [src/css-utilities/scroller/scss/index.scss, src/css-utilities/scroller/scss/variables.scss, src/css-utilities/index.scss, src/components/root/scss/variables.scss]
---

# Remove the .--scroller utility (replaced by scrollbar --flex-row)

## Rationale

`.--scroller` exists only to provide a horizontally-scrolling row with a hidden native bar, via the same measured-width hack the scrollbar component used (`margin-bottom: calc(var(--scrollbar-width) * -1)` + matching `padding-bottom`, keyed on the root `--scrollbar-width: 17px`). After the core item, that job is fully covered by COMPOSITION of existing pieces: `class='scrollbar --flex-row'` — `.scrollbar` supplies the natively-styled bar, the compound `.scrollbar.--flex-row { overflow-y: hidden }` rule pins the vertical axis off exactly as `.--scroller`'s `overflow-y: hidden` did, and `.--flex-row` (`src/css-utilities/flex/scss/index.scss`: `display: flex; flex-flow: row; gap: 0px var(--gap-horizontal);` — row nowrap, so children overflow horizontally) supplies the layout and gap intent. The utility is therefore deleted, not reworked (user decision). Deleting a publicly `@forward`ed utility class is a public-API removal — `api-impact: breaking`.

## Changes

The css-utilities surface loses the scroller utility entirely (files, barrel forward, and the stale global measured-width variable); horizontal scrolling is served by composing the scrollbar styling class with the existing flex row utility.

## Design

1. DELETE `src/css-utilities/scroller/scss/index.scss` and `src/css-utilities/scroller/scss/variables.scss` — the whole `scroller/` utility folder goes.
2. `src/css-utilities/index.scss` line 18: remove `@forward './scroller/scss/index.scss';` (the only reference to the deleted folder).
3. `src/components/root/scss/variables.scss` line 23: remove the `--scrollbar-width: 17px;` declaration from `:root` — the stale MEASURED-native-width variable. After the core item, the new `--scrollbar-width: 4px` lives scoped on `.scrollbar` in `src/components/scrollbar/scss/variables.scss`, and after this deletion nothing references the old root 17px meaning. Leave every other `:root` variable untouched.

## Reads

- src/css-utilities/index.scss — the barrel that `@forward`s the folder being deleted
- src/css-utilities/flex/scss/index.scss — provides the `.--flex-row` replacement this deletion relies on

## Acceptance

The scroller folder no longer exists, the barrel no longer forwards it, the `:root` 17px definition is gone, and no `.--scroller` selector survives anywhere in src.

## Checks

- `test ! -e d:/ui/src/css-utilities/scroller/scss/index.scss`
- `test ! -d d:/ui/src/css-utilities/scroller`
- `grep -q "scroller" d:/ui/src/css-utilities/index.scss && exit 1 || exit 0`
- `grep -q -- "--scrollbar-width: 17px" d:/ui/src/components/root/scss/variables.scss && exit 1 || exit 0`
- `grep -rq "\-\-scroller\b" d:/ui/src && exit 1 || exit 0`

## Notes

- Migration for external consumers of `.--scroller`: use `class='scrollbar --flex-row'` — natively-styled horizontal bar, horizontal layout and gap via the existing flex utility. Rides the same breaking release as the core item.
- `depends-on: scrollbar-native-core` because the root 17px removal is only safe once the core item has removed the last old-meaning `var(--scrollbar-width)` usage (the old scrollbar scss consumed it).
- External stylesheets reading the global `var(--scrollbar-width)` (undocumented internal mechanism) lose it with this deletion.
