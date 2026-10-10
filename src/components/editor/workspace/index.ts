import { effect, flush, onCleanup, reactive, read, root, signal, untrack, write, type Signal } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import breadcrumb, { type Crumb } from '~/components/breadcrumb';
import sidebar from '~/components/button/sidebar';
import command, { type Command, type ResultGroup, type Tab } from '~/components/command';
import fileTree, {
    FileTreeDecorations,
    FileTreeEditor,
    FileTreeElements,
    fileTreeIcon,
    type FileTreeController,
    type FileTreeElement
} from '../tree';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import input from '~/components/input';
import overlay from '~/components/overlay';
import tooltip from '~/components/tooltip';
import type { Controller as MenuController, Item } from '~/components/tooltip/menu';
import fuzzy from '~/shared/fuzzy';
import { mac } from '~/shared/platform';
import { observe } from '~/shared/resize';
import codeEditor, { type CodeEditorAttributes } from '../code/editor';
import type { Controller as EditorController, Options as EditorOptions } from '../code/view';
import { label as chordLabel, declare, merge, sequence, type Keybindings } from './keybindings';
import {
    dirty,
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
import left from '@esportsplus/ui/svg/arrow-left.svg';
import right from '@esportsplus/ui/svg/arrow-right.svg';
import collapse from '@esportsplus/ui/svg/chevrons-up-down.svg';
import close from '@esportsplus/ui/svg/close.svg';
import wrap from '@esportsplus/ui/svg/corner-down-right.svg';
import whitespace from '@esportsplus/ui/svg/eye.svg';
import save from '@esportsplus/ui/svg/save.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import undo from '@esportsplus/ui/svg/undo.svg';
import '~/components/button/scss/index.scss';
import '../code/scss/index.scss';
import './scss/index.scss';


type CodeEditorWorkspaceAttributes = Attributes & {
    // Called whenever the shown tab or its path changes; the previous cleanup runs first.
    addons?: (context: WorkspaceEditorContext) => void | VoidFunction;
    controller?: (controller: CodeEditorWorkspaceController) => void;
    cwd?: string;
    // The host's own marks, like git status and problems, which the explorer shows and next/previous step between.
    decorations?: FileTreeDecorations | FileTreeDecorations[];
    // The editor for a tab, such as 'editor.markdown', or undefined for the code editor. A mounted editor stays
    // for the next tab that uses the same one, when its controller can 'setDocument'.
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
    disabled?: () => boolean;
    label: string | (() => string);
    onclick: VoidFunction;
    sprite: string | (() => string);
};

// The editor shown for the active tab: it moves on to the next tab that uses the same editor, and is released when a
// different one takes its place or the workspace goes.
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

// Shared by the code and markdown controllers; narrow with 'isWorkspaceCodeEditor' for code-only addons. Without
// 'setDocument', every tab switch mounts the editor again.
type WorkspaceEditorController = Pick<EditorController, 'dispose' | 'document' | 'focus' | 'host' | 'scroller' | 'select'> &
    Partial<Pick<EditorController, 'setDocument'>>;


// At or below this width the explorer stacks under the editor instead of beside it.
const COMPACT_WIDTH = 520;


let uid = 0;


function control({ active, disabled, label, onclick, sprite }: Control) {
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
            ${() => icon({ 'aria-hidden': 'true', class: 'code-workspace-control-icon' }, typeof sprite === 'string' ? sprite : sprite())}
        </button>
    `;
}

// 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere, as the command palette spells it.
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
        active = signal<WorkspaceTab | undefined>(undefined),
        activeId = signal(0),
        bindings = signal<Keybindings>({}),
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
        elements = new WeakMap<WorkspaceTab, HTMLElement>(),
        entries: readonly WorkspaceEntry[] | undefined,
        files = signal<readonly string[]>([]),
        flags = new Map<number, Signal<boolean>>(),
        focusing = false,
        hovered = false,
        id = `code-workspace-${++uid}`,
        keyboard = reactive({ active: false }),
        model = supplied ?? new EditorWorkspaceModel(host!, cwd),
        mount: Mount | undefined,
        palette = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab }),
        release: VoidFunction | undefined,
        request = signal<WorkspaceConfirmation | undefined>(undefined),
        returnFocus: HTMLElement | undefined,
        revealed = 0,
        searchField: HTMLInputElement | undefined,
        // Runs once the open modal has closed and returned focus, to move it where the user went next.
        settle: VoidFunction | undefined,
        shown = signal<Mount | undefined>(undefined),
        statusBar = statusbar(model, () => navigation.go('problem')),
        strip = tabStrip({
            isFile: (path) => treeStore.get(path)?.type === 'file',
            model,
            remount,
            reveal: (path) => {
                peek(true, true);
                treeState.selected = '';
                flush();
                treeState.selected = path;
            }
        }),
        tabs = signal<readonly WorkspaceTab[]>([]),
        tabsKey = '',
        target = signal<Target | undefined>(undefined),
        tree: FileTreeController | undefined,
        treeEditor = new FileTreeEditor(),
        treeState = reactive({ selected: '', selection: new Set<string>() }),
        treeStore = new FileTreeElements([]),
        view = reactive({
            busy: false,
            canUndo: false,
            collapsed: false,
            compact: false,
            cwd: '',
            error: '',
            explorerOpen: true,
            left: false,
            loaded: false,
            path: '',
            peek: false,
            position: '',
            project: '',
            ready: false,
            search: '',
            status: '',
            statusError: false,
            tabs: false,
            whitespace: false,
            wrap: false
        });

    let hosting = hosted(model, () => (mount?.controller ? { controller: mount.controller, tab: mount.tab } : undefined)),
        navigation = navigate({
            bindings: () => (mount ? settings(mount.tab, mount.tab.path).keybindings : model.state.preferences.keybindings),
            hosting,
            model,
            tree: () => tree
        });

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
        statusBar.attach(controller);
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

    // Model state lands in fine-grained reactive fields, so each emit only re-renders what actually changed.
    function bridge() {
        let state = model.state,
            current = state.active,
            key = '',
            list = state.tabs;

        if (entries !== state.entries) {
            entries = state.entries;
            reconcile(treeStore, entries);

            let paths: string[] = [];

            for (let i = 0, n = entries.length; i < n; i++) {
                if (entries[i].kind === 'file') {
                    paths.push(entries[i].path);
                }
            }

            write(files, paths);
        }

        for (let i = 0, n = list.length; i < n; i++) {
            key += `${list[i].id}:${list[i].path}:${list[i].pinned}:${list[i].preview}\n`;
        }

        if (key !== tabsKey) {
            tabsKey = key;
            write(tabs, [...list]);
        }

        write(active, current);
        write(activeId, current?.id ?? 0);
        write(bindings, state.preferences.keybindings);
        show(current);

        view.busy = state.busy > 0;
        view.canUndo = state.canUndoFiles;
        view.collapsed = list.length > 0 && !state.preferences.explorerOpen;
        view.cwd = state.cwd;
        view.error = state.error;
        view.explorerOpen = state.preferences.explorerOpen;
        view.left = state.preferences.explorerSide === 'left';
        view.loaded = state.loaded;
        view.project = state.cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
        view.status = state.status ||
            (state.opening.length
                ? `Opening ${state.opening.at(-1)}…`
                : state.busy
                    ? 'Working…'
                    : state.loading
                        ? 'Refreshing…'
                        : current?.missing
                            ? 'File removed from disk; draft retained'
                            : '');
        view.statusError = !!state.status && state.statusKind === 'error';
        view.tabs = list.length > 0;
        view.whitespace = state.preferences.showWhitespace;
        view.wrap = state.preferences.wrapText;

        if (!view.collapsed) {
            view.peek = false;
            view.ready = false;
        }

        let path = current && !current.compare ? current.path : '';

        if (view.path !== path) {
            view.path = path;
            treeState.selected = path;

            // A rename keeps the tab and its editor; addons restart for the new path.
            if (mount && mount.tab === current && read(mount.path) !== path) {
                attach(mount);
            }
        }

        decorate(list);
        reveal();
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

    function connect(element: HTMLElement) {
        release?.();
        container = element;
        release = root((dispose) => {
            let listening = new AbortController(),
                unobserve = observe(element, ([entry]) => {
                    view.compact = entry.contentRect.width <= COMPACT_WIDTH;
                });

            bridge();
            // A page-wide palette on Mod+K, like the site search, leaves the chord to a focused element that declares it.
            element.setAttribute('aria-keyshortcuts', declare(element.getAttribute('aria-keyshortcuts'), OPEN[0]));
            element.ownerDocument.addEventListener('keydown', keydown, { signal: listening.signal });
            // Capture, so the second chord reaches neither the editor nor the workspace's own Mod+S.
            element.ownerDocument.addEventListener('keydown', chords.keydown, { capture: true, signal: listening.signal });
            // A closing modal hands focus back to whatever had it before, so ours moves only once it has closed;
            // 'close' doesn't bubble, but capture still passes through the workspace.
            element.addEventListener('close', () => {
                let next = settle;

                settle = undefined;
                next?.();
            }, { capture: true, signal: listening.signal });
            model.setConfirmation(ask);

            onCleanup(model.subscribe(bridge));
            onCleanup(hosting.connect(element));
            onCleanup(navigation.connect(element));
            onCleanup(statusBar.connect(element));
            onCleanup(() => {
                listening.abort();
                chords.cancel();
                unobserve();
                confirmation?.resolve('cancel');
                model.setConfirmation(undefined);
                model.stop();

                if (mount) {
                    unmount(mount);
                }

                container = undefined;
                release = undefined;
            });

            // Line and column follow the active document alone, so typing in one tab never touches the others.
            effect(() => {
                let tab = read(active);

                if (!tab || tab.compare) {
                    view.position = '';
                    return;
                }

                let document = tab.document,
                    update = () => {
                        let position = document.position();

                        view.position = `Ln ${position.line}, Col ${position.column}`;
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
                        if (path !== model.state.active?.path) {
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

    function crumbs() {
        let path = view.path;

        if (!path) {
            return '';
        }

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
            class: 'breadcrumb--compact code-workspace-breadcrumb',
            items,
            label: 'File path',
            onnavigate: (item) => locate(item.href.slice(1)),
            separator: 'chevron'
        });
    }

    function decorate(list: readonly WorkspaceTab[]) {
        let ids = new Set<number>(),
            open = new Set<string>();

        for (let i = 0, n = list.length; i < n; i++) {
            let tab = list[i],
                unsaved = dirty(tab);

            ids.add(tab.id);
            open.add(tab.path);
            write(flag(tab), unsaved);

            if (decorated.get(tab.path) !== unsaved) {
                decorated.set(tab.path, unsaved);
                decorations.update([[tab.path, { editor: { open: true, unsaved } }]]);
            }
        }

        for (let path of [...decorated.keys()]) {
            if (!open.has(path)) {
                decorated.delete(path);
                decorations.update([[path, null]]);
            }
        }

        for (let id of [...flags.keys()]) {
            if (!ids.has(id)) {
                flags.delete(id);
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

    function flag(tab: WorkspaceTab) {
        let found = flags.get(tab.id);

        if (!found) {
            found = signal(dirty(tab));
            flags.set(tab.id, found);
        }

        return found;
    }

    // The active tab's editor may still be mounting; it takes focus as soon as its controller arrives.
    function focusEditor() {
        let tab = model.state.active;

        focusing = false;

        if (!tab) {
            searchField?.focus();
            return;
        }

        if (mount?.controller && mount.tab === tab) {
            mount.controller.focus();
            return;
        }

        focusing = true;
    }

    function keydown(event: KeyboardEvent) {
        if (event.defaultPrevented || event.isComposing || !container || confirmation) {
            return;
        }

        let inside = container.contains(event.target as Node | null),
            key = event.key.toLowerCase(),
            mod = (event.ctrlKey || event.metaKey) && !event.altKey;

        // Quick open also answers while the pointer rests on the workspace, as an editor pane under the cursor would.
        if (mod && !event.shiftKey && key === 'p' && (inside || hovered)) {
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
        else if (key === 'escape' && view.peek) {
            event.preventDefault();
            peek(false);
            focusEditor();
        }
    }

    // A breadcrumb leads back into the explorer: the project collapses the tree, a folder is revealed in it.
    function locate(path: string) {
        peek(true, true);

        if (!path) {
            tree?.collapseAll();
            return;
        }

        if (path !== view.path) {
            treeState.selected = path;
        }
    }

    function openKeybindings() {
        palette.active = false;
        keyboard.active = true;
    }

    function pane() {
        let next = read(shown);

        if (!next) {
            return html`
                <div class='code-workspace-empty'>
                    Open a file from the explorer or press
                    <span class='code-workspace-keys'>
                        ${keys(['Mod', 'P']).map((key) => html`<kbd class='button button--kbd'>${key}</kbd>`)}
                    </span>
                </div>
            `;
        }

        // A render that runs again has released the mount it made; the tab gets a fresh one.
        let current: Mount = next.released ? { editor: next.editor, path: signal(next.tab.path), released: false, tab: next.tab } : next,
            bound: WorkspaceEditorAttributes = {
                class: 'code-workspace-document',
                controller: (controller) => {
                    if (current.released) {
                        return;
                    }

                    current.controller = controller;
                    restore(current);
                    attach(current);
                    reveal();

                    if (focusing) {
                        focusing = false;
                        // The controller can arrive mid-render; focusing may flush, which would render the pane again.
                        queueMicrotask(() => {
                            if (!current.released) {
                                controller.focus();
                            }
                        });
                    }
                },
                document: current.tab.document,
                onSave: () => {
                    void model.save(current.tab);
                },
                options: () => settings(current.tab, read(current.path))
            };

        mount = current;
        onCleanup(() => unmount(current));

        return untrack(() => current.editor(bound));
    }

    function peek(open: boolean, keyboard = false) {
        if (!view.collapsed) {
            return;
        }

        if (!open) {
            view.peek = false;
            view.ready = false;
            return;
        }

        view.peek = true;

        // No transition will report the drawer settled when motion is off.
        if (keyboard || container?.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            view.ready = true;
        }
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

    // The edge leaves once the drawer is open, so keyboard focus moves on into the explorer instead of being dropped.
    function reach() {
        peek(true, true);
        flush();
        searchField?.focus();
    }

    function results(groups: ResultGroup[]) {
        return html`
            ${highlight({ class: 'command-highlight', hover: false, target: '.command-option' })}
            ${groups.map((group) => html`
                <div aria-labelledby='${group.id}' class='command-group' role='group'>
                    <div class='command-group-label' id='${group.id}'>${group.label}</div>
                    ${group.items.map((item) => html`
                        <div class='command-option' ${item.attributes}>
                            ${item.command?.icon
                                ? icon({ 'aria-hidden': 'true', class: 'code-workspace-command-icon' }, item.command.icon)
                                : fileTreeIcon({ name: name(item.id), type: 'file' }, false)}
                            ${item.content}
                        </div>
                    `)}
                </div>
            `)}
        `;
    }

    // Where the shown tab was left, for when it's shown again.
    function remember(current: Mount) {
        let element = current.controller!.scroller;

        current.tab.scroll = { left: element.scrollLeft, top: element.scrollTop };
        hosting.remember(current.tab, current.controller!);
    }

    // A merge starting or ending on the shown tab swaps what the pane shows for it.
    function remount() {
        if (mount) {
            unmount(mount);
        }

        show(model.state.active);
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

    // Moves the mounted editor on to another tab's document, which costs far less than mounting it again.
    function retarget(current: Mount, tab: WorkspaceTab) {
        remember(current);
        detach(current);
        current.tab = tab;
        current.controller!.setDocument!(tab.document, settings(tab, tab.path));
        restore(current);
        attach(current);
        reveal();
    }

    function reveal() {
        let controller = mount?.controller,
            state = model.state,
            next = state.reveal;

        if (!controller || !next || !state.active || next.request === revealed || controller.document !== state.active.document || state.active.id !== next.tabId) {
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
        view.search = query;
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
            keybindings: merge(options?.keybindings, read(bindings)),
            label: path,
            whitespace: view.whitespace,
            wrap: view.wrap
        };
    }

    // Puts the tab in the editor pane: the mounted editor moves on to it when it can, or one is mounted for it.
    function show(tab: WorkspaceTab | undefined) {
        if (mount?.tab === tab) {
            return;
        }

        let editor = tab && (strip.editor(tab) ?? editorFor?.(tab) ?? codeEditor);

        if (tab && mount?.controller?.setDocument && mount.editor === editor) {
            retarget(mount, tab);
            return;
        }

        if (mount) {
            unmount(mount);
        }

        mount = tab && editor && { editor, path: signal(tab.path), released: false, tab };
        write(shown, mount);
    }

    function tab(entry: WorkspaceTab) {
        let chosen = () => signal.selector(activeId, entry.id),
            file = strip.label(entry);

        return html`
            <div
                aria-controls='${id}-panel'
                class='button code-workspace-tab'
                id='${id}-tab-${entry.id}'
                role='tab'
                title='${strip.title(entry)}'
                ${{
                    'aria-selected': () => (chosen() ? 'true' : 'false'),
                    class: () => chosen() && '--active',
                    onauxclick: (event: MouseEvent) => {
                        if (event.button === 1) {
                            event.preventDefault();
                            void model.close(entry.path);
                        }
                    },
                    onclick: () => {
                        model.activate(entry);
                        focusEditor();
                    },
                    onconnect: (element: HTMLElement) => {
                        elements.set(entry, element);
                    },
                    onkeydown: (event: KeyboardEvent) => {
                        let list = untrack(() => read(tabs)),
                            at = list.indexOf(entry),
                            next: WorkspaceTab | undefined;

                        if (event.key === 'ArrowRight') {
                            next = list[(at + 1) % list.length];
                        }
                        else if (event.key === 'ArrowLeft') {
                            next = list[(at - 1 + list.length) % list.length];
                        }
                        else if (event.key === 'Home') {
                            next = list[0];
                        }
                        else if (event.key === 'End') {
                            next = list.at(-1);
                        }
                        else if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            model.activate(entry);
                            focusEditor();
                            return;
                        }

                        if (next) {
                            event.preventDefault();
                            model.activate(next);
                            elements.get(next)?.focus();
                        }
                    },
                    tabindex: () => (chosen() ? 0 : -1)
                }}
                ${strip.attributes(entry)}
            >
                ${fileTreeIcon({ name: file, type: 'file' }, false)}
                <span class='code-workspace-tab-name'>${file}</span>
                ${strip.pin(entry)}
                ${() => read(flag(entry)) && html`<span aria-label='Unsaved changes' class='code-workspace-tab-dirty' role='img'></span>`}
                <button
                    aria-label='Close ${file}'
                    class='button code-workspace-tab-close'
                    tabindex='-1'
                    title='${label('Close', ['Mod', 'W'])}'
                    type='button'
                    ${{
                        onclick: (event: Event) => {
                            event.stopPropagation();
                            void model.close(entry.path);
                        }
                    }}
                >
                    ${icon({ 'aria-hidden': 'true', class: 'code-workspace-tab-close-icon' }, close)}
                </button>
            </div>
        `;
    }

    function toggle(key: 'explorerOpen' | 'showWhitespace' | 'wrapText') {
        model.setPreferences({ [key]: !model.state.preferences[key] });
        view.peek = false;
        view.ready = false;
    }

    function unmount(current: Mount) {
        if (current.released) {
            return;
        }

        let controller = current.controller;

        current.released = true;

        if (mount === current) {
            mount = undefined;
            statusBar.attach(undefined);
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
                return mount?.controller;
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
                view.peek = false;
                view.ready = false;
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

    receive?.(api);

    return html`
        <section
            aria-label='Editor workspace'
            class='code-workspace'
            ${attributes}
            ${{
                class: [
                    () => view.collapsed && 'code-workspace--collapsed',
                    () => view.left && 'code-workspace--left',
                    () => view.peek && 'code-workspace--peek',
                    // A narrow workspace stacks an open explorer under the editor; a hidden one still peeks from the edge.
                    () => view.compact && view.tabs && view.explorerOpen && 'code-workspace--stacked',
                    () => view.tabs && 'code-workspace--tabs'
                ],
                onconnect: connect,
                onpointerenter: () => {
                    hovered = true;
                },
                onpointerleave: () => {
                    hovered = false;
                }
            }}
        >
            <aside
                aria-label='File explorer'
                class='code-workspace-explorer'
                ${{
                    onfocusin: () => peek(true, true),
                    // A drawer still sliding away can pass under a resting pointer; only a settled one peeks.
                    onpointerenter: (event: PointerEvent) => {
                        if (!(event.currentTarget as HTMLElement).getAnimations().length) {
                            peek(true);
                        }
                    },
                    ontransitionend: (event: TransitionEvent) => {
                        if (event.target === event.currentTarget && event.propertyName === 'translate') {
                            view.ready = view.peek;
                        }
                    }
                }}
            >
                <div class='code-workspace-explorer-content' ${{ inert: () => view.collapsed && !view.ready }}>
                    <div class='code-workspace-explorer-header'>
                        ${control({
                            label: () => (view.left ? 'Move file explorer to right' : 'Move file explorer to left'),
                            onclick: api.toggleExplorerSide,
                            sprite: () => (view.left ? right : left)
                        })}
                        ${control({ label: 'Collapse all folders', onclick: api.collapseAll, sprite: collapse })}
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
                            value: () => view.search
                        })}
                    </div>
                    <div class='code-workspace-tree'>
                        ${() => hosting.ready() && untrack(() => fileTree({
                            class: 'code-workspace-files',
                            compact: true,
                            controller: (value) => {
                                tree = value;
                                value.search(view.search);
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
                                view.search = query;
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
                ${() => view.collapsed && !view.ready && html`
                    <button
                        aria-label='Peek file explorer'
                        class='code-workspace-edge'
                        type='button'
                        ${{ onclick: reach, onfocus: reach }}
                    ></button>
                `}
            </aside>
            <main class='code-workspace-main' ${{ onpointerenter: () => peek(false) }}>
                <div aria-label='Open files' class='code-workspace-tabs --scrollbar' role='tablist'>
                    ${highlight({ class: 'code-workspace-tabs-highlight', line: 'bottom' })}
                    ${() => read(tabs).map(tab)}
                </div>
                <div class='code-workspace-bar'>
                    ${crumbs}
                    <div class='code-workspace-actions'>
                        ${statusBar.save(() => control({
                            disabled: () => !view.tabs || view.busy,
                            label: label('Save file', ['Mod', 'S']),
                            onclick: () => {
                                void model.save();
                            },
                            sprite: save
                        }))}
                        ${control({
                            active: () => view.wrap,
                            label: () => (view.wrap ? 'Disable wrap' : 'Wrap long lines'),
                            onclick: api.toggleWrap,
                            sprite: wrap
                        })}
                        ${control({
                            active: () => view.whitespace,
                            label: () => (view.whitespace ? 'Hide whitespace' : 'Show whitespace'),
                            onclick: api.toggleWhitespace,
                            sprite: whitespace
                        })}
                        ${sidebar({
                            'aria-label': () => (view.explorerOpen ? 'Hide file explorer' : 'Show file explorer'),
                            class: 'code-workspace-control',
                            onclick: api.toggleExplorer,
                            open: () => view.explorerOpen,
                            side: () => (view.left ? 'left' : 'right'),
                            title: () => (view.explorerOpen ? 'Hide file explorer' : 'Show file explorer')
                        })}
                    </div>
                </div>
                <div
                    class='code-workspace-editor'
                    id='${id}-panel'
                    role='tabpanel'
                    ${{ 'aria-labelledby': () => (read(activeId) ? `${id}-tab-${read(activeId)}` : undefined) }}
                >
                    ${pane}
                </div>
            </main>
            <footer class='code-workspace-status'>
                <span class='code-workspace-status-path'>${() => view.cwd}</span>
                <span class='code-workspace-status-position'>${() => view.position}</span>
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
                ${strip.menu()}
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
                keybindings: () => read(bindings),
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
