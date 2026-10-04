import { effect, flush, peek, reactive, read, signal, untrack, write } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import fileTree, {
    FileTreeDecorations,
    FileTreeEditor,
    FileTreeElements,
    fileTreeIcon,
    type FileTreeController,
    type FileTreeElement
} from '~/components/file-tree';
import codeEditor, { type CodeEditorAttributes } from '../editor';
import type { Controller as EditorController, Options as EditorOptions } from '../view';
import {
    EditorWorkspaceModel,
    dirty,
    workspaceMatches,
    type WorkspaceConfirmation,
    type WorkspaceDecision,
    type WorkspaceEntry,
    type WorkspaceHost,
    type WorkspaceTab,
    type WorkspaceTarget
} from './model';
/** Shared by the code and Markdown controllers. Narrow with `isWorkspaceCodeEditor` for code-only addons. */
export type WorkspaceEditorController = Pick<
    EditorController,
    'document' | 'textarea' | 'focus' | 'select' | 'dispose'
>;
export type WorkspaceEditorAttributes = Omit<CodeEditorAttributes, 'controller' | 'document'> & {
    document: WorkspaceTab['document'];
    controller?: (controller: WorkspaceEditorController) => void;
};
export function isWorkspaceCodeEditor(controller: WorkspaceEditorController): controller is EditorController {
    return 'goToLine' in controller && 'rectAt' in controller && 'refresh' in controller;
}
export type WorkspaceEditorContext = {
    host: HTMLElement;
    controller: WorkspaceEditorController;
    tab: WorkspaceTab;
    workspace: EditorWorkspaceModel;
};
export type CodeEditorWorkspaceController = {
    readonly model: EditorWorkspaceModel;
    readonly editor: WorkspaceEditorController | undefined;
    open(path: string, line?: number, column?: number): ReturnType<EditorWorkspaceModel['open']>;
    save(): ReturnType<EditorWorkspaceModel['save']>;
    close(path?: string): ReturnType<EditorWorkspaceModel['close']>;
    rename(source: string, destination: string): ReturnType<EditorWorkspaceModel['rename']>;
    delete(paths?: readonly string[]): ReturnType<EditorWorkspaceModel['delete']>;
    undoFiles(): ReturnType<EditorWorkspaceModel['undoFiles']>;
    refresh(): Promise<void>;
    search(query: string): void;
    collapseAll(): void;
    quickOpen(query?: string): void;
    toggleExplorer(): void;
    toggleExplorerSide(): void;
    toggleWrap(): void;
    toggleWhitespace(): void;
    focus(): void;
    dispose(): void;
};
export type CodeEditorWorkspaceAttributes = Attributes & {
    host?: WorkspaceHost;
    cwd?: string;
    model?: EditorWorkspaceModel;
    controller?: (controller: CodeEditorWorkspaceController) => void;
    openTarget?: WorkspaceTarget | (() => WorkspaceTarget | undefined);
    editorOptions?: EditorOptions | ((tab: WorkspaceTab) => EditorOptions);
    /** Called for each active editor mount and again after its path changes. Previous cleanup runs first. */
    addons?: (context: WorkspaceEditorContext) => void | VoidFunction;
    /** Return a first-party markdown/custom editor template, or undefined for the standard code editor.
     * Forward the supplied document/options/controller/lifecycle attributes to preserve workspace behavior. */
    renderEditor?: (tab: WorkspaceTab, attributes: WorkspaceEditorAttributes) => Renderable<unknown> | undefined;
};
type Menu = { paths: string[]; target: FileTreeElement; x: number; y: number };
type Confirmation = { request: WorkspaceConfirmation; resolve: (decision: WorkspaceDecision) => void };
let uid = 0;

function glyph(path: string) {
    return html`<svg aria-hidden='true' focusable='false' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><path d='${path}' /></svg>`;
}
const SYMBOLS = {
    explorer: 'M2 2v9h4M2 5h4M8 3h6v4H8ZM8 10h6v4H8Z',
    collapse: 'M4 2l4 4 4-4M4 14l4-4 4 4',
    wrap: 'M2 3h12M2 7h10c4 0 4 5 0 5H8M10 10l-2 2 2 2M2 12h3',
    whitespace: 'M2 10v3h12v-3M7 4h.01',
    undo: 'M6 3L2 6l4 3M2 6h7c5 0 5 7 0 7',
    save: 'M2 2h10l2 2v10H2ZM5 2v4h6V2M5 14V9h6v5',
    search: 'M6.5 10.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM10 10l4 4',
    side: 'M2 2h12v12H2ZM6 2v12M9 6l2 2-2 2'
};

/** Reconcile path-shaped entries through the existing store so watcher ticks keep unchanged rows and expansion. */
export function reconcileWorkspaceTree(store: FileTreeElements, entries: readonly WorkspaceEntry[]) {
    let nodes = new Map<string, { element: FileTreeElement; parent: string | null }>();
    for (let entry of entries) {
        let parts = entry.path.split('/');
        for (let length = 1; length <= parts.length; length++) {
            let id = parts.slice(0, length).join('/'),
                folder = length < parts.length || entry.kind === 'directory';
            nodes.set(id, {
                element: {
                    id,
                    name: parts[length - 1],
                    type: folder ? 'folder' : 'file',
                    ...(folder ? { children: [] } : {})
                },
                parent: length === 1 ? null : parts.slice(0, length - 1).join('/')
            });
        }
    }
    for (let [id, { element }] of [...store.index]) {
        if (!nodes.has(id) || nodes.get(id)!.element.type !== element.type) store.remove(id);
    }
    for (let [id, node] of [...nodes].sort(([a], [b]) => a.split('/').length - b.split('/').length)) {
        if (!store.get(id)) store.add(node.element, node.parent);
    }
}

function workspace(input: CodeEditorWorkspaceAttributes) {
    let {
        host,
        cwd = '',
        model: supplied,
        controller: receive,
        openTarget,
        editorOptions,
        addons,
        renderEditor,
        onconnect,
        ondisconnect,
        ...attributes
    } = input;
    if (!supplied && !host) throw new Error('codeEditorWorkspace requires a WorkspaceHost or EditorWorkspaceModel');
    let model = supplied ?? new EditorWorkspaceModel(host!, cwd),
        treeStore = new FileTreeElements([]),
        treeEditor = new FileTreeEditor(),
        decorations = new FileTreeDecorations(),
        treeState = reactive({ selected: '', selection: new Set<string>() }),
        version = signal(0),
        active = signal<WorkspaceTab | undefined>(undefined),
        tabs = signal<readonly WorkspaceTab[]>([]),
        ui = reactive({
            hasTabs: false,
            explorerOpen: true,
            explorerSide: 'right',
            wrap: false,
            whitespace: false,
            path: '',
            search: '',
            quick: false,
            query: '',
            quickIndex: 0,
            peek: false,
            peekReady: false,
            compact: false
        }),
        menu = signal<Menu | undefined>(undefined),
        confirmation = signal<Confirmation | undefined>(undefined),
        id = `code-workspace-${++uid}`,
        tree: FileTreeController | undefined,
        editor: WorkspaceEditorController | undefined,
        refreshAddons: VoidFunction | undefined,
        root: HTMLElement | undefined,
        returnFocus: HTMLElement | undefined,
        resize: ResizeObserver | undefined,
        stop: VoidFunction | undefined,
        stopTarget: VoidFunction | undefined,
        stopSelection: VoidFunction | undefined,
        stopOutside: VoidFunction | undefined,
        lastEntries: readonly WorkspaceEntry[] | undefined,
        lastTabs = '',
        lastActivePath = '',
        revealed = 0,
        decorated = new Set<string>(),
        disposed = false;

    function state() {
        read(version);
        return model.state;
    }
    function matches() {
        return workspaceMatches(state().entries, ui.query);
    }
    function selected() {
        return [...treeState.selection].filter((path) => treeStore.get(path));
    }
    function bridge() {
        let state = model.state;
        if (lastEntries !== state.entries) {
            reconcileWorkspaceTree(treeStore, state.entries);
            lastEntries = state.entries;
        }
        let key = state.tabs.map((tab) => `${tab.id}:${tab.path}`).join('\n');
        if (key !== lastTabs) {
            lastTabs = key;
            write(tabs, [...state.tabs]);
        }
        write(active, state.active);
        ui.hasTabs = state.tabs.length > 0;
        ui.path = state.active?.path ?? '';
        ui.explorerOpen = state.preferences.explorerOpen;
        ui.explorerSide = state.preferences.explorerSide;
        ui.wrap = state.preferences.wrapText;
        ui.whitespace = state.preferences.showWhitespace;
        if (lastActivePath !== ui.path) {
            lastActivePath = ui.path;
            treeState.selected = ui.path;
            refreshAddons?.();
        }
        let next = new Set(state.tabs.map((tab) => tab.path));
        for (let path of decorated) if (!next.has(path)) decorations.update([[path, null]]);
        for (let tab of state.tabs) decorations.update([[tab.path, { editor: { open: true, unsaved: dirty(tab) } }]]);
        decorated = next;
        write(version, state.revision);
        reveal();
    }
    function reveal() {
        let target = model.state.reveal;
        if (
            !editor ||
            !target ||
            target.request === revealed ||
            editor.document !== model.state.active?.document ||
            model.state.active?.id !== target.tabId
        )
            return;
        revealed = target.request;
        if (isWorkspaceCodeEditor(editor)) editor.goToLine(target.line, target.column);
        else {
            let offset = editor.document.offset(target.line, target.column);
            editor.select({ start: offset, end: offset });
        }
    }
    function focusEditor() {
        if (editor) editor.focus();
        else root?.querySelector<HTMLInputElement>('.code-workspace-search')?.focus();
    }
    function quick(query = '') {
        returnFocus = root?.ownerDocument.activeElement as HTMLElement | undefined;
        ui.query = query;
        ui.quickIndex = 0;
        ui.quick = true;
        flush();
        root?.querySelector<HTMLInputElement>('.code-workspace-quick-input')?.focus();
    }
    function closeQuick() {
        ui.quick = false;
        returnFocus?.focus({ preventScroll: true });
    }
    function choose(path?: string) {
        if (path) {
            ui.quick = false;
            void model.open(path).then(() => focusEditor());
        }
    }
    function dismissMenu(refocus = false) {
        write(menu, undefined);
        if (refocus) returnFocus?.focus({ preventScroll: true });
    }
    function toggle(key: 'explorerOpen' | 'wrapText' | 'showWhitespace') {
        model.setPreferences({ [key]: !model.state.preferences[key] });
        ui.peek = false;
        ui.peekReady = false;
    }
    function peekDrawer(open: boolean, keyboard = false) {
        if (ui.explorerOpen || !ui.hasTabs) return;
        if (!open) {
            ui.peek = false;
            ui.peekReady = false;
            return;
        }
        if (!ui.peek) {
            ui.peek = true;
            ui.peekReady = false;
        }
        if (keyboard || root?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
            ui.peekReady = true;
    }
    function search(query: string) {
        ui.search = query;
        tree?.search(query);
    }
    function ask(request: WorkspaceConfirmation) {
        let previous = peek(confirmation);
        previous?.resolve('cancel');
        returnFocus = root?.ownerDocument.activeElement as HTMLElement | undefined;
        return new Promise<WorkspaceDecision>((resolve) => {
            write(confirmation, {
                request,
                resolve: (decision) => {
                    write(confirmation, undefined);
                    returnFocus?.focus({ preventScroll: true });
                    resolve(decision);
                }
            });
        });
    }
    const api: CodeEditorWorkspaceController = {
        model,
        get editor() {
            return editor;
        },
        open: (path, line, column) => model.open(path, line, column),
        save: () => model.save(),
        close: (path) => model.close(path),
        rename: (source, destination) => model.rename(source, destination),
        delete: (paths = selected()) => model.delete(paths),
        undoFiles: () => model.undoFiles(),
        refresh: () => model.refresh(),
        search,
        collapseAll: () => tree?.collapseAll(),
        quickOpen: quick,
        toggleExplorer: () => toggle('explorerOpen'),
        toggleWrap: () => toggle('wrapText'),
        toggleWhitespace: () => toggle('showWhitespace'),
        toggleExplorerSide: () => {
            model.setPreferences({ explorerSide: ui.explorerSide === 'left' ? 'right' : 'left' });
            ui.peek = false;
            ui.peekReady = false;
        },
        focus: focusEditor,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            cleanup();
            editor?.dispose();
            model.dispose();
        }
    };
    receive?.(api);

    function cleanup() {
        resize?.disconnect();
        resize = undefined;
        stop?.();
        stop = undefined;
        stopTarget?.();
        stopTarget = undefined;
        stopSelection?.();
        stopSelection = undefined;
        stopOutside?.();
        stopOutside = undefined;
        peek(confirmation)?.resolve('cancel');
        model.setConfirmation(undefined);
        model.stop();
    }
    function hotkeys(event: KeyboardEvent) {
        if (event.isComposing || !root?.contains(event.target as Node)) return;
        let target = event.target as HTMLElement,
            command = event.ctrlKey || event.metaKey,
            key = event.key.toLowerCase(),
            treeFocus = !!target.closest('.file-tree') && !target.closest('input, textarea, [contenteditable=true]');
        if (peek(confirmation)) return;
        if (event.defaultPrevented) return;
        if (command && key === 'p') {
            event.preventDefault();
            quick();
        } else if (command && key === 'w') {
            event.preventDefault();
            void model.close();
        } else if (command && key === 's') {
            event.preventDefault();
            void model.save();
        } else if (treeFocus && command && key === 'z' && !event.shiftKey) {
            event.preventDefault();
            void model.undoFiles();
        } else if (key === 'escape') {
            if (ui.quick) {
                event.preventDefault();
                closeQuick();
            } else if (peek(menu)) {
                event.preventDefault();
                dismissMenu(true);
            } else if (ui.peek) {
                event.preventDefault();
                peekDrawer(false);
                focusEditor();
            }
        }
    }
    function button(
        label: string | (() => string),
        symbol: keyof typeof SYMBOLS,
        action: VoidFunction,
        pressed?: () => boolean,
        disabled?: () => boolean
    ) {
        return html`<button class='code-workspace-button' type='button' title='${label}' aria-label='${label}'
            ${{ 'aria-pressed': pressed && (() => String(pressed())), disabled, onclick: action }}>${glyph(SYMBOLS[symbol])}</button>`;
    }
    function tabItem(tab: WorkspaceTab) {
        let name = tab.path.split('/').at(-1)!;
        return html`
            <div class='code-workspace-tab' role='tab' id='${`${id}-tab-${tab.id}`}' aria-controls='${`${id}-panel`}' title='${tab.path}'
                ${{
                    'aria-selected': () => String(read(active)?.id === tab.id),
                    tabindex: () => (read(active)?.id === tab.id ? 0 : -1),
                    onclick: () => {
                        model.activate(tab);
                        focusEditor();
                    },
                    onauxclick: (event: MouseEvent) => {
                        if (event.button === 1) {
                            event.preventDefault();
                            void model.close(tab.path);
                        }
                    },
                    onkeydown: (event: KeyboardEvent) => {
                        let list = peek(tabs),
                            at = list.indexOf(tab),
                            next: WorkspaceTab | undefined;
                        if (event.key === 'ArrowRight') next = list[(at + 1) % list.length];
                        else if (event.key === 'ArrowLeft') next = list[(at - 1 + list.length) % list.length];
                        else if (event.key === 'Home') next = list[0];
                        else if (event.key === 'End') next = list.at(-1);
                        else if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            model.activate(tab);
                            focusEditor();
                        }
                        if (next) {
                            event.preventDefault();
                            model.activate(next);
                            flush();
                            root?.querySelector<HTMLElement>(`#${id}-tab-${next.id}`)?.focus();
                        }
                    }
                }}>
                <span class='code-workspace-tab-icon'>${fileTreeIcon({ name: tab.path, type: 'file' })}</span>
                <span class='code-workspace-tab-name'>${name}</span>
                ${() => {
                    read(version);
                    return (
                        dirty(tab) &&
                        html`<span class='code-workspace-dirty' role='img' aria-label='Unsaved changes'></span>`
                    );
                }}
                <button class='code-workspace-close' type='button' aria-label='${`Close ${name}`}' title='Close (Ctrl/Cmd+W)'
                    onclick='${(event: Event) => {
                        event.stopPropagation();
                        void model.close(tab.path);
                    }}'>×</button>
            </div>
        `;
    }
    function editorPane() {
        let tab = read(active);
        if (!tab)
            return html`<div class='code-workspace-empty'>Open a file from the explorer or press Ctrl/Cmd+P.</div>`;
        let bound: WorkspaceEditorAttributes = {
            document: tab.document,
            options: () => {
                let options = typeof editorOptions === 'function' ? editorOptions(tab) : editorOptions;
                return {
                    minimap: true,
                    fold: true,
                    ...options,
                    fileName: ui.path,
                    label: ui.path,
                    wrap: ui.wrap,
                    whitespace: ui.whitespace
                };
            },
            onSave: () => {
                void model.save(tab);
            },
            controller: (mounted) => {
                editor = mounted;
                let scrollElement = mounted.textarea.closest<HTMLElement>('.markdown-surface') ?? mounted.textarea;
                scrollElement.scrollTop = tab.scroll.top;
                scrollElement.scrollLeft = tab.scroll.left;
                let dispose = mounted.dispose,
                    addonStop: void | VoidFunction,
                    released = false,
                    addonPath = '';
                let updateAddons = () => {
                    if (released || model.state.active?.document !== mounted.document || addonPath === tab.path) return;
                    addonPath = tab.path;
                    try {
                        addonStop?.();
                        addonStop = undefined;
                        addonStop = addons?.({
                            host:
                                mounted.textarea.closest<HTMLElement>('.code-editor, .markdown-editor') ??
                                mounted.textarea.parentElement!,
                            controller: mounted,
                            tab,
                            workspace: model
                        });
                    } catch (error) {
                        model.status(`Editor addon failed: ${String(error)}`, true);
                    }
                };
                refreshAddons = updateAddons;
                updateAddons();
                mounted.dispose = () => {
                    if (released) return;
                    released = true;
                    tab.scroll = { top: scrollElement.scrollTop, left: scrollElement.scrollLeft };
                    try {
                        addonStop?.();
                    } finally {
                        if (refreshAddons === updateAddons) refreshAddons = undefined;
                        if (editor === mounted) editor = undefined;
                        dispose();
                    }
                };
                reveal();
            }
        };
        let custom = renderEditor?.(tab, bound);
        return custom === undefined ? codeEditor(bound) : custom;
    }
    function quickOverlay() {
        return html`
            <div class='code-workspace-backdrop' onclick='${closeQuick}'>
                <div class='code-workspace-quick' role='dialog' aria-modal='true' aria-label='Go to file' onclick='${(event: Event) => event.stopPropagation()}'>
                    <input class='code-workspace-quick-input' role='combobox' aria-label='Go to file' aria-autocomplete='list' aria-expanded='true'
                        aria-controls='${`${id}-results`}' placeholder='Go to file…' autocomplete='off' spellcheck='false'
                        ${{
                            value: () => ui.query,
                            'aria-activedescendant': () =>
                                matches().length
                                    ? `${id}-result-${Math.min(ui.quickIndex, matches().length - 1)}`
                                    : undefined,
                            onconnect: (element: HTMLInputElement) => element.focus(),
                            oninput: (event: Event) => {
                                ui.query = (event.target as HTMLInputElement).value;
                                ui.quickIndex = 0;
                            },
                            onkeydown: (event: KeyboardEvent) => {
                                let list = matches(),
                                    count = list.length;
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    closeQuick();
                                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    ui.quickIndex = count
                                        ? (ui.quickIndex + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
                                        : 0;
                                } else if (event.key === 'Enter') {
                                    event.preventDefault();
                                    choose(list[Math.min(ui.quickIndex, count - 1)]?.path);
                                } else if (event.key === 'Tab') {
                                    event.preventDefault();
                                }
                            }
                        }}>
                    <div id='${`${id}-results`}' role='listbox' aria-label='Matching files'>
                        ${() => {
                            let list = matches();
                            return list.length
                                ? list.map(
                                      (entry, at) => html`
                                <div class='code-workspace-result' role='option' id='${`${id}-result-${at}`}'
                                    aria-selected='${() => String(at === Math.min(ui.quickIndex, list.length - 1))}'
                                    onmouseenter='${() => {
                                        ui.quickIndex = at;
                                    }}' onclick='${() => choose(entry.path)}'>
                                    ${fileTreeIcon({ name: entry.path, type: 'file' })}<span>${entry.path}</span>
                                </div>
                            `
                                  )
                                : html`<div class='code-workspace-notice' role='status'>No matching files</div>`;
                        }}
                    </div>
                </div>
            </div>
        `;
    }
    function menuOverlay(current: Menu) {
        let items = [
            ...(current.target.type === 'file'
                ? [
                      {
                          label: 'Open',
                          action: () => {
                              void model.open(current.target.id).then(focusEditor);
                          }
                      },
                      {
                          label: 'Delete',
                          action: () => {
                              void model.delete(current.paths);
                          }
                      }
                  ]
                : [
                      {
                          label: 'Delete',
                          action: () => {
                              void model.delete(current.paths);
                          }
                      }
                  ]),
            { label: 'Rename', action: () => treeEditor.rename(current.target.id) },
            {
                label: 'Add to Chat',
                action: () => {
                    void model.mention(current.target.id);
                }
            },
            {
                label: 'Copy Path',
                action: () => {
                    void model.copyPath(current.target.id);
                }
            }
        ];
        return html`<div class='code-workspace-menu' role='menu' aria-label='File actions' style='${`left:${current.x}px;top:${current.y}px;`}'
            ${{
                onconnect: (element: HTMLElement) => {
                    let box = element.getBoundingClientRect(),
                        bounds = root!.getBoundingClientRect();
                    element.style.left = `${Math.max(0, Math.min(current.x, bounds.width - box.width))}px`;
                    element.style.top = `${Math.max(0, Math.min(current.y, bounds.height - box.height))}px`;
                    element.querySelector<HTMLElement>('button')?.focus();
                },
                onkeydown: (event: KeyboardEvent) => {
                    let buttons = [
                            ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')
                        ],
                        at = buttons.indexOf(event.target as HTMLButtonElement);
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        buttons[(at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
                    } else if (event.key === 'Home' || event.key === 'End') {
                        event.preventDefault();
                        (event.key === 'Home' ? buttons[0] : buttons.at(-1))?.focus();
                    } else if (event.key === 'Escape' || event.key === 'Tab') {
                        event.preventDefault();
                        dismissMenu(true);
                    }
                }
            }}>
            ${items.map(
                (item) =>
                    html`<button type='button' role='menuitem' onclick='${() => {
                        dismissMenu();
                        item.action();
                    }}'>${item.label}</button>`
            )}
        </div>`;
    }
    function confirmOverlay(current: Confirmation) {
        return html`<div class='code-workspace-backdrop code-workspace-confirm-backdrop'>
            <div class='code-workspace-confirm' role='dialog' aria-modal='true' aria-labelledby='${`${id}-confirm-title`}'
                ${{
                    onconnect: (element: HTMLElement) => element.querySelector<HTMLButtonElement>('button')?.focus(),
                    onkeydown: (event: KeyboardEvent) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            current.resolve('cancel');
                        } else if (event.key === 'Tab') {
                            let controls = [
                                    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
                                        'button'
                                    )
                                ],
                                at = controls.indexOf(event.target as HTMLButtonElement);
                            event.preventDefault();
                            controls[(at + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
                        }
                    }
                }}>
                <strong id='${`${id}-confirm-title`}'>Save unsaved changes?</strong>
                <p>${current.request.dirty.join(', ')}</p>
                <p>${current.request.kind === 'delete' ? 'Save before deleting, discard the drafts, or cancel deletion.' : 'Save the drafts, discard them, or keep them open.'}</p>
                <div><button type='button' onclick='${() => current.resolve('cancel')}'>Cancel</button>
                    <button type='button' onclick='${() => current.resolve('discard')}'>Discard</button>
                    <button type='button' onclick='${() => current.resolve('save')}'>Save</button></div>
            </div>
        </div>`;
    }

    return html`
        <section class='code-workspace' aria-label='Editor workspace' tabindex='-1' ${attributes} ${{
            'data-has-tabs': () => String(ui.hasTabs),
            'data-explorer-side': () => ui.explorerSide,
            'data-explorer-open': () => String(ui.explorerOpen),
            'data-compact': () => String(ui.compact),
            onconnect: (element: HTMLElement) => {
                root = element;
                bridge();
                stop = model.subscribe(bridge);
                model.setConfirmation(ask);
                ui.compact = element.getBoundingClientRect().width <= 520;
                resize = new ResizeObserver(([entry]) => {
                    if (entry) ui.compact = entry.contentRect.width <= 520;
                });
                resize.observe(element);
                stopSelection = effect(() => {
                    let path = treeState.selected;
                    if (path && path !== model.state.active?.path && treeStore.get(path)?.type === 'file')
                        untrack(() => {
                            void model.open(path);
                        });
                });
                let outside = (event: Event) => {
                    if (peek(menu) && !(event.target as HTMLElement).closest?.('.code-workspace-menu')) dismissMenu();
                };
                element.ownerDocument.addEventListener('pointerdown', outside);
                // A native listener sees shortcuts from every child. Template delegation intentionally dispatches
                // only to the nearest registered handler, so a delegated root would miss tree/tab/input key events.
                element.addEventListener('keydown', hotkeys);
                stopOutside = () => {
                    element.ownerDocument.removeEventListener('pointerdown', outside);
                    element.removeEventListener('keydown', hotkeys);
                };
                stopTarget = effect(() => {
                    let target = typeof openTarget === 'function' ? openTarget() : openTarget;
                    if (target)
                        untrack(() => {
                            void model.start().then(() => model.openTarget(target));
                        });
                });
                void model.start();
                onconnect?.(element);
            },
            ondisconnect: (element: HTMLElement) => {
                cleanup();
                root = undefined;
                ondisconnect?.(element);
            }
        }}>
            <aside class='code-workspace-explorer' aria-label='File explorer' tabindex='0' ${{
                'data-peek': () => String(ui.peek),
                'data-peek-ready': () => String(ui.peekReady),
                onmouseenter: () => peekDrawer(true),
                onfocusin: () => peekDrawer(true, true),
                ontransitionend: (event: TransitionEvent) => {
                    if (event.target === event.currentTarget && event.propertyName === 'transform')
                        ui.peekReady = ui.peek;
                }
            }}>
                <div class='code-workspace-explorer-content' ${{ inert: () => ui.hasTabs && !ui.explorerOpen && !ui.peekReady }}>
                    <div class='code-workspace-tree-header'>
                        ${button(() => (ui.explorerSide === 'right' ? 'Move file explorer to left' : 'Move file explorer to right'), 'side', api.toggleExplorerSide)}
                        ${button('Collapse all folders', 'collapse', api.collapseAll)}
                        ${button(
                            'Undo file operation',
                            'undo',
                            () => {
                                void model.undoFiles();
                            },
                            undefined,
                            () => !state().canUndoFiles || !!state().busy
                        )}
                        ${button('Go to file (Ctrl/Cmd+P)', 'search', () => quick())}
                        <input class='code-workspace-search' type='search' aria-label='Search files' placeholder='Search files' spellcheck='false'
                            ${{ value: () => ui.search, oninput: (event: Event) => search((event.target as HTMLInputElement).value) }}>
                    </div>
                    <div class='code-workspace-tree-wrap'>
                        ${fileTree({
                            elements: treeStore,
                            editor: treeEditor,
                            state: treeState,
                            decorations,
                            find: 'filter',
                            compact: true,
                            typing: 'typeahead',
                            preview: 'immediate',
                            controller: (value) => {
                                tree = value;
                                value.search(ui.search);
                            },
                            open: (element) => {
                                void model.open(element.id);
                            },
                            rename: async (element, name) => {
                                let parent = element.id.includes('/')
                                    ? element.id.slice(0, element.id.lastIndexOf('/') + 1)
                                    : '';
                                if (!(await model.rename(element.id, parent + name)))
                                    throw new Error(model.state.status);
                            },
                            operations: {
                                delete: (elements) => {
                                    void model.delete(elements.map((element) => element.id));
                                }
                            },
                            menu: (elements, position) => {
                                let target = elements[0];
                                if (!target || !root) return;
                                returnFocus = root.ownerDocument.activeElement as HTMLElement;
                                let rect = root.getBoundingClientRect();
                                write(menu, {
                                    target,
                                    paths: elements.map((element) => element.id),
                                    x: position.x - rect.left,
                                    y: position.y - rect.top
                                });
                            },
                            empty: () => html`<div class='code-workspace-notice'>No files in this workspace</div>`
                        })}
                        ${() => {
                            let current = state();
                            if (current.error)
                                return html`<div class='code-workspace-notice' role='alert'>${current.error}<button type='button' onclick='${() => {
                                    void model.refresh();
                                }}'>Retry</button></div>`;
                            return (
                                !current.loaded && html`<div class='code-workspace-notice' role='status'>Loading…</div>`
                            );
                        }}
                    </div>
                </div>
                <button class='code-workspace-peek-edge' type='button' aria-label='Peek file explorer' onclick='${() => peekDrawer(true, true)}'></button>
            </aside>
            <main class='code-workspace-main' onmouseenter='${() => peekDrawer(false)}'>
                <div class='code-workspace-tabbar' role='tablist' aria-label='Open files'>${() => read(tabs).map(tabItem)}</div>
                <div class='code-workspace-breadcrumb-bar'>
                    <nav class='code-workspace-breadcrumb' aria-label='File breadcrumb'>${() => {
                        let current = state(),
                            tab = current.active;
                        if (!tab) return '';
                        let project = current.cwd.split(/[\\/]/).filter(Boolean).at(-1),
                            crumbs = [...(project ? [project] : []), ...tab.path.split('/')];
                        return crumbs.map(
                            (label, at) =>
                                html`<span class='${at === crumbs.length - 1 ? 'code-workspace-crumb code-workspace-crumb--file' : 'code-workspace-crumb'}' title='${at === crumbs.length - 1 ? tab.path : label}'>${at > 0 ? '› ' : ''}${label}</span>`
                        );
                    }}</nav>
                    ${button(
                        'Save file (Ctrl/Cmd+S)',
                        'save',
                        () => {
                            void model.save();
                        },
                        undefined,
                        () => !state().active || !!state().busy
                    )}
                    ${button(
                        () => (ui.wrap ? 'Disable wrap' : 'Wrap long lines'),
                        'wrap',
                        api.toggleWrap,
                        () => ui.wrap
                    )}
                    ${button(
                        () => (ui.whitespace ? 'Hide whitespace' : 'Show whitespace'),
                        'whitespace',
                        api.toggleWhitespace,
                        () => ui.whitespace
                    )}
                    ${button(
                        () => (ui.explorerOpen ? 'Hide file explorer' : 'Show file explorer'),
                        'explorer',
                        api.toggleExplorer,
                        () => !ui.explorerOpen
                    )}
                </div>
                <div class='code-workspace-editor-area' id='${`${id}-panel`}' role='tabpanel'
                    aria-labelledby='${() => (read(active) ? `${id}-tab-${read(active)!.id}` : undefined)}'>${editorPane}</div>
            </main>
            <footer class='code-workspace-statusbar'>
                <span class='code-workspace-status-path'>${() => state().cwd}</span>
                <span class='code-workspace-position'>${() => {
                    let tab = state().active;
                    if (!tab) return '';
                    let position = tab.document.position();
                    return `Ln ${position.line}, Col ${position.column}`;
                }}</span>
                <span role='status' aria-live='polite' data-error='${() => String(state().statusKind === 'error')}'>${() => {
                    let current = state();
                    return (
                        current.status ||
                        (current.opening.length
                            ? `Opening ${current.opening.at(-1)}…`
                            : current.busy
                              ? 'Working…'
                              : current.loading
                                ? 'Refreshing…'
                                : current.active?.missing
                                  ? 'File removed from disk; draft retained'
                                  : '')
                    );
                }}</span>
            </footer>
            ${() => ui.quick && quickOverlay()}
            ${() => {
                let current = read(menu);
                return current && menuOverlay(current);
            }}
            ${() => {
                let current = read(confirmation);
                return current && confirmOverlay(current);
            }}
        </section>
    `;
}

export { EditorWorkspaceModel } from './model';
export type {
    WorkspaceHost,
    WorkspaceTab,
    WorkspaceEntry,
    WorkspacePreferences,
    WorkspaceTarget,
    WorkspaceConfirmation,
    WorkspaceDecision
} from './model';
export const codeEditorWorkspace = component(workspace);
export default codeEditorWorkspace;
