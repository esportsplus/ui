import type { Command } from '../code/keymap';
import { EditorDocument } from '../code/document';
import { sanitize } from './keybindings';
import type { FileTreeExport, FileTreeImportEntry } from '../tree';
import { closable, compareKey, compareTab, order, place } from './tabs';


type FileOperation = {
    after: WorkspaceEntry[];
    before: WorkspaceEntry[];
    destination?: string;
    id: string;
    kind: 'delete' | 'rename';
    source?: string;
};

// A context menu entry the host adds after the built-in ones, run against the paths the menu opened on.
type WorkspaceAction = {
    danger?: boolean;
    // Sprite id, as imported from '@esportsplus/ui/svg/*.svg'.
    icon?: string;
    id: string;
    label: string;
    run(cwd: string, paths: readonly string[]): void | Promise<void>;
    // Shown for every selection unless this says otherwise.
    visible?: (paths: readonly string[]) => boolean;
};

type WorkspaceChange = { paths?: readonly string[] };

// A read-only diff of two files, as they read when compared; its tab's document stays empty and never saves.
type WorkspaceCompare = Readonly<{ modified: string; original: string; paths: readonly [string, string] }>;

type WorkspaceConfirmation = {
    dirty: readonly string[];
    kind: 'close' | 'delete' | 'workspace';
    paths: readonly string[];
};

type WorkspaceDecision = 'cancel' | 'discard' | 'save';

type WorkspaceEntry = Readonly<{ kind: 'directory' | 'file'; path: string }>;

type WorkspaceHost = {
    actions?: readonly WorkspaceAction[];
    // The text a file's git gutter diffs against, like its HEAD revision; null for none.
    baseline?: (cwd: string, path: string) => Promise<string | null>;
    confirm?: (request: WorkspaceConfirmation) => WorkspaceDecision | Promise<WorkspaceDecision>;
    copyPath(cwd: string, path: string): void | Promise<void>;
    delete(cwd: string, paths: readonly string[]): Promise<{ operationId: string }>;
    // What a file dragged out of the explorer leaves on the desktop or in another app; null for nothing.
    export?: (cwd: string, path: string) => FileTreeExport | null;
    // Files and folders dropped in from the OS onto 'target', a folder path or '' for the top level.
    import?: (cwd: string, target: string, entries: readonly FileTreeImportEntry[]) => Promise<void>;
    list(cwd: string): Promise<readonly WorkspaceEntry[]>;
    preferences?: {
        get(): Promise<Partial<WorkspacePreferences>>;
        set(preferences: WorkspacePreferences): Promise<void>;
    };
    read(cwd: string, path: string): Promise<string>;
    rename(cwd: string, source: string, destination: string): Promise<{ operationId: string }>;
    session?: {
        get(): Promise<WorkspaceSession | null>;
        set(session: WorkspaceSession): Promise<void>;
    };
    undo(cwd: string, operationId: string): Promise<void>;
    watch(cwd: string, changed: (event: WorkspaceChange) => void): VoidFunction | Promise<VoidFunction>;
    write(cwd: string, path: string, content: string): Promise<void>;
};

type WorkspacePreferences = {
    autoSave: 'delay' | 'focus' | 'off';
    autoSaveDelay: number;
    explorerOpen: boolean;
    explorerSide: 'left' | 'right';
    // Chords over the default keys, passed to every editor as 'keybindings'.
    keybindings: Readonly<Record<string, Command | null>>;
    showWhitespace: boolean;
    wrapText: boolean;
};

type WorkspaceSession = {
    active: string | null;
    explorer: { expanded: string[]; scroll: number };
    tabs: WorkspaceSessionTab[];
};

type WorkspaceSessionTab = {
    // Unsaved text restored on load (hot exit); undefined when the tab was saved.
    draft?: string;
    folds: number[];
    path: string;
    pinned: boolean;
    preview: boolean;
    scroll: { left: number; top: number };
    selection: { anchor: number; head: number };
};

type WorkspaceState = Readonly<{
    active: WorkspaceTab | undefined;
    busy: number;
    canUndoFiles: boolean;
    cwd: string;
    entries: readonly WorkspaceEntry[];
    error: string;
    loaded: boolean;
    loading: boolean;
    opening: readonly string[];
    preferences: Readonly<WorkspacePreferences>;
    reveal: { column: number; line: number; request: number; tabId: number } | undefined;
    revision: number;
    status: string;
    statusKind: 'error' | 'info';
    tabs: readonly WorkspaceTab[];
}>;

type WorkspaceTab = {
    readonly compare?: WorkspaceCompare;
    readonly document: EditorDocument;
    readonly id: number;
    missing: boolean;
    path: string;
    pinned: boolean;
    preview: boolean;
    saved: string;
    scroll: { left: number; top: number };
};

type WorkspaceTarget = { column?: number; line?: number; path: string; requestId?: number | string };


const AUTO_SAVE_DELAY_MAX = 60_000;

const AUTO_SAVE_DELAY_MIN = 100;

const DEFAULTS: WorkspacePreferences = {
    autoSave: 'off',
    autoSaveDelay: 1000,
    explorerOpen: true,
    explorerSide: 'right',
    keybindings: {},
    showWhitespace: false,
    wrapText: false
};

const ERROR_PREFIX = /^Workspace: /;


// The status line already names the failed operation, so this module's error prefix is dropped there.
function message(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).replace(ERROR_PREFIX, '');
}

/** Workspace-relative path identity; accept an absolute open target only when it lies inside cwd.
 * @throws {Error} A path outside the workspace, or an invalid path segment.
 */
function workspacePath(value: string, cwd = '') {
    let base = cwd.replace(/\\/g, '/').replace(/\/+$/, ''),
        path = value.replace(/\\/g, '/');

    if (/^(?:[a-z]:|\/)/i.test(path)) {
        let windows = /^[a-z]:/i.test(base),
            a = windows ? path.toLowerCase() : path,
            b = windows ? base.toLowerCase() : base;

        if (!base || !a.startsWith(`${b}/`)) {
            throw new Error('Workspace: path is outside this workspace');
        }

        path = path.slice(base.length + 1);
    }

    let parts = path.replace(/\/+$/, '').split('/');

    if (!parts.length || parts.some((part) => !part || part === '.' || part === '..' || /[\x00-\x1f]/.test(part))) {
        throw new Error('Workspace: a valid workspace-relative path is required');
    }

    return parts.join('/');
}


const containsPath = (parent: string, path: string) => path === parent || path.startsWith(`${parent}/`);

const dirty = (tab: WorkspaceTab) => tab.document.value !== tab.saved;


/** UI-independent workspace coordinator. One document per tab; all file mutations are serialized. */
class EditorWorkspaceModel {
    readonly host: WorkspaceHost;
    private active: number | undefined;
    private busy = 0;
    private closed = new Map<string, number>();
    private confirm: WorkspaceHost['confirm'];
    private cwd: string;
    // Each tab's dirty state as last emitted, so typing only notifies when a tab turns dirty or clean.
    private dirty = new Map<number, boolean>();
    private disposed = false;
    private documents = new Map<number, VoidFunction>();
    private entries: WorkspaceEntry[] = [];
    private epoch = 0;
    private error = '';
    private history: FileOperation[] = [];
    private lastTarget: number | string | undefined;
    private listeners = new Set<(state: WorkspaceState) => void>();
    private loaded = false;
    private loading = false;
    private mutation = 0;
    private openIntent = 0;
    private opening = new Map<string, Promise<WorkspaceTab | undefined>>();
    private operations = Promise.resolve();
    // Optimistic desired entries survive a lagging workspace index until it acknowledges each mutation.
    private overlay = new Map<string, WorkspaceEntry | null>();
    private preferenceRevision = 0;
    private preferences = { ...DEFAULTS };
    private preferenceWrite = Promise.resolve();
    private refreshIntent = 0;
    private requestedPath = '';
    private revealed: WorkspaceState['reveal'];
    private revealRequest = 0;
    private revision = 0;
    private running = false;
    private starting: Promise<void> | undefined;
    private statusKind: 'error' | 'info' = 'info';
    private statusText = '';
    private tabId = 0;
    private tabs: WorkspaceTab[] = [];
    private unwatch: VoidFunction | undefined;
    private watchers = new Set<(event: WorkspaceChange) => void>();
    private watchWork = Promise.resolve();


    constructor(host: WorkspaceHost, cwd = '', preferences: Partial<WorkspacePreferences> = {}) {
        this.cwd = cwd;
        this.host = host;
        this.applyPreferences(preferences);
    }


    private applyPreferences(preferences: Partial<WorkspacePreferences>) {
        if (preferences.autoSave === 'delay' || preferences.autoSave === 'focus' || preferences.autoSave === 'off') {
            this.preferences.autoSave = preferences.autoSave;
        }

        if (typeof preferences.autoSaveDelay === 'number' && Number.isFinite(preferences.autoSaveDelay)) {
            this.preferences.autoSaveDelay = Math.min(Math.max(Math.round(preferences.autoSaveDelay), AUTO_SAVE_DELAY_MIN), AUTO_SAVE_DELAY_MAX);
        }

        for (let key of ['explorerOpen', 'showWhitespace', 'wrapText'] as const) {
            if (typeof preferences[key] === 'boolean') {
                this.preferences[key] = preferences[key];
            }
        }

        if (preferences.explorerSide === 'left' || preferences.explorerSide === 'right') {
            this.preferences.explorerSide = preferences.explorerSide;
        }

        if (preferences.keybindings !== undefined) {
            this.preferences.keybindings = sanitize(preferences.keybindings);
        }
    }

    private async authorize(kind: WorkspaceConfirmation['kind'], tabs: readonly WorkspaceTab[], paths: readonly string[]) {
        let changed = tabs.filter(dirty),
            revisions = new Map(tabs.map((tab) => [tab.id, tab.document.state.revision]));

        if (!changed.length) {
            return revisions;
        }

        let confirm = this.host.confirm ?? this.confirm;

        if (!confirm) {
            this.status('Unsaved changes require confirmation.', true);
            return;
        }

        let decision: WorkspaceDecision;

        try {
            decision = await confirm({ dirty: changed.map((tab) => tab.path), kind, paths });
        }
        catch (error) {
            this.status(`Confirmation failed: ${message(error)}`, true);
            return;
        }

        if (decision === 'cancel') {
            return;
        }

        if (decision === 'save') {
            for (let tab of changed) {
                if (!(await this.save(tab)) || dirty(tab)) {
                    this.status('Changes made during saving remain open.', true);
                    return;
                }
            }
        }

        for (let tab of tabs) {
            if (tab.document.state.revision !== revisions.get(tab.id)) {
                this.status('The draft changed while confirmation was open; try again.', true);
                return;
            }
        }

        return revisions;
    }

    private async closeTabs(tabs: readonly WorkspaceTab[]) {
        if (!tabs.length) {
            return true;
        }

        let paths = tabs.map((tab) => tab.path);

        for (let path of paths) {
            this.closed.set(path, (this.closed.get(path) ?? 0) + 1);
        }

        if (!(await this.authorize('close', tabs, paths))) {
            return false;
        }

        for (let tab of tabs) {
            this.removeTab(tab);
        }

        this.emit();

        return true;
    }

    private desire(before: readonly WorkspaceEntry[], after: readonly WorkspaceEntry[]) {
        for (let entry of before) {
            this.overlay.set(entry.path, null);
        }

        for (let entry of after) {
            this.overlay.set(entry.path, entry);
        }

        let removed = new Set(before.map((entry) => entry.path));

        this.entries = [...this.entries.filter((entry) => !removed.has(entry.path)), ...after];
        this.mutation++;
        this.emit();
    }

    private emit() {
        if (this.disposed) {
            return;
        }

        this.revision++;

        for (let i = 0, n = this.tabs.length; i < n; i++) {
            this.dirty.set(this.tabs[i].id, dirty(this.tabs[i]));
        }

        let state = this.state;

        for (let listener of [...this.listeners]) {
            listener(state);
        }
    }

    private queue<T>(label: string, task: () => Promise<T>) {
        let epoch = this.epoch,
            result = this.operations.then(async () => {
                if (this.disposed || epoch !== this.epoch) {
                    return undefined;
                }

                this.busy++;
                this.emit();

                try {
                    return await task();
                }
                catch (error) {
                    if (epoch === this.epoch) {
                        this.status(`${label} failed: ${message(error)}`, true);
                    }

                    return undefined;
                }
                finally {
                    this.busy--;
                    this.emit();
                }
            });

        this.operations = result.then(() => undefined);

        return result;
    }

    private removeTab(tab: WorkspaceTab) {
        let at = this.tabs.indexOf(tab);

        if (at < 0) {
            return;
        }

        this.tabs.splice(at, 1);
        this.documents.get(tab.id)?.();
        this.documents.delete(tab.id);
        this.dirty.delete(tab.id);

        if (this.active === tab.id) {
            this.active = (this.tabs[at] ?? this.tabs[at - 1])?.id;
        }
    }


    get state(): WorkspaceState {
        let active: WorkspaceTab | undefined;

        for (let i = 0, n = this.tabs.length; i < n; i++) {
            if (this.tabs[i].id === this.active) {
                active = this.tabs[i];
                break;
            }
        }

        return {
            active,
            busy: this.busy,
            canUndoFiles: this.history.length > 0,
            cwd: this.cwd,
            entries: this.entries,
            error: this.error,
            loaded: this.loaded,
            loading: this.loading,
            opening: [...this.opening.keys()],
            preferences: this.preferences,
            reveal: this.revealed,
            revision: this.revision,
            status: this.statusText,
            statusKind: this.statusKind,
            tabs: this.tabs
        };
    }


    activate(tab: WorkspaceTab | string) {
        let found = typeof tab === 'string' ? this.tabs.find((item) => item.path === tab) : tab;

        if (!found || !this.tabs.includes(found)) {
            return;
        }

        this.openIntent++;
        this.requestedPath = found.path;
        this.active = found.id;
        this.emit();
    }

    /** Adds a tab whose text came from elsewhere, like a restored draft; undefined when the path is open or opening. */
    adopt(path: string, content: string, saved: string, missing = false) {
        if (this.disposed || this.opening.has(path) || this.tabs.some((tab) => tab.path === path)) {
            return;
        }

        let tab: WorkspaceTab = {
            document: new EditorDocument(content),
            id: ++this.tabId,
            missing,
            path,
            pinned: false,
            preview: false,
            saved,
            scroll: { left: 0, top: 0 }
        };

        this.tabs.push(tab);
        this.documents.set(tab.id, tab.document.subscribe((_, change) => {
            if (change.textChanged && dirty(tab) !== this.dirty.get(tab.id)) {
                if (dirty(tab)) {
                    tab.preview = false;
                }

                this.emit();
            }
        }));
        this.emit();

        return tab;
    }

    async close(path = this.state.active?.path) {
        if (!path) {
            return false;
        }

        this.closed.set(path, (this.closed.get(path) ?? 0) + 1);

        let tab = this.tabs.find((tab) => tab.path === path);

        if (!tab) {
            return true;
        }

        if (!(await this.authorize('close', [tab], [path]))) {
            return false;
        }

        this.removeTab(tab);
        this.emit();

        return true;
    }

    closeOthers(path = this.state.active?.path) {
        return this.closeTabs(closable(this.tabs, 'others', path));
    }

    closeRight(path = this.state.active?.path) {
        return this.closeTabs(closable(this.tabs, 'right', path));
    }

    closeSaved() {
        return this.closeTabs(closable(this.tabs, 'saved'));
    }

    /** Opens a read-only diff of two files in a tab of its own, or shows the one already open for them. */
    async compare(original: string, modified: string) {
        let paths: [string, string];

        try {
            paths = [workspacePath(original, this.cwd), workspacePath(modified, this.cwd)];
        }
        catch (error) {
            this.status(`Compare failed: ${message(error)}`, true);
            return;
        }

        let cwd = this.cwd,
            epoch = this.epoch,
            key = compareKey(paths[0], paths[1]),
            tab = this.tabs.find((tab) => tab.path === key);

        if (!tab) {
            let texts: string[];

            try {
                texts = await Promise.all([this.host.read(cwd, paths[0]), this.host.read(cwd, paths[1])]);
            }
            catch (error) {
                if (epoch === this.epoch) {
                    this.status(`Compare failed: ${message(error)}`, true);
                }

                return;
            }

            if (epoch !== this.epoch || this.disposed) {
                return;
            }

            tab = this.tabs.find((tab) => tab.path === key);

            if (!tab) {
                tab = compareTab(++this.tabId, { modified: texts[1], original: texts[0], paths });
                this.tabs.push(tab);
            }
        }

        this.activate(tab);

        return tab;
    }

    async copyPath(path: string) {
        try {
            await this.host.copyPath(this.cwd, workspacePath(path, this.cwd));
            this.status('Path copied');
        }
        catch (error) {
            this.status(`Copy Path failed: ${message(error)}`, true);
        }
    }

    async delete(paths: readonly string[]) {
        let normalized: string[];

        try {
            normalized = [...new Set(paths.map((path) => workspacePath(path, this.cwd)))];
        }
        catch (error) {
            this.status(`Delete failed: ${message(error)}`, true);
            return false;
        }

        if (!normalized.length) {
            return false;
        }

        let tabs = this.tabs.filter((tab) => normalized.some((path) => containsPath(path, tab.path))),
            revisions = await this.authorize('delete', tabs, normalized);

        if (!revisions) {
            return false;
        }

        return this.queue('Delete', async () => {
            let before = this.entries.filter((entry) => normalized.some((path) => containsPath(path, entry.path))),
                epoch = this.epoch;

            this.mutation++;

            let result = await this.host.delete(this.cwd, normalized);

            if (epoch !== this.epoch) {
                return false;
            }

            this.history.push({ after: [], before, id: result.operationId, kind: 'delete' });
            this.desire(before, []);

            for (let tab of this.tabs.slice()) {
                if (!normalized.some((path) => containsPath(path, tab.path))) {
                    continue;
                }

                // Typing during an async delete must not discard a new draft.
                if (tab.document.state.revision === revisions.get(tab.id)) {
                    this.removeTab(tab);
                }
                else {
                    tab.missing = true;
                }
            }

            this.status(`Deleted ${normalized.length === 1 ? normalized[0] : `${normalized.length} paths`}`);
            await this.refresh();

            return true;
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.stop();
        this.disposed = true;

        for (let stop of this.documents.values()) {
            stop();
        }

        this.documents.clear();
        this.listeners.clear();
    }

    /** Hears each event the host's watcher reports, once its refresh has started. */
    onWatch(listener: (event: WorkspaceChange) => void) {
        this.watchers.add(listener);

        return () => {
            this.watchers.delete(listener);
        };
    }

    // A preview opens in place of the last preview tab; opening the file again without 'preview' keeps its tab.
    async open(value: string, line?: number, column = 1, preview = false) {
        if (this.disposed) {
            return;
        }

        let path: string;

        try {
            path = workspacePath(value, this.cwd);
        }
        catch (error) {
            this.status(`Open failed: ${message(error)}`, true);
            return;
        }

        let cwd = this.cwd,
            epoch = this.epoch,
            intent = ++this.openIntent;

        this.requestedPath = path;

        let existing = this.tabs.find((tab) => tab.path === path),
            pending = this.opening.get(path);

        if (!existing && !pending) {
            let closed = this.closed.get(path) ?? 0;

            pending = (async () => {
                try {
                    let content = await this.host.read(cwd, path);

                    if (epoch !== this.epoch || this.disposed || closed !== (this.closed.get(path) ?? 0) || this.overlay.get(path) === null) {
                        return;
                    }

                    let tab: WorkspaceTab = {
                        document: new EditorDocument(content),
                        id: ++this.tabId,
                        missing: false,
                        path,
                        pinned: false,
                        preview,
                        saved: content,
                        scroll: { left: 0, top: 0 }
                    };

                    let replaced = place(this.tabs, tab);

                    if (replaced) {
                        this.removeTab(replaced);
                    }

                    this.documents.set(tab.id, tab.document.subscribe((_, change) => {
                        if (change.textChanged && dirty(tab) !== this.dirty.get(tab.id)) {
                            if (dirty(tab)) {
                                tab.preview = false;
                            }

                            this.emit();
                        }
                    }));

                    return tab;
                }
                catch (error) {
                    if (epoch === this.epoch && this.requestedPath === path && closed === (this.closed.get(path) ?? 0)) {
                        this.status(`Open failed: ${message(error)}`, true);
                    }
                }
                finally {
                    if (epoch === this.epoch) {
                        this.opening.delete(path);
                        this.emit();
                    }
                }
            })();
            this.opening.set(path, pending);
            this.emit();
        }

        let tab = existing ?? (await pending);

        if (!tab || epoch !== this.epoch || !this.tabs.includes(tab)) {
            return;
        }

        if (!preview) {
            tab.preview = false;
        }

        if (intent === this.openIntent) {
            this.active = tab.id;

            if (line !== undefined) {
                let safeColumn = Number.isFinite(column) ? Math.max(1, Math.trunc(column)) : 1,
                    safeLine = Number.isFinite(line) ? Math.max(1, Math.trunc(line)) : 1,
                    offset = tab.document.offset(safeLine, safeColumn);

                tab.document.select({ end: offset, start: offset });
                this.revealed = { column: safeColumn, line: safeLine, request: ++this.revealRequest, tabId: tab.id };
            }

            this.statusText = '';
            this.statusKind = 'info';
            this.emit();
        }

        return tab;
    }

    async openTarget(target?: WorkspaceTarget) {
        if (!target || !target.path || (target.requestId !== undefined && target.requestId === this.lastTarget)) {
            return;
        }

        this.lastTarget = target.requestId;

        return this.open(target.path, target.line, target.column);
    }

    pin(path: string, pinned = true) {
        let tab = this.tabs.find((tab) => tab.path === path);

        if (!tab || tab.pinned === pinned) {
            return;
        }

        tab.pinned = pinned;
        tab.preview = false;
        order(this.tabs);
        this.emit();
    }

    async refresh(_paths?: readonly string[]) {
        if (this.disposed || !this.cwd) {
            return;
        }

        let cwd = this.cwd,
            epoch = this.epoch,
            intent = ++this.refreshIntent,
            mutation = this.mutation;

        this.loading = true;
        this.emit();

        try {
            let listed = await this.host.list(cwd);

            if (epoch !== this.epoch || intent !== this.refreshIntent || mutation !== this.mutation) {
                return;
            }

            let entries = new Map<string, WorkspaceEntry>();

            for (let i = 0, n = listed.length; i < n; i++) {
                let path = workspacePath(listed[i].path, cwd);

                entries.set(path, { kind: listed[i].kind, path });
            }

            for (let [path, desired] of this.overlay) {
                let found = entries.get(path);

                if (desired ? found?.kind === desired.kind : !found) {
                    this.overlay.delete(path);
                }
                else if (desired) {
                    entries.set(path, desired);
                }
                else {
                    entries.delete(path);
                }
            }

            this.entries = [...entries.values()];
            this.error = '';
            this.loaded = true;
            this.loading = false;
            this.emit();

            // Refresh sequentially to bound IO even with many open tabs. Recheck after the read, not only before it.
            for (let tab of [...this.tabs]) {
                if (epoch !== this.epoch || intent !== this.refreshIntent || mutation !== this.mutation) {
                    return;
                }

                if (tab.compare) {
                    continue;
                }

                tab.missing = !entries.has(tab.path);

                if (dirty(tab) || tab.missing) {
                    this.emit();
                    continue;
                }

                let path = tab.path,
                    revision = tab.document.state.revision;

                try {
                    let content = await this.host.read(cwd, path);

                    if (
                        epoch !== this.epoch ||
                        intent !== this.refreshIntent ||
                        mutation !== this.mutation ||
                        !this.tabs.includes(tab) ||
                        tab.path !== path ||
                        dirty(tab) ||
                        tab.document.state.revision !== revision
                    ) {
                        continue;
                    }

                    tab.saved = content;

                    if (content !== tab.document.value) {
                        tab.document.reset(content, tab.document.selection);
                    }

                    this.emit();
                }
                catch (error) {
                    if (epoch === this.epoch && this.tabs.includes(tab)) {
                        this.status(`Refresh failed for ${path}: ${message(error)}`, true);
                    }
                }
            }
        }
        catch (error) {
            if (epoch === this.epoch && intent === this.refreshIntent) {
                this.error = message(error);
                this.emit();
            }
        }
        finally {
            if (epoch === this.epoch && intent === this.refreshIntent) {
                this.loading = false;
                this.emit();
            }
        }
    }

    rename(source: string, destination: string) {
        return this.queue('Rename', async () => {
            let epoch = this.epoch,
                from = workspacePath(source, this.cwd),
                to = workspacePath(destination, this.cwd);

            if (from === to) {
                return true;
            }

            if (containsPath(from, to)) {
                throw new Error('Workspace: cannot move a directory inside itself');
            }

            if (this.entries.some((entry) => entry.path === to)) {
                throw new Error('Workspace: destination already exists');
            }

            let before = this.entries.filter((entry) => containsPath(from, entry.path));

            if (!before.length) {
                throw new Error('Workspace: source does not exist');
            }

            this.mutation++;

            let result = await this.host.rename(this.cwd, from, to);

            if (epoch !== this.epoch) {
                return false;
            }

            let after = before.map((entry) => ({ ...entry, path: to + entry.path.slice(from.length) }));

            this.history.push({ after, before, destination: to, id: result.operationId, kind: 'rename', source: from });

            for (let tab of this.tabs) {
                if (containsPath(from, tab.path)) {
                    tab.path = to + tab.path.slice(from.length);
                }
            }

            this.desire(before, after);
            this.status(`Renamed ${from}`);
            await this.refresh();

            return true;
        });
    }

    /** Runs a host action against workspace-relative paths; a failure lands in the status line. */
    async run(action: WorkspaceAction, paths: readonly string[]) {
        try {
            await action.run(this.cwd, paths.map((path) => workspacePath(path, this.cwd)));
        }
        catch (error) {
            this.status(`${action.label} failed: ${message(error)}`, true);
        }
    }

    save(tab = this.state.active) {
        return this.queue('Save', async () => {
            if (!tab || !this.tabs.includes(tab) || tab.compare) {
                return false;
            }

            if (!dirty(tab) && !tab.missing) {
                return true;
            }

            let content = tab.document.value,
                epoch = this.epoch,
                path = tab.path;

            // Invalidate pre-save watcher reads. A subsequent edit is never declared saved by this request.
            this.mutation++;
            await this.host.write(this.cwd, path, content);

            if (epoch !== this.epoch || !this.tabs.includes(tab) || tab.path !== path) {
                return false;
            }

            tab.missing = false;
            tab.saved = content;

            if (tab.document.value === content) {
                tab.document.markSaved();
            }

            let entry: WorkspaceEntry = { kind: 'file', path };

            this.overlay.set(path, entry);

            if (!this.entries.some((item) => item.path === path)) {
                this.entries = [...this.entries, entry];
            }

            this.mutation++;
            this.status(`Saved ${path}`);
            await this.refresh();

            return true;
        });
    }

    setConfirmation(confirm?: WorkspaceHost['confirm']) {
        this.confirm = confirm;
    }

    setPreferences(preferences: Partial<WorkspacePreferences>) {
        this.preferences = { ...this.preferences };
        this.applyPreferences(preferences);
        this.preferenceRevision++;
        this.emit();

        let epoch = this.epoch,
            snapshot = { ...this.preferences };

        this.preferenceWrite = this.preferenceWrite.then(async () => {
            if (this.disposed) {
                return;
            }

            try {
                await this.host.preferences?.set(snapshot);
            }
            catch (error) {
                if (epoch === this.epoch) {
                    this.status(`Could not save editor preferences: ${message(error)}`, true);
                }
            }
        });
    }

    async setWorkspace(cwd: string) {
        if (cwd === this.cwd) {
            return true;
        }

        if (!(await this.authorize('workspace', this.tabs, this.tabs.map((tab) => tab.path)))) {
            return false;
        }

        this.stop();

        for (let tab of this.tabs.slice()) {
            this.removeTab(tab);
        }

        this.closed.clear();
        this.cwd = cwd;
        this.entries = [];
        this.error = '';
        this.history = [];
        this.lastTarget = undefined;
        this.loaded = false;
        this.overlay.clear();
        this.revealed = undefined;
        this.statusText = '';
        this.emit();
        await this.start();

        return true;
    }

    async start() {
        if (this.disposed) {
            return;
        }

        if (this.running) {
            return this.starting;
        }

        this.running = true;

        let epoch = ++this.epoch,
            revision = this.preferenceRevision;

        this.starting = (async () => {
            if (!this.cwd) {
                this.error = 'No workspace open.';
                this.emit();
                return;
            }

            let preferences = (async () => {
                try {
                    await this.preferenceWrite;

                    let result = await this.host.preferences?.get();

                    if (epoch === this.epoch && result && revision === this.preferenceRevision) {
                        this.preferences = { ...this.preferences };
                        this.applyPreferences(result);
                        this.emit();
                    }
                }
                catch (error) {
                    if (epoch === this.epoch) {
                        this.status(`Could not load editor preferences: ${message(error)}`, true);
                    }
                }
            })();

            try {
                let stop = await this.host.watch(this.cwd, (event) => {
                    if (epoch === this.epoch) {
                        this.watchWork = this.refresh(event.paths);

                        for (let watcher of [...this.watchers]) {
                            watcher(event);
                        }
                    }
                });

                if (epoch !== this.epoch) {
                    stop();
                }
                else {
                    this.unwatch = stop;
                }
            }
            catch (error) {
                if (epoch === this.epoch) {
                    this.status(`Watch failed: ${message(error)}`, true);
                }
            }

            if (epoch === this.epoch) {
                await this.refresh();
            }

            await preferences;
        })();

        return this.starting;
    }

    status(text: string, error = false) {
        this.statusText = text;
        this.statusKind = error ? 'error' : 'info';
        this.emit();
    }

    stop() {
        this.unwatch?.();
        this.unwatch = undefined;
        this.epoch++;
        this.loading = false;
        this.openIntent++;
        this.opening.clear();
        this.refreshIntent++;
        this.running = false;
        this.emit();
    }

    subscribe(listener: (state: WorkspaceState) => void) {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    undoFiles() {
        return this.queue('Undo', async () => {
            let epoch = this.epoch,
                operation = this.history.at(-1);

            if (!operation) {
                return false;
            }

            this.mutation++;
            await this.host.undo(this.cwd, operation.id);

            if (epoch !== this.epoch) {
                return false;
            }

            this.history.pop();

            if (operation.kind === 'rename') {
                for (let tab of this.tabs) {
                    if (containsPath(operation.destination!, tab.path)) {
                        tab.path = operation.source! + tab.path.slice(operation.destination!.length);
                    }
                }
            }

            this.desire(operation.after, operation.before);
            this.status(operation.kind === 'delete' ? 'Restored deleted files' : `Restored ${operation.source}`);
            await this.refresh();

            return true;
        });
    }

    unpin(path: string) {
        this.pin(path, false);
    }

    /** Tests/hosts can drain event-driven work without sleeps or polling timers. */
    async whenIdle() {
        for (;;) {
            let operations = this.operations,
                preferences = this.preferenceWrite,
                watch = this.watchWork;

            await operations;
            await watch;
            await preferences;

            if (operations === this.operations && watch === this.watchWork && preferences === this.preferenceWrite) {
                return;
            }
        }
    }
}


export { containsPath, DEFAULTS, dirty, EditorWorkspaceModel, workspacePath };
export type {
    WorkspaceAction,
    WorkspaceChange,
    WorkspaceCompare,
    WorkspaceConfirmation,
    WorkspaceDecision,
    WorkspaceEntry,
    WorkspaceHost,
    WorkspacePreferences,
    WorkspaceSession,
    WorkspaceSessionTab,
    WorkspaceState,
    WorkspaceTab,
    WorkspaceTarget
};
