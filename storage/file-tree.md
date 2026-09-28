# File tree features

Tick to approve. Status: ✅ built · ◐ partial · — missing. Sources: VS Code (VSC), Zed, JetBrains (JB), Cursor/Windsurf follow VSC.

## Structure & display

- [✅] **Virtualized rows** — only on-screen rows in the DOM.
- [✅] **Indent guides** — line per ancestor under its chevron; brighter on hover.
- [✅] **Indent guide modes** — `indicator: 'always' | 'hover' | 'never'` (VSC).
- [✅] **Chevrons** — rotate on open; files keep the column for alignment.
- [✅] **File & folder icons** — per-element icon function (by extension, open/closed).
- [✅] **Named folder icons** — distinct icons for `src`, `test`, `.git`, `node_modules`, `docs`, `dist`, `public`, `assets`, `components`, `scripts`.
- [ ] **Compact folders** — single-child folder chains shown as one row, `src/components` (VSC, Zed, JB). —
- [ ] **File nesting** — pattern rules tuck related files under a parent, `package-lock.json` under `package.json` (VSC). —
- [✅] **Sticky scroll** — ancestor folders pin to the top while scrolling, pushed up by the next subtree (VSC, Zed).
- [✅] **Expand/collapse animation** — accordion edge with fade; instant under reduced motion.
- [✅] **Nested selection highlight** — one highlight inset to each row's depth; selected full tint, hover dimmer, selection moves instantly.
- [✅] **Ellipsis truncation** — long names cut with `…`.
- [✅] **Full-path tooltip** — hover shows path, size, modified date.
- [✅] **Empty state** — message/action when there are no files.
- [✅] **Loading row** — spinner while a folder's children load.
- [✅] **Error row** — folder that failed to read shows why; retry by reopening.
- [✅] **Right-to-left** — mirrored layout and arrow keys.
- [ ] **Multi-root** — several roots, each with a header row (VSC workspaces). —
- [✅] **Scope colors** — tint rows by scope, e.g. tests green (JB).

## Sorting & filtering

- [✅] **Natural sort, folders first** — `file2` before `file10`.
- [✅] **Sort modes** — folders first, files first, mixed, by type, by modified date, or a comparator (VSC, Zed).
- [✅] **Case/unicode sort options** (Zed).
- [✅] **Hide dotfiles** toggle (Zed).
- [✅] **Hide gitignored** toggle (Zed); dimmed otherwise.
- [✅] **Exclude patterns** — glob list never shown (VSC `files.exclude`).
- [ ] **Find/filter widget** — type to filter or highlight matches, keeps ancestors (VSC Ctrl+Alt+F). —
- [ ] **Fuzzy match highlight** — matched characters bolded in names. —

## Decorations

- [✅] **Git name colors** — untracked/added green, modified yellow, conflict red, ignored grey.
- [✅] **Git letters** — U A M D R `!`, each part colored on its own.
- [✅] **Diff stats** — `display.stats`: `+x` green / `−x` red; untracked shows `+x`.
- [✅] **Folder rollup** — dot in the most severe child color, even collapsed; deleted files count as modified.
- [✅] **Folder diff totals** — summed `+x −y` on folders, deleted files included.
- [✅] **Problems** — name tinted; counts spoken, not shown in the badge.
- [✅] **Deleted files** — hidden by default, `display.deleted` shows struck through.
- [✅] **Staged vs unstaged** — staged letter in a tinted chip beside the working-tree letter (VSC).
- [✅] **Submodule marker** — `S` (VSC).
- [✅] **Unsaved marker** — dot on files dirty in the editor.
- [✅] **Open-in-editor marker** — files with an open tab.
- [✅] **Symlink / read-only markers** — arrow / lock icon.
- [✅] **Cut marker** — cut items dimmed until pasted.
- [✅] **Custom decorations** — consumer-defined badge + color per id; one store per provider, merged by id.

## Navigation & selection

- [✅] **Arrows, Home/End, PageUp/PageDown**.
- [✅] **Left/Right** — close/open, jump to parent/first child.
- [✅] **Type-ahead** — jump by typed prefix.
- [✅] **Expand/collapse all** button.
- [✅] **Expand siblings** — `*` opens all folders at that level.
- [✅] **Recursive expand** — Alt+click or Alt+Right/Left opens or closes a whole subtree (VSC).
- [✅] **Auto-reveal** — editor's file opened and scrolled to (VSC, Zed, JB).
- [✅] **Auto-reveal modes** — `reveal: 'on' | 'select' | 'off'` (VSC).
- [✅] **Multi-select** — Ctrl/Shift+click, Shift+arrows, Ctrl+A.
- [✅] **Preview vs pinned open** — single click previews, double/middle click pins; reported to `open` (VSC, Zed).
- [✅] **Open to side** — Ctrl+Enter / Alt+click; reported to `open`.
- [✅] **Expand mode** — `expand: 'click' | 'dblclick'` (VSC).
- [✅] **Next/previous change** — Alt+F5 / Shift+Alt+F5 and a controller (Zed).
- [✅] **Autoscroll to source** — `preview`: a resting cursor opens the file (JB).

## File operations

- [✅] **New file / folder inline** — input row in place, paths like `a/b.ts` create folders.
- [✅] **Inline rename** — F2, stem pre-selected.
- [✅] **Inline validation** — "name exists", invalid characters, consumer validator.
- [✅] **Delete / trash** — with confirm hook.
- [✅] **Cut / copy / paste / duplicate**.
- [✅] **Drag & drop** — move, Alt copies, folders open on hover, confirm hook.
- [ ] **Drop from OS** — import files dragged in from the desktop. —
- [ ] **Drag to editor/terminal** — drop a file into other panels. —
- [ ] **Undo / redo** file operations (Zed). —
- [✅] **Copy path / relative path**.
- [ ] **Compare two files** — diff selected pair (Zed). —
- [✅] **Context menu hook** — right-click callback with selected elements.

## Data & API

- [✅] **Decorations store** — diffed `replace`/`update`, only changed rows re-render.
- [✅] **open / select callbacks** + two-way `state.selected` / `state.selection`.
- [✅] **Live updates** — `FileTreeElements` store: add/remove/rename/move without rebuilding.
- [✅] **Lazy children** — async `load` on first open.
- [✅] **Persist state** — `snapshot` saves/restores open folders and scroll position.
- [✅] **Locked items** — visible but not selectable.

## Accessibility

- [✅] **ARIA tree** — roles, levels, active descendant, single tab stop.
- [✅] **Accurate set size** — position/size skip hidden rows.
- [✅] **Spoken decorations** — "modified, 2 errors" in the accessible name.
- [✅] **Reduced motion**.
- [✅] **Forced colors** — selection and guides visible in high contrast mode.
