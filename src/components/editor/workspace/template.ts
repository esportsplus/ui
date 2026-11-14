import { computed, effect, flush, onCleanup, reactive, read, root, signal, untrack, write, type Signal } from '@esportsplus/reactivity';
import { component, html, type Attributes, type On, type Renderable } from '@esportsplus/template';
import breadcrumb, { type Crumb } from '~/components/breadcrumb';
import command, { type Command, type ResultGroup, type Sprite, type Tab } from '~/components/command';
import fileTree, {
    FileTreeDecorations,
    FileTreeEditor,
    FileTreeElements,
    fileTreeIcon,
    type FileTreeController,
    type FileTreeElement
} from '../tree';
import icon from '~/components/icon';
import input from '~/components/input';
import nav from '~/components/nav';
import overlay from '~/components/overlay';
import shell, { type Catalog, type Surface } from '~/components/shell';
import { findSurfaceGroup } from '~/components/shell/model';
import tooltip from '~/components/tooltip';
import type { Controller as MenuController, Item } from '~/components/tooltip/menu';
import fuzzy from '~/shared/fuzzy';
import { mac } from '~/shared/platform';
import codeEditor, { type CodeEditorAttributes } from '../code/editor';
import type { Controller as EditorController, Options as EditorOptions } from '../code/view';
import { label as chordLabel, declare, merge, sequence } from './keybindings';
import {
    EditorWorkspaceModel,
    type WorkspaceConfirmation,
    type WorkspaceDecision,
    type WorkspaceEntry,
    type WorkspaceHost,
    type WorkspaceTab,
    type WorkspaceTarget
} from './model';
import navigate from './navigate';
import hosted from './session';
import shortcuts, { OPEN, PALETTE } from './shortcuts';
import statusbar from './statusbar';
import tabStrip from './strip';
import arrow from '@esportsplus/ui/svg/arrow.svg';
import collapse from '@esportsplus/ui/svg/chevrons-up-down.svg';
import cmd from '@esportsplus/ui/svg/command.svg';
import wrap from '@esportsplus/ui/svg/corner-down-right.svg';
import whitespace from '@esportsplus/ui/svg/eye.svg';
import save from '@esportsplus/ui/svg/save.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import undo from '@esportsplus/ui/svg/undo.svg';


type CodeEditorWorkspaceAttributes = Attributes & {
    // Called whenever the shown tab or its path changes; the previous cleanup runs first.
    addons?: (context: WorkspaceEditorContext) => void | VoidFunction;
    controller?: (controller: CodeEditorWorkspaceController) => void;
    cwd?: string;
    // The host's own marks, like git status and problems, which the explorer shows and next/previous step between.
    decorations?: FileTreeDecorations | FileTreeDecorations[];
    // The editor for a tab, such as 'editor.markdown', or undefined for the code editor. Each tab's pane mounts its
    // own while the tab shows in its group.
    editor?: (tab: WorkspaceTab) => WorkspaceEditor | undefined;
    editorOptions?: EditorOptions | ((tab: WorkspaceTab) => EditorOptions);
    host?: WorkspaceHost;
    model?: EditorWorkspaceModel;
    openTarget?: WorkspaceTarget | (() => WorkspaceTarget | undefined);
};

type CodeEditorWorkspaceController = {
    close(path?: string): ReturnType<EditorWorkspaceModel['close']>;
    collapseAll(): void;
    delete(paths?: readonly string[]): ReturnType<EditorWorkspaceModel['delete']>;
    dispose(): void;
    readonly editor: WorkspaceEditorController | undefined;
    focus(): void;
    keybindings(): void;
    readonly model: EditorWorkspaceModel;
    // The next or previous change or problem, in the shown file and then the next file that has one.
    navigate(kind: 'change' | 'problem', backward?: boolean): Promise<boolean>;
    open(path: string, line?: number, column?: number): ReturnType<EditorWorkspaceModel['open']>;
    quickOpen(query?: string): void;
    refresh(): Promise<void>;
    rename(source: string, destination: string): ReturnType<EditorWorkspaceModel['rename']>;
    save(): ReturnType<EditorWorkspaceModel['save']>;
    search(query: string): void;
    toggleExplorer(): void;
    toggleExplorerSide(): void;
    toggleWhitespace(): void;
    toggleWrap(): void;
    undoFiles(): ReturnType<EditorWorkspaceModel['undoFiles']>;
};

type Confirmation = {
    request: WorkspaceConfirmation;
    resolve: (decision: WorkspaceDecision) => void;
};

type Control = {
    active?: () => boolean;
    // A class turning the sprite, such as 'icon--left'.
    direction?: () => string;
    disabled?: () => boolean;
    label: string | (() => string);
    onclick: VoidFunction;
    sprite: string | (() => string);
};

// The editor a tab's pane shows while the tab is its group's active one, released once it isn't or the tab closes.
type Mount = {
    addon?: void | VoidFunction;
    controller?: WorkspaceEditorController;
    editor: WorkspaceEditor;
    // The shown tab's path; the options follow it through renames.
    path: Signal<string>;
    released: boolean;
    tab: WorkspaceTab;
};

type Target = {
    element: FileTreeElement;
    paths: string[];
};

// Forward every attribute, so drafts, saving and reveal keep working.
type WorkspaceEditor = (attributes: WorkspaceEditorAttributes) => Renderable<unknown>;

type WorkspaceEditorAttributes = Omit<CodeEditorAttributes, 'controller' | 'document'> & {
    controller?: (controller: WorkspaceEditorController) => void;
    document: WorkspaceTab['document'];
};

type WorkspaceEditorContext = {
    controller: WorkspaceEditorController;
    host: HTMLElement;
    tab: WorkspaceTab;
    workspace: EditorWorkspaceModel;
};

// Shared by the code and markdown controllers; narrow with 'isWorkspaceCodeEditor' for code-only addons.
type WorkspaceEditorController = Pick<EditorController, 'dispose' | 'document' | 'focus' | 'host' | 'scroller' | 'select'>;


// At or below this width the explorer pushes the editors aside as it opens, rather than narrowing them.
const NARROW = 520;


let uid = 0;


function control({ active, direction, disabled, label, onclick, sprite }: Control) {
    return html`
        <button
            class='button code-workspace-control'
            type='button'
            ${{
                'aria-label': label,
                'aria-pressed': active && (() => (active() ? 'true' : 'false')),
                class: active && (() => active() && '--active'),
                disabled,
                onclick,
                title: label
            }}
        >
            ${() => icon({ 'aria-hidden': 'true', class: ['code-workspace-control-icon', direction?.() ?? ''] }, typeof sprite === 'string' ? sprite : sprite())}
        </button>
    `;
}

function glyph(sprite: Sprite) {
    if (typeof sprite === 'string') {
        return icon({ 'aria-hidden': 'true', class: 'code-workspace-command-icon' }, sprite);
    }

    return icon({ 'aria-hidden': 'true', class: ['code-workspace-command-icon', sprite.class] }, sprite.href);
}

// 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere, as the command palette spells it. Text, for titles; keycaps swap
// the ⌘ for its icon, since most fonts lack the glyph.
function keys(names: string[]) {
    let apple = mac();

    return names.map((name) => (name === 'Mod' ? (apple ? '⌘' : 'Ctrl') : name));
}

function label(text: string, names: string[]) {
    return `${text} (${keys(names).join(mac() ? '' : '+')})`;
}

function name(path: string) {
    return path.slice(path.lastIndexOf('/') + 1);
}

// Path-shaped entries reconcile through the existing store, so watcher ticks keep unchanged rows and expansion.
function reconcile(store: FileTreeElements, entries: readonly WorkspaceEntry[]) {
    let nodes = new Map<string, { depth: number; element: FileTreeElement; parent: string | null }>();

    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i],
            id = '',
            parts = entry.path.split('/');

        for (let length = 1, m = parts.length; length <= m; length++) {
            let folder = length < m || entry.kind === 'directory',
                parent = length === 1 ? null : id;

            id = parent === null ? parts[0] : `${parent}/${parts[length - 1]}`;
            nodes.set(id, {
                depth: length,
                element: { id, name: parts[length - 1], type: folder ? 'folder' : 'file', ...(folder ? { children: [] } : {}) },
                parent
            });
        }
    }

    for (let [id, { element }] of [...store.index]) {
        if (nodes.get(id)?.element.type !== element.type) {
            store.remove(id);
        }
    }

    let sorted = [...nodes].sort(([, a], [, b]) => a.depth - b.depth);

    for (let i = 0, n = sorted.length; i < n; i++) {
        let [id, node] = sorted[i];

        if (!store.get(id)) {
            store.add(node.element, node.parent);
        }
    }
}


const isWorkspaceCodeEditor = (controller: WorkspaceEditorController): controller is EditorController =>
    'goToLine' in controller && 'rectAt' in controller && 'refresh' in controller;

const workspace = ({
    addons,
    controller: receive,
    cwd = '',
    decorations: provided,
    editor: editorFor,
    editorOptions,
    host,
    model: supplied,
    openTarget,
    ...attributes
}: CodeEditorWorkspaceAttributes) => {
    if (!supplied && !host) {
        throw new Error('Workspace: editor.workspace requires a WorkspaceHost or EditorWorkspaceModel');
    }

    let actions: MenuController | undefined,
        // The code editor keymap has no chord sequences, so the workspace runs Mod+K Mod+S itself.
        chords = sequence({
            // Focus inside only: the page's own Mod+K, like site search, still answers under a resting pointer.
            accept: (event) => !confirmation && !!container?.contains(event.target as Node | null),
            actions: { [OPEN[1]]: () => openKeybindings() },
            apple: mac(),
            onpending: (pending) => {
                let text = `${chordLabel(OPEN[0], mac())} was pressed; waiting for the next key…`;

                if (pending) {
                    model.status(text);
                }
                else if (model.state.status === text) {
                    model.status('');
                }
            },
            prefix: OPEN[0]
        }),
        confirmation: Confirmation | undefined,
        container: HTMLElement | undefined,
        // Each open tab's path and dirty state as last written to the tree's decorations.
        decorated = new Map<string, boolean>(),
        decorations = new FileTreeDecorations(),
        dialog = reactive({ active: false }),
        files = signal<readonly string[]>([]),
        // The tab whose editor takes focus once it mounts.
        focusing: WorkspaceTab | undefined,
        id = `code-workspace-${++uid}`,
        keyboard = reactive({ active: false }),
        model = supplied ?? new EditorWorkspaceModel(host!, cwd),
        mounts = new Map<WorkspaceTab, Mount>(),
        palette = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab }),
        release: VoidFunction | undefined,
        request = signal<WorkspaceConfirmation | undefined>(undefined),
        returnFocus: HTMLElement | undefined,
        revealed = 0,
        searchField: HTMLInputElement | undefined,
        // Each pane's way to mount its editor again.
        remounts = new Map<WorkspaceTab, VoidFunction>(),
        // Runs once the open modal has closed and returned focus, to move it where the user went next.
        settle: VoidFunction | undefined,
        statusBar = statusbar(model, () => navigation.go('problem')),
        strip = tabStrip({
            isFile: (path) => treeStore.get(path)?.type === 'file',
            model,
            remount: (tab) => remounts.get(tab)?.(),
            reveal: (path) => {
                explore();
                treeState.selected = '';
                flush();
                treeState.selected = path;
            }
        }),
        target = signal<Target | undefined>(undefined),
        tree: FileTreeController | undefined,
        treeEditor = new FileTreeEditor(),
        treeState = reactive({ selected: '', selection: new Set<string>() }),
        treeStore = new FileTreeElements([]),
        ui = reactive({ position: '', search: '' });

    let active = computed(() => model.state.active),
        hosting = hosted(model, (tab) => mounts.get(tab)?.controller),
        navigation = navigate({
            bindings: () => {
                let tab = read(active);

                return tab && mounts.has(tab) ? settings(tab, tab.path).keybindings : model.state.preferences.keybindings;
            },
            hosting,
            model,
            tree: () => tree
        }),
        // What the workspace shows of the model; each getter reads only the signals it needs.
        view = {
            get busy() {
                return model.state.busy > 0;
            },
            get canUndo() {
                return model.state.canUndoFiles;
            },
            get cwd() {
                return model.state.cwd;
            },
            get error() {
                return model.state.error;
            },
            get explorerOpen() {
                return model.state.preferences.explorerOpen;
            },
            get left() {
                return model.state.preferences.explorerSide === 'left';
            },
            get loaded() {
                return model.state.loaded;
            },
            get path() {
                let tab = read(active);

                return tab && !tab.compare ? tab.path : '';
            },
            get project() {
                return model.state.cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
            },
            get status() {
                let state = model.state;

                return state.status ||
                    (state.opening.length
                        ? `Opening ${state.opening.at(-1)}…`
                        : state.busy
                            ? 'Working…'
                            : state.loading
                                ? 'Refreshing…'
                                : read(active)?.missing
                                    ? 'File removed from disk; draft retained'
                                    : '');
            },
            get statusError() {
                return !!model.state.status && model.state.statusKind === 'error';
            },
            get whitespace() {
                return model.state.preferences.showWhitespace;
            },
            get wrap() {
                return model.state.preferences.wrapText;
            }
        };

    function ask(next: WorkspaceConfirmation) {
        confirmation?.resolve('cancel');
        returnFocus = (container?.ownerDocument.activeElement as HTMLElement | null) ?? undefined;

        return new Promise<WorkspaceDecision>((resolve) => {
            let current: Confirmation = {
                request: next,
                resolve: (decision) => {
                    if (confirmation !== current) {
                        return;
                    }

                    confirmation = undefined;
                    dialog.active = false;
                    settle = () => {
                        if (returnFocus?.isConnected) {
                            returnFocus.focus({ preventScroll: true });
                        }
                        else {
                            focusEditor();
                        }
                    };
                    resolve(decision);
                }
            };

            confirmation = current;
            write(request, next);
            dialog.active = true;
        });
    }

    function attach(current: Mount) {
        let controller = current.controller;

        detach(current);
        write(current.path, current.tab.path);

        if (!addons || !controller) {
            return;
        }

        try {
            current.addon = addons({
                controller,
                host: controller.host,
                tab: current.tab,
                workspace: model
            });
        }
        catch (error) {
            model.status(`Editor addon failed: ${String(error)}`, true);
        }
    }

    function choose(entry: Command) {
        if (entry.group === PALETTE.group && entry.id === PALETTE.id) {
            settle = openKeybindings;
            return;
        }

        let opened = model.open(entry.id);

        settle = () => {
            void opened.then(focusEditor);
        };
    }

    function connect(element: HTMLElement, on: On) {
        release?.();
        container = element;
        release = root((dispose) => {
            // Capture, so the second chord reaches neither the editor nor the workspace's own Mod+S.
            onCleanup(on(element.ownerDocument, 'keydown', chords.keydown, { capture: true }));
            // A closing modal hands focus back to whatever had it before, so ours moves only once it has closed;
            // 'close' doesn't bubble, but capture still passes through the workspace.
            onCleanup(on(element, 'close', () => {
                let next = settle;

                settle = undefined;
                next?.();
            }, { capture: true }));
            model.setConfirmation(ask);

            onCleanup(hosting.connect(element, on));
            onCleanup(navigation.connect(element, on));
            onCleanup(statusBar.connect());
            onCleanup(() => {
                chords.cancel();
                confirmation?.resolve('cancel');
                model.setConfirmation(undefined);
                model.stop();

                for (let current of [...mounts.values()]) {
                    unmount(current);
                }

                container = undefined;
                release = undefined;
            });

            // Each effect follows one part of the model, so a change reaches only what shows it.
            effect(() => {
                let entries = model.state.entries;

                untrack(() => {
                    let paths: string[] = [];

                    reconcile(treeStore, entries);

                    for (let i = 0, n = entries.length; i < n; i++) {
                        if (entries[i].kind === 'file') {
                            paths.push(entries[i].path);
                        }
                    }

                    write(files, paths);
                });
            });

            effect(() => {
                let tab = read(active);

                untrack(() => statusBar.attach(tab && mounts.get(tab)?.controller));
            });

            effect(() => {
                let path = view.path;

                untrack(() => {
                    treeState.selected = path;
                });
            });

            // The layout's sidebar toggle shows and hides the explorer, which the preferences remember.
            effect(() => {
                let open = model.layout.layout[untrack(() => model.state.preferences.explorerSide)].open;

                untrack(() => {
                    if (open !== model.state.preferences.explorerOpen) {
                        model.setPreferences({ explorerOpen: open });
                    }
                });
            });

            effect(() => {
                let tabs = model.state.tabs.map((tab) => [tab.path, tab.dirty] as const);

                untrack(() => decorate(tabs));
            });

            effect(() => {
                read(active);
                model.state.reveal;
                untrack(reveal);
            });

            // Line and column follow the active document alone, so typing in one tab never touches the others.
            effect(() => {
                let tab = read(active);

                if (!tab || tab.compare) {
                    ui.position = '';
                    return;
                }

                let document = tab.document,
                    update = () => {
                        let position = document.position();

                        ui.position = `Ln ${position.line}, Col ${position.column}`;
                    };

                update();
                onCleanup(document.subscribe((_, change) => {
                    if (change.selectionChanged || change.textChanged) {
                        update();
                    }
                }));
            });

            effect(() => {
                let path = treeState.selected;

                if (path && treeStore.get(path)?.type === 'file') {
                    untrack(() => {
                        if (path !== read(active)?.path) {
                            void model.open(path, undefined, undefined, true);
                        }
                    });
                }
            });

            effect(() => {
                let next = typeof openTarget === 'function' ? openTarget() : openTarget;

                if (next) {
                    untrack(() => {
                        void model.start().then(() => model.openTarget(next));
                    });
                }
            });

            // A dialog closed by Escape, its backdrop or a drag leaves the drafts open.
            effect(() => {
                if (!dialog.active) {
                    untrack(() => confirmation?.resolve('cancel'));
                }
            });

            void hosting.restore();

            return dispose;
        });
    }

    function crumbs(tab: WorkspaceTab) {
        if (tab.compare) {
            return '';
        }

        let path = tab.path;

        let parts = path.split('/'),
            project = view.project,
            items: Crumb[] = [];

        if (project) {
            items.push({ href: '#', label: project });
        }

        for (let i = 0, n = parts.length; i < n; i++) {
            items.push({ href: `#${parts.slice(0, i + 1).join('/')}`, label: parts[i] });
        }

        return breadcrumb({
            class: 'code-workspace-breadcrumb',
            items,
            label: 'File path',
            onnavigate: (item) => locate(item.href.slice(1), path),
            separator: 'chevron'
        });
    }

    // The explorer marks open files and drafts; only a path that changed either is written.
    function decorate(tabs: readonly (readonly [string, boolean])[]) {
        let open = new Set<string>();

        for (let i = 0, n = tabs.length; i < n; i++) {
            let [path, unsaved] = tabs[i];

            open.add(path);

            if (decorated.get(path) !== unsaved) {
                decorated.set(path, unsaved);
                decorations.update([[path, { editor: { open: true, unsaved } }]]);
            }
        }

        for (let path of [...decorated.keys()]) {
            if (!open.has(path)) {
                decorated.delete(path);
                decorations.update([[path, null]]);
            }
        }
    }

    function detach(current: Mount) {
        let stop = current.addon;

        current.addon = undefined;

        try {
            stop?.();
        }
        catch (error) {
            model.status(`Editor addon failed: ${String(error)}`, true);
        }
    }

    // Opens the explorer, if it is closed, to show something in it.
    function explore() {
        if (!model.state.preferences.explorerOpen) {
            model.setPreferences({ explorerOpen: true });
        }
    }

    // The explorer's whole body: its controls, the search and the tree, in the layout's static sidebar.
    function explorer() {
        return html`
            <div class='code-workspace-explorer'>
                <div class='code-workspace-explorer-header'>
                    ${control({
                        direction: () => (view.left ? '' : 'icon--left'),
                        label: () => (view.left ? 'Move file explorer to right' : 'Move file explorer to left'),
                        onclick: () => api.toggleExplorerSide(),
                        sprite: arrow
                    })}
                    ${control({ label: 'Collapse all folders', onclick: () => api.collapseAll(), sprite: collapse })}
                    ${control({
                        disabled: () => !view.canUndo || view.busy,
                        label: 'Undo file operation',
                        onclick: () => {
                            void model.undoFiles();
                        },
                        sprite: undo
                    })}
                    ${control({ label: label('Go to file', ['Mod', 'P']), onclick: () => quickOpen(), sprite: magnifier })}
                    ${input({
                        'aria-label': 'Search files',
                        autocomplete: 'off',
                        class: 'code-workspace-search',
                        onconnect: (element: HTMLInputElement) => {
                            searchField = element;
                        },
                        oninput: (event: Event) => search((event.target as HTMLInputElement).value),
                        placeholder: 'Search files',
                        spellcheck: false,
                        type: 'search',
                        value: () => ui.search
                    })}
                </div>
                <div class='code-workspace-tree'>
                    ${() => hosting.ready() && untrack(() => fileTree({
                        class: 'code-workspace-files',
                        compact: true,
                        controller: (value) => {
                            tree = value;
                            value.search(ui.search);
                        },
                        decorations: [hosting.marks, ...[provided ?? []].flat(), decorations],
                        editor: treeEditor,
                        elements: treeStore,
                        empty: () => html`<div class='code-workspace-notice'>No files in this workspace</div>`,
                        export: hosting.export,
                        find: 'filter',
                        menu: (elements, position) => {
                            if (!elements.length || !actions) {
                                return;
                            }

                            write(target, { element: elements[0], paths: elements.map((element) => element.id) });
                            // Items hide by the target; the menu focuses its first visible one as it opens.
                            flush();
                            // The tree claims the right click; the context menu opens at the point it reports.
                            actions.open(position);
                        },
                        open: (element, open) => {
                            void model.open(element.id, undefined, undefined, open.mode === 'preview');
                        },
                        operations: {
                            delete: (elements) => {
                                void model.delete(elements.map((element) => element.id));
                            },
                            import: hosting.import
                        },
                        preview: 'immediate',
                        rename: async (element, value) => {
                            let parent = element.id.includes('/') ? element.id.slice(0, element.id.lastIndexOf('/') + 1) : '';

                            if (!(await model.rename(element.id, parent + value))) {
                                throw new Error(`Workspace: ${model.state.status}`);
                            }
                        },
                        searched: (query) => {
                            ui.search = query;
                        },
                        snapshot: hosting.explorer,
                        state: treeState,
                        typing: 'typeahead'
                    }))}
                    ${() => {
                        if (view.error) {
                            return html`
                                <div class='code-workspace-notice code-workspace-notice--cover' role='alert'>
                                    ${view.error}
                                    <button
                                        class='button code-workspace-retry'
                                        type='button'
                                        onclick='${() => {
                                            void model.refresh();
                                        }}'
                                    >
                                        Retry
                                    </button>
                                </div>
                            `;
                        }

                        return !view.loaded && html`<div class='code-workspace-notice code-workspace-notice--cover' role='status'>Loading…</div>`;
                    }}
                </div>
            </div>
        `;
    }

    // A file's pane: its path and controls over its editor, which mounts while the tab shows in its group.
    function file(surface: Surface) {
        let tab = model.find(surface.id);

        if (!tab) {
            return '';
        }

        let again = signal(0),
            owner = tab,
            visible = computed(() => findSurfaceGroup(model.layout.layout.root, surface.id)?.active === surface.id);

        remounts.set(owner, () => write(again, untrack(() => read(again)) + 1));
        onCleanup(() => remounts.delete(owner));

        return html`
            <div class='code-workspace-pane'>
                <div class='code-workspace-bar'>
                    ${() => crumbs(owner)}
                    <div class='code-workspace-actions'>
                        ${statusBar.save(() => control({
                            disabled: () => !!owner.compare || view.busy,
                            label: label('Save file', ['Mod', 'S']),
                            onclick: () => {
                                void model.save(owner);
                            },
                            sprite: save
                        }))}
                        ${control({
                            active: () => view.wrap,
                            label: () => (view.wrap ? 'Disable wrap' : 'Wrap long lines'),
                            onclick: () => api.toggleWrap(),
                            sprite: wrap
                        })}
                        ${control({
                            active: () => view.whitespace,
                            label: () => (view.whitespace ? 'Hide whitespace' : 'Show whitespace'),
                            onclick: () => api.toggleWhitespace(),
                            sprite: whitespace
                        })}
                    </div>
                </div>
                <div class='code-workspace-editor'>
                    ${() => {
                        read(again);

                        return read(visible) && pane(owner);
                    }}
                </div>
            </div>
        `;
    }

    // The active tab's editor may still be mounting; it takes focus as soon as its controller arrives.
    function focusEditor() {
        let tab = untrack(() => read(active));

        focusing = undefined;

        if (!tab) {
            searchField?.focus();
            return;
        }

        let controller = mounts.get(tab)?.controller;

        if (controller) {
            controller.focus();
            return;
        }

        focusing = tab;
    }

    function keydown(event: KeyboardEvent) {
        if (event.defaultPrevented || event.isComposing || !container || confirmation) {
            return;
        }

        let inside = container.contains(event.target as Node | null),
            key = event.key.toLowerCase(),
            mod = (event.ctrlKey || event.metaKey) && !event.altKey;

        // Quick open also answers while the pointer rests on the workspace, as an editor pane under the cursor would.
        if (mod && !event.shiftKey && key === 'p' && (inside || container.matches(':hover'))) {
            event.preventDefault();
            quickOpen();
            return;
        }

        if (!inside) {
            return;
        }

        if (mod && key === 's') {
            event.preventDefault();
            void model.save();
        }
        else if (mod && key === 'w') {
            event.preventDefault();
            void model.close();
        }
        else if (mod && key === 'z' && !event.shiftKey && (event.target as Element).closest('.file-tree') && !(event.target as Element).closest('input, textarea, [contenteditable=true]')) {
            event.preventDefault();
            void model.undoFiles();
        }
    }

    // A breadcrumb leads back into the explorer: the project collapses the tree, a folder is revealed in it.
    function locate(path: string, from: string) {
        explore();

        if (!path) {
            tree?.collapseAll();
            return;
        }

        if (path !== from) {
            treeState.selected = path;
        }
    }

    function openKeybindings() {
        palette.active = false;
        keyboard.active = true;
    }

    function pane(tab: WorkspaceTab) {
        let current: Mount = { editor: strip.editor(tab) ?? editorFor?.(tab) ?? codeEditor, path: signal(tab.path), released: false, tab },
            bound: WorkspaceEditorAttributes = {
                class: 'code-workspace-document',
                controller: (controller) => {
                    if (current.released) {
                        return;
                    }

                    current.controller = controller;
                    restore(current);
                    attach(current);

                    if (untrack(() => read(active)) === tab) {
                        statusBar.attach(controller);
                        reveal();
                    }

                    if (focusing === tab) {
                        focusing = undefined;
                        // The controller can arrive mid-render; focusing may flush, which would render the pane again.
                        queueMicrotask(() => {
                            if (!current.released) {
                                controller.focus();
                            }
                        });
                    }
                },
                document: tab.document,
                onSave: () => {
                    void model.save(tab);
                },
                options: () => settings(tab, read(current.path))
            };

        mounts.set(tab, current);
        onCleanup(() => unmount(current));

        // A rename keeps the tab and its editor; addons restart for the new path.
        effect(() => {
            let path = tab.path;

            untrack(() => {
                if (current.controller && read(current.path) !== path) {
                    attach(current);
                }
            });
        });

        return untrack(() => current.editor(bound));
    }

    function quickOpen(query = '') {
        if (palette.active) {
            palette.active = false;
            return;
        }

        palette.active = true;

        // Opening clears the query; the requested one goes in after.
        flush();
        palette.query = query;
    }

    function results(groups: ResultGroup[]) {
        return nav.tree({
            current: 'command',
            sections: groups.map((group) => ({
                groups: [{
                    links: group.items.map((item) => ({
                        attributes: item.attributes,
                        content: html`
                            ${item.command?.icon
                                ? glyph(item.command.icon)
                                : fileTreeIcon({ name: name(item.id), type: 'file' }, false)}
                            ${item.content}
                        `,
                        label: item.label
                    }))
                }],
                label: group.label
            })),
            [nav.tree.highlight]: true
        });
    }

    // Where the shown tab was left, for when it's shown again.
    function remember(current: Mount) {
        let element = current.controller!.scroller;

        current.tab.scroll = { left: element.scrollLeft, top: element.scrollTop };
        hosting.remember(current.tab, current.controller!);
    }

    function restore(current: Mount) {
        hosting.shown(current.tab, current.controller!);

        let element = current.controller!.scroller,
            { left, top } = current.tab.scroll,
            tab = current.tab;

        element.scrollLeft = left;
        element.scrollTop = top;

        // An editor that draws lazily, like markdown's, isn't tall enough before its first frame; it is after.
        if (Math.abs(element.scrollLeft - left) > 1 || Math.abs(element.scrollTop - top) > 1) {
            requestAnimationFrame(() => {
                if (!current.released && current.tab === tab) {
                    element.scrollLeft = left;
                    element.scrollTop = top;
                }
            });
        }
    }

    function reveal() {
        let tab = read(active),
            controller = tab && mounts.get(tab)?.controller,
            next = model.state.reveal;

        if (!tab || !controller || !next || next.request === revealed || controller.document !== tab.document || tab.id !== next.tabId) {
            return;
        }

        revealed = next.request;

        if (isWorkspaceCodeEditor(controller)) {
            controller.goToLine(next.line, next.column);
            return;
        }

        let offset = controller.document.offset(next.line, next.column);

        controller.select({ end: offset, start: offset });
    }

    function search(query: string) {
        ui.search = query;
        tree?.search(query);
    }

    function selected() {
        return [...treeState.selection].filter((path) => treeStore.get(path));
    }

    function settings(tab: WorkspaceTab, path: string): EditorOptions {
        let options = typeof editorOptions === 'function' ? editorOptions(tab) : editorOptions;

        return {
            fold: true,
            minimap: true,
            onMerge: () => {
                void strip.merge(tab);
            },
            ...options,
            ...statusBar.options(tab),
            ...(model.host.baseline ? { baseline: hosting.baseline(path) } : {}),
            fileName: path,
            keybindings: merge(options?.keybindings, model.state.preferences.keybindings),
            label: path,
            whitespace: view.whitespace,
            wrap: view.wrap
        };
    }

    function toggle(key: 'explorerOpen' | 'showWhitespace' | 'wrapText') {
        model.setPreferences({ [key]: !model.state.preferences[key] });
    }

    function unmount(current: Mount) {
        if (current.released) {
            return;
        }

        let controller = current.controller;

        current.released = true;

        if (mounts.get(current.tab) === current) {
            mounts.delete(current.tab);

            if (untrack(() => read(active)) === current.tab) {
                statusBar.attach(undefined);
            }
        }

        if (controller?.host.isConnected) {
            remember(current);
        }

        detach(current);
    }

    let api: CodeEditorWorkspaceController = {
            close: (path) => model.close(path),
            collapseAll: () => tree?.collapseAll(),
            delete: (paths = selected()) => model.delete(paths),
            dispose: () => {
                release?.();
                hosting.dispose();
                model.dispose();
            },
            get editor() {
                let tab = untrack(() => read(active));

                return tab && mounts.get(tab)?.controller;
            },
            focus: focusEditor,
            keybindings: openKeybindings,
            model,
            navigate: (kind, backward) => navigation.go(kind, backward),
            open: (path, line, column) => model.open(path, line, column),
            quickOpen,
            refresh: () => model.refresh(),
            rename: (source, destination) => model.rename(source, destination),
            save: () => model.save(),
            search,
            toggleExplorer: () => toggle('explorerOpen'),
            toggleExplorerSide: () => {
                model.setPreferences({ explorerSide: view.left ? 'right' : 'left' });
            },
            toggleWhitespace: () => toggle('showWhitespace'),
            toggleWrap: () => toggle('wrapText'),
            undoFiles: () => model.undoFiles()
        },
        items: Item[] = [
            {
                hidden: () => !single() || read(target)?.element.type !== 'file',
                label: 'Open',
                onselect: () => {
                    void model.open(paths()[0]).then(focusEditor);
                }
            },
            {
                hidden: () => !single(),
                hint: 'F2',
                label: 'Rename',
                onselect: () => treeEditor.rename(paths()[0])
            },
            {
                hidden: () => !single(),
                label: 'Copy Path',
                onselect: () => {
                    void model.copyPath(paths()[0]);
                }
            },
            ...strip.items(() => paths()),
            ...(model.host.actions ?? []).map((action): Item => ({
                danger: action.danger,
                hidden: () => !paths().length || (!!action.visible && !action.visible(paths())),
                icon: action.icon ? () => icon({ 'aria-hidden': 'true' }, action.icon!) : undefined,
                label: action.label,
                onselect: () => {
                    void model.run(action, paths());
                }
            })),
            {
                danger: true,
                hint: mac() ? '⌘⌫' : 'Del',
                label: 'Delete',
                onselect: () => {
                    void model.delete(paths());
                }
            }
        ],
        paths = () => read(target)?.paths ?? [],
        single = () => paths().length === 1;

    let catalog: Catalog = {
        explorer: { addable: false, render: explorer, title: 'File explorer' },
        file: {
            addable: false,
            menu: strip.menu,
            render: file,
            tab: (surface) => {
                let tab = model.find(surface.id);

                return tab ? strip.tab(tab) : {};
            },
            title: (surface) => {
                let tab = model.find(surface.id);

                return tab ? strip.label(tab) : '';
            },
            tooltip: (surface) => {
                let tab = model.find(surface.id);

                return tab ? strip.title(tab) : '';
            }
        }
    };

    receive?.(api);

    return html`
        <section
            aria-label='Editor workspace'
            class='code-workspace'
            ${attributes}
            ${hosting.attributes}
            ${statusBar.attributes}
            ${{
                // A page-wide palette on Mod+K, like the site search, leaves the chord to a focused element that
                // declares it.
                'aria-keyshortcuts': declare(attributes['aria-keyshortcuts'] as string | undefined, OPEN[0]),
                onconnect: connect,
                ondocumentkeydown: keydown
            }}
        >
            ${shell({
                catalog,
                class: 'code-workspace-layout',
                empty: () => html`
                    <div class='code-workspace-empty'>
                        Open a file from the explorer or press
                        <span class='code-workspace-keys'>
                            ${keys(['Mod', 'P']).map((key) => html`
                                <kbd class='button button--kbd'>
                                    ${key === '⌘' ? icon({ 'aria-hidden': 'true', class: 'button-kbd-icon' }, cmd) : key}
                                </kbd>
                            `)}
                        </span>
                    </div>
                `,
                narrow: NARROW,
                sidebars: {
                    left: { hover: true, label: 'File explorer', resizable: true },
                    right: { hover: true, label: 'File explorer', resizable: true }
                },
                state: model.layout
            })}
            <footer class='code-workspace-status'>
                <span class='code-workspace-status-path'>${() => view.cwd}</span>
                <span class='code-workspace-status-position'>${() => ui.position}</span>
                ${statusBar.items}
                <span
                    aria-live='polite'
                    class='code-workspace-status-message'
                    role='status'
                    ${{ class: () => view.statusError && 'code-workspace-status-message--error' }}
                >
                    ${() => view.status}
                </span>
            </footer>
            <div
                class='code-workspace-layer'
                popover='manual'
                ${{
                    onconnect: (element: HTMLElement) => {
                        element.showPopover();
                    }
                }}
            >
                ${tooltip.context(
                    {
                        class: 'code-workspace-menu',
                        controller: (value: MenuController) => {
                            actions = value;
                        },
                        items,
                        [tooltip.context.panel]: { 'aria-label': 'File actions', class: 'code-workspace-menu-panel' }
                    },
                    ''
                )}
                ${statusBar.menu}
            </div>
            ${command({
                commands: () => [PALETTE, ...read(files).map((path): Command => ({ group: 'Files', id: path, label: path }))],
                hotkey: [],
                label: 'Go to file',
                limit: 50,
                match: fuzzy,
                onrun: choose,
                placeholder: 'Go to file',
                render: results,
                state: palette,
                trigger: false,
                [command.dialog]: { 'aria-label': 'Go to file' }
            })}
            ${shortcuts({
                apple: mac(),
                id,
                keybindings: () => model.state.preferences.keybindings,
                onchange: (next) => model.setPreferences({ keybindings: next }),
                state: keyboard
            })}
            ${overlay(
                {
                    'aria-labelledby': `${id}-confirm`,
                    class: 'card overlay--alert code-workspace-confirm',
                    state: dialog
                },
                html`
                    <h2 class='code-workspace-confirm-title' id='${id}-confirm'>Save unsaved changes?</h2>
                    <p class='code-workspace-confirm-files'>${() => read(request)?.dirty.join(', ')}</p>
                    <p class='code-workspace-confirm-text'>
                        ${() => (read(request)?.kind === 'delete'
                            ? 'Save before deleting, discard the drafts, or cancel deletion.'
                            : 'Save the drafts, discard them, or keep them open.')}
                    </p>
                    <div class='code-workspace-confirm-actions'>
                        <button autofocus class='button code-workspace-confirm-button' type='button' onclick='${() => confirmation?.resolve('cancel')}'>
                            Cancel
                        </button>
                        <button class='button code-workspace-confirm-button' type='button' onclick='${() => confirmation?.resolve('discard')}'>
                            Discard
                        </button>
                        <button class='button code-workspace-confirm-button code-workspace-confirm-button--primary' type='button' onclick='${() => confirmation?.resolve('save')}'>
                            Save
                        </button>
                    </div>
                `
            )}
        </section>
    `;
};


export default component(workspace);
export { EditorWorkspaceModel, isWorkspaceCodeEditor };
export type {
    CodeEditorWorkspaceAttributes,
    CodeEditorWorkspaceController,
    WorkspaceEditor,
    WorkspaceEditorAttributes,
    WorkspaceEditorContext,
    WorkspaceEditorController
};
export type {
    WorkspaceAction,
    WorkspaceCompare,
    WorkspaceConfirmation,
    WorkspaceDecision,
    WorkspaceEntry,
    WorkspaceHost,
    WorkspacePreferences,
    WorkspaceSession,
    WorkspaceSessionTab,
    WorkspaceTab,
    WorkspaceTarget
} from './model';
