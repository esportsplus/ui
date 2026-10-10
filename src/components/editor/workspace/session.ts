import { effect, read, root, signal, untrack, write, type Signal } from '@esportsplus/reactivity';
import Decorations, { type Decoration } from '../tree/decorations';
import type { CodeController } from '../code/view';
import type { FileTreeElement, FileTreeImportEntry, FileTreeSnapshot } from '../tree';
import {
    containsPath,
    dirty,
    workspacePath,
    type EditorWorkspaceModel,
    type WorkspaceChange,
    type WorkspaceSession,
    type WorkspaceSessionTab,
    type WorkspaceTab
} from './model';
import type { WorkspaceEditorController } from './index';


type Baseline = {
    // The latest fetch, settled once its text is in.
    fetched: Promise<void>;
    request: number;
    // The tab's saved text when this was fetched: a save or an outside change fetches it again.
    saved: string;
    text: Signal<string | null>;
};

type Shown = { controller: WorkspaceEditorController; tab: WorkspaceTab };


// Session writes wait this long after the last change.
const DELAY = 500;


function code(controller: WorkspaceEditorController): controller is CodeController {
    return 'folds' in controller && 'nextChange' in controller;
}

function message(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).replace(/^Workspace: /, '');
}

function numbers(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is number => Number.isFinite(item)) : [];
}

function offset(value: unknown, length: number) {
    return Number.isFinite(value) ? Math.max(0, Math.min(length, Math.trunc(value as number))) : 0;
}

// Stored sessions outlive the code that wrote them and may be edited by hand, so each field is checked on the way in.
function parse(value: WorkspaceSession | null | undefined): WorkspaceSession | null {
    if (!value || typeof value !== 'object' || !Array.isArray(value.tabs)) {
        return null;
    }

    let tabs: WorkspaceSessionTab[] = [];

    for (let i = 0, n = value.tabs.length; i < n; i++) {
        let tab = value.tabs[i];

        if (!tab || typeof tab.path !== 'string') {
            continue;
        }

        tabs.push({
            ...(typeof tab.draft === 'string' ? { draft: tab.draft } : {}),
            folds: numbers(tab.folds),
            path: tab.path,
            pinned: tab.pinned === true,
            preview: tab.preview === true,
            scroll: { left: Math.max(0, Number(tab.scroll?.left) || 0), top: Math.max(0, Number(tab.scroll?.top) || 0) },
            selection: { anchor: Number(tab.selection?.anchor) || 0, head: Number(tab.selection?.head) || 0 }
        });
    }

    return {
        active: typeof value.active === 'string' ? value.active : null,
        explorer: {
            expanded: Array.isArray(value.explorer?.expanded) ? value.explorer.expanded.filter((id) => typeof id === 'string') : [],
            scroll: Math.max(0, Number(value.explorer?.scroll) || 0)
        },
        tabs
    };
}

function selection(tab: WorkspaceTab): WorkspaceSessionTab['selection'] {
    let { direction, end, start } = tab.document.selection;

    return direction === 'backward' ? { anchor: end, head: start } : { anchor: start, head: end };
}


// What the workspace takes from its host beyond files: the persisted session (hot exit included), each tab's git
// baseline, OS drag and drop, and the change and problem marks the explorer's next/previous step between.
const hosted = (model: EditorWorkspaceModel, current: () => Shown | undefined, delay = DELAY) => {
    let baselines = new Map<string, Baseline>(),
        disposed = false,
        documents = new Map<WorkspaceTab, VoidFunction>(),
        explorer: FileTreeSnapshot = {},
        folded = new WeakMap<WorkspaceTab, number[]>(),
        host = model.host,
        last = '',
        marks = new Decorations(),
        // Folds a restored tab gets once its editor first shows it.
        pending = new WeakMap<WorkspaceTab, number[]>(),
        problems = new Map<WorkspaceTab, { errors: number; warnings: number }>(),
        ready = signal(!host.session),
        restored = !host.session,
        restoring: Promise<void> | undefined,
        stopProblems: VoidFunction | undefined,
        timer: ReturnType<typeof setTimeout> | undefined,
        waiters = new Map<WorkspaceTab, ((controller: WorkspaceEditorController | undefined) => void)[]>();

    function capture(): WorkspaceSession {
        let shown = current(),
            state = model.state,
            tabs: WorkspaceSessionTab[] = [];

        for (let i = 0, n = state.tabs.length; i < n; i++) {
            let tab = state.tabs[i];

            // A compare tab is a snapshot of two files, not a file to reopen.
            if (tab.compare) {
                continue;
            }

            let live = shown?.tab === tab && shown.controller.host?.isConnected ? shown.controller : undefined,
                item: WorkspaceSessionTab = {
                    folds: live && code(live) ? live.folds() : (folded.get(tab) ?? pending.get(tab) ?? []),
                    path: tab.path,
                    pinned: tab.pinned,
                    preview: tab.preview,
                    scroll: live ? { left: live.scroller.scrollLeft, top: live.scroller.scrollTop } : { ...tab.scroll },
                    selection: selection(tab)
                };

            if (dirty(tab) || tab.missing) {
                item.draft = tab.document.value;
            }

            tabs.push(item);
        }

        return {
            active: state.active && !state.active.compare ? state.active.path : null,
            explorer: { expanded: [...(explorer.expanded ?? [])], scroll: explorer.scroll ?? 0 },
            tabs
        };
    }

    async function fetch(path: string, entry: Baseline) {
        let cwd = model.state.cwd,
            request = ++entry.request,
            text: string | null = null;

        try {
            text = await host.baseline!(cwd, path);
        }
        catch (error) {
            if (baselines.get(path) === entry) {
                model.status(`Could not read the baseline of ${path}: ${message(error)}`, true);
            }
        }

        if (!disposed && baselines.get(path) === entry && entry.request === request && cwd === model.state.cwd) {
            write(entry.text, typeof text === 'string' ? text : null);
            mark();
        }
    }

    function flush() {
        clearTimeout(timer);
        timer = undefined;
        mark();

        if (!restored || !host.session) {
            return;
        }

        let session = capture(),
            json = JSON.stringify(session);

        if (json === last) {
            return;
        }

        last = json;
        host.session.set(session).catch((error) => {
            last = '';
            model.status(`Could not save the session: ${message(error)}`, true);
        });
    }

    function mark() {
        let entries: [string, Decoration][] = [],
            tabs = model.state.tabs;

        for (let i = 0, n = tabs.length; i < n; i++) {
            let tab = tabs[i],
                baseline = baselines.get(tab.path),
                counts = problems.get(tab),
                decoration: Decoration = {},
                text = baseline && untrack(() => read(baseline.text));

            if (typeof text === 'string' && text !== tab.document.value) {
                decoration.status = 'modified';
            }

            if (counts?.errors) {
                decoration.errors = counts.errors;
            }

            if (counts?.warnings) {
                decoration.warnings = counts.warnings;
            }

            if (decoration.errors || decoration.status || decoration.warnings) {
                entries.push([tab.path, decoration]);
            }
        }

        marks.replace(entries);
    }

    async function reopen(session: WorkspaceSession) {
        let cwd = model.state.cwd;

        for (let i = 0, n = session.tabs.length; i < n; i++) {
            let item = session.tabs[i],
                content: string | undefined,
                path: string;

            try {
                path = workspacePath(item.path, cwd);
            }
            catch {
                continue;
            }

            try {
                content = await host.read(cwd, path);
            }
            catch {
                content = undefined;
            }

            if (disposed || cwd !== model.state.cwd) {
                return;
            }

            // A file gone from disk comes back only for the draft it held.
            if (content === undefined && item.draft === undefined) {
                continue;
            }

            let tab = model.adopt(path, item.draft ?? content!, content ?? '', content === undefined);

            if (!tab) {
                continue;
            }

            let length = tab.document.value.length,
                anchor = offset(item.selection.anchor, length),
                head = offset(item.selection.head, length);

            if (item.pinned) {
                model.pin(path);
            }
            else {
                tab.preview = item.preview;
            }

            tab.scroll = { ...item.scroll };
            tab.document.select({ direction: head < anchor ? 'backward' : 'forward', end: Math.max(anchor, head), start: Math.min(anchor, head) });

            if (item.folds.length) {
                pending.set(tab, item.folds);
            }
        }

        // Whatever the user opened meanwhile stays in front.
        if (session.active && !model.state.active && !model.state.opening.length) {
            model.activate(session.active);
        }
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(flush, delay);
    }

    function settle(tab: WorkspaceTab, controller: WorkspaceEditorController | undefined) {
        let list = waiters.get(tab);

        waiters.delete(tab);

        for (let i = 0, n = list?.length ?? 0; i < n; i++) {
            list![i](controller);
        }
    }

    function sync() {
        let open = new Set<string>(),
            tabs = model.state.tabs;

        for (let i = 0, n = tabs.length; i < n; i++) {
            let tab = tabs[i];

            open.add(tab.path);

            if (!documents.has(tab)) {
                documents.set(tab, tab.document.subscribe((_, change) => {
                    if (change.selectionChanged || change.textChanged) {
                        schedule();
                    }
                }));
            }

            if (!host.baseline) {
                continue;
            }

            let entry = baselines.get(tab.path);

            if (!entry) {
                track(tab);
            }
            else if (entry.saved !== tab.saved) {
                entry.saved = tab.saved;
                entry.fetched = fetch(tab.path, entry);
            }
        }

        for (let [tab, stop] of documents) {
            if (!tabs.includes(tab)) {
                stop();
                documents.delete(tab);
                problems.delete(tab);
                settle(tab, undefined);
            }
        }

        for (let path of [...baselines.keys()]) {
            if (!open.has(path)) {
                baselines.delete(path);
            }
        }

        schedule();
    }

    function track(tab: WorkspaceTab) {
        let entry: Baseline = { fetched: Promise.resolve(), request: 0, saved: tab.saved, text: signal<string | null>(null) };

        baselines.set(tab.path, entry);
        entry.fetched = fetch(tab.path, entry);

        return entry;
    }

    function watched(event: WorkspaceChange) {
        for (let [path, entry] of baselines) {
            if (!event.paths || event.paths.some((changed) => containsPath(changed, path))) {
                entry.fetched = fetch(path, entry);
            }
        }
    }

    return {
        // The text the tab's git gutter diffs against; reactive, so the editor's options follow it once fetched.
        baseline(path: string) {
            if (!host.baseline) {
                return undefined;
            }

            // An editor can ask before the workspace has heard of the path, as it does mid-rename.
            let entry = baselines.get(path) ?? untrack(() => {
                let tab = model.state.tabs.find((item) => item.path === path);

                return tab && track(tab);
            });

            return entry ? read(entry.text) : null;
        },
        connect(element: HTMLElement) {
            let listening = new AbortController(),
                unsubscribe = model.subscribe(sync),
                unwatch = model.onWatch(watched);

            // Scrolling, folding and opening folders tell nothing else, so any gesture in the workspace may be one.
            element.addEventListener('keyup', schedule, { capture: true, passive: true, signal: listening.signal });
            element.addEventListener('pointerup', schedule, { capture: true, passive: true, signal: listening.signal });
            element.addEventListener('scroll', schedule, { capture: true, passive: true, signal: listening.signal });
            // Hot exit: a closing page never disconnects the workspace.
            element.ownerDocument.defaultView?.addEventListener('pagehide', flush, { signal: listening.signal });
            sync();

            return () => {
                listening.abort();
                unsubscribe();
                unwatch();
                flush();
                stopProblems?.();
                stopProblems = undefined;

                for (let stop of documents.values()) {
                    stop();
                }

                documents.clear();
            };
        },
        dispose() {
            flush();
            disposed = true;
        },
        explorer,
        export: host.export && ((element: FileTreeElement) => host.export!(model.state.cwd, element.id)),
        flush,
        import: host.import && (async (target: FileTreeElement | null, entries: readonly FileTreeImportEntry[]) => {
            let folder = !target ? '' : target.type === 'file' ? target.id.slice(0, Math.max(0, target.id.lastIndexOf('/'))) : target.id;

            try {
                await host.import!(model.state.cwd, folder, entries);
            }
            catch (error) {
                model.status(`Import failed: ${message(error)}`, true);
                return;
            }

            model.status(`Imported ${entries.length === 1 ? entries[0].path : `${entries.length} items`}`);
            await model.refresh();
        }),
        // The tab's baseline once its latest fetch is in; null for none.
        async loaded(path: string) {
            let entry = baselines.get(path);

            while (entry && baselines.get(path) === entry) {
                let fetched = entry.fetched;

                await fetched;

                if (fetched === entry.fetched) {
                    break;
                }
            }

            return entry && baselines.get(path) === entry ? untrack(() => read(entry.text)) : null;
        },
        mark,
        marks,
        ready: () => read(ready),
        // The shown tab is leaving its editor: its folds stay with it.
        remember(tab: WorkspaceTab, controller: WorkspaceEditorController) {
            if (code(controller)) {
                folded.set(tab, controller.folds());
            }
        },
        // Starts the model, then brings back the stored session once; nothing is written until it's back.
        restore() {
            if (!host.session || restored) {
                return model.start();
            }

            return restoring ??= (async () => {
                let loading = model.start(),
                    session: WorkspaceSession | null = null;

                try {
                    session = parse(await host.session!.get());
                }
                catch (error) {
                    model.status(`Could not restore the session: ${message(error)}`, true);
                }

                await loading;

                if (disposed) {
                    return;
                }

                if (session) {
                    explorer.expanded = session.explorer.expanded;
                    explorer.scroll = session.explorer.scroll;
                    last = JSON.stringify(session);
                }

                write(ready, true);

                try {
                    if (session) {
                        await reopen(session);
                    }
                }
                finally {
                    restored = true;
                }
            })();
        },
        // A tab's editor is showing it, scrolled where it was left; folds come first, since they change the height.
        shown(tab: WorkspaceTab, controller: WorkspaceEditorController) {
            let lines = pending.get(tab);

            pending.delete(tab);

            if (code(controller)) {
                for (let i = 0, n = lines?.length ?? 0; i < n; i++) {
                    controller.fold(lines![i]);
                }

                stopProblems?.();
                stopProblems = root((dispose) => {
                    effect(() => {
                        let { errors, warnings } = controller.state.problems;

                        untrack(() => {
                            if (current()?.tab === tab) {
                                problems.set(tab, { errors, warnings });
                                mark();
                            }
                        });
                    });

                    return dispose;
                });
            }

            settle(tab, controller);
        },
        // Resolves once an editor shows the tab, or with undefined when the tab closes first.
        whenShown(tab: WorkspaceTab) {
            let shown = current();

            if (shown?.tab === tab) {
                return Promise.resolve(shown.controller);
            }

            return new Promise<WorkspaceEditorController | undefined>((resolve) => {
                let list = waiters.get(tab) ?? [];

                list.push(resolve);
                waiters.set(tab, list);
            });
        }
    };
};


export default hosted;
export { parse };
export type { Shown };
