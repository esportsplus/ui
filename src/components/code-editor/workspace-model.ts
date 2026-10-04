import { EditorDocument } from './document';

export type WorkspaceEntry = Readonly<{ path: string; kind: 'file' | 'directory' }>;
export type WorkspacePreferences = {
    explorerOpen: boolean;
    explorerSide: 'left' | 'right';
    wrapText: boolean;
    showWhitespace: boolean;
};
export type WorkspaceChange = { paths?: readonly string[] };
export type WorkspaceConfirmation = {
    kind: 'close' | 'delete' | 'workspace';
    paths: readonly string[];
    dirty: readonly string[];
};
export type WorkspaceDecision = 'save' | 'discard' | 'cancel';
export type WorkspaceHost = {
    list(cwd: string): Promise<readonly WorkspaceEntry[]>;
    read(cwd: string, path: string): Promise<string>;
    write(cwd: string, path: string, content: string): Promise<void>;
    rename(cwd: string, source: string, destination: string): Promise<{ operationId: string }>;
    delete(cwd: string, paths: readonly string[]): Promise<{ operationId: string }>;
    undo(cwd: string, operationId: string): Promise<void>;
    watch(cwd: string, changed: (event: WorkspaceChange) => void): VoidFunction | Promise<VoidFunction>;
    preferences?: {
        get(): Promise<Partial<WorkspacePreferences>>;
        set(preferences: WorkspacePreferences): Promise<void>;
    };
    mention(cwd: string, path: string): void | Promise<void>;
    copyPath(cwd: string, path: string): void | Promise<void>;
    confirm?: (request: WorkspaceConfirmation) => WorkspaceDecision | Promise<WorkspaceDecision>;
};
export type WorkspaceTab = {
    readonly id: number;
    path: string;
    readonly document: EditorDocument;
    saved: string;
    missing: boolean;
    scroll: { top: number; left: number };
};
export type WorkspaceTarget = { path: string; line?: number; column?: number; requestId?: string | number };
export type WorkspaceState = Readonly<{
    cwd: string;
    entries: readonly WorkspaceEntry[];
    tabs: readonly WorkspaceTab[];
    active: WorkspaceTab | undefined;
    preferences: Readonly<WorkspacePreferences>;
    loaded: boolean;
    loading: boolean;
    error: string;
    status: string;
    statusKind: 'info' | 'error';
    busy: number;
    opening: readonly string[];
    canUndoFiles: boolean;
    revision: number;
    reveal: { tabId: number; line: number; column: number; request: number } | undefined;
}>;
type FileOperation = {
    id: string;
    kind: 'delete' | 'rename';
    before: WorkspaceEntry[];
    after: WorkspaceEntry[];
    source?: string;
    destination?: string;
};

const DEFAULTS: WorkspacePreferences = { explorerOpen: true, explorerSide: 'right', wrapText: false, showWhitespace: false };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
export const dirty = (tab: WorkspaceTab) => tab.document.value !== tab.saved;
export const containsPath = (parent: string, path: string) => path === parent || path.startsWith(`${parent}/`);

/** Workspace-relative path identity; accept an absolute open target only when it lies inside cwd.
 * @throws {Error} A path outside the workspace, or an invalid path segment.
 */
export function workspacePath(value: string, cwd = '') {
    let path = value.replace(/\\/g, '/'), base = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
    if (/^(?:[a-z]:|\/)/i.test(path)) {
        let windows = /^[a-z]:/i.test(base), a = windows ? path.toLowerCase() : path, b = windows ? base.toLowerCase() : base;
        if (!base || !a.startsWith(`${b}/`)) throw new Error('Path is outside this workspace');
        path = path.slice(base.length + 1);
    }
    let parts = path.replace(/\/+$/, '').split('/');
    if (!parts.length || parts.some((part) => !part || part === '.' || part === '..' || /[\x00-\x1f]/.test(part))) {
        throw new Error('A valid workspace-relative path is required');
    }
    return parts.join('/');
}

/** Reference-compatible subsequence ranking, with deterministic path ties and a bounded result list. */
export function workspaceMatches(entries: readonly WorkspaceEntry[], query: string, limit = 12) {
    let needle = query.toLowerCase(), matches: { entry: WorkspaceEntry; score: number }[] = [];
    for (let entry of entries) {
        if (entry.kind !== 'file') continue;
        let target = entry.path.toLowerCase(), cursor = 0, score = 0, match = true;
        for (let letter of needle) {
            let at = target.indexOf(letter, cursor);
            if (at < 0) { match = false; break; }
            score += at - cursor + (at === cursor ? 0 : 1);
            cursor = at + 1;
        }
        if (match) matches.push({ entry, score });
    }
    return matches.sort((a, b) => a.score - b.score || a.entry.path.localeCompare(b.entry.path))
        .slice(0, Math.max(0, limit)).map(({ entry }) => entry);
}

/** UI-independent workspace coordinator. One document per tab; all file mutations are serialized. */
export class EditorWorkspaceModel {
    readonly host: WorkspaceHost;
    #cwd: string;
    #entries: WorkspaceEntry[] = [];
    #tabs: WorkspaceTab[] = [];
    #active: number | undefined;
    #preferences = { ...DEFAULTS };
    #preferenceRevision = 0;
    #loaded = false;
    #loading = false;
    #error = '';
    #status = '';
    #statusKind: 'info' | 'error' = 'info';
    #busy = 0;
    #revision = 0;
    #tabId = 0;
    #epoch = 0;
    #openIntent = 0;
    #requestedPath = '';
    #refreshIntent = 0;
    #mutation = 0;
    #revealRequest = 0;
    #reveal: WorkspaceState['reveal'];
    #lastTarget: string | number | undefined;
    #running = false;
    #disposed = false;
    #watch: VoidFunction | undefined;
    #opening = new Map<string, Promise<WorkspaceTab | undefined>>();
    #closed = new Map<string, number>();
    #documents = new Map<number, VoidFunction>();
    #listeners = new Set<(state: WorkspaceState) => void>();
    #operations = Promise.resolve();
    #preferenceWrite = Promise.resolve();
    #watchWork = Promise.resolve();
    #start: Promise<void> | undefined;
    // Optimistic desired entries survive a lagging workspace index until it acknowledges each mutation.
    #overlay = new Map<string, WorkspaceEntry | null>();
    #history: FileOperation[] = [];
    #confirm: WorkspaceHost['confirm'];

    constructor(host: WorkspaceHost, cwd = '', preferences: Partial<WorkspacePreferences> = {}) {
        this.host = host;
        this.#cwd = cwd;
        this.#applyPreferences(preferences);
    }

    get state(): WorkspaceState {
        return {
            cwd: this.#cwd, entries: this.#entries, tabs: this.#tabs,
            active: this.#tabs.find((tab) => tab.id === this.#active), preferences: this.#preferences,
            loaded: this.#loaded, loading: this.#loading, error: this.#error,
            status: this.#status, statusKind: this.#statusKind, busy: this.#busy,
            opening: [...this.#opening.keys()], canUndoFiles: this.#history.length > 0,
            revision: this.#revision, reveal: this.#reveal
        };
    }

    subscribe(listener: (state: WorkspaceState) => void) {
        this.#listeners.add(listener);
        return () => { this.#listeners.delete(listener); };
    }

    #emit() {
        if (this.#disposed) return;
        this.#revision++;
        let state = this.state;
        for (let listener of [...this.#listeners]) listener(state);
    }

    status(text: string, error = false) {
        this.#status = text;
        this.#statusKind = error ? 'error' : 'info';
        this.#emit();
    }

    setConfirmation(confirm?: WorkspaceHost['confirm']) { this.#confirm = confirm; }

    #applyPreferences(preferences: Partial<WorkspacePreferences>) {
        for (let key of ['explorerOpen', 'wrapText', 'showWhitespace'] as const) {
            if (typeof preferences[key] === 'boolean') this.#preferences[key] = preferences[key];
        }
        if (preferences.explorerSide === 'left' || preferences.explorerSide === 'right') this.#preferences.explorerSide = preferences.explorerSide;
    }

    setPreferences(preferences: Partial<WorkspacePreferences>) {
        this.#preferences = { ...this.#preferences };
        this.#applyPreferences(preferences);
        this.#preferenceRevision++;
        this.#emit();
        let snapshot = { ...this.#preferences }, epoch = this.#epoch;
        this.#preferenceWrite = this.#preferenceWrite.then(async () => {
            if (this.#disposed) return;
            try { await this.host.preferences?.set(snapshot); }
            catch (error) { if (epoch === this.#epoch) this.status(`Could not save editor preferences: ${message(error)}`, true); }
        });
    }

    async start() {
        if (this.#disposed) return;
        if (this.#running) return this.#start;
        this.#running = true;
        let epoch = ++this.#epoch, revision = this.#preferenceRevision;
        this.#start = (async () => {
            if (!this.#cwd) { this.#error = 'No workspace open.'; this.#emit(); return; }
            let preferences = (async () => {
                try {
                    await this.#preferenceWrite;
                    let result = await this.host.preferences?.get();
                    if (epoch === this.#epoch && result && revision === this.#preferenceRevision) {
                        this.#preferences = { ...this.#preferences };
                        this.#applyPreferences(result);
                        this.#emit();
                    }
                }
                catch (error) { if (epoch === this.#epoch) this.status(`Could not load editor preferences: ${message(error)}`, true); }
            })();
            try {
                let stop = await this.host.watch(this.#cwd, (event) => {
                    if (epoch === this.#epoch) this.#watchWork = this.refresh(event.paths);
                });
                if (epoch !== this.#epoch) stop();
                else this.#watch = stop;
            }
            catch (error) { if (epoch === this.#epoch) this.status(`Watch failed: ${message(error)}`, true); }
            if (epoch === this.#epoch) await this.refresh();
            await preferences;
        })();
        return this.#start;
    }

    stop() {
        this.#watch?.(); this.#watch = undefined;
        this.#running = false; this.#epoch++; this.#openIntent++; this.#refreshIntent++;
        this.#opening.clear(); this.#loading = false;
        this.#emit();
    }

    async refresh(_paths?: readonly string[]) {
        if (this.#disposed || !this.#cwd) return;
        let epoch = this.#epoch, intent = ++this.#refreshIntent, mutation = this.#mutation, cwd = this.#cwd;
        this.#loading = true; this.#emit();
        try {
            let listed = await this.host.list(cwd);
            if (epoch !== this.#epoch || intent !== this.#refreshIntent || mutation !== this.#mutation) return;
            let entries = new Map<string, WorkspaceEntry>();
            for (let entry of listed) {
                let path = workspacePath(entry.path, cwd);
                entries.set(path, { path, kind: entry.kind });
            }
            for (let [path, desired] of this.#overlay) {
                let listed = entries.get(path);
                if (desired ? listed?.kind === desired.kind : !listed) this.#overlay.delete(path);
                else if (desired) entries.set(path, desired);
                else entries.delete(path);
            }
            this.#entries = [...entries.values()];
            this.#loaded = true; this.#error = ''; this.#loading = false; this.#emit();
            // Refresh sequentially to bound IO even with many open tabs. Recheck after the read, not only before it.
            for (let tab of [...this.#tabs]) {
                if (epoch !== this.#epoch || intent !== this.#refreshIntent || mutation !== this.#mutation) return;
                tab.missing = !entries.has(tab.path);
                if (dirty(tab) || tab.missing) { this.#emit(); continue; }
                let revision = tab.document.state.revision, path = tab.path;
                try {
                    let content = await this.host.read(cwd, path);
                    if (epoch !== this.#epoch || intent !== this.#refreshIntent || mutation !== this.#mutation ||
                        !this.#tabs.includes(tab) || tab.path !== path || dirty(tab) || tab.document.state.revision !== revision) continue;
                    tab.saved = content;
                    if (content !== tab.document.value) tab.document.reset(content, tab.document.selection);
                    this.#emit();
                }
                catch (error) { if (epoch === this.#epoch && this.#tabs.includes(tab)) this.status(`Refresh failed for ${path}: ${message(error)}`, true); }
            }
        }
        catch (error) {
            if (epoch === this.#epoch && intent === this.#refreshIntent) { this.#error = message(error); this.#emit(); }
        }
        finally {
            if (epoch === this.#epoch && intent === this.#refreshIntent) { this.#loading = false; this.#emit(); }
        }
    }

    activate(tab: WorkspaceTab | string) {
        let found = typeof tab === 'string' ? this.#tabs.find((item) => item.path === tab) : tab;
        if (!found || !this.#tabs.includes(found)) return;
        this.#openIntent++; this.#requestedPath = found.path; this.#active = found.id; this.#emit();
    }

    async open(value: string, line?: number, column = 1) {
        if (this.#disposed) return;
        let path: string;
        try { path = workspacePath(value, this.#cwd); }
        catch (error) { this.status(`Open failed: ${message(error)}`, true); return; }
        let epoch = this.#epoch, intent = ++this.#openIntent, cwd = this.#cwd;
        this.#requestedPath = path;
        let existing = this.#tabs.find((tab) => tab.path === path), pending = this.#opening.get(path);
        if (!existing && !pending) {
            let closed = this.#closed.get(path) ?? 0;
            pending = (async () => {
                try {
                    let content = await this.host.read(cwd, path);
                    if (epoch !== this.#epoch || this.#disposed || closed !== (this.#closed.get(path) ?? 0) || this.#overlay.get(path) === null) return;
                    let tab: WorkspaceTab = {
                        id: ++this.#tabId, path, document: new EditorDocument(content), saved: content,
                        missing: false, scroll: { top: 0, left: 0 }
                    };
                    this.#tabs.push(tab);
                    this.#documents.set(tab.id, tab.document.subscribe(() => this.#emit()));
                    return tab;
                }
                catch (error) {
                    if (epoch === this.#epoch && this.#requestedPath === path && closed === (this.#closed.get(path) ?? 0)) this.status(`Open failed: ${message(error)}`, true);
                }
                finally {
                    if (epoch === this.#epoch) { this.#opening.delete(path); this.#emit(); }
                }
            })();
            this.#opening.set(path, pending); this.#emit();
        }
        let tab = existing ?? await pending;
        if (!tab || epoch !== this.#epoch || !this.#tabs.includes(tab)) return;
        if (intent === this.#openIntent) {
            this.#active = tab.id;
            if (line !== undefined) {
                let safeLine = Number.isFinite(line) ? Math.max(1, Math.trunc(line)) : 1,
                    safeColumn = Number.isFinite(column) ? Math.max(1, Math.trunc(column)) : 1,
                    offset = tab.document.offset(safeLine, safeColumn);
                tab.document.select({ start: offset, end: offset });
                this.#reveal = { tabId: tab.id, line: safeLine, column: safeColumn, request: ++this.#revealRequest };
            }
            this.#status = ''; this.#statusKind = 'info'; this.#emit();
        }
        return tab;
    }

    async openTarget(target?: WorkspaceTarget) {
        if (!target || !target.path || (target.requestId !== undefined && target.requestId === this.#lastTarget)) return;
        this.#lastTarget = target.requestId;
        return this.open(target.path, target.line, target.column);
    }

    #queue<T>(label: string, task: () => Promise<T>) {
        let epoch = this.#epoch;
        let result = this.#operations.then(async () => {
            if (this.#disposed || epoch !== this.#epoch) return undefined;
            this.#busy++; this.#emit();
            try { return await task(); }
            catch (error) { if (epoch === this.#epoch) this.status(`${label} failed: ${message(error)}`, true); return undefined; }
            finally { this.#busy--; this.#emit(); }
        });
        this.#operations = result.then(() => undefined);
        return result;
    }

    save(tab = this.state.active) {
        return this.#queue('Save', async () => {
            if (!tab || !this.#tabs.includes(tab)) return false;
            if (!dirty(tab) && !tab.missing) return true;
            let content = tab.document.value, path = tab.path, epoch = this.#epoch;
            // Invalidate pre-save watcher reads. A subsequent edit is never declared saved by this request.
            this.#mutation++;
            await this.host.write(this.#cwd, path, content);
            if (epoch !== this.#epoch || !this.#tabs.includes(tab) || tab.path !== path) return false;
            tab.saved = content; tab.missing = false;
            if (tab.document.value === content) tab.document.markSaved();
            let entry: WorkspaceEntry = { path, kind: 'file' };
            this.#overlay.set(path, entry);
            if (!this.#entries.some((item) => item.path === path)) this.#entries = [...this.#entries, entry];
            this.#mutation++;
            this.status(`Saved ${path}`);
            await this.refresh();
            return true;
        });
    }

    async #authorize(kind: WorkspaceConfirmation['kind'], tabs: readonly WorkspaceTab[], paths: readonly string[]) {
        let revisions = new Map(tabs.map((tab) => [tab.id, tab.document.state.revision])), changed = tabs.filter(dirty);
        if (!changed.length) return revisions;
        let confirm = this.host.confirm ?? this.#confirm;
        if (!confirm) { this.status('Unsaved changes require confirmation.', true); return; }
        let decision: WorkspaceDecision;
        try { decision = await confirm({ kind, paths, dirty: changed.map((tab) => tab.path) }); }
        catch (error) { this.status(`Confirmation failed: ${message(error)}`, true); return; }
        if (decision === 'cancel') return;
        if (decision === 'save') {
            for (let tab of changed) {
                if (!await this.save(tab) || dirty(tab)) { this.status('Changes made during saving remain open.', true); return; }
            }
        }
        for (let tab of tabs) {
            if (tab.document.state.revision !== revisions.get(tab.id)) {
                this.status('The draft changed while confirmation was open; try again.', true); return;
            }
        }
        return revisions;
    }

    #removeTab(tab: WorkspaceTab) {
        let at = this.#tabs.indexOf(tab);
        if (at < 0) return;
        this.#tabs.splice(at, 1); this.#documents.get(tab.id)?.(); this.#documents.delete(tab.id);
        if (this.#active === tab.id) this.#active = (this.#tabs[at] ?? this.#tabs[at - 1])?.id;
    }

    async close(path = this.state.active?.path) {
        if (!path) return false;
        this.#closed.set(path, (this.#closed.get(path) ?? 0) + 1);
        let tab = this.#tabs.find((tab) => tab.path === path);
        if (!tab) return true;
        if (!await this.#authorize('close', [tab], [path])) return false;
        this.#removeTab(tab); this.#emit();
        return true;
    }

    #desired(before: readonly WorkspaceEntry[], after: readonly WorkspaceEntry[]) {
        for (let entry of before) this.#overlay.set(entry.path, null);
        for (let entry of after) this.#overlay.set(entry.path, entry);
        let removed = new Set(before.map((entry) => entry.path));
        this.#entries = [...this.#entries.filter((entry) => !removed.has(entry.path)), ...after];
        this.#mutation++; this.#emit();
    }

    rename(source: string, destination: string) {
        return this.#queue('Rename', async () => {
            let from = workspacePath(source, this.#cwd), to = workspacePath(destination, this.#cwd), epoch = this.#epoch;
            if (from === to) return true;
            if (containsPath(from, to)) throw new Error('Cannot move a directory inside itself');
            if (this.#entries.some((entry) => entry.path === to)) throw new Error('Destination already exists');
            let before = this.#entries.filter((entry) => containsPath(from, entry.path));
            if (!before.length) throw new Error('Source does not exist');
            this.#mutation++;
            let result = await this.host.rename(this.#cwd, from, to);
            if (epoch !== this.#epoch) return false;
            let after = before.map((entry) => ({ ...entry, path: to + entry.path.slice(from.length) }));
            this.#history.push({ id: result.operationId, kind: 'rename', before, after, source: from, destination: to });
            for (let tab of this.#tabs) if (containsPath(from, tab.path)) tab.path = to + tab.path.slice(from.length);
            this.#desired(before, after);
            this.status(`Renamed ${from}`);
            await this.refresh();
            return true;
        });
    }

    async delete(paths: readonly string[]) {
        let normalized: string[];
        try { normalized = [...new Set(paths.map((path) => workspacePath(path, this.#cwd)))]; }
        catch (error) { this.status(`Delete failed: ${message(error)}`, true); return false; }
        if (!normalized.length) return false;
        let tabs = this.#tabs.filter((tab) => normalized.some((path) => containsPath(path, tab.path))),
            revisions = await this.#authorize('delete', tabs, normalized);
        if (!revisions) return false;
        return this.#queue('Delete', async () => {
            let before = this.#entries.filter((entry) => normalized.some((path) => containsPath(path, entry.path))), epoch = this.#epoch;
            this.#mutation++;
            let result = await this.host.delete(this.#cwd, normalized);
            if (epoch !== this.#epoch) return false;
            this.#history.push({ id: result.operationId, kind: 'delete', before, after: [] });
            this.#desired(before, []);
            for (let tab of this.#tabs.slice()) {
                if (!normalized.some((path) => containsPath(path, tab.path))) continue;
                if (tab.document.state.revision === revisions.get(tab.id)) this.#removeTab(tab);
                else tab.missing = true; // Typing during an async delete must not discard a new draft.
            }
            this.status(`Deleted ${normalized.length === 1 ? normalized[0] : `${normalized.length} paths`}`);
            await this.refresh();
            return true;
        });
    }

    undoFiles() {
        return this.#queue('Undo', async () => {
            let operation = this.#history.at(-1), epoch = this.#epoch;
            if (!operation) return false;
            this.#mutation++;
            await this.host.undo(this.#cwd, operation.id);
            if (epoch !== this.#epoch) return false;
            this.#history.pop();
            if (operation.kind === 'rename') {
                for (let tab of this.#tabs) {
                    if (containsPath(operation.destination!, tab.path)) tab.path = operation.source! + tab.path.slice(operation.destination!.length);
                }
            }
            this.#desired(operation.after, operation.before);
            this.status(operation.kind === 'delete' ? 'Restored deleted files' : `Restored ${operation.source}`);
            await this.refresh();
            return true;
        });
    }

    async mention(path: string) {
        try { await this.host.mention(this.#cwd, workspacePath(path, this.#cwd)); this.status(`Added ${path} to chat`); }
        catch (error) { this.status(`Add to Chat failed: ${message(error)}`, true); }
    }

    async copyPath(path: string) {
        try { await this.host.copyPath(this.#cwd, workspacePath(path, this.#cwd)); this.status('Path copied'); }
        catch (error) { this.status(`Copy Path failed: ${message(error)}`, true); }
    }

    async setWorkspace(cwd: string) {
        if (cwd === this.#cwd) return true;
        if (!await this.#authorize('workspace', this.#tabs, this.#tabs.map((tab) => tab.path))) return false;
        this.stop();
        for (let tab of this.#tabs.slice()) this.#removeTab(tab);
        this.#cwd = cwd; this.#entries = []; this.#history = []; this.#overlay.clear(); this.#closed.clear();
        this.#loaded = false; this.#error = ''; this.#status = ''; this.#lastTarget = undefined; this.#reveal = undefined;
        this.#emit(); await this.start();
        return true;
    }

    /** Tests/hosts can drain event-driven work without sleeps or polling timers. */
    async whenIdle() {
        for (;;) {
            let operations = this.#operations, watch = this.#watchWork, preferences = this.#preferenceWrite;
            await operations; await watch; await preferences;
            if (operations === this.#operations && watch === this.#watchWork && preferences === this.#preferenceWrite) return;
        }
    }

    dispose() {
        if (this.#disposed) return;
        this.stop(); this.#disposed = true;
        for (let stop of this.#documents.values()) stop();
        this.#documents.clear(); this.#listeners.clear();
    }
}

/** Deterministic complete host for tests and interactive examples, including watcher and undo receipts.
 * @throws {Error} An invalid initial file path.
 */
export function createMemoryWorkspaceHost(files: Readonly<Record<string, string>>, initial: Partial<WorkspacePreferences> = {}, emptyDirectories: readonly string[] = []) {
    let contents = new Map(Object.entries(files).map(([path, text]) => [workspacePath(path), text])),
        directories = new Set(emptyDirectories.map((path) => workspacePath(path))),
        watchers = new Set<(event: WorkspaceChange) => void>(), preferences = { ...DEFAULTS, ...initial },
        operations = new Map<string, { undo: VoidFunction }>(), id = 0,
        mentions: string[] = [], copiedPaths: string[] = [], writes: { path: string; content: string }[] = [];
    let changed = (paths: readonly string[]) => { for (let watcher of [...watchers]) watcher({ paths }); };
    let parents = (path: string) => {
        let parts = path.split('/');
        for (let length = 1; length < parts.length; length++) directories.add(parts.slice(0, length).join('/'));
    };
    for (let path of [...contents.keys(), ...directories]) parents(path);
    let list = () => {
        let entries = new Map<string, WorkspaceEntry>();
        for (let path of directories) entries.set(path, { path, kind: 'directory' });
        for (let path of contents.keys()) {
            entries.set(path, { path, kind: 'file' });
        }
        return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
    };
    let receipt = (undo: VoidFunction) => {
        let operationId = `memory-${++id}`; operations.set(operationId, { undo }); return { operationId };
    };
    const host: WorkspaceHost = {
        list: async () => list(),
        read: async (_cwd, path) => { if (!contents.has(path)) throw new Error(`File not found: ${path}`); return contents.get(path)!; },
        write: async (_cwd, path, content) => { parents(path); contents.set(path, content); writes.push({ path, content }); changed([path]); },
        rename: async (_cwd, source, destination) => {
            let moved = [...contents].filter(([path]) => containsPath(source, path));
            if (!moved.length && !directories.has(source)) throw new Error('Source does not exist');
            if (list().some((entry) => containsPath(destination, entry.path))) throw new Error('Destination already exists');
            let move = (from: string, to: string) => {
                let items = [...contents].filter(([path]) => containsPath(from, path));
                let folders = [...directories].filter((path) => containsPath(from, path));
                for (let [path] of items) contents.delete(path);
                for (let [path, value] of items) contents.set(to + path.slice(from.length), value);
                for (let path of folders) directories.delete(path);
                for (let path of folders) directories.add(to + path.slice(from.length));
                parents(to);
            };
            move(source, destination); changed([source, destination]);
            return receipt(() => {
                if (list().some((entry) => containsPath(source, entry.path))) throw new Error('Undo destination already exists');
                move(destination, source); changed([source, destination]);
            });
        },
        delete: async (_cwd, paths) => {
            let removed = [...contents].filter(([path]) => paths.some((parent) => containsPath(parent, path)));
            let removedDirectories = [...directories].filter((path) => paths.some((parent) => containsPath(parent, path)));
            for (let [path] of removed) contents.delete(path);
            for (let path of removedDirectories) directories.delete(path);
            changed(paths);
            return receipt(() => {
                if (removed.some(([path]) => contents.has(path)) || removedDirectories.some((path) => contents.has(path))) throw new Error('Cannot overwrite a file created after deletion');
                for (let [path, value] of removed) contents.set(path, value);
                for (let path of removedDirectories) directories.add(path);
                changed(paths);
            });
        },
        undo: async (_cwd, operationId) => {
            let operation = operations.get(operationId);
            if (!operation) throw new Error('Unknown operation');
            operation.undo(); operations.delete(operationId);
        },
        watch: (_cwd, listener) => { watchers.add(listener); return () => { watchers.delete(listener); }; },
        preferences: { get: async () => ({ ...preferences }), set: async (next) => { preferences = { ...next }; } },
        mention: (_cwd, path) => { mentions.push(path); },
        copyPath: (cwd, path) => { copiedPaths.push(`${cwd.replace(/[\\/]+$/, '')}/${path}`); }
    };
    return Object.assign(host, {
        contents, directories, mentions, copiedPaths, writes,
        watchCount: () => watchers.size,
        change(path: string, content: string | null) {
            path = workspacePath(path);
            if (content === null) contents.delete(path); else { parents(path); contents.set(path, content); }
            changed([path]);
        }
    });
}
