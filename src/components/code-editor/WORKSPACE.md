# Editor workspace

`workspace.ts` exports `codeEditorWorkspace` (also the default export), its controller and editor hook types, `EditorWorkspaceModel`, and `createMemoryWorkspaceHost`. The shell uses the existing first-party template/reactivity, file tree, code editor, and `EditorDocument`. It adds no runtime dependency and copies no vendored implementations or icon assets.

## Mounting and controller

Import the module directly until the package integration exports it. Its standalone SCSS partial is imported by the component; give its container a definite height.

The shell uses the existing white, grey-300, text and border tokens, with matching `Canvas`/`CanvasText` fallbacks when tokens are absent. Override the `--workspace-*` properties or the host's theme tokens for custom themes. A component width of 520px or less stacks the explorer below the editor; hiding it restores the editor's height and retains the side-specific peek edge. A `ResizeObserver` tracks embedded width and disconnects with the component. Explorer filenames keep stable accessible names; editor and filesystem decorations are exposed through accessible descriptions.

```ts
import codeEditorWorkspace, { createMemoryWorkspaceHost } from './workspace';

const host = createMemoryWorkspaceHost({
    'src/main.ts': 'export const answer = 42;\n',
    'README.md': '# Workspace\n'
}, { explorerSide: 'right' }, ['empty-directory']);

const view = codeEditorWorkspace({
    host,
    cwd: '/project',
    controller: (workspace) => {
        // Save this controller for app commands; opening accepts one-based positions.
        void workspace.open('src/main.ts', 1, 14);
    }
});
// Render `view` using the application's existing template renderer.
```

The controller exposes `model`, the current `editor`, `open`, `save`, `close`, `rename`, `delete`, `undoFiles`, `refresh`, `search`, `collapseAll`, `quickOpen`, explorer/wrap/whitespace toggles, `focus`, and `dispose`. `delete()` without paths uses explorer selection. Model operations return promises; failures update visible status and return a failure result rather than breaking later operations. `model.whenIdle()` drains watcher, operation and preference queues for deterministic tests.

Supply `model` instead of `host`/`cwd` when the application manages workspace state itself. Call `model.setWorkspace(cwd)` to switch roots with dirty-draft authorization. `openTarget` accepts a value or reactive getter returning `{ path, line?, column?, requestId? }`. Repeated request IDs are ignored; new IDs can reveal a new position in the same tab. Workspace-relative paths and absolute targets contained in `cwd` are accepted; Windows and POSIX separators are normalized. Traversal and targets outside the workspace are rejected.

## Host contract

`WorkspaceHost` injects real filesystem/application behavior:

| Method | Responsibility |
| --- | --- |
| `list(cwd)` | Return workspace-relative file and directory entries. Omitted parent directories are derived for the tree; explicit empty directories are supported. |
| `read(cwd, path)` / `write(cwd, path, content)` | Read text and durably write the captured save snapshot. Reject failed IO. |
| `rename(cwd, source, destination)` / `delete(cwd, paths)` | Execute the operation and return its undo receipt `{ operationId }`. Preserve undo data in the host. |
| `undo(cwd, operationId)` | Reverse that receipt; reject conflicting restoration rather than overwriting new files. |
| `watch(cwd, changed)` | Return a synchronous or promised unsubscribe function. Call `changed({ paths? })` after external changes; refresh reconciles the complete index and clean open documents. |
| `preferences.get()` / `.set(preferences)` | Optional asynchronous preference persistence. Writes are serialized snapshots. Defaults: explorer visible/right, wrap and whitespace off. |
| `mention(cwd, path)` | Execute Add to Chat in the application's mention system. |
| `copyPath(cwd, path)` | Execute Copy Path using the application's path convention and clipboard bridge. |
| `confirm(request)` | Optional native confirmation returning `save`, `discard` or `cancel`. Without it the shell renders a working keyboard-accessible dialog. |

The memory host implements all these operations, directory and file undo, preferences, and watcher notifications. `change(path, textOrNull)` simulates external changes. Its `contents`, `directories`, `writes`, `mentions`, `copiedPaths`, and `watchCount()` support inspection without timers. It records mention/clipboard actions instead of contacting an external application. Persistence lasts for the lifetime of the host; supply a real preferences adapter for durable storage.

## Editor and addon integration

Every tab owns a stable `EditorDocument`, history, selection, saved snapshot, and scroll position. The default editor enables minimap and folding; `editorOptions` can override those defaults. Workspace preferences control wrap and whitespace. Typing, watcher refresh and rename do not recreate the active textarea. Tab switching mounts the appropriate view around the retained document.

`renderEditor(tab, attributes)` may return a first-party custom editor or return `undefined` for the standard code editor. Forward the provided attributes so document, controller, reactive options and save behavior remain connected. The shared controller contract supports both the core and Markdown components; line reveals fall back to document offsets for custom editors.

```ts
import markdownEditor from './markdown';
import { mountLanguageServices } from './services';
import { isWorkspaceCodeEditor } from './workspace';

codeEditorWorkspace({
    host,
    cwd: '/project',
    renderEditor: (tab, attributes) => /\.md(?:own)?$/i.test(tab.path)
        ? markdownEditor(attributes)
        : undefined,
    addons: ({ host: surface, controller, tab, workspace }) => {
        if (!isWorkspaceCodeEditor(controller)) return;
        const services = mountLanguageServices(surface, controller, {
            fileName: tab.path,
            cwd: workspace.state.cwd,
            // transport: the application's language-service transport
        });
        return () => services.dispose();
    }
});
```

The addon hook runs after each active editor mounts and after its path changes. Previous cleanup runs before remounting services with the new filename. It also runs when the editor is released. Errors appear in workspace status. The controller receiver should not replace or dispose the document itself. Disconnect releases workspace watches and focus listeners; controller `dispose()` additionally releases model subscriptions and editor resources. The consuming renderer remains responsible for removing its rendered template.

## Reference UI audit

Read-only reference: `G:/t3code/packages/t3code-plugin-editor/src/ui/main.ts` (including its complete embedded CSS), `src/ui/state.ts`, `src/file-tree/index.ts`, `src/file-tree/render/file-tree.ts`, and `src/file-tree/render/style.ts`. The component-level icon audit is in `../file-tree/README.md`.

| Reference behavior/source | Implemented equivalent |
| --- | --- |
| `main.ts`: shell grid, tabbar, breadcrumb bar, statusbar CSS | Standalone `_workspace.scss`: full-height shell, 36px tab strip, 40px breadcrumb controls, side-dependent explorer grid, compact chrome, ellipsis, themed colors, keyboard focus, forced colors and reduced motion. |
| `tabItem`, `openFile`, `closeTab`; `state.ts`: tabs/draft/content | File icons, basename/title, active tabs, dirty dots, close buttons, middle-click close, Ctrl/Cmd+W, next/previous neighbor activation. Independent retained documents/history/scroll; tab arrows/Home/End/Enter/Space. |
| `breadcrumb`, `toggleWrap`, `toggleWhitespace` | Project/path breadcrumb with file emphasis; live editor options, pressed button states, persistent preferences. |
| `toggleExplorer`, `toggleExplorerSide`, `setupExplorerPeek`, `setupEditorMainPeek` | Explorer defaults right, moves left/right, collapses to a 16px peek edge, fills the shell without tabs. Edge hover opens; mouseleave leaves it open; entering editor retracts. Pointer access waits for transition end; keyboard/reduced-motion opening is immediate. |
| `collapseAllFolders`, `setSearch`; reference tree controller selection subscription | Collapse all, external hide-non-matches search without a duplicate find bar, matching highlights and ancestor expansion; selecting a file opens it, including keyboard selection. Existing tree navigation, typeahead, selection and inline rename remain available. |
| `quickOpenMatches`, `fuzzyScore`, quick-open overlay and keydown | Case-insensitive subsequence ranking with deterministic path ties, file-only top 12 results, input autofocus, wrapped Up/Down, Enter, Escape, mouse hover/click, backdrop dismissal, focus return and no-results surface. Ctrl/Cmd+P is scoped to workspace focus. |
| Explorer context menu, `deleteSelectedFiles`, `renameFile`, `undoFileOp`, keydown | Open/Delete/Add to Chat/Copy Path plus Rename; context keyboard navigation/dismissal and bounds clamping; F2 inline rename; Delete and tree-focused Ctrl/Cmd+Z; visible file-operation Undo button. Folder delete/rename and multi-selection delete also work. |
| `saveActive`, tab draft updates | Actual snapshot writes, dirty markers clear only for the saved content, scoped Ctrl/Cmd+S and Save button, unsaved close/delete/root-switch Save/Discard/Cancel dialog. File undo is separate from document undo. |
| Loading/error notices and status | Initial loading, refreshing/opening/working status, workspace path and Ln/Col, IO errors, retry, missing-file draft notice and empty-workspace/editor states. |
| `openTarget`, pending line reveal | Path/line/column targets, absolute-contained path normalization, clamped positions, request-ID deduplication and latest-open activation. |
| `editor.changed` watcher, `refresh`, clean-tab reads | Reconcile index and stable tree rows; reload clean tabs, preserve dirty drafts and missing files. Latest list/read responses win; a read rechecks document revision and cleanliness before applying. |
| Preferences load and serialized save | Optional injected persistent preferences, normalized defaults, ordered immutable snapshots, late-load protection, subsequent writes recover after errors. |
| Reference CM/Markdown/LSP view selection | First-party code view by default; typed custom-editor and addon hooks accept the separately implemented Markdown and language-service modules. No CodeMirror or vendor tree runtime is used. |

The existing file tree already supplied virtualization, compact folders, keyboard/multi-selection, typeahead/find, rename, decorations, lazy children, drag/drop and operations. This shell reuses those implementations; its tree changes expose `collapseAll`, `expandAll`, externally controlled `search(query)`, and opt-in `preview: 'immediate'` for reference-style keyboard file navigation. Existing find and delayed preview behavior remain available. Authored built-in icon mappings remain shared between tree, tabs and quick-open results.

## Async protections and remaining integration

IO operations are serialized. Save captures the value before awaiting IO, so later typing remains dirty. Concurrent opens deduplicate reads and respect the latest activation intent. Workspace/disposal epochs invalidate stale results. Watcher reads recheck tab identity, path, revision and cleanliness. Rename retains document identity; pending index overlays protect successful rename/delete/undo from stale listings until acknowledged. Typing during delete preserves a newly edited draft as a missing-file tab. Confirmation decisions are rejected if drafts change while authorization or saves are pending.

All reference **workspace shell actions** have live implementations here. Remaining application integration is the host adapter for SDK/IPC filesystem receipts, OS watching, durable preference storage, clipboard and chat, and selection of the supplied Markdown/LSP hooks. Language-server process startup belongs to the host transport. The component does not invent the reference application's external bridge. Code/Markdown language-specific features are documented by the separate core, `MARKDOWN.md`, and `SERVICES.md` modules. Reference-specific data-slot names, brand sprite assets and its vendor API are not reproduced; geometry and icons use the local component system. The parent Chrome suites have exercised the docs workspace, including default minimap and folding. The correction suite also compiles current workspace sources in memory and checks light/dark token contrast, 350px layout on both explorer sides, peek, toolbar actions and repeated filtered context actions. Its light/dark screenshots were inspected. Exact reference pixel equivalence and assistive-technology behavior still need manual review.

## Focused verification

With the existing dependencies provisioned (no installation or manifest changes):

```powershell
node --test scripts/test-code-editor-workspace.mjs scripts/test-code-editor-workspace-build.mjs
$env:CODE_EDITOR_WORKSPACE_JSDOM_PATH = 'G:/template/node_modules/jsdom'
node --test scripts/test-code-editor-workspace-dom.mjs
node --test src/components/file-tree/icons.test.mjs src/components/file-tree/build.test.mjs
$env:CODE_EDITOR_PLAYWRIGHT_PATH = 'G:/t3code/node_modules/.pnpm/playwright-core@1.61.0/node_modules/playwright-core'
$env:CODE_EDITOR_BROWSER_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test scripts/test-code-editor-workspace-correction-browser.mjs
```

The model suite exercises independent history, directory operations, saved snapshots, queued failures, open/read/list races, watcher dirty protection, stale-index overlays, edit-during-delete, confirmation, preferences, request IDs and disposal. The DOM suite compiles and runs the actual first-party component and real core/tree in an existing JSDOM installation; it checks retained textareas, toolbar/preferences, scoped shortcuts, peek transition semantics, quick-open, confirmation, context actions, real inline rename, tree undo, addon restart/cleanup, errors and retry. The build suite compiles templates and Sass in memory and typechecks the focused workspace dependency graph. DOM tests skip with an explicit reason if no existing JSDOM is available; no package is added. Tree tests cover the authored icon registry and tree template/styles.

The correction browser suite reuses existing Playwright and Chrome. It needs no docs build or listening server, and leaves the parent preview and browser script untouched. It writes `editor-workspace-correction-light-350.png` and `editor-workspace-correction-dark-350.png` into the OS temporary directory.
