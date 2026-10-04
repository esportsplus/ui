export type Selection = Readonly<{ start: number; end: number; direction: 'forward' | 'backward' | 'none' }>;
export type Edit = Readonly<{ from: number; to: number; insert: string }>;
export type Change = Readonly<{
    source: string;
    textChanged: boolean;
    selectionChanged: boolean;
    editBatches?: readonly (readonly Edit[])[];
}>;
export type Snapshot = Readonly<{
    value: string;
    selection: Selection;
    selections: readonly Selection[];
    revision: number;
    lineCount: number;
    dirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
}>;
export type TransactionOptions = {
    source?: string;
    selection?: Partial<Selection>;
    selections?: readonly Partial<Selection>[];
    /** Adjacent native typing/deletion only; commands are separate undo steps. */
    group?: string;
    time?: number;
};
export type TransactionResult = Readonly<
    | { accepted: true; changed: boolean }
    | { accepted: false; reason: 'invalid-range' | 'overlap' | 'invalid-insert'; index: number }
>;
type Patch = { from: number; removed: string; insert: string };
type Entry = {
    patches: Patch[][];
    before: readonly Selection[];
    after: readonly Selection[];
    group?: string;
    time: number;
    bytes: number;
};

export function clamp(value: number, max: number) {
    return Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));
}

export function selection(value: Partial<Selection>, length: number): Selection {
    let start = clamp(value.start ?? 0, length),
        end = clamp(value.end ?? start, length);

    return Object.freeze({
        start: Math.min(start, end),
        end: Math.max(start, end),
        direction: value.direction ?? 'none'
    });
}

export function sameSelection(a: Selection, b: Selection) {
    return a.start === b.start && a.end === b.end && a.direction === b.direction;
}

/** Index in UTF-16 source offsets, including CRLF and lone CR as single line breaks. */
export function lineStarts(text: string) {
    let starts = [0];

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\r') {
            if (text[i + 1] === '\n') i++;
            starts.push(i + 1);
        } else if (text[i] === '\n') starts.push(i + 1);
    }

    return starts;
}

/** Last array index whose value is <= offset. */
export function floorIndex(starts: readonly number[], offset: number) {
    let lo = 0,
        hi = starts.length;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;
        if (starts[mid] <= offset) lo = mid + 1;
        else hi = mid;
    }

    return lo - 1;
}

export function lineEnd(text: string, starts: readonly number[], index: number) {
    let end = starts[index + 1] ?? text.length;
    if (end > starts[index] && text[end - 1] === '\n') end--;
    if (end > starts[index] && text[end - 1] === '\r') end--;
    return end;
}

export function preferredEol(text: string) {
    return /\r\n|\r|\n/.exec(text)?.[0] ?? '\n';
}

/** Pure document with bounded patch history. No DOM or reactive runtime is needed. */
export class EditorDocument {
    #value: string;
    #saved: string;
    #selection = selection({}, 0);
    #selections: readonly Selection[] = Object.freeze([this.#selection]);
    #starts: number[];
    #revision = 0;
    #undo: Entry[] = [];
    #redo: Entry[] = [];
    #listeners = new Set<(state: Snapshot, change: Change) => void>();
    #bytes = 0;
    #limit: number;
    #byteLimit: number;
    #boundary = false;
    #selectionUndo: (readonly Selection[])[] = [];
    #selectionRedo: (readonly Selection[])[] = [];

    constructor(value = '', history: { limit?: number; bytes?: number } = {}) {
        this.#value = this.#saved = value;
        this.#starts = lineStarts(value);
        this.#limit = clamp(history.limit ?? 200, 10000);
        this.#byteLimit = clamp(history.bytes ?? 8_000_000, Number.MAX_SAFE_INTEGER);
    }

    get value() {
        return this.#value;
    }
    get selection() {
        return this.#selection;
    }
    get selections() {
        return this.#selections;
    }
    get starts(): readonly number[] {
        return this.#starts;
    }
    get state(): Snapshot {
        return Object.freeze({
            value: this.#value,
            selection: this.#selection,
            selections: this.#selections,
            revision: this.#revision,
            lineCount: this.#starts.length,
            dirty: this.#value !== this.#saved,
            canUndo: this.#undo.length > 0,
            canRedo: this.#redo.length > 0
        });
    }

    subscribe(listener: (state: Snapshot, change: Change) => void) {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }

    #emit(
        source: string,
        textChanged: boolean,
        before: readonly Selection[],
        editBatches?: readonly (readonly Edit[])[]
    ) {
        let change = Object.freeze({
                source,
                textChanged,
                editBatches,
                selectionChanged: !sameSelections(before, this.#selections)
            }),
            state = this.state;
        for (let listener of [...this.#listeners]) listener(state, change);
    }

    select(next: Partial<Selection>, source = 'selection') {
        this.selectMany([next], source);
    }

    /** Primary range is first. Overlapping ranges merge; duplicate carets are removed. */
    selectMany(next: readonly Partial<Selection>[], source = 'selection') {
        let before = this.#selections;
        this.#assignSelections(next, this.#value.length);
        if (sameSelections(before, this.#selections)) return;
        this.#selectionUndo.push(before);
        if (this.#selectionUndo.length > 200) this.#selectionUndo.shift();
        this.#selectionRedo = [];
        this.#boundary = true;
        this.#emit(source, false, before);
    }

    undoSelection() {
        return this.#travelSelection(false);
    }
    redoSelection() {
        return this.#travelSelection(true);
    }
    #travelSelection(redo: boolean) {
        let next = (redo ? this.#selectionRedo : this.#selectionUndo).pop();
        if (!next) return false;
        let before = this.#selections;
        (redo ? this.#selectionUndo : this.#selectionRedo).push(before);
        this.#assignSelections(next, this.#value.length);
        this.#boundary = true;
        this.#emit(redo ? 'redoSelection' : 'undoSelection', false, before);
        return true;
    }

    #assignSelections(next: readonly Partial<Selection>[], length: number) {
        this.#selections = normalizeSelections(next, length);
        this.#selection = this.#selections[0];
    }

    /** Boolean compatibility API: false means rejected or no text change. See tryTransact for details. */
    transact(edits: readonly Edit[], options: TransactionOptions = {}): boolean {
        let result = this.tryTransact(edits, options);
        return result.accepted && result.changed;
    }

    /** All ranges refer to the original document. Validation rejection changes nothing and emits nothing. */
    tryTransact(edits: readonly Edit[], options: TransactionOptions = {}): TransactionResult {
        let sorted = edits.map((edit, index) => ({ edit, index })).sort((a, b) => a.edit.from - b.edit.from),
            previous = -1;
        for (let { edit, index } of sorted) {
            if (
                !Number.isInteger(edit.from) ||
                !Number.isInteger(edit.to) ||
                edit.from < 0 ||
                edit.to < edit.from ||
                edit.to > this.#value.length
            )
                return { accepted: false, reason: 'invalid-range', index };
            if (typeof edit.insert !== 'string') return { accepted: false, reason: 'invalid-insert', index };
            if (edit.from < previous) return { accepted: false, reason: 'overlap', index };
            previous = edit.to;
        }
        let patches = sorted
                .map(({ edit: { from, to, insert } }) => ({ from, removed: this.#value.slice(from, to), insert }))
                .filter((patch) => patch.removed !== patch.insert),
            before = this.#selections,
            next = this.#value;
        next = applyPatches(next, patches);
        let map = (position: number) => {
            let delta = 0;
            for (let patch of patches) {
                if (position < patch.from) break;
                if (position <= patch.from + patch.removed.length) return patch.from + delta + patch.insert.length;
                delta += patch.insert.length - patch.removed.length;
            }
            return position + delta;
        };
        this.#assignSelections(
            options.selections ??
                (options.selection
                    ? [options.selection]
                    : before.map((range) => ({
                          start: map(range.start),
                          end: map(range.end),
                          direction: range.direction
                      }))),
            next.length
        );
        if (!patches.length) {
            if (!sameSelections(before, this.#selections)) this.#emit(options.source ?? 'command', false, before);
            return { accepted: true, changed: false };
        }
        this.#selectionUndo = [];
        this.#selectionRedo = [];
        this.#value = next;
        this.#starts = lineStarts(next);
        this.#revision++;
        let time = options.time ?? Date.now(),
            bytes = patches.reduce((sum, patch) => sum + 2 * (patch.insert.length + patch.removed.length), 0),
            last = this.#undo.at(-1),
            group = options.group;
        // Dropping redo also releases its memory from the shared budget.
        for (let entry of this.#redo) this.#bytes -= entry.bytes;
        this.#redo = [];
        if (
            !this.#boundary &&
            group &&
            last?.group === group &&
            time - last.time >= 0 &&
            time - last.time < 750 &&
            sameSelections(before, last.after) &&
            !patches.some((patch) => /[\r\n]/.test(patch.insert + patch.removed))
        ) {
            last.patches.push(patches);
            last.after = this.#selections;
            last.time = time;
            last.bytes += bytes;
        } else this.#undo.push({ patches: [patches], before, after: this.#selections, group, time, bytes });
        this.#boundary = false;
        this.#bytes += bytes;
        while (this.#undo.length > this.#limit || this.#bytes > this.#byteLimit) {
            this.#bytes -= this.#undo.shift()!.bytes;
        }
        this.#emit(options.source ?? 'command', true, before, [
            patches.map((p) => ({ from: p.from, to: p.from + p.removed.length, insert: p.insert }))
        ]);
        return { accepted: true, changed: true };
    }

    replace(from: number, to: number, insert: string, options: TransactionOptions = {}) {
        return this.transact([{ from, to, insert }], options);
    }

    setValue(value: string, options: TransactionOptions = {}) {
        return this.replace(0, this.#value.length, value, {
            selections: this.#selections,
            source: 'setValue',
            ...options
        });
    }

    /** A new document baseline: drops history and starts clean, preserving source verbatim. */
    reset(value = '', next: Partial<Selection> = {}) {
        let before = this.#selections,
            changed = value !== this.#value;
        this.#value = this.#saved = value;
        this.#starts = lineStarts(value);
        this.#assignSelections([next], value.length);
        this.#selectionUndo = [];
        this.#selectionRedo = [];
        this.#undo = [];
        this.#redo = [];
        this.#bytes = 0;
        this.#boundary = true;
        if (changed) this.#revision++;
        this.#emit('reset', changed, before);
    }

    #travel(redo: boolean) {
        let entry = (redo ? this.#redo : this.#undo).pop();
        if (!entry) return false;
        let before = this.#selections,
            editBatches: Edit[][] = [];
        for (let patches of redo ? entry.patches : [...entry.patches].reverse()) {
            let delta = 0,
                ranges = patches.map((patch) => {
                    let from = patch.from + (redo ? 0 : delta);
                    delta += patch.insert.length - patch.removed.length;
                    return {
                        from,
                        removed: redo ? patch.removed : patch.insert,
                        insert: redo ? patch.insert : patch.removed
                    };
                });
            editBatches.push(ranges.map((p) => ({ from: p.from, to: p.from + p.removed.length, insert: p.insert })));
            this.#value = applyPatches(this.#value, ranges);
        }
        this.#selectionUndo = [];
        this.#selectionRedo = [];
        this.#assignSelections(redo ? entry.after : entry.before, this.#value.length);
        this.#starts = lineStarts(this.#value);
        this.#revision++;
        (redo ? this.#undo : this.#redo).push(entry);
        this.#boundary = true;
        this.#emit(redo ? 'redo' : 'undo', true, before, editBatches);
        return true;
    }

    undo() {
        return this.#travel(false);
    }
    redo() {
        return this.#travel(true);
    }
    breakHistory() {
        this.#boundary = true;
    }
    markSaved() {
        this.#saved = this.#value;
        this.#boundary = true;
        this.#emit('saved', false, this.#selections);
    }

    position(offset = this.#selection.direction === 'backward' ? this.#selection.start : this.#selection.end) {
        offset = clamp(offset, this.#value.length);
        let index = floorIndex(this.#starts, offset);
        return {
            line: index + 1,
            column: Math.min(offset, lineEnd(this.#value, this.#starts, index)) - this.#starts[index] + 1
        };
    }

    offset(line: number, column = 1) {
        let index = clamp(line - 1, this.#starts.length - 1),
            start = this.#starts[index];
        return start + clamp(column - 1, lineEnd(this.#value, this.#starts, index) - start);
    }
}

export function sameSelections(a: readonly Selection[], b: readonly Selection[]) {
    return a.length === b.length && a.every((range, index) => sameSelection(range, b[index]));
}

export function normalizeSelections(ranges: readonly Partial<Selection>[], length: number): readonly Selection[] {
    let original = ranges.length ? ranges.map((range) => selection(range, length)) : [selection({}, length)],
        primary = original[0],
        sorted = [...original].sort((a, b) => a.start - b.start || a.end - b.end),
        merged: Selection[] = [];
    for (let range of sorted) {
        let last = merged.at(-1);
        if (last && (range.start < last.end || (range.start === last.start && range.end === last.end))) {
            merged[merged.length - 1] = selection(
                { start: last.start, end: Math.max(last.end, range.end), direction: last.direction },
                length
            );
        } else merged.push(range);
    }
    let index = merged.findIndex((range) => range.start <= primary.start && range.end >= primary.end);
    if (index > 0) merged.unshift(...merged.splice(index, 1));
    return Object.freeze(merged);
}

function applyPatches(value: string, patches: readonly Patch[]) {
    let chunks: string[] = [],
        cursor = 0;
    for (let patch of patches) {
        chunks.push(value.slice(cursor, patch.from), patch.insert);
        cursor = patch.from + patch.removed.length;
    }
    chunks.push(value.slice(cursor));
    return chunks.join('');
}
