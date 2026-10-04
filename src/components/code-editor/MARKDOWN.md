# In-place Markdown

Import `markdownEditor` directly from `./markdown`. It accepts `{ document, options?, controller?, onChange?, onSelection?, onSave? }` and normal template attributes/lifecycle callbacks. `options` can be a reactive getter. There is also `mountMarkdownEditor(host, document, options, callbacks)` for an empty host. `markdown.ts` imports `_markdown.scss`; direct users of `markdown-view.ts` should import that stylesheet themselves.

```ts
import { markdownEditor, EditorDocument } from './markdown';

const document = new EditorDocument('# Draft\r\n\r\n- [ ] Review\r\n');
const view = markdownEditor({
    document,
    options: () => ({ readonly: permissions.readonly, label: 'README.md' }),
    controller: api => { activeMarkdown = api; },
    onChange: (value, change, state) => updateDraft(value, state.dirty),
    onSave: (value, state) => persist(value, state)
});
```

Each inactive source block renders in the document flow. Clicking it replaces **that same position** with the persistent native textarea containing its exact raw Markdown markers. Blocks above and below remain rendered. Selection spanning blocks makes the entire intersected region editable in place. Blur restores the rendered region. This is a single editing surface, not a separate preview pane. Ctrl/Cmd+A selects the entire source; dragging a selection across rendered blocks and Shift+Arrow at a block boundary project back to source selection. Arrow movement at an editable-region boundary enters adjacent blocks.

Active headings retain the heading font size, weight and line height. Active quotes retain their depth-dependent border, indentation and color; active code retains its code background and monospace metrics. Inactive and active regions use the same base font and spacing. List indentation (including tabs) and nested quote depth remain source metadata rather than being flattened. Indented code renders literally, inline delimiter runs skip escaped closers and code spans, balanced inline link destinations retain nested parentheses, and reference links retain their raw bracket presentation with link styling.

`markdown-layout.ts` uses estimated heights followed by measured DOM heights in a Fenwick index. The surface renders an overscanned window of at most 120 blocks, with spacer heights preserving document flow. Large code, quote and prose blocks use source slices of at most 32 lines (8192 characters for parsed prose); a long code line remains a single horizontally scrollable text node. These slices do not change the logical block or its edit range. A single active block uses the native textarea at that block's position. A selection spanning blocks shows raw source in the same bounded window, with each selected block retaining its heading/quote/code styling and selection highlight; the persistent native input captures typing, clipboard and IME without adding another visible pane. Typing collapses the selection back to the native block editor. A hidden template text mirror measures the caret with the head block's font/wrapping metrics. Height measurements preserve the scroll anchor, cached measurements survive edits, and resize/font/image changes update geometry. Scrolling a document or selecting thousands of blocks does not mount their entire DOM. HTML widgets stay whole and sanitized, matching the reference's block widget behavior.

The shared `EditorDocument` owns source, selection and undo history. Rendering never rewrites its value. Native LF projection maps selections and edits back to exact mixed-EOL source; commands preserve the document's preferred EOL. Copy/cut use the exact selected source and paste preserves supplied text. Task toggles, formatting, markup continuation and native edits use document transactions. IME keeps the input mounted, commits once after the final input, and queues `controller.setValue` until composition finishes. A concurrent direct document edit wins over the composing draft. Readonly blocks can be selected/revealed but cannot type, format, toggle checkboxes or change history. Saving calls `onSave` and leaves marking saved to the persistence owner.

`MarkdownOptions` extends the core `Options`, adding `spellcheck`. `wrap`, `whitespace`, `minimap`, `fold` and `readonly` work through reactive component props or `setOptions`; wrapping defaults to true for standalone Markdown. Workspace preferences override it. `wrap:false` keeps inactive text on source lines and disables native input wrapping; horizontal caret reveal follows the active source input. Whitespace dots/arrows are source-based overlays. The minimap samples at most 512 source lines, projects them onto the measured visual layout (including folds), and supports pointer dragging and keyboard navigation. Heading sections, multiline quotes/lists, code/fences, frontmatter and HTML have structural fold controls. Active blocks retain a fold button; collapsed regions show a source header and line-count chip. Search, selection and go-to-line unfold matched source regions. Source edits map surviving folds through the document's edit batches; edits inside hidden ranges reveal them. Folding never changes source/history.

The controller implements the complete core `Controller` contract plus `bold` and `italic`: reactive `state`; selection/occurrence and selection-history commands; source insertion, line commands, indentation, Markdown newline and HTML comment toggling; find/replace; folding; navigation; `rectAt`, `offsetAt`, `refresh`; persistence/lifecycle commands. Its native textarea contains the **active source region**, not the whole document. Use the document for persistence and source selection. Geometry uses browser text ranges for mounted presentation/native mirrors and estimated source rows for virtual blocks, in client coordinates; hidden folded offsets return null. `onCompletionKey`/`onAutocomplete` support host completion wiring. Dispose releases listeners, panel/minimap/overlay scopes and the compiled template scope; component disconnection handles disposal automatically, and explicit controller disposal also stops reactive prop effects.

Find searches the exact source using existing `search.ts`, including markers and hidden regions. The panel supports literal/regex search, match case, whole word, previous/next, replacement capture expansion and replace-all. Invalid regex displays an error and blocks replacement; truncated results block replace-all. Replacements are one document transaction and readonly guards apply to both UI and API. Matches activate and reveal their block. Keyboard shortcuts: Ctrl/Cmd+F (find), H (replace), G/Shift+G and F3/Shift+F3 (next/previous), Ctrl/Cmd+Alt+G (line:column), Escape (close panel), Ctrl/Cmd+Alt+[/] (fold/unfold), with Shift for all.

Ctrl/Cmd+D adds the next occurrence; Ctrl/Cmd+Shift+L/A selects all occurrences (at most 1000, matching the shared helper). `selectMany` accepts source ranges. Secondary selected blocks show raw markers and per-block typography in the same bounded surface. Native typing, grapheme deletion, clipboard, Markdown formatting/continuation and IME commit across all ranges atomically; undo restores text and selections together. Copy/cut preserve exact source and empty ranges copy/cut source lines. Multirange clipboard metadata preserves embedded EOLs when copying between these editors; external text with one line per range distributes those lines, otherwise it inserts the same text at every range. Alt+pointer drag creates rectangular source-line selections using Markdown geometry; ordinary rendered dragging still maps to a single source range. Ctrl/Cmd+U/Shift+U traverses selection history.

Parent workspace wiring: choose this component for Markdown tabs and reuse `tab.document` and the workspace's save/change callbacks. `MarkdownController` structurally satisfies the entire core `Controller`; the workspace guard's `goToLine`/`rectAt`/`refresh` check can safely recognize it. Existing toolbar wrap/whitespace preferences and find/navigation commands can route directly to this controller. `mountLanguageServices(host, controller, options)` also accepts it directly, using the shared exact-source document and geometry. The focused compiled integration test mounts an injected transport on this Markdown controller, applies a real completion text edit, renders hover/diagnostics and verifies cleanup. This module does not edit the workspace, parent examples or root barrel.

Raw HTML uses the browser's inert DOM parser followed by an explicit allowlist and static compiled templates. It permits ordinary prose, headings, code, lists, tables, details, safe links and images. Script/style, active form controls, frames, SVG/MathML, object/embed and their contents are discarded; event attributes, style, arbitrary attributes and unsafe URL schemes never reach live nodes. HTML source is never assigned to live `innerHTML`, and no DOMPurify/runtime package is added. Unsafe Markdown links retain their visible label without an executable destination.

## Reference checklist

Reference root: `G:/t3code/packages/t3code-plugin-editor/src/ui`.

| Reference source/symbol | Implementation |
| --- | --- |
| `markdown.ts`, `selectionTouches/buildDecorations` | Active source region shows raw markers; inactive blocks render in the same flow |
| `markdown.ts`, `HEAD_CLASS/HeaderMark` | ATX and setext headings, inactive markers hidden, h1–h6 styling |
| `markdown.ts`, `HIDDEN_MARKS/SELECTION_STYLES` | Emphasis, strong, strike, inline code and fenced code presentation |
| `markdown.ts`, `Link` handling | Balanced inline links display labels and safe destinations; reference links retain styled source brackets |
| `markdown.ts`, `Blockquote` | Nested quote depth and matching inactive/active styling |
| `markdown.ts`, `TaskCheckbox` | Actual checkbox toggles only its source state character, undoable and per-document |
| `markdown.ts`, `FrontmatterChip/FRONTMATTER_RE` | Leading frontmatter collapses to a chip and opens for source editing |
| `markdown.ts`, `SanitizedHtmlBlock` | Inert parsing plus strict allowlist, rendered through templates |
| `markdown-edit.ts`, `insertNewlineContinueMarkup/deleteMarkupBackward` | List/ordered-list/task/quote continuation, empty-item exit, Backspace unwrap |
| `markdown-edit.ts`, `mdBold/mdItalic/toggleWrapped` | Ctrl/Cmd+B/I toggles word/selection, preserves selection direction and undo |
| `cm.ts`, `search/searchKeymap` | Shared source search/replace semantics, visible panel, regex/case/word controls, match reveal and navigation shortcuts |
| `cm.ts`, `wrapCompartment/whitespaceCompartment` | Functional wrap and source whitespace options through workspace-compatible props |
| `cm.ts`, `foldGutter/foldKeymap` | Structural Markdown folds, active/inactive buttons, chips, fold/unfold/all, edit mapping and source reveal |
| `cm.ts`, `minimap` | Bounded source overview with visual-layout mapping, viewport thumb, pointer and keyboard navigation |
| `cm.ts`, `EditorState.allowMultipleSelections/defaultKeymap/historyKeymap/drawSelection` | Shared occurrence helper, multirange source selections, atomic edits/clipboard/IME/history and visible secondary selections |
| `cm.ts`, `rectangularSelection/crosshairCursor` | Alt+drag source-line rectangles mapped through Markdown geometry |

## Validation and limits

```powershell
$env:CODE_EDITOR_JSDOM_PATH = 'G:/template/node_modules/jsdom'
node --test scripts/test-code-editor-markdown.mjs scripts/test-code-editor-markdown-dom.mjs scripts/test-code-editor-markdown-controls.mjs scripts/test-code-editor-markdown-services.mjs scripts/test-code-editor-services-build.mjs
node_modules/.bin/tsc.cmd -p src/components/code-editor/tsconfig.services-test.json
node_modules/.bin/tsc.cmd -p docs/tsconfig.json
```

Pure tests cover source ranges, mixed EOL, inline marks, safe URLs, task transactions, continuation/unwrapping and formatting history. Compiled DOM tests cover same-position activation, rendered marks, hostile HTML, multi-block selection, keyboard editing, readonly, IME, save and scoped component cleanup. The Chrome suites verify active-block editing, task/history behavior, source search/replacement, multirange edits, layout controls, folding, minimap navigation and large-document end-of-document editing.

Correction-round tests cover active heading/quote/code typography, nested list and quote layout, indented code, balanced/escaped link destinations, delimiter runs, and styled reference source. Viewport tests cover ten thousand logical blocks and a five-thousand-line fence, measured heights, distant selection, select-all, navigation in readonly mode, source range coverage and bounded DOM counts.

Control tests cover 2000 intervening rows in search/reveal, source regex replacements and history, invalid regex and readonly, line:column validation, active wrapping/height, whitespace/minimap visibility and navigation, heading/fence fold/unfold/reveal, multirange native typing/copy/cut/paste/formatting/deletion/IME, the complete shared controller contract, source geometry round trips, Alt-drag rectangles and disposal. Model tests verify fold boundaries and atomic multi-range Markdown command history. The shared services integration test verifies the structural service contract without a core shim.

Remaining limits: the parser is local rather than Lezer's full CommonMark/GFM grammar; uncommon combinations of mixed container nesting or HTML-block termination can group differently. Markdown tables and images retain source presentation, as requested; no new rendering for them was added. Ordered continuation renumbers consecutive siblings and leaves mixed/repeated numbering unchanged. Sanitized HTML maps a click to its source block start; hidden presentation markers map to nearby displayed text. Offscreen geometry uses estimated row metrics until measured, and rectangles select source lines rather than supporting virtual columns beyond line ends; rectangle dragging has no edge autoscroll. The minimap uses cached, sampled token-colored source segments; its geometry follows the rendered Markdown blocks. Whitespace/search/selection overlays are capped at 1000 visible marks, occurrence selection at 1000 ranges and minimap at 512 sampled lines. Source parsing still examines the document on text changes, while DOM and individual large code/prose presentations are bounded. Browser checks pass in the integrated docs and workspace, including inherited-scroll-style isolation and heading typography.
