# File tree and code editor

## Reference and scope

The reference is `G:/t3code/packages/t3code-plugin-editor`. The UI library's existing tree lives in `src/components/file-tree` (the package uses the `components` directory). Changes belong in this library; the T3 plugin remains a reference and is not modified.

Reference files reviewed:

- `src/file-tree/core/model/publicTypes.d.ts`: selection, expansion, mutations, search, rename, drag/drop, and virtual rows.
- `src/file-tree/core/iconConfig.js`, `core/builtInIcons.js`, and `core/render/iconResolver.js`: icon sets, filename and extension resolution, color, and overrides.
- `src/ui/main.ts`: explorer integration, tab icons, drafts, save, workspace events, and quick open.
- `src/ui/cm.ts`: CodeMirror editing, language grammars, search, history, selection, brackets, folding, and wrapping.
- `src/ui/minimap.ts`, `src/ui/markdown.ts`, and `src/ui/lsp.ts`: overview rendering, Markdown editing, and language services.

## Tree comparison

The existing UI component already provides virtual rows, keyboard and range selection, compact folders, multi-root workspaces, lazy loading, reveal, sticky ancestors, fuzzy search/filtering, sorting, exclusion rules, context-menu callbacks, drag/drop, clipboard operations, inline create/rename, undo history, snapshots, git decorations, diff counts, and open/unsaved badges. These should be retained rather than replaced by the plugin's controller.

The concrete missing area is file icon coverage: existing defaults have named open/closed folder icons but a generic file glyph. Add filename, compound-extension, and extension resolution; extend named folder coverage; preserve the custom renderer; allow monochrome presentation. Use library-owned markup and existing assets without importing the vendored engine or adding an icon package. Details and remaining differences live in the tree's component README.

## Editor implementation plan

1. Implement independent document, selection, transaction, history, search, and tokenization helpers. Exercise text preservation, selection changes, undo/redo, and search edge cases with focused tests.
2. Build `src/components/code-editor` using `@esportsplus/reactivity`, `@esportsplus/template`, and browser APIs. Keep one native textarea mounted for selection, clipboard, accessibility, and input-method composition. Render highlighted text safely as text nodes, with line numbers and synchronized scrolling.
3. Expose a typed controller and reactive options, change/selection/save callbacks, indentation, bracket insertion, comment toggling, find/replace, and line navigation. Keep persistence and workspace RPC in the consuming application.
4. Add library exports, token-based styling, component documentation, and runnable documentation examples including tree-to-editor composition.
5. Validate pure editing behavior, type checking, stylesheet compilation, and the compiled documentation application. Review the implemented API and document its actual limits.

## Full UI parity acceptance plan

The requested deliverable now includes the reference plugin's complete UI, exposed as reusable components. The initial component below is a baseline, not the acceptance criterion. Reference paths in this table are relative to `G:/t3code/packages/t3code-plugin-editor/src/ui`. A feature is complete only after its integrated behavior is verified; the presence of an API or button alone does not qualify.

| Area | Reference | Required acceptance behavior |
| --- | --- | --- |
| Explorer and icons | `main.ts`, `../file-tree/core/iconConfig.js` | Named file/folder icons, filename precedence, compact folders, selection, keyboard navigation, search, collapse, rename, context menu, delete and undo |
| Workspace | `main.ts` | Async file loading, independent drafts, tabs and dirty indicators, close/activate, breadcrumbs, save/error feedback, path-and-line navigation |
| Workspace controls | `main.ts` | Left/right explorer, hide/show and edge peek, wrap and whitespace toggles, persistent preferences, fuzzy quick open with keyboard navigation |
| External changes | `main.ts` | Watcher refresh updates clean documents and tree entries while preserving dirty drafts; stale reads/saves cannot overwrite newer state |
| Editing and history | `cm.ts` | Native input/IME, clipboard, undo/redo, indentation and auto-indent, bracket insertion/deletion/matching, comments, line commands and selection shortcuts |
| Search | `cm.ts` | Search panel, match navigation/highlighting, case/word/regex options, replacement, invalid-pattern handling, go-to-line |
| Selection | `cm.ts` | Multiple cursors, rectangular selection, occurrence selection, edits and history across ranges, active gutter, drag/drop cursor |
| Layout | `cm.ts` | Soft wrap, visible whitespace, folding and fold shortcuts, correctly aligned caret/selection/overlay/gutter when scrolled, resized, wrapped or folded |
| Highlighting | `cm.ts` | JavaScript/JSX, TypeScript/TSX, CSS/SCSS, HTML and embedded code, JSON, Python and Markdown; themeable token categories and state across lines |
| Minimap | `minimap.ts` | Colored document overview, viewport indicator, click/drag navigation, correct resize and edit updates, bounded rendering for large documents |
| Language services | `lsp.ts` | Injected transport with open/change/close lifecycle, completion keyboard/mouse acceptance, hover, diagnostic ranges/messages, stale-response suppression |
| Markdown | `markdown.ts` | In-place active source/inactive rendering, heading/emphasis/strong/strike/code/link/quote/fence/task behavior, checkbox edits, frontmatter, safe HTML, continuation/deletion and bold/italic shortcuts |
| Lifecycle and integration | All | Reactive prop updates, mount/unmount/remount cleanup, readonly enforcement, document switching, scoped shortcuts, no new runtime dependencies |

Verification combines focused model tests, compiled template lifecycle tests, library/docs typechecks, a production docs build, and real-browser interactions. Browser coverage must include combinations such as wrap + folding + minimap navigation, multicursor + undo, Markdown + document switching, and async save/watch races. The existing browser suite remains a regression baseline.

An isolated Chrome probe of the reference's existing `dist/ui.js` confirmed its explorer/tab/breadcrumb arrangement, fold gutter, minimap and quick-open behavior. The probe supplied in-memory host responses and made no filesystem changes in the reference project. Its built Markdown mode threw `Block decorations may not be specified via plugins` when opening a document containing frontmatter and an HTML block, and its LSP notification used a truncated file URI. These reference defects are not desired compatibility behavior: acceptance follows the source's intended functionality and requires the replacement to handle these cases successfully.

## Component boundary

The reusable editor owns text editing and its local controls. The workspace component owns tabs, drafts, explorer controls, quick open and file-operation UI. Filesystem access, watching, preferences, chat mentions and language-server transport are supplied through typed host adapters. Deterministic in-memory adapters exercise these boundaries without adding backend dependencies to the UI package.

The expanded scope requires multiple cursors, structural folding, Markdown WYSIWYG, interactive minimap, and language-service completion/hover/diagnostics. Its documentation must describe actual support explicitly; basic lexical highlighting is not a replacement for a language parser or server. No CodeMirror, Monaco, Lezer, sanitizer, or other new third-party runtime dependency is introduced.

## Initial baseline verification (before the full parity expansion)

This section records the earlier core-only baseline. Current APIs are documented in the [tree README](../src/components/file-tree/README.md), [editor README](../src/components/code-editor/README.md), [workspace contract](../src/components/code-editor/WORKSPACE.md), [language services](../src/components/code-editor/SERVICES.md), and [Markdown editor](../src/components/code-editor/MARKDOWN.md).

All 44 focused tests pass: icon resolution and tree compilation, editor transactions and commands, native text projection, search, tokenization, template/SCSS compilation, and compiled DOM input/lifecycle tests. Both library and documentation typechecks pass with only the pre-existing animation fan-out advisory. The documentation production build passes. Package manifests and lockfiles are unchanged.

DOM tests use an existing jsdom installation through `CODE_EDITOR_JSDOM_PATH`, with synthetic layout metrics. An additional real-Chrome suite, `scripts/test-code-editor-browser.mjs`, passes eight integration scenarios (nine reported tests including the parent). It covers native editing/shortcuts, find/replace/save, 2,000-line horizontal and vertical scrolling with measured overlay/gutter alignment, real browser clipboard operations, document switching/history, read-only input, desktop/mobile-width containment, and tree icons/keyboard navigation. The suite uses an existing Playwright installation and a running docs preview through environment variables; no dependency is added. No page errors were reported.

Browser verification found and fixed native scroll restoration cancelling pending caret reveals, inherited smooth scrolling/transform transitions causing text and gutter lag, demo grid overflow, and language monograms/folder badges created in the HTML namespace instead of SVG. Regression checks cover these cases.

At that baseline, advanced selections, folding, wrapping, minimap, language services, Markdown editing, and workspace management had not been implemented. They have since been added and are covered by the expanded acceptance plan above. Physical-device IME, mobile keyboards, and assistive-technology behavior still require device validation.

## Expanded implementation and browser checks

The docs now include a complete in-memory workspace, transport-driven completion/hover/diagnostics, and in-place Markdown editing. The workspace example uses typed host operations for loading, saving, renaming, deleting, undoing file operations, watching external changes, preferences, copying paths, and chat mentions. Markdown tabs share their documents and history with the workspace. The production library does not generate mock diagnostics or start language servers.

Browser suites are `scripts/test-code-editor-browser.mjs`, `scripts/test-code-editor-features-browser.mjs`, and `scripts/test-code-editor-workspace-browser.mjs`. They cover the earlier baseline plus tabs/drafts, save/watch behavior, path-and-line opening, explorer sides/hide/peek/search, fuzzy quick open, clipboard/chat context actions, rename/delete/undo, Markdown tab history, multiple/rectangular selections, whitespace, wrapping, fold persistence/clipboard/placeholders, minimap navigation, completion keyboard/mouse acceptance, hover dismissal, diagnostic positioning during page scroll, and task/heading edits. Final integrated verification passes: 142 focused tests and 23 real-Chrome tests, with no skipped tests or browser page errors. Both library and docs typechecks and the production docs build pass. The only reported advisories are the existing animation fan-out finding and docs chunk-size warning. Package manifests and lockfiles are unchanged.

Browser review has additionally corrected workspace light-theme contrast, narrow embedded layout, stable tree accessible names during decoration changes, and fixed-position language-service marks not following page scroll. The Markdown parser and code lexer are authored first-party implementations; their documented grammar limits are distinct from the visible UI feature checklist.

The local review preview is `/components/code-editor`; its complete-workspace example composes the tree, code/Markdown editors and injected language services. The acceptance matrix covers the visible feature set; this does not claim identical parser behavior, brand SVGs, or pixel output. Remaining grammar, geometry, large-source budgets and device-validation limits are recorded in the component READMEs.
