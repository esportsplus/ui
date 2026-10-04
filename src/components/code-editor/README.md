# Code editor

A reusable source editor using only `@esportsplus/template`, `@esportsplus/reactivity`, and browser APIs. No editor framework, parser, or new runtime dependency. The entry imports its SCSS using the repository component convention.

## Architecture

1. An independent `EditorDocument` preserves exact source, UTF-16 selections, a line index, saved baseline, and bounded patch history.
2. A separate LF projection maps native textarea selections and input back to exact source offsets. One textarea stays mounted through every edit and option update.
3. First-party `html` templates and `render` construct layout, find/go controls, status, tokens, gutter, and selection decorations. Reactive state drives attributes and geometry; `html.reactive` renders bounded row and token arrays. Shared browser-measured layout maps source positions through wrapping and folding for text, selection, pointer input, and service overlays.
4. Input and commands use document transactions for indentation, conservative bracket assistance, search/replace, go-to-line, and callbacks. A mount owns a reactive scope and a render disposer; disposal releases template effects, array subscriptions, native listeners, observers, frames, and timers.
5. A canvas minimap shares token colors and provides viewport navigation. Separate [workspace](WORKSPACE.md), [language-service](SERVICES.md), and [Markdown](MARKDOWN.md) modules supply the integrated shell and optional editing modes. Pure, compiled DOM, and real-browser suites exercise these layers.

`document.ts`, `native.ts`, `commands.ts`, `search.ts`, and `highlight.ts` are independently testable. `view.ts` owns template rendering and reactive view state; its imperative code handles native textarea values, selection, focus, scroll, input/composition events, and measurement. `index.ts` supplies the component wrapper, independent value/options effects, and disconnect cleanup. Explicit controller disposal also stops the component's prop effects.

## Component API

```ts
import { reactive } from '@esportsplus/reactivity';
import codeEditor, { EditorDocument, type Controller } from '@esportsplus/ui/code-editor';

const document = new EditorDocument('const score = 42;\r\n');
const options = reactive({ fileName: 'score.ts', readonly: false, tabSize: 4 });
let editor: Controller;

const content = codeEditor({
    document,
    options: () => options,
    controller: (controller) => { editor = controller; },
    onChange: (value, change, snapshot) => {
        // snapshot.dirty, snapshot.revision, change.source
    },
    onSelection: (selection, position) => {
        // Exact UTF-16 source offsets; 1-based line and column.
    },
    onSave: (value) => {
        // Persist value. After success, call document.markSaved().
    },
    style: '--editor-height: 420px;'
});
```

The source entry is `src/components/code-editor/index.ts`; the package subpath is `@esportsplus/ui/code-editor`. Default export is a `component(...)` factory supporting bound presets and host attributes. Host `onconnect` and `ondisconnect` callbacks are forwarded after internal lifecycle work. `controller` runs after mount and again if the template reconnects; old controllers become inert after disposal.

| Prop | Contract |
| --- | --- |
| `document?: EditorDocument` | Optional persistent document. Use one per tab and mount the desired document in the host. The instance identity is fixed for a mounted component. |
| `value?: string \| (() => string)` | Initial/external exact text. A getter or a property on a reactive attributes object updates live. Subsequent values use undoable `setValue`; use `document.reset` to replace a document baseline. |
| `options?: Options \| (() => Options)` | Reactive option snapshot. Missing keys return to defaults on the next prop update. Passing a reactive options object directly also works. |
| `controller?: (controller) => void` | Receives the public API when connected. |
| `onChange?: (value, change, snapshot) => void` | Every committed text change, including commands, external values, reset, undo, redo, and a completed composition. |
| `onSelection?: (selection, position) => void` | Changed selections, including native mouse/keyboard selection and command selection. |
| `onSave?: (value, snapshot) => void` | Save request only. No implicit persistence or clean-state change. |

For a controlled value, use `value: () => draft.value` and write `draft.value = value` in `onChange`. The component tracks props rather than document state, so unrelated option updates do not write a stale captured string over input. During IME, `controller.setValue` queues the latest value until composition finishes. Direct document mutations during IME take precedence over the composing native draft; prefer controller updates when retaining that composition matters.

Do not pass internal input listeners as host attributes to replace editor behavior. Native input attributes are provided through options (`label`, `name`, `placeholder`). The textarea is exposed for integration, inspection, and focus; changing its value directly bypasses document/history ownership. Put custom toolbars outside the editor host.

## Options and styling

| Option | Default / behavior |
| --- | --- |
| `label`, `name`, `placeholder` | Accessible textarea name defaults to `Code editor`; native form name/placeholder are optional. |
| `fileName`, `language` | Extension inference unless `language` is supplied. `plain`, `javascript`, `typescript`, `json`, `jsonc`, `css`, `html`, `markdown`, `python`. JSX/TSX/Vue/SCSS extensions use the nearest lexical mode, not dedicated grammars. |
| `readonly` | `false`; blocks native edits and editing controller commands, including undo/redo. Selection, navigation, copy, and save requests remain available. Explicit `setValue`, `document.reset`, and direct document operations remain available to the owner. |
| `lineNumbers`, `highlight` | `true`. Turning highlighting off exposes normal native textarea text. |
| `wrap`, `whitespace` | `false`; soft wrapping and visible space/tab marks without changing source. |
| `minimap`, `fold` | Minimap defaults off in the bare component and on in the workspace; folding defaults on. Token overview supports click, drag and wheel navigation. |
| `onAutocomplete`, `onCompletionKey` | Completion request/key hooks. The supplied language-service addon also handles its own scoped events. |
| `tabSize` | `4`, clamped to 1–16; controls tab display. |
| `indent` | Four spaces; accepts nonempty spaces/tabs. This is independent of tab display size. |
| `autoIndent`, `autoBrackets` | `true`; disable assistance separately. Programmatic `newline()` always applies indentation. |
| `captureTab` | `true`; Escape then Tab always leaves the editor. `false` keeps normal Tab navigation. |
| `lineComment`, `blockComment` | Language defaults: JS/TS/JSONC/plain `//`, Python `#`, CSS `/* */`, HTML/Markdown `<!-- -->`, strict JSON no comment command. Override with a marker or `false` and an optional delimiter tuple. |

Theme with `--editor-background`, `--editor-color`, `--editor-border`, `--editor-comment`, `--editor-keyword`, `--editor-string`, `--editor-number`, `--editor-selection`, `--editor-match`, and `--editor-match-active`. Dimensions use `--editor-height`, `--editor-font-family`, `--editor-font-size`, `--editor-line-height`, and `--editor-padding`. A numeric pixel line height and monospace font are recommended. The template-owned `.code-editor-view` binds `--editor-tab-size`, `--editor-gutter-width`, and internal state attributes; disposal removes that view without changing caller-owned host styles. Resize and font-load events repaint alignment. Forced-colors mode exposes native text and hides the overlay.

## Controller and document API

`Controller` exposes `document`, reactive read-only-by-contract `state`, and the persistent `textarea`. Persist `document.value`: the textarea contains an LF-normalized visible projection when folded. `state.selections` contains every selection; native accessibility exposes the primary range.

| Method | Behavior |
| --- | --- |
| `focus()` | Focus native input. |
| `setValue(text)` | Undoable full replacement; preserves/clamps selection; queues during IME. Return `false` means unchanged or deferred. |
| `setOptions(options, replace = false)` | Patch options, or replace the complete option snapshot when `replace` is true. |
| `select({ start, end?, direction? }, reveal = true)` | Set/clamp source selection; reveal the active caret. |
| `selectMany(ranges, reveal = true)`, `addNextOccurrence(all = false)` | Multiple source selections, normalized against overlap; select the next or all occurrences. |
| `undoSelection()`, `redoSelection()` | Restore selection changes separately from document history. |
| `rectAt(offset)`, `offsetAt(clientX, clientY)`, `refresh()` | Source/client geometry through wrap and fold projection; refresh measurements after host layout changes. Hidden offsets have no rectangle. |
| `fold(line?)`, `unfold(line?)`, `foldAll()`, `unfoldAll()` | Structural folding and gutter actions. Optional line defaults to the active source line. |
| `lineCommand(command)` | Move/copy lines up/down, delete lines, or insert a blank line as an atomic history entry. |
| `insert(text)` | Replace selection with exact text, bypassing typing assistance. |
| `undo()`, `redo()` | Shared native/command history. |
| `indent()`, `outdent()`, `newline()`, `toggleComment()` | One transaction per command. Line selections exclude the final line when the selection ends exactly at its start. |
| `find(query?, options?)` | Set/search query and return `{ matches, error, truncated }`; does not open the panel or move selection. |
| `findNext()`, `findPrevious()` | Select/reveal next match, wrap, and return the match or `null`; do not steal focus from the find field. |
| `replace(text)`, `replaceAll(text)` | Replace current/next match or all matches as one undo step. Literal replacement stays literal; regex replacement supports JS capture/replacement tokens. |
| `openFind(replace = false)`, `closeFind()` | Built-in accessible find/replace panel; close also clears search marks. |
| `goToLine(line, column = 1)`, `openGoToLine()` | Clamp/reveal 1-based line/column; built-in panel accepts `line:column`. |
| `save()` | Invoke save callback with current exact source and snapshot. |
| `dispose()` | Flush native composition/pending values; stop observers, frames, timers, subscriptions, and listeners; remove owned nodes. Idempotent. |

Editing methods return `boolean`. During composition those commands are inert; only `setValue` queues. Navigation and panel opening also wait for composition to finish.

`new EditorDocument(value = '', { limit = 200, bytes = 8_000_000 } = {})` starts clean. History uses patches rather than whole-document snapshots. The byte budget counts UTF-16 inserted/removed text (not exact heap overhead); an entry exceeding it is discarded while its document change remains applied. There is no native undo fallback.

The document exposes:

- `value`, immutable `selection`, read-only `starts`, and immutable `state` snapshots: `{ value, selection, revision, lineCount, dirty, canUndo, canRedo }`.
- `transact(edits, options?)` and `replace(from, to, insert, options?)` return a boolean: `true` for a text change; `false` for rejected validation or an accepted operation without a text change. All edit ranges reference the pre-transaction source. Invalid/noninteger/out-of-bounds ranges, overlaps, and nonstring insertions are rejected before mutation, without throwing. Rejection leaves text, selection, line index, revision, saved state, undo/redo stacks, history grouping, and notifications untouched. Options include `source`, final `selection`, and native typing `group`/`time`.
- `tryTransact(edits, options?)` returns exported `TransactionResult`: `{ accepted: true, changed: boolean }` or `{ accepted: false, reason: 'invalid-range' | 'overlap' | 'invalid-insert', index: number }`. The diagnostic index refers to the original input array, before range sorting. Use this result when distinguishing rejection from an accepted no-op matters. Accepted selection-only operations still notify selection changes with `changed: false`. Validation is nonthrowing; caller-provided callback exceptions propagate normally rather than being caught or hidden.
- `setValue(value, options?)`, `reset(value = '', selection = {})`, `select(selection, source?)`, `undo()`, `redo()`, `breakHistory()`, and `markSaved()`.
- `position(offset?)`, `offset(line, column = 1)`, and `subscribe((snapshot, change) => ...)`, which returns an unsubscribe function. `change` is `{ source, textChanged, selectionChanged }`.

Adjacent native insert/delete input groups for up to 750 ms until a selection move, command, save, undo, redo, or composition boundary. Commands and full replacements are separate undo steps. Undo/redo restore selections and backward direction. Dirty state compares exact source to the saved baseline, so undoing to saved text clears dirty. Save callbacks should mark saved only when the current draft is the successfully persisted value.

For imperative mounting, create an empty host with class `code-editor` and use `mountEditor(host, document?, options?, callbacks?)`. Include the component SCSS through the normal package pipeline. Dispose that controller when its host is removed. Template mounting does this automatically. Documents outlive views and can be mounted again; simultaneous views of one document share selections and history.

## Shortcuts

`Mod` means Ctrl or Cmd. Browser-native caret movement, selection, word movement, clipboard, and accessibility remain textarea behavior.

| Shortcut | Action |
| --- | --- |
| Mod+Z / Mod+Shift+Z / Mod+Y | Undo / redo |
| Tab / Shift+Tab | Indent / outdent when captured and editable |
| Escape then Tab | Leave textarea using native focus navigation |
| Enter | Newline indentation when enabled |
| Mod+/ | Toggle comment |
| Mod+] / Mod+[ | Indent / outdent |
| Mod+F / Mod+H | Find / replace panel |
| F3 / Shift+F3 | Next / previous match in the textarea |
| Enter / Shift+Enter in find fields | Next / previous match |
| Mod+G / Mod+Shift+G | Next / previous search match |
| Mod+Alt+G | Go-to-line panel |
| Mod+S | Save request |
| Mod+D / Mod+Shift+L | Add next occurrence / select all occurrences |
| Alt+click / Alt+Shift+drag | Add cursor / rectangular selection |
| Mod+Shift+[ / Mod+Shift+] | Fold / unfold at the active line |
| Ctrl+Alt+[ / Ctrl+Alt+] | Fold / unfold all |
| Alt+Up / Alt+Down | Move selected lines |
| Alt+Shift+Up / Alt+Shift+Down | Copy selected lines |
| Mod+Space | Request completion when connected |
| Escape in a panel | Close panel and return focus |

## Source, IME, performance, and limitations

The document never trims, HTML-escapes, or normalizes source. Template slots produce safe text nodes; no source is evaluated or inserted with `innerHTML`. Offsets are UTF-16, matching native selection APIs, not grapheme columns. CRLF and lone CR are single displayed line breaks. Native LF offsets map to raw offsets; an offset inside CRLF visually snaps to the boundary after the break. Native inserted line breaks use the first existing document EOL, or LF for an empty/no-break document. Programmatic insertions, paste, copy, and cut use exact source. Browser-native drag/drop can normalize newly inserted line endings. Unchanged regions retain mixed EOLs verbatim.

IME intermediate text stays entirely in the persistent textarea. The overlay hides during composition so the browser displays its composing text/underlines. Final commit is one transaction, accounting for different ordering of final `input` and `compositionend`. The underlying DOM node is never replaced and unchanged values are never assigned. External value updates are held until the final commit; direct document mutations win conflicting compositions.

The overlay and gutter have only the visible row window plus overscan. Painting is scheduled on changes/scroll/resize, with no continuous animation loop. Lexical scanning stops after 200,000 characters or 10,000 lines; lines over 10,000 characters or 500 tokens display plain text. Visible token/search slices have a 3,000-slice paint budget and at most 200 search marks per line. Beyond visual budgets, full source remains visible and editable as plain text. Search collects at most 10,000 matches; navigation uses that bounded set, and replace-all refuses a truncated set. Zero-width regex matches navigate/replace but have no visible-width background.

Document strings, native textarea layout, line indexing, projection rebuilding, search, and some commands still have O(document length) cost. This is not a rope/piece-table editor for multi-megabyte interactive workloads. Regex search uses browser `RegExp` on the main thread; match caps do not bound pathological regex execution time. Lexical modes handle comments, strings, regular expressions, embedded HTML script/style, and conservative structural assistance, but do not supply a complete grammar AST or semantic analysis. Long lines can fall back to plain text. Browser measurement supports soft wrap; bidirectional text, complex font shaping, physical IME, and mobile keyboards still need device validation.

## Reference audit and parity

Audited local sources: `G:/template/src/{component.ts,types.ts,event/onconnect.ts,event/index.ts}`, `G:/reactivity/src/system.ts`, repository component/SCSS conventions, and `G:/t3code/packages/t3code-plugin-editor/src/ui/{cm.ts,minimap.ts,lsp.ts,main.ts}`.

| Reference capability | Implementation |
| --- | --- |
| Persistent editing view, document updates, focus/reveal, readonly surface | Implemented through a persistent native textarea and controller. |
| Undo/redo, indentation, close brackets, comments, search/replace, go-to-line | Implemented; assistance is lexical/conservative and uses exact source transactions. |
| Line numbers, active gutter, language selection, syntax coloring, theme | Implemented with bounded overlay rows and approximate lexical modes. |
| Native text selection and clipboard | Primary native selection plus multiple source ranges; distributed paste, exact-source copy/cut, atomic history. |
| Highlighting, bracket matching, fold gutter/fold commands | Authored lexical modes and structural scanning, including template/JSX expressions. Source-mapped folds survive unrelated edits/history; ellipsis clicks reveal hidden text. Full parser equivalence is not claimed. |
| Multiple/rectangular selections, crosshair, selection/drop-cursor decorations | Alt+click adds cursors; Alt+Shift+drag selects a rectangle. Ctrl/Cmd+D adds occurrences; edits preserve all ranges in history. |
| Soft wrap and visible whitespace toggle from `main.ts` | Live options with browser-measured layout and source-preserving display marks. |
| Canvas minimap, sampling/slider dragging from `minimap.ts` | Token-colored, bounded canvas rendering with cached drawing and an interactive viewport slider. |
| LSP lifecycle, diagnostics, completion, hover from `lsp.ts` | Optional injected [language services](SERVICES.md), including stale-result handling and lifecycle cleanup. |
| Markdown WYSIWYG/decorated editing | Optional [in-place Markdown editor](MARKDOWN.md) uses the same document/history. |
| Files/tabs, quick open, explorer, watchers, save, preferences in `main.ts` | [Workspace component](WORKSPACE.md) with typed host adapters and deterministic memory host. |

## Verification

Run with Node supporting native TypeScript stripping and `registerHooks` (Node 22.15+):

```sh
node --test scripts/test-code-editor.mjs
node --test scripts/test-code-editor-build.mjs
node --test scripts/test-code-editor-dom.mjs
```

The pure-state suite needs no installed dependencies. It checks source/EOL preservation, atomic rejection diagnostics and boolean compatibility, unchanged state/history/notifications on rejection, callback exception propagation, history grouping/bounds, selections, commands, native offset/diff behavior, composition commits, regex/literal search and replacements, lexical continuation, and deterministic undo/redo fuzzing. The build suite compiles first-party templates and SCSS without emitting files or starting a server. Run `tsc --noEmit` from both the repository root and `docs` to check library and consumer exception contracts.

The DOM suite compiles the actual component and runs it with the shared first-party runtimes in an already-installed jsdom. It tries `CODE_EDITOR_JSDOM_PATH` and then the workspace's `jsdom`; it skips with a reason if neither exists. No package installation is needed. To use another existing installation, set `CODE_EDITOR_JSDOM_PATH` to its package directory or entry file before running the test.

Compiled DOM coverage includes persistent textarea identity, native input and command history, reactive find/replace controls and errors, go-to-line, safe source rendering, bounded visible rows and scroll transforms, IME commits and queued values, prop synchronization, explicit/component disposal, old-handler cleanup, and same-host remounts. The harness supplies fixed viewport/canvas metrics because jsdom has no layout engine.

`scripts/test-code-editor-browser.mjs` additionally exercises the built docs in real Chrome: keyboard editing, search, clipboard copy/cut/paste, 2,000-line scrolling and overlay/gutter geometry, per-document drafts/history, read-only input, responsive containment, and file-tree icon rendering/navigation. Start a docs preview, set `CODE_EDITOR_TEST_URL` to its URL, `CODE_EDITOR_PLAYWRIGHT_PATH` to an existing `playwright-core` package, and optionally `CODE_EDITOR_BROWSER_PATH` to a browser executable, then run `node --test scripts/test-code-editor-browser.mjs`. No test dependency is installed. Physical-device IME, mobile keyboards, and accessibility tooling still require manual validation.
