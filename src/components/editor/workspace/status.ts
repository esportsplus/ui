import { reactive } from '@esportsplus/reactivity';
import type { Edit, EditorDocument, Language, Options, Selection } from '../code';
import type { Status } from '~/components/inline-edit/status';
import { dirty, type EditorWorkspaceModel, type WorkspacePreferences, type WorkspaceTab } from './model';


type AutoSaveMode = WorkspacePreferences['autoSave'];

type Indentation = { size: number; tabs: boolean };

type LineEnding = 'crlf' | 'lf';

type Tracked = {
    dirty: boolean;
    saved: string;
    timer?: ReturnType<typeof setTimeout>;
    unsubscribe: VoidFunction;
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
    private mode: AutoSaveMode = 'off';
    private pending = 0;
    private tabs = new Map<WorkspaceTab, Tracked>();
    private unsubscribe: VoidFunction | undefined;


    constructor(model: EditorWorkspaceModel) {
        this.model = model;
    }


    private edited(tab: WorkspaceTab) {
        let tracked = this.tabs.get(tab);

        if (!tracked || this.mode !== 'delay') {
            return;
        }

        clearTimeout(tracked.timer);
        tracked.timer = undefined;

        if (dirty(tab)) {
            tracked.timer = setTimeout(() => {
                tracked.timer = undefined;
                this.save(tab);
            }, this.model.state.preferences.autoSaveDelay);
        }
    }

    private phase() {
        this.status.phase = this.pending ? 'saving' : this.model.state.tabs.some(dirty) ? 'unsaved' : 'saved';
    }

    // A file deleted from disk is never brought back without being asked.
    private save(tab: WorkspaceTab) {
        if (!dirty(tab) || tab.missing || !this.tabs.has(tab)) {
            return;
        }

        this.pending++;
        this.phase();

        void this.model.save(tab).finally(() => {
            this.pending--;
            this.phase();
        });
    }

    private sync() {
        let state = this.model.state,
            open = new Set(state.tabs),
            previous = this.active;

        for (let [tab, tracked] of this.tabs) {
            if (!open.has(tab)) {
                clearTimeout(tracked.timer);
                tracked.unsubscribe();
                this.tabs.delete(tab);
            }
        }

        for (let i = 0, n = state.tabs.length; i < n; i++) {
            let tab = state.tabs[i],
                tracked = this.tabs.get(tab),
                unsaved = dirty(tab);

            if (!tracked) {
                this.tabs.set(tab, {
                    dirty: unsaved,
                    saved: tab.saved,
                    unsubscribe: tab.document.subscribe((_, change) => {
                        if (change.textChanged) {
                            this.edited(tab);
                        }
                    })
                });
                continue;
            }

            // Only saving turns a draft clean with new saved text; a reload from disk only touches clean tabs.
            if (tracked.dirty && !unsaved && tracked.saved !== tab.saved) {
                this.status.savedAt = Date.now();
            }

            tracked.dirty = unsaved;
            tracked.saved = tab.saved;
        }

        if (state.preferences.autoSave !== this.mode) {
            this.mode = state.preferences.autoSave;

            for (let [tab, tracked] of this.tabs) {
                clearTimeout(tracked.timer);
                tracked.timer = undefined;
                this.edited(tab);
            }
        }

        this.active = state.active;

        if (this.mode === 'focus' && previous && previous !== state.active) {
            this.save(previous);
        }

        this.phase();
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
        this.unsubscribe = this.model.subscribe(() => this.sync());
        this.sync();

        return () => this.disconnect();
    }

    // Pending saves are dropped with it.
    disconnect() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;

        for (let tracked of this.tabs.values()) {
            clearTimeout(tracked.timer);
            tracked.unsubscribe();
        }

        this.active = undefined;
        this.mode = 'off';
        this.tabs.clear();
    }
}


export { AUTO_SAVE_MODES, AutoSave, INDENT_SIZES, indentation, indentLabel, LANGUAGES, lineEndings };
export type { AutoSaveMode, Indentation, LineEnding };
