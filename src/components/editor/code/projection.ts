import { clamp } from '~/shared/clamp';
import { preferredEol, type Edit, type Selection } from './document';


// What 'beforeinput' saw of the textarea: its selection and length.
type Before = { end: number; length: number; start: number };

// A fold's placeholder in native offsets, with the source range it stands for.
type Placeholder = { at: number; from: number; to: number };

// Source ranges the native text drops, struct-of-arrays so a keystroke shifts numbers rather than objects: a CR ahead
// of its LF (insert 0) or a fold, shown as one ellipsis (insert 1).
type Removals = {
    ends: number[];
    inserts: number[];
    natives: number[];
    starts: number[];
};


const ELLIPSIS = '…';

const EMPTY: Removals = { ends: [], inserts: [], natives: [], starts: [] };

// Inputs that replace the selection with their data, or with a line break.
const INSERTS = new Set(['insertLineBreak', 'insertParagraph', 'insertReplacementText', 'insertText']);

const LINE_BREAKS = /\r\n?/g;

const NO_EDIT: Edit = { from: 0, insert: '', to: 0 };


// Last removal whose 'key' value is below 'offset'.
function below(values: readonly number[], offset: number) {
    let hi = values.length,
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if (values[mid] < offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    return lo - 1;
}

function build(source: string, hidden: readonly { from: number; to: number }[]) {
    let chunks: string[] = [],
        cr = source.indexOf('\r'),
        cursor = 0,
        folds = hidden.length > 1 ? [...hidden].sort((a, b) => a.from - b.from) : hidden,
        i = 0,
        removals: Removals = { ends: [], inserts: [], natives: [], starts: [] },
        removed = 0;

    if (cr < 0 && !folds.length) {
        return { removals: EMPTY, value: source };
    }

    for (;;) {
        let fold = folds[i];

        if (fold && (fold.from < cursor || fold.to <= fold.from || fold.to > source.length)) {
            i++;
            continue;
        }

        if (fold && (cr < 0 || fold.from <= cr)) {
            chunks.push(source.slice(cursor, fold.from), ELLIPSIS);
            push(removals, fold.from, fold.to, 1, fold.from - removed);
            removed += fold.to - fold.from - 1;
            cursor = fold.to;
            i++;

            if (cr >= 0 && cr < cursor) {
                cr = source.indexOf('\r', cursor);
            }

            continue;
        }

        if (cr < 0) {
            break;
        }

        if (source.charCodeAt(cr + 1) === 10) {
            chunks.push(source.slice(cursor, cr));
            push(removals, cr, cr + 1, 0, cr - removed);
            removed++;
        }
        else {
            chunks.push(source.slice(cursor, cr), '\n');
        }

        cursor = cr + 1;
        cr = source.indexOf('\r', cursor);
    }

    chunks.push(source.slice(cursor));

    return { removals, value: chunks.join('') };
}

function push(removals: Removals, start: number, end: number, insert: number, native: number) {
    removals.ends.push(end);
    removals.inserts.push(insert);
    removals.natives.push(native);
    removals.starts.push(start);
}


// Textareas normalize CR and CRLF to LF and show each fold as one ellipsis; this maps that native text to the exact
// source and back, without touching the source.
class NativeText {
    readonly length: number;
    readonly value: string;
    private removals: Removals;


    constructor(
        source: string,
        hidden: readonly { from: number; to: number }[] = [],
        // An incrementally built text from 'apply'.
        built?: { removals: Removals; value: string }
    ) {
        let { removals, value } = built ?? build(source, hidden);

        this.length = source.length;
        this.removals = removals;
        this.value = value;
    }


    // True when the native text is the source itself: no CR and no fold.
    get identity() {
        return this.removals.starts.length === 0;
    }

    // The next projection after one source edit, rescanning only around it; null when a fold sits next to the edit or
    // more than one edit landed, where the caller rebuilds.
    apply(source: string, edit: Edit): NativeText | null {
        let { ends, inserts, natives, starts } = this.removals,
            delta = edit.insert.length - (edit.to - edit.from),
            end = edit.from + edit.insert.length,
            from = Math.max(0, edit.from - 1),
            to = Math.min(source.length, end + 1);

        // Never split a CRLF at either edge of the rescanned window.
        if (from > 0 && source.charCodeAt(from - 1) === 13 && source.charCodeAt(from) === 10) {
            from--;
        }

        if (to < source.length && source.charCodeAt(to - 1) === 13 && source.charCodeAt(to) === 10) {
            to++;
        }

        let old = to - delta,
            first = below(starts, from) + 1,
            last = below(starts, old);

        for (let k = Math.max(0, first - 1), n = Math.min(starts.length, last + 2); k < n; k++) {
            if (inserts[k] && starts[k] < old + 1 && ends[k] > from - 1) {
                return null;
            }
        }

        let nativeFrom = this.toNative(from),
            nativeTo = this.toNative(old),
            window = source.slice(from, to),
            next: Removals = { ends: [], inserts: [], natives: [], starts: [] },
            text = window.indexOf('\r') < 0 ? window : window.replace(LINE_BREAKS, '\n'),
            shift = text.length - (nativeTo - nativeFrom);

        for (let k = 0; k < first; k++) {
            push(next, starts[k], ends[k], inserts[k], natives[k]);
        }

        for (let cr = window.indexOf('\r'), removed = 0; cr >= 0; cr = window.indexOf('\r', cr + 1)) {
            if (window.charCodeAt(cr + 1) === 10) {
                push(next, from + cr, from + cr + 1, 0, nativeFrom + cr - removed);
                removed++;
            }
        }

        for (let k = last + 1, n = starts.length; k < n; k++) {
            push(next, starts[k] + delta, ends[k] + delta, inserts[k], natives[k] + shift);
        }

        return new NativeText(source, [], {
            removals: next.starts.length ? next : EMPTY,
            value: this.value.slice(0, nativeFrom) + text + this.value.slice(nativeTo)
        });
    }

    // A minimal anchored diff that keeps untouched line endings, mixed EOL documents included. The fallback when an
    // input can't be read from 'beforeinput' alone.
    edit(source: string, value: string, before?: Pick<Selection, 'end' | 'start'>, inputType = ''): Edit {
        let old = this.value;

        if (old === value) {
            return NO_EDIT;
        }

        // Without a direction, an edit among repeated characters can land at the wrong offset.
        if (before && before.start === before.end) {
            let removed = old.length - value.length;

            if (removed > 0 && inputType.endsWith('Backward')) {
                before = { ...before, start: this.toSource(Math.max(0, this.toNative(before.start) - removed)) };
            }

            if (removed > 0 && inputType.endsWith('Forward')) {
                before = { ...before, end: this.toSource(this.toNative(before.end) + removed) };
            }
        }

        let from = 0,
            newEnd = value.length,
            oldEnd = old.length,
            prefix = Math.min(old.length, value.length, before ? this.toNative(before.start) : old.length),
            suffix = before ? this.toNative(before.end) : 0;

        while (from < prefix && old.charCodeAt(from) === value.charCodeAt(from)) {
            from++;
        }

        while (oldEnd > Math.max(from, suffix) && newEnd > from && old.charCodeAt(oldEnd - 1) === value.charCodeAt(newEnd - 1)) {
            oldEnd--;
            newEnd--;
        }

        return this.toSourceEdit(source, from, oldEnd, value.slice(from, newEnd));
    }

    // Placeholder edges map to the source boundaries on either side, never to the hidden text.
    placeholders(): Placeholder[] {
        let { ends, inserts, natives, starts } = this.removals,
            out: Placeholder[] = [];

        for (let k = 0, n = starts.length; k < n; k++) {
            if (inserts[k]) {
                out.push({ at: natives[k], from: starts[k], to: ends[k] });
            }
        }

        return out;
    }

    toNative(offset: number): number {
        let { ends, inserts, natives, starts } = this.removals;

        offset = clamp(offset, 0, this.length);

        let k = below(starts, offset);

        if (k < 0) {
            return offset;
        }

        if (offset < ends[k]) {
            return natives[k];
        }

        return offset - ends[k] + natives[k] + inserts[k];
    }

    toSource(offset: number): number {
        let { ends, inserts, natives } = this.removals;

        offset = clamp(offset, 0, this.value.length);

        let k = below(natives, offset);

        if (k < 0) {
            return offset;
        }

        return offset - natives[k] - inserts[k] + ends[k];
    }

    // A native replacement as a source edit; a no-op when it would remove hidden text under a placeholder.
    toSourceEdit(source: string, from: number, to: number, insert: string): Edit {
        let { inserts, natives } = this.removals;

        for (let k = Math.max(0, below(natives, from)), n = natives.length; k < n && natives[k] < to; k++) {
            if (inserts[k] && natives[k] >= from) {
                return NO_EDIT;
            }
        }

        return {
            from: this.toSource(from),
            insert: insert.indexOf('\n') < 0 ? insert : insert.replace(/\n/g, preferredEol(source)),
            to: this.toSource(to)
        };
    }
}


// The native edit an input made, read from what 'beforeinput' saw and the textarea's length and caret afterwards;
// null when they disagree with the input type, and the caller diffs instead.
const inputEdit = (before: Before, after: Before, inputType: string, data: string | null) => {
    let collapsed = before.start === before.end;

    if (INSERTS.has(inputType)) {
        let insert = inputType === 'insertLineBreak' || inputType === 'insertParagraph' ? '\n' : data;

        if (
            insert === null ||
            after.length !== before.length - (before.end - before.start) + insert.length ||
            after.start !== before.start + insert.length ||
            after.end !== after.start
        ) {
            return null;
        }

        return { from: before.start, insert, to: before.end };
    }

    if (!inputType.startsWith('delete')) {
        return null;
    }

    let removed = before.length - after.length,
        from = collapsed ? (inputType.endsWith('Backward') ? before.start - removed : before.start) : before.start,
        to = from + removed;

    if (removed <= 0 || from < 0 || after.start !== from || after.end !== from || (!collapsed && to !== before.end)) {
        return null;
    }

    return { from, insert: '', to };
};


export { inputEdit, NativeText };
export type { Before, Placeholder };
