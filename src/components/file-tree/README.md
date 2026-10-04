# File tree audit and icon customization

Compared against `G:/t3code/packages/t3code-plugin-editor/src/file-tree` and `src/ui/main.ts` in that package on 2026-10-04. The reference is read-only; no vendored implementation, sprite, or brand artwork was copied.

## Existing capabilities

| Capability | Local implementation | Reference |
| --- | --- | --- |
| Virtual rows, keyboard navigation, focus, ARIA, multi-selection, sorting, reveal and snapshots | `index.ts`, `selection.ts`, `shortcuts.ts`, `sort.ts`, `spoken.ts` | `core/model/FileTreeController.js`, `core/model/virtualization.js`, `render/file-tree.ts` |
| Compact folder chains, individually selectable segments and sticky ancestors | `compact.ts`, `sticky.ts`, `index.ts` | Controller flattening exists; `render/file-tree.ts` explicitly strips sticky folders and flattened-segment drag targets |
| Fuzzy highlight, find/filter modes, typeahead, exclusions and dotfile visibility | `find.ts`, `fuzzy.ts`, `filter.ts`, `glob.ts`, `index.ts` | `core/model/searchHelpers.js`, controller search sessions |
| Inline rename/create with validation, async errors and read-only protection | `edit.ts`, `index.ts` | `core/model/renameHelpers.js`, reference rename view |
| Mutable element store, lazy children with retry, history, clipboard operations, drag/drop and auto-open | `model.ts`, `lazy.ts`, `history.ts`, `clipboard.ts`, `drag.ts`, `index.ts` | Path-store mutations and controller drag/drop; reference view exposes less of this |
| Git status and ancestor rollups, staged/working-tree badges, diff statistics, problems and editor markers | `decorations.ts`, `index.ts` | `render/gitStatus.ts`, `core/model/gitStatus.js` |
| Multiple roots, scopes, symlink/lock markers, path/metadata tooltips, preview/pinned/side opens and context-menu hooks | `index.ts` | Reference uses app-side menus and opens in `src/ui/main.ts` |

The primary gap was icon coverage: every local file used `file.svg`, and only 23 folder basenames had named artwork. The reference uses `core/builtInIcons.js`, `core/render/iconResolver.js`, and filename remaps in `src/ui/main.ts` (`T3_ICON_BY_FILENAME`, the explorer options, and the tab resolver).

## Implemented

- `icons.ts`: authored glyph geometry, language monograms, filename/compound-extension resolution, expanded folder families, isolated custom rule maps and monochrome support. Common languages, frameworks, build/lint/format tools, package managers, agent instructions, documents, databases, fonts, images, audio, video, certificates and archives have icons. All reference built-in file families and all seven app-specific filename overrides have semantic counterparts. The reference's branded SVGs are deliberately represented by authored semantic shapes, not exact logos.
- `folders.ts`: preserves every existing folder asset and its open/closed pair. New folder names use small semantic badges. Generic and named folders remain visually different when opened, including lazy folders with explicit `type: 'folder'`.
- `glyph.ts`, `index.ts`: first-party template rendering within the existing reactive row lifecycle, including sticky and motion copies. Custom callback output still wins; returning `undefined` now keeps the built-in icon, and `null`, `false` or an empty string still hides it. Rename/move changes use the existing store/rebuild path. Root headers continue omitting icons as before.
- `scss/variables.scss`, `scss/index.scss`: eight themeable color families, a global icon color override and inherited system colors in forced-colors mode. Geometry remains meaningful with color disabled.

No dependency or manifest changes are needed. Runtime rules are normalized once per tree; they are configuration for that tree instance, rather than live mutable rule stores. The existing row virtualization remains responsible for limiting rendered icons.

## Using the icons

Import from the component subpath. The component and icon helpers are also exported by the library barrel:

```ts
import fileTree, {
    fileTreeIcon,
    createFileTreeIconResolver,
    resolveFileTreeIcon,
    type FileTreeIconOptions
} from '@esportsplus/ui/file-tree';

const icons: FileTreeIconOptions = {
    colored: true,
    byFileName: { 'project.json': 'package' },
    byFileExtension: { '.d.ts': 'document', 'tar.gz': 'archive' },
    byFolderName: { domain: 'layers' }
};

fileTree({ elements, icons });

// A callback can override only selected rows. Undefined delegates to the configured built-ins.
fileTree({
    elements,
    icons,
    icon: (element, open) => element.id === specialId ? myIcon(element, open) : undefined
});

// The default renderer is reusable in other first-party templates, such as a tab strip.
fileTreeIcon({ name: 'example.tsx', type: 'file' }, false);

// Pure metadata resolution; no DOM or template instantiation.
resolveFileTreeIcon({ name: 'pnpm-lock.yaml' }).name; // 'pnpm'
const custom = createFileTreeIconResolver(icons);
custom({ name: 'types.d.ts' }).name; // 'document'
```

`FileTreeIconName` lists the accepted glyph names. Useful override targets include `file`, `code`, `config`, `package`, `book`, `document`, `text`, `markdown`, `agents`, `test`, `git`, `lock`, `key`, `image`, `audio`, `video`, `font`, `archive`, `table`, `database`, `network`, `layers`, and each mapped language/tool name. `FileTreeResolvedIcon` exposes the semantic name, path geometry, optional monogram paths, color family and folder badge.

Filename and folder keys are case-insensitive. Extension keys are trimmed and may have one leading dot. Both `/` and `\` paths are accepted as names; only the basename participates. A bare dotfile or trailing dot does not invent an extension. Explicit `type` takes precedence over `children` when deciding whether an element is a folder.

File precedence, from highest to lowest:

1. Custom exact filename.
2. Custom extension, longest compound suffix first.
3. Built-in exact filename.
4. Built-in filename families (`tsconfig.*.json`, `.env.*`, `Dockerfile.*`, etc.).
5. Built-in extension, longest compound suffix first.
6. Generic file.

Custom extensions intentionally outrank built-in special filenames, so `byFileExtension: { json: 'text' }` affects `package.json` unless a custom filename rule also exists. Folder matching uses custom exact names, built-in exact names, then a generic folder; file rules never affect folders. Partial mappings always retain the other built-ins. Unknown JavaScript override values are ignored, and prototype-like names safely fall back.

Set `icons: { colored: false }` for monochrome. CSS can set `--file-tree-icon-blue`, `--file-tree-icon-cyan`, `--file-tree-icon-green`, `--file-tree-icon-grey`, `--file-tree-icon-orange`, `--file-tree-icon-purple`, `--file-tree-icon-red`, and `--file-tree-icon-yellow`, or `--file-tree-icon-color` to override all built-in colors. Custom callback markup keeps its own styling. `data-file-tree-icon` identifies each built-in semantic glyph for targeted styling.

## Remaining differences

- The reference offers path-array/prepared input, numeric initial expansion, preset density, arbitrary sorting callbacks, and rich item/controller handles (`core/model/publicTypes.d.ts`, `core/preparedInput.js`). Local equivalents use element stores, expanded IDs, tree CSS variables, the existing sort options and reactive selection/snapshots. A compatibility adapter belongs to integration; this change does not replace those APIs.
- The reference exposes additional search-session callbacks/modes and sprite-set/remap APIs (`core/model/publicTypes.d.ts`, `core/iconConfig.js`). Local find/highlight/filter covers the primary explorer use; extra controller/search APIs would need a separate concrete use case.
- Arbitrary custom artwork is supplied through the existing `icon` callback. Custom maps target authored built-ins, rather than accepting third-party sprites or copying their branded assets. Path-specific icon rules can also use the callback and `element.id`.
- Disk operations, workspace watching, editor/tab behavior, drag-to-chat attributes and filesystem path adapters stay app-side (`src/ui/main.ts`). Existing `open`, `menu`, operation and model hooks already support that integration; editor files were not changed.
- The integrated real-Chrome suite (`scripts/test-code-editor-browser.mjs`) checks icon rendering, SVG namespaces, folder expansion, and keyboard selection. The icon gallery was also visually inspected. Assistive-technology validation remains manual; consumer sprite mounting is part of the existing app pipeline.

## Verification

With the existing worktree dependencies provisioned, run:

```sh
node --test src/components/file-tree/icons.test.mjs src/components/file-tree/build.test.mjs
node_modules/.bin/tsc -p src/components/file-tree/tsconfig.test.json --noEmit
```

The 12 focused tests cover more than 200 filename/extension/folder/override cases, longest-suffix and custom precedence, Windows/POSIX basenames, dotfiles, lazy-folder inference, open/closed geometry, monochrome badges, invalid/prototype-like names, per-tree isolation, and store rename/move behavior. The complete tree is also compiled in memory through the existing first-party template compiler; Sass is compiled separately to check palette and forced-colors rules. No build output, browser, dev server, or new package is required. The focused typecheck passes; the existing compiler analyzer reports one advisory for dynamic `Promise.allSettled` in unchanged `src/shared/animation.ts`.
