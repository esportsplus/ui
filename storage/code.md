# Editor family plan

Everything editor-related lives under `src/components/editor/` and is exported as one namespace:

```ts
import { editor } from '@esportsplus/ui/components';

editor.code(...)       // code editor (was codeEditor)
editor.markdown(...)   // markdown editor (was codeEditor.markdown)
editor.tree(...)       // file tree (was fileTree)
editor.workspace(...)  // explorer, tabs, toolbar, status bar (was codeEditor.workspace)
editor.diffs(...)      // diff viewer (new)
editor.diffs.merge(...) // three-way merge editor (new)
```

There are no aliases for the old names. CSS class names are unchanged (`.code-editor`, `.markdown-editor`,
`.code-workspace`, `.file-tree`). New components use `.diffs` and `.diffs-merge`.

## Layout

```
src/components/editor/
├── index.ts          namespace + public re-exports
├── code/             core editor: document, view, syntax, layout, minimap, keymap, services/ (language server)
├── markdown/         rendered markdown editor, built on code/
├── tree/             file tree
├── workspace/        composes code, markdown, tree, diffs
└── diffs/            diff viewer and merge editor; engine.ts is the shared Myers line diff
```

`diffs/engine.ts` (`diffLines`, `diffSequences`, `changes`) ships in the base commit. The code editor's git gutter
and the diff component both use it.

## Work split

Work is split by folder. Each agent works in its own git worktree and only edits files it owns:
- its `src/components/editor/<folder>/`;
- its docs example folder;
- its own new test file under `scripts/`.

Shared files are off limits to every agent; the orchestrator merges them:
- `src/components/editor/index.ts`
- `src/components/index.ts`
- `docs/src/examples/groups.ts`
- `README.md`

Each agent lists the lines to add to those files in its report.

The work runs in two phases:
- **Phase 1:** `code`, `tree` and `diffs` run in parallel, against the contracts below.
- **Phase 2:** `workspace` runs on top of the merged phase 1, wiring everything together.

The gate for every agent:
- `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p docs/tsconfig.json` must be clean (the existing
  `animation.ts` analyzer note is fine);
- `node --test scripts/*.test.mjs` must pass;
- the coding standards in CLAUDE.md apply.

---

## Phase 1A: `editor/code`

New options (`Options` in `code/view.ts`). Every one is optional and off or neutral by default unless noted:

| Option | Behaviour |
| --- | --- |
| `sticky?: boolean \| number` | Sticky scroll: the headers of the enclosing folds stay pinned at the top while scrolling. `true` = up to 5 lines; a number sets the cap. Clicking a pinned header scrolls to it. Uses the existing fold structure (`folding.ts`). |
| `colors?: boolean` | Colour swatches: a small swatch before each CSS colour literal (hex, `rgb()`/`hsl()`/`oklch()`, named colours) in CSS, SCSS, HTML and string literals. Clicking it opens the library `colorPicker` in a tooltip; picking replaces the literal as one undoable edit. |
| `links?: boolean \| ((url: string) => void)` | Clickable links: URLs (and `file://` / relative paths when a handler is given) are underlined on Mod+hover and open on Mod+click. The default handler opens `noopener` in a new tab. |
| `unicode?: boolean` (default `true`) | Unicode warnings: invisible characters (zero-width, NBSP, soft hyphen), bidirectional controls, and confusables (non-ASCII letters that look like ASCII in otherwise ASCII identifiers) get a box mark; hovering explains which code point it is. |
| `rulers?: readonly number[]` | Vertical rulers drawn at those columns. Colour is `--ruler-color`. |
| `baseline?: string \| null` | Git gutter: diff the document against this text (for example HEAD), via `diffLines`. Gutter bars show added, modified and deleted lines (`--gutter-added-color` etc.). Clicking a bar opens an inline peek of the original lines with Revert and Next/Previous. Recomputed after edits, debounced and incremental where cheap. |
| `keybindings?: Readonly<Record<string, Command \| null>>` | User keybinding overrides merged over the defaults: a key chord maps to a command, and `null` unbinds a default chord. |
| `onMerge?: (conflict: Conflict) => void` | Called from the conflict lens's "Compare" action (below). |

Conflict markers: blocks between `<<<<<<<`, `=======` and `>>>>>>>` (and `|||||||` for the base) are tinted current,
base and incoming, with a lens row above each block: **Accept current · Accept incoming · Accept both · Compare**.
The accepts are single undoable edits; Compare calls `onMerge`.

New commands (in `keymap.ts` `Command`, with default bindings):

| Command | Default |
| --- | --- |
| `nextChange` / `previousChange` | Alt+F5 / Shift+Alt+F5 (needs `baseline`) |
| `nextProblem` / `previousProblem` | F8 / Shift+F8 (diagnostics from services), each showing the message inline |
| `nextConflict` / `previousConflict` | Alt+F8 / Shift+Alt+F8 |

New exports from `code/index.ts` (the workspace depends on these):

```ts
// Every command with its label and default chords, for keybinding editors.
export const commands: readonly { id: Command; label: string; keys: readonly string[] }[];
export type { Command, Conflict };
// Conflict = { start: number; end: number; current: string; base: string | null; incoming: string; line: number }
```

New `Controller` methods: `nextChange()`, `previousChange()`, `nextProblem()`, `previousProblem()`,
`conflicts(): Conflict[]`, `resolveConflict(conflict, 'current' | 'incoming' | 'both' | string)`,
`setBaseline(text: string | null)`.

`Snapshot` (`controller.state`) gains `selections: number`, `lineEnding: 'crlf' | 'lf'` (detected), `indent:
{ size: number; tabs: boolean }` (detected unless options set it), `problems: { errors: number; warnings: number }`
and `language: Language`. These drive the workspace status bar.

Docs: extend `docs/src/examples/code-editor/index.ts` with examples or toggles for each option, plus a conflict
sample. Tests: `scripts/code-editor-features.test.mjs` covers conflict parsing and resolution, colour literal
detection, unicode detection, keybinding override merging and the baseline change ranges.

## Phase 1B: `editor/tree`

| Feature | API |
| --- | --- |
| Drop from the OS | New `operations.import?: (target: Element \| null, entries: readonly ImportEntry[]) => void \| Promise<void>`, with `ImportEntry = { path: string; file: File \| null }`. `path` is relative inside dropped folders, and `file` is null for a directory. Folders are walked with `webkitGetAsEntry`. Drop-target highlighting and folders that open on hover work the same as for internal drags. Without `operations.import`, OS drops are ignored. |
| Drag out to the OS | New `export?: (element: Element) => { name: string; type?: string; url?: string; text?: string } \| null`. Sets `DownloadURL` (Chromium), `text/uri-list` and `text/plain` on the native drag so a file can be dropped on the desktop or into another app. Internal moves keep working. |
| Next and previous change or problem | `Controller.next(kind)` and `Controller.previous(kind)`, with `kind: 'change' \| 'problem'`. They walk visible order, expanding and loading folders as needed, wrap around, and use decorations (git status for changes; problem counts for problems). Shortcuts: Alt+F5 / Shift+Alt+F5 for changes and F8 / Shift+F8 for problems, while the tree has focus. |
| Preview and pinned | Already supported (`preview`, `open(element, { mode })`); no tree work. |

Docs: add examples to `docs/src/examples/file-tree/index.ts` for drop from the OS (it logs the imported entries into
the in-memory store), drag out (text files as data URLs), and change and problem navigation. Tests:
`scripts/file-tree-features.test.mjs` for the navigation order and the import entry flattening.

## Phase 1C: `editor/diffs`

A new component, adapting the t3code reference (`G:/t3code/packages/diffs/src`: hunks, segments, render/split,
unified, virtual and whitespace) to this repo's template, reactivity, SCSS and coding standards.

`editor.diffs(attributes)`:
- `original: string`, `modified: string`, `language?: Language` (syntax colours through `../code/syntax`), and
  `filename?` with a header showing the +additions and −deletions.
- `mode?: 'split' | 'unified'` (default split), `wordDiff?` (character and word highlights inside changed lines,
  default `true`), `ignoreWhitespace?`, and `context?` (default 3) with expandable "N hidden lines" rows.
- Virtualised rows for large files, line numbers on both sides, and next/previous change (Alt+F5 and Shift+Alt+F5,
  plus buttons).
- `onaccept?(change)` / `onrevert?(change)` per hunk when given (a change carries ranges on both sides and the
  texts).
- `controller?` with `next()`, `previous()`, `setMode()`, `setTexts(original, modified)`.

`editor.diffs.merge(attributes)` is a three-way merge editor:
- `base: string | null`, `current: string`, `incoming: string`, `language?`, and `onresolve(result: string)`.
- Layout: incoming and current read-only on top (`editor.diffs`-style highlighting), and an editable result below
  using `editor.code` (seeded with conflict markers, or by auto-merging non-conflicting hunks against the base).
- Each conflict has Accept current, Accept incoming and Accept both, plus next/previous conflict, a remaining count,
  and Complete merge (enabled once no markers remain).
- It may build `diff3` on `engine.ts`.

Docs: a new `docs/src/examples/diffs/index.ts` (split, unified, word diff, large file, merge) with `name: 'diffs'`.
Report any docs registration it needs. Tests: `scripts/diffs.test.mjs` already covers the engine; extend it for
hunks with context, word segments and the three-way merge.

---

## Phase 2: `editor/workspace`

This phase runs after phase 1 is merged and committed, and wires everything in.

| Feature | Behaviour |
| --- | --- |
| Preview and pinned tabs | Single-click opens reuse one preview tab (italic) until it's edited, double-clicked or pinned. Pinned tabs sort first with a pin icon and are kept by "close others". The tab context menu has Pin/Unpin, Close, Close others, Close to the right, Close saved, Copy path and Reveal in explorer. |
| Auto save | Preference `autoSave: 'off' \| 'delay' \| 'focus'` and `autoSaveDelay` (ms, default 1000), toggled from the toolbar or menu. While it's on, the save button is replaced by an inline-edit-style status (unsaved → saving spinner → saved check, then "Saved"), reusing `inline-edit/status`. |
| Keybinding editor | Overlay (command palette entry and Mod+K Mod+S) listing `commands` from `editor/code`, with a search box, recording a new chord (the `shortcut-recorder` component), conflict warnings, and reset per command or all. Stored in preferences as `keybindings` and passed to every editor as `editorOptions.keybindings`. |
| Status bar items | Ln/Col (exists), selections, problems (errors and warnings; click goes to the next problem), language (click picks one), indentation (click picks tabs or spaces and the size), line ending (click converts LF ↔ CRLF as one undoable edit), and auto save state. Encoding is shown as UTF-8, read-only. |
| Persisted session | Optional `WorkspaceHost.session?: { get(): Promise<WorkspaceSession \| null>; set(session: WorkspaceSession): Promise<void> }`. It stores open tabs (path, pinned, preview), the active tab, each tab's selection, scroll and folds, the explorer's expansion and scroll, and unsaved drafts (hot exit), restored on load. Writes are debounced. |
| Git gutter | Optional `WorkspaceHost.baseline?(cwd, path): Promise<string \| null>` feeds `options.baseline` per tab, refreshed on save and on watch events. |
| OS drag and drop | `WorkspaceHost.import?(cwd, target, entries)` wired to the tree's `operations.import`; `WorkspaceHost.export?` to the tree's `export`. |
| Next change or problem | Workspace-level commands that move across files, using the tree's `next`/`previous` and then the editor's. |
| Merge | When an editor reports `onMerge`, or a file with conflict markers is opened through "Merge", open `editor.diffs.merge` in place of the editor tab, and write the result back on completion. |
| Compare | A tree context action "Compare with selected" opens `editor.diffs` in a tab. |

Docs: extend `docs/src/examples/code-editor/workspace-example.ts` and the in-memory host fixture
(`fixtures/workspace.ts`) with `session` (localStorage), `baseline` (a fixed HEAD map), `import` and `export`.
Tests: extend `scripts/code-editor-workspace.test.mjs`.

## Merge and commit

After each phase:
1. Apply each worktree's diff to main.
2. Merge the shared-file additions.
3. Run the gate and spot-check the docs.
4. Commit by component as semantic commits: `feat(editor/code): …`, `feat(editor/tree): …`, `feat(editor/diffs): …`,
   `feat(editor/workspace): …`.
