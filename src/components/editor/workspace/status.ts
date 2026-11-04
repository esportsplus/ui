import { effect, peek, reactive, read, root, signal, untrack, write } from '@esportsplus/reactivity';
import type { Edit, EditorDocument, Language, Options, Selection } from '../code';
import type { Status } from '~/components/inline-edit/status';
import type { EditorWorkspaceModel, WorkspacePreferences, WorkspaceTab } from './model';


type AutoSaveMode = WorkspacePreferences['autoSave'];

type Indentation = { size: number; tabs: boolean };

type LineEnding = 'crlf' | 'lf';

type Tracked = {
    dirty: boolean;
    saved: string;
    stop: VoidFunction;
    timer?: ReturnType<typeof setTimeout>;
};


const AUTO_SAVE_MODES: Record<AutoSaveMode, string> = {
    delay: 'After delay',
    focus: 'On focus change',
    off: 'Off'
};

const INDENT_SIZES = [2, 4, 8];

const LANGUAGES: Record<Language, string> = {
    css: 'CSS',
    html: 'HTML',
    javascript: 'JavaScript',
    json: 'JSON',
    jsonc: 'JSON with Comments',
    jsx: 'JavaScript JSX',
    markdown: 'Markdown',
    plain: 'Plain Text',
    python: 'Python',
    scss: 'SCSS',
    tsx: 'TypeScript JSX',
    typescript: 'TypeScript'
};

const LINE_BREAK = /\r\n|\r|\n/g;


function indentation({ size, tabs }: Indentation): Options {
    return { indent: tabs ? '\t' : ' '.repeat(size), tabSize: size };
}

function indentLabel({ size, tabs }: Indentation) {
    return `${tabs ? 'Tab Size' : 'Spaces'}: ${size}`;
}

// Every break becomes 'eol' in one transaction, so a single undo restores the original endings; carets keep their
// place in the text, and one inside a CRLF lands before it.
function lineEndings(document: EditorDocument, eol: LineEnding) {
    let edits: Edit[] = [],
        insert = eol === 'crlf' ? '\r\n' : '\n',
        shifts = [0],
        text = document.value;

    for (let match of text.matchAll(LINE_BREAK)) {
        if (match[0] !== insert) {
            edits.push({ from: match.index, insert, to: match.index + match[0].length });
            shifts.push(shifts[shifts.length - 1] + insert.length - match[0].length);
        }
    }

    if (!edits.length) {
        return false;
    }

    let map = (offset: number) => {
            let hi = edits.length,
                lo = 0;

            while (lo < hi) {
                let mid = (lo + hi) >>> 1;

                if (edits[mid].to <= offset) {
                    lo = mid + 1;
                }
                else {
                    hi = mid;
                }
            }

            let edit = edits[lo];

            if (edit && edit.from < offset) {
                return edit.from + shifts[lo];
            }

            return offset + shifts[lo];
        },
        selections: Selection[] = document.selections.map((range) => ({ direction: range.direction, end: map(range.end), start: map(range.start) }));

    return document.transact(edits, { selections }).changed;
}


/** Saves dirty tabs by the 'autoSave' preference and reports the workspace's save status, as inline-edit's. */
class AutoSave {
    readonly model: EditorWorkspaceModel;
    readonly status: Status = reactive<Status>({ phase: 'saved', savedAt: null });
    private active: WorkspaceTab | undefined;
    private pending = signal(0);
    private release: VoidFunction | undefined;
    private tabs = new Map<WorkspaceTab, Tracked>();


    constructor(model: EditorWorkspaceModel) {
        this.model = model;
    }


    // Read when an edit, blur or timer happens, so one right after the preference changes already follows it.
    private get mode(): AutoSaveMode {
        return untrack(() => this.model.state.preferences.autoSave);
    }


    private edited(tab: WorkspaceTab) {
        let tracked = this.tabs.get(tab);

        if (!tracked || this.mode !== 'delay') {
            return;
        }

        clearTimeout(tracked.timer);
        tracked.timer = undefined;

        if (tab.dirty) {
            tracked.timer = setTimeout(() => {
                tracked.timer = undefined;

                if (this.mode === 'delay') {
                    this.save(tab);
                }
            }, untrack(() => this.model.state.preferences.autoSaveDelay));
        }
    }

    // A file deleted from disk is never brought back without being asked.
    private save(tab: WorkspaceTab) {
        if (!tab.dirty || tab.missing || !this.tabs.has(tab)) {
            return;
        }

        write(this.pending, peek(this.pending) + 1);

        void this.model.save(tab).finally(() => {
            write(this.pending, peek(this.pending) - 1);
        });
    }

    // Each open tab is followed on its own: its edits restart the delay, and a save that turns it clean stamps the
    // time.
    private track(tab: WorkspaceTab) {
        let tracked: Tracked = { dirty: tab.dirty, saved: tab.saved, stop: () => {} },
            unsubscribe = tab.document.subscribe((_, change) => {
                if (change.textChanged) {
                    this.edited(tab);
                }
            }),
            // Detached, since it lives as long as the tab rather than the effect that saw it open.
            stop = root(() => effect(() => {
                let dirty = tab.dirty,
                    saved = tab.saved;

                // Only saving turns a draft clean with new saved text; a reload from disk only touches clean tabs.
                if (tracked.dirty && !dirty && tracked.saved !== saved) {
                    this.status.savedAt = Date.now();
                }

                tracked.dirty = dirty;
                tracked.saved = saved;
            }));

        tracked.stop = () => {
            clearTimeout(tracked.timer);
            stop();
            unsubscribe();
        };
        this.tabs.set(tab, tracked);
    }


    // The editor lost focus, or with 'all' the window did.
    blur(all = false) {
        if (this.mode !== 'focus') {
            return;
        }

        let tabs = all ? this.model.state.tabs : [this.model.state.active];

        for (let i = 0, n = tabs.length; i < n; i++) {
            let tab = tabs[i];

            if (tab) {
                this.save(tab);
            }
        }
    }

    connect() {
        this.disconnect();
        this.release = root((dispose) => {
            let state = this.model.state;

            effect(() => {
                let tabs = state.tabs;

                untrack(() => {
                    let open = new Set(tabs);

                    for (let [tab, tracked] of this.tabs) {
                        if (!open.has(tab)) {
                            tracked.stop();
                            this.tabs.delete(tab);
                        }
                    }

                    for (let i = 0, n = tabs.length; i < n; i++) {
                        if (!this.tabs.has(tabs[i])) {
                            this.track(tabs[i]);
                        }
                    }
                });
            });

            // Switching to 'delay' schedules the tabs already dirty; switching away cancels them.
            effect(() => {
                state.preferences.autoSave;

                untrack(() => {
                    for (let [tab, tracked] of this.tabs) {
                        clearTimeout(tracked.timer);
                        tracked.timer = undefined;
                        this.edited(tab);
                    }
                });
            });

            // On focus change, the tab left behind is saved.
            effect(() => {
                let active = state.active;

                untrack(() => {
                    let previous = this.active;

                    this.active = active;

                    if (this.mode === 'focus' && previous && previous !== active) {
                        this.save(previous);
                    }
                });
            });

            effect(() => {
                this.status.phase = read(this.pending)
                    ? 'saving'
                    : state.tabs.some((tab) => tab.dirty) ? 'unsaved' : 'saved';
            });

            return dispose;
        });

        return () => this.disconnect();
    }

    // Pending saves are dropped with it.
    disconnect() {
        this.release?.();
        this.release = undefined;

        for (let tracked of this.tabs.values()) {
            tracked.stop();
        }

        this.active = undefined;
        this.tabs.clear();
    }
}


export { AUTO_SAVE_MODES, AutoSave, INDENT_SIZES, indentation, indentLabel, LANGUAGES, lineEndings };
export type { AutoSaveMode, Indentation, LineEnding };
