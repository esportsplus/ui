# Language services

`mountLanguageServices(host, controller, options)` adds scoped, compiled template UI to an existing editor host. It returns `{ dispose, requestCompletion, requestHover }`. Import it directly from `./services`; this subsystem does not change the editor or root barrels. `services.ts` imports its standalone `_services.scss`.

```ts
import { mountLanguageServices, referenceRpcTransport } from './services';

const languageId = 'typescript';
const transport = referenceRpcTransport({
    cwd, languageId,
    invoke: hostRpc.invoke,
    subscribe: hostRpc.subscribe
});
const services = mountLanguageServices(editorHost, editorController, {
    fileName: 'src/app.ts', cwd, languageId, transport,
    onError: reportServiceError
});
// Dispose before disposing the core controller or switching its document/path.
services.dispose();
```

The injected transport owns server availability and initialization. Nothing in these modules imports a backend or starts a process. The reference adapter invokes `editor.lsp.request`/`editor.lsp.notify` with `{ cwd, languageId, method, params }`, unwraps `{ result }`, and subscribes to `editor.lsp.notification`. Its subscription function must return cleanup. Events are filtered by workspace, language and URI. Supply `uri` explicitly if the backend uses a URI convention different from the encoded `fileUri(cwd, fileName)`.

The controller contract is structural: `document`, `textarea`, `focus`, `select`, `refresh`, `rectAt(offset)` and `offsetAt(clientX, clientY)`. Geometry uses client coordinates. Mount after core layout is available. Completion/hover/diagnostic position comes from this geometry, including wrapped rows. Scroll/resize schedules one repaint; there is no animation loop. For a workspace `addons(context)` hook, return `services.dispose` as the hook cleanup and construct a transport for the tab's language. A mount binds exactly one document URI; remount when a tab changes path.

The document opens at LSP version 0. Every actual text change, including history, increments that version. Full-text changes debounce for 350 ms by default. Requests flush pending sync first, and notifications serialize so open/change/close cannot overtake each other. Closing flushes the last pending text. Selection changes never send didChange. All positions are UTF-16 offsets against the exact source, including mixed CRLF/lone CR/LF.

Ctrl/Cmd+Space requests completion. Typing requests it after 100 ms by default. Arrow keys select, Enter/Tab accept, Escape dismisses, and mouse clicks accept without moving the editor's selection first. Server-provided commit characters apply with the item. `textEdit` (including insert/replace shapes), `additionalTextEdits`, `insertText`, label fallback and snippet format 2 are supported. All edits validate in one document transaction, with selection adjusted for additional edits before the insertion. Overlapping/out-of-document edits reject without partial mutation. Numeric snippet stops, defaults, choices, escaping and linked numeric mirrors work; Tab skips duplicate mirrors, Shift+Tab returns to earlier stops, and `$0` ends the session. Editing outside the current placeholder cancels the session.

When no transport exists, completion can use unique matching words already present in the document; `localCompletion: false` disables it. A supplied but unavailable server returns no completion and never substitutes mock data. `mockLanguageTransport({ completion, hover })` is an explicit deterministic fixture: it records requests and notifications, accepts fixture handlers, and exposes `publish(event)` for tests/demo pushes. Its default answers are null and it publishes nothing automatically.

Hover contents and completion strings render as text. Diagnostics show severity-colored squiggles and a message list; clicking a message selects its source range, and hovering a diagnostic exposes its messages. No fake diagnostics are generated. Versioned diagnostic pushes must match the current version, and every edit clears the previous diagnostics. Requests abort and discard answers after newer requests, selection changes, text changes, IME composition or disposal. Readonly editors cannot apply completion.

## Reference checklist

Reference root: `G:/t3code/packages/t3code-plugin-editor/src`.

| Reference source/symbol | Implementation |
| --- | --- |
| `ui/lsp.ts`, `LspLifecycle.open/update/destroy` | Open, debounced full-text change, close; additionally ordered sync and final flush |
| `lsp/protocol.ts`, RPC payloads and notification channel | `services-protocol.ts`, `referenceRpcTransport` |
| `ui/lsp.ts`, `languageIdFor/pathToUri/offsetToPosition` | Language mapping, encoded file URI, exact UTF-16 position conversion |
| `ui/lsp.ts`, `lspCompletions` and CM completion UI | Injected requests, label/detail, sorting, keyboard/mouse popover; additionally text edits, commit characters and snippets |
| `ui/lsp.ts`, `lspHover` | Injected hover with all content entries rendered as text |
| `ui/lsp.ts`, `handleLspNotification/lspLintSource` | URI/version-scoped diagnostics, squiggles, messages, range navigation |
| `ui/cm.ts`, `autocompletion()` | Optional actual-document word completion without a transport; the reference's LSP override itself supplies no fallback |

## Validation and limits

Run from the repository root (PowerShell):

```powershell
$env:CODE_EDITOR_JSDOM_PATH = 'G:/template/node_modules/jsdom'
node --test scripts/test-code-editor-services.mjs scripts/test-code-editor-services-dom.mjs scripts/test-code-editor-services-build.mjs
node_modules/.bin/tsc.cmd -p src/components/code-editor/tsconfig.services-test.json
node_modules/.bin/tsc.cmd -p docs/tsconfig.json
```

The DOM suite uses compiled templates and actual first-party runtimes. The Chrome suites additionally verify keyboard/mouse completion, diagnostic selection and page-scroll positioning, hover and Escape dismissal. Shared services also have compiled integration coverage on the Markdown controller.

Residual limits: LSP pushes without a `version` cannot be proven current; like the reference they are accepted for the matching URI. The RPC bridge has no request cancellation ID, so its adapter cancels the client result rather than the remote computation; direct transports receive `AbortSignal` and can cancel upstream. Completion resolve, signature help, code actions and server commands are outside the reference subsystem and are not implemented. Snippet variables, nested placeholders and regex transforms remain literal; numeric placeholders and mirrors are supported. Completion UI is capped at 200 items and squiggles at 1000 visual segments. The optional document-word fallback is an explicit extension to the reference override's behavior.
