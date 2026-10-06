import { ReactiveArray } from '@esportsplus/reactivity';
import type { Edit, EditorDocument } from '../document';
import type { Mark } from '../rows';
import { spanOf } from './model';
import type { Diagnostic } from './protocol';


type Diagnostics = {
    // Sorted by offset.
    readonly all: readonly Entry[];
    clear: VoidFunction;
    readonly count: number;
    hit: (from: number, to: number) => Entry[];
    map: (batches: readonly (readonly Edit[])[]) => void;
    marks: (from: number, to: number) => readonly Mark[];
    problems: ReactiveArray<Entry>;
    publish: (doc: EditorDocument, list: readonly Diagnostic[]) => void;
};

type Entry = {
    from: number;
    kind: string;
    label: string;
    message: string;
    severity: Severity;
    to: number;
};

type Severity = 'error' | 'hint' | 'info' | 'warning';


// Squiggles drawn; a server flooding a file can't stall painting.
const LIMIT = 1000;

const SEVERITIES: Severity[] = ['error', 'error', 'warning', 'info', 'hint'];


// The published diagnostics: squiggles are marks on the rendered rows, so they sit on the glyphs, wrap and scroll
// with them at no cost of their own. 'problems' lists them for the panel below the editor; 'changed' hears of every
// new list.
const diagnostics = ({ changed }: { changed?: (entries: readonly Entry[]) => void } = {}): Diagnostics => {
    let entries: Entry[] = [],
        problems = new ReactiveArray<Entry>();

    function set(next: Entry[]) {
        entries = next;
        problems.splice(0, problems.length, ...next);
        changed?.(next);
    }

    let api: Diagnostics = {
        get all() {
            return entries;
        },
        clear: () => {
            if (entries.length) {
                set([]);
            }
        },
        get count() {
            return entries.length;
        },
        // Diagnostics over the source range [from, to).
        hit: (from: number, to: number) => entries.filter((entry) => entry.from < to && entry.to > from),
        // Shifts the squiggles past each edit; one an edit touches is dropped until the server reports again.
        map: (batches: readonly (readonly Edit[])[]) => {
            if (!entries.length) {
                return;
            }

            let next = entries;

            for (let i = 0, n = batches.length; i < n; i++) {
                let batch = batches[i],
                    kept: Entry[] = [];

                for (let j = 0, m = next.length; j < m; j++) {
                    let entry = next[j],
                        shift = 0,
                        touched = false;

                    for (let k = 0, o = batch.length; k < o; k++) {
                        let edit = batch[k];

                        if (edit.to <= entry.from) {
                            shift += edit.insert.length - (edit.to - edit.from);
                        }
                        // Typing just past a squiggle leaves it; an insertion inside or a change over it doesn't.
                        else if (edit.from < entry.to && (edit.from < edit.to || edit.from > entry.from)) {
                            touched = true;
                            break;
                        }
                    }

                    if (!touched) {
                        entry.from += shift;
                        entry.to += shift;
                        kept.push(entry);
                    }
                }

                next = kept;
            }

            if (next.length !== entries.length) {
                set(next);
            }
        },
        // Those overlapping the source range [from, to], for the rows painting it.
        marks: (from: number, to: number) => {
            let out: Mark[] = [];

            for (let i = 0, n = entries.length; i < n; i++) {
                let entry = entries[i];

                if (entry.to >= from && entry.from <= to) {
                    out.push(entry);
                }
            }

            return out;
        },
        problems,
        publish: (doc: EditorDocument, list: readonly Diagnostic[]) => {
            let next: Entry[] = [];

            for (let i = 0, n = list.length; i < n && next.length < LIMIT; i++) {
                let diagnostic = list[i],
                    span = typeof diagnostic?.message === 'string' && diagnostic.range ? spanOf(doc, diagnostic.range) : null;

                if (!span) {
                    continue;
                }

                // An empty range still marks the character it points at, or the one before it at a line's end.
                if (span.from === span.to) {
                    let line = doc.lineAt(span.from);

                    if (span.to < doc.lineEnd(line)) {
                        span.to++;
                    }
                    else if (span.from > doc.lineStart(line)) {
                        span.from--;
                    }
                }

                let severity = SEVERITIES[diagnostic.severity ?? 1] ?? 'error';

                next.push({
                    from: span.from,
                    kind: `code-editor-diagnostic code-editor-diagnostic--${severity}`,
                    label: diagnostic.source ? `${diagnostic.source}: ${diagnostic.message}` : diagnostic.message,
                    message: diagnostic.message,
                    severity,
                    to: span.to
                });
            }

            set(next.sort((a, b) => a.from - b.from));
        }
    };

    return api;
};


export { diagnostics };
export type { Diagnostics, Entry };
