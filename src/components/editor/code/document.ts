import { clamp } from '~/shared/clamp';


type Change = Readonly<{
    editBatches?: readonly (readonly Edit[])[];
    selectionChanged: boolean;
    source: string;
    textChanged: boolean;
}>;

// One applied batch in line terms: old lines [line, line + removed) became new lines [line, line + inserted); every
// other line kept its text, shifted by the difference. Caches keyed by line follow edits through these.
type Delta = Readonly<{
    edits: readonly Edit[];
    inserted: number;
    line: number;
    removed: number;
}>;

type Edit = Readonly<{ from: number; insert: string; to: number }>;

type Entry = {
    after: readonly Selection[];
    before: readonly Selection[];
    bytes: number;
    group?: string;
    patches: Patch[][];
    time: number;
};

type History = {
    bytes?: number;
    limit?: number;
};

type Listener = (state: Snapshot, change: Change) => void;

type Logged = {
    delta: Delta | null;
    revision: number;
};

type Patch = { from: number; insert: string; removed: string };

type Selection = Readonly<{ direction: 'backward' | 'forward' | 'none'; end: number; start: number }>;

type Snapshot = Readonly<{
    canRedo: boolean;
    canUndo: boolean;
    dirty: boolean;
    lineCount: number;
    revision: number;
    selection: Selection;
    selections: readonly Selection[];
    value: string;
}>;

type TransactionOptions = {
    // Adjacent native typing/deletion only; commands are separate undo steps.
    group?: string;
    selection?: Partial<Selection>;
    selections?: readonly Partial<Selection>[];
    source?: string;
    time?: number;
};

type TransactionResult = Readonly<
    | { accepted: true; changed: boolean }
    | { accepted: false; changed: false; index: number; reason: 'invalid-insert' | 'invalid-range' | 'overlap' }
>;


const EOL = /\r\n|\r|\n/;

const GROUP_WINDOW = 750;

const LINE_BREAK = /[\r\n]/;

const LOG_LIMIT = 64;

const SELECTION_HISTORY = 200;


function applyPatches(value: string, patches: readonly Patch[]) {
    let chunks: string[] = [],
        cursor = 0;

    for (let i = 0, n = patches.length; i < n; i++) {
        let patch = patches[i];

        chunks.push(value.slice(cursor, patch.from), patch.insert);
        cursor = patch.from + patch.removed.length;
    }

    chunks.push(value.slice(cursor));

    return chunks.join('');
}

// Offsets and counts from callers may be fractional, negative or NaN; they settle on an integer in [0, max].
function clampOffset(value: number, max: number) {
    return clamp(Number.isFinite(value) ? Math.trunc(value) : 0, 0, max);
}

function edits(patches: readonly Patch[]): Edit[] {
    return patches.map((patch) => ({ from: patch.from, insert: patch.insert, to: patch.from + patch.removed.length }));
}

// CRLF and a lone CR are single breaks, so a CR only starts a line when no LF follows it.
function isLineStart(text: string, offset: number) {
    let previous = text.charCodeAt(offset - 1);

    return previous === 10 || (previous === 13 && text.charCodeAt(offset) !== 10);
}

// Patches are sorted, disjoint and in pre-edit offsets. A start outside every patch depends only on the two characters
// around it, so only offsets inside each replacement are rescanned and the rest shift.
function reindex(starts: readonly number[], text: string, patches: readonly Patch[]) {
    let cursor = 0,
        first = 0,
        next: number[] = [],
        shift = 0;

    for (let k = 0, n = patches.length; k < n; k++) {
        let { from, insert, removed } = patches[k],
            to = from + removed.length;

        while (cursor < starts.length && (cursor === 0 || starts[cursor] < from)) {
            next.push(starts[cursor++] + shift);
        }

        if (k === 0) {
            first = starts[cursor] === from ? cursor : cursor - 1;
        }

        let at = from + shift;

        for (let p = Math.max(at, next[next.length - 1] + 1), end = at + insert.length; p <= end; p++) {
            if (isLineStart(text, p)) {
                next.push(p);
            }
        }

        while (cursor < starts.length && starts[cursor] <= to) {
            cursor++;
        }

        shift += insert.length - removed.length;
    }

    let line = Math.max(0, first),
        removed = cursor - line,
        inserted = next.length - line;

    for (let n = starts.length; cursor < n; cursor++) {
        next.push(starts[cursor] + shift);
    }

    return { delta: { edits: edits(patches), inserted, line, removed }, starts: next };
}


// Last array index whose value is <= offset.
const floorIndex = (starts: readonly number[], offset: number) => {
    let hi = starts.length,
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if (starts[mid] <= offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    return lo - 1;
};

const lineEnd = (text: string, starts: readonly number[], index: number) => {
    let end = starts[index + 1] ?? text.length,
        start = starts[index];

    if (end > start && text.charCodeAt(end - 1) === 10) {
        end--;
    }

    if (end > start && text.charCodeAt(end - 1) === 13) {
        end--;
    }

    return end;
};

// UTF-16 offsets of every line start; CRLF and a lone CR are single breaks.
const lineStarts = (text: string) => {
    let starts = [0];

    for (let i = 0, n = text.length; i < n; i++) {
        let code = text.charCodeAt(i);

        if (code === 13) {
            if (text.charCodeAt(i + 1) === 10) {
                i++;
            }

            starts.push(i + 1);
        }
        else if (code === 10) {
            starts.push(i + 1);
        }
    }

    return starts;
};

const preferredEol = (text: string) => {
    return EOL.exec(text)?.[0] ?? '\n';
};

const sameSelection = (a: Selection, b: Selection) => {
    return a.start === b.start && a.end === b.end && a.direction === b.direction;
};

const sameSelections = (a: readonly Selection[], b: readonly Selection[]) => {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0, n = a.length; i < n; i++) {
        if (!sameSelection(a[i], b[i])) {
            return false;
        }
    }

    return true;
};

const selection = (value: Partial<Selection>, length: number): Selection => {
    let start = clampOffset(value.start ?? 0, length),
        end = clampOffset(value.end ?? start, length);

    return Object.freeze({
        direction: value.direction ?? 'none',
        end: Math.max(start, end),
        start: Math.min(start, end)
    });
};

// The primary range stays first; overlapping ranges merge and duplicate carets collapse.
const normalizeSelections = (ranges: readonly Partial<Selection>[], length: number): readonly Selection[] => {
    let merged: Selection[] = [],
        original = ranges.length ? ranges.map((range) => selection(range, length)) : [selection({}, length)],
        primary = original[0],
        sorted = original.length > 1 ? [...original].sort((a, b) => a.start - b.start || a.end - b.end) : original;

    for (let i = 0, n = sorted.length; i < n; i++) {
        let last = merged[merged.length - 1],
            range = sorted[i];

        if (last && (range.start < last.end || (range.start === last.start && range.end === last.end))) {
            merged[merged.length - 1] = selection(
                { direction: last.direction, end: Math.max(last.end, range.end), start: last.start },
                length
            );
        }
        else {
            merged.push(range);
        }
    }

    let index = merged.findIndex((range) => range.start <= primary.start && range.end >= primary.end);

    if (index > 0) {
        merged.unshift(...merged.splice(index, 1));
    }

    return Object.freeze(merged);
};


// Pure text with bounded patch history and an incrementally maintained line index; no DOM or reactive runtime.
class EditorDocument {
    private boundary = false;
    private byteLimit: number;
    private bytes = 0;
    private dropped = 0;
    private future: Entry[] = [];
    private index: number[];
    private limit: number;
    private listeners = new Set<Listener>();
    private log: Logged[] = [];
    private past: Entry[] = [];
    private primary = selection({}, 0);
    private ranges: readonly Selection[] = Object.freeze([this.primary]);
    private saved: string;
    private selectionFuture: (readonly Selection[])[] = [];
    private selectionPast: (readonly Selection[])[] = [];
    private text: string;
    private version = 0;


    constructor(value = '', history: History = {}) {
        this.byteLimit = clampOffset(history.bytes ?? 8_000_000, Number.MAX_SAFE_INTEGER);
        this.index = lineStarts(value);
        this.limit = clampOffset(history.limit ?? 200, 10000);
        this.saved = this.text = value;
    }


    private assign(next: readonly Partial<Selection>[], length: number) {
        this.ranges = normalizeSelections(next, length);
        this.primary = this.ranges[0];
    }

    private emit(
        source: string,
        textChanged: boolean,
        before: readonly Selection[],
        editBatches?: readonly (readonly Edit[])[]
    ) {
        let change = Object.freeze({
                editBatches,
                selectionChanged: !sameSelections(before, this.ranges),
                source,
                textChanged
            }),
            state = this.state;

        for (let listener of [...this.listeners]) {
            listener(state, change);
        }
    }

    private record(delta: Delta | null) {
        this.log.push({ delta, revision: this.version });

        if (this.log.length > LOG_LIMIT) {
            this.dropped = this.log.shift()!.revision;
        }
    }

    private travel(redo: boolean) {
        let entry = (redo ? this.future : this.past).pop();

        if (!entry) {
            return false;
        }

        let batches = redo ? entry.patches : [...entry.patches].reverse(),
            before = this.ranges,
            editBatches: (readonly Edit[])[] = [];

        this.version++;

        for (let i = 0, n = batches.length; i < n; i++) {
            let delta = 0,
                ranges: Patch[] = [];

            for (let j = 0, m = batches[i].length; j < m; j++) {
                let patch = batches[i][j];

                ranges.push({
                    from: patch.from + (redo ? 0 : delta),
                    insert: redo ? patch.insert : patch.removed,
                    removed: redo ? patch.removed : patch.insert
                });
                delta += patch.insert.length - patch.removed.length;
            }

            let text = applyPatches(this.text, ranges),
                next = reindex(this.index, text, ranges);

            editBatches.push(next.delta.edits);
            this.index = next.starts;
            this.text = text;
            this.record(next.delta);
        }

        this.selectionFuture = [];
        this.selectionPast = [];
        this.assign(redo ? entry.after : entry.before, this.text.length);
        (redo ? this.past : this.future).push(entry);
        this.boundary = true;
        this.emit(redo ? 'redo' : 'undo', true, before, editBatches);

        return true;
    }

    private travelSelection(redo: boolean) {
        let next = (redo ? this.selectionFuture : this.selectionPast).pop();

        if (!next) {
            return false;
        }

        let before = this.ranges;

        (redo ? this.selectionPast : this.selectionFuture).push(before);
        this.assign(next, this.text.length);
        this.boundary = true;
        this.emit(redo ? 'redoSelection' : 'undoSelection', false, before);

        return true;
    }


    get eol() {
        let end = this.index[1];

        if (end === undefined) {
            return '\n';
        }

        if (this.text.charCodeAt(end - 1) === 13) {
            return '\r';
        }

        return this.text.charCodeAt(end - 2) === 13 ? '\r\n' : '\n';
    }

    get lineCount() {
        return this.index.length;
    }

    get revision() {
        return this.version;
    }

    get selection() {
        return this.primary;
    }

    get selections() {
        return this.ranges;
    }

    // Replaced, never mutated, on each text change: a captured array stays a consistent view of its revision.
    get starts(): readonly number[] {
        return this.index;
    }

    get state(): Snapshot {
        return Object.freeze({
            canRedo: this.future.length > 0,
            canUndo: this.past.length > 0,
            dirty: this.text !== this.saved,
            lineCount: this.index.length,
            revision: this.version,
            selection: this.primary,
            selections: this.ranges,
            value: this.text
        });
    }

    get value() {
        return this.text;
    }

    breakHistory() {
        this.boundary = true;
    }

    // Line-level changes after revision 'since', oldest first; null when the log no longer reaches back that far or a
    // reset replaced the text, in which case a consumer rebuilds from scratch.
    deltas(since: number): readonly Delta[] | null {
        if (since === this.version) {
            return [];
        }

        let log = this.log,
            out: Delta[] = [];

        // A revision's entries may be partly trimmed, so only revisions after the last trimmed one are complete.
        if (since > this.version || since < this.dropped) {
            return null;
        }


        for (let i = 0, n = log.length; i < n; i++) {
            let entry = log[i];

            if (entry.revision <= since) {
                continue;
            }

            if (!entry.delta) {
                return null;
            }

            out.push(entry.delta);
        }

        return out;
    }

    // Zero-based line index containing 'offset'.
    lineAt(offset: number) {
        return floorIndex(this.index, clampOffset(offset, this.text.length));
    }

    lineEnd(line: number) {
        return lineEnd(this.text, this.index, clampOffset(line, this.index.length - 1));
    }

    lineStart(line: number) {
        return this.index[clampOffset(line, this.index.length - 1)];
    }

    lineText(line: number) {
        line = clampOffset(line, this.index.length - 1);

        return this.text.slice(this.index[line], lineEnd(this.text, this.index, line));
    }

    markSaved() {
        this.saved = this.text;
        this.boundary = true;
        this.emit('saved', false, this.ranges);
    }

    offset(line: number, column = 1) {
        let index = clampOffset(line - 1, this.index.length - 1),
            start = this.index[index];

        return start + clampOffset(column - 1, lineEnd(this.text, this.index, index) - start);
    }

    position(offset = this.primary.direction === 'backward' ? this.primary.start : this.primary.end) {
        offset = clampOffset(offset, this.text.length);

        let index = floorIndex(this.index, offset);

        return {
            column: Math.min(offset, lineEnd(this.text, this.index, index)) - this.index[index] + 1,
            line: index + 1
        };
    }

    redo() {
        return this.travel(true);
    }

    redoSelection() {
        return this.travelSelection(true);
    }

    replace(from: number, to: number, insert: string, options: TransactionOptions = {}) {
        return this.transact([{ from, insert, to }], options).changed;
    }

    // A new baseline: drops history and starts clean, keeping the source verbatim.
    reset(value = '', next: Partial<Selection> = {}) {
        let before = this.ranges,
            changed = value !== this.text;

        this.saved = this.text = value;
        this.index = lineStarts(value);
        this.assign([next], value.length);
        this.selectionFuture = [];
        this.selectionPast = [];
        this.future = [];
        this.past = [];
        this.bytes = 0;
        this.boundary = true;

        if (changed) {
            this.version++;
            this.record(null);
        }

        this.emit('reset', changed, before);
    }

    select(next: Partial<Selection>, source = 'selection') {
        this.selectMany([next], source);
    }

    selectMany(next: readonly Partial<Selection>[], source = 'selection') {
        let before = this.ranges;

        this.assign(next, this.text.length);

        if (sameSelections(before, this.ranges)) {
            return;
        }

        this.selectionPast.push(before);

        if (this.selectionPast.length > SELECTION_HISTORY) {
            this.selectionPast.shift();
        }

        this.selectionFuture = [];
        this.boundary = true;
        this.emit(source, false, before);
    }

    setValue(value: string, options: TransactionOptions = {}) {
        return this.replace(0, this.text.length, value, { selections: this.ranges, source: 'setValue', ...options });
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    // Every range refers to the original text. A rejected transaction changes nothing and notifies no one; an
    // accepted one without text changes still applies its selection.
    transact(batch: readonly Edit[], options: TransactionOptions = {}): TransactionResult {
        let length = this.text.length,
            previous = -1,
            sorted = batch.map((edit, index) => ({ edit, index })).sort((a, b) => a.edit.from - b.edit.from);

        for (let i = 0, n = sorted.length; i < n; i++) {
            let { edit, index } = sorted[i];

            if (
                !Number.isInteger(edit.from) ||
                !Number.isInteger(edit.to) ||
                edit.from < 0 ||
                edit.to < edit.from ||
                edit.to > length
            ) {
                return { accepted: false, changed: false, index, reason: 'invalid-range' };
            }

            if (typeof edit.insert !== 'string') {
                return { accepted: false, changed: false, index, reason: 'invalid-insert' };
            }

            if (edit.from < previous) {
                return { accepted: false, changed: false, index, reason: 'overlap' };
            }

            previous = edit.to;
        }

        let before = this.ranges,
            patches: Patch[] = [],
            shifts: number[] = [],
            total = 0;

        for (let i = 0, n = sorted.length; i < n; i++) {
            let { from, insert, to } = sorted[i].edit,
                removed = this.text.slice(from, to);

            if (removed !== insert) {
                patches.push({ from, insert, removed });
                shifts.push(total);
                total += insert.length - removed.length;
            }
        }

        let text = patches.length ? applyPatches(this.text, patches) : this.text;

        shifts.push(total);

        // A position inside or at either edge of a replaced range lands after its insertion.
        let map = (position: number) => {
            let hi = patches.length,
                lo = 0;

            while (lo < hi) {
                let mid = (lo + hi) >>> 1;

                if (patches[mid].from + patches[mid].removed.length < position) {
                    lo = mid + 1;
                }
                else {
                    hi = mid;
                }
            }

            let patch = patches[lo];

            if (patch && patch.from <= position) {
                return patch.from + shifts[lo] + patch.insert.length;
            }

            return position + shifts[lo];
        };

        this.assign(
            options.selections ??
                (options.selection
                    ? [options.selection]
                    : before.map((range) => ({
                          direction: range.direction,
                          end: map(range.end),
                          start: map(range.start)
                      }))),
            text.length
        );

        if (!patches.length) {
            if (!sameSelections(before, this.ranges)) {
                this.emit(options.source ?? 'command', false, before);
            }

            return { accepted: true, changed: false };
        }

        let next = reindex(this.index, text, patches);

        this.selectionFuture = [];
        this.selectionPast = [];
        this.text = text;
        this.index = next.starts;
        this.version++;
        this.record(next.delta);

        let bytes = 0,
            group = options.group,
            last = this.past[this.past.length - 1],
            multiline = false,
            time = options.time ?? Date.now();

        for (let i = 0, n = patches.length; i < n; i++) {
            let patch = patches[i];

            bytes += 2 * (patch.insert.length + patch.removed.length);
            multiline ||= LINE_BREAK.test(patch.insert) || LINE_BREAK.test(patch.removed);
        }

        // Dropping redo also releases its memory from the shared budget.
        for (let i = 0, n = this.future.length; i < n; i++) {
            this.bytes -= this.future[i].bytes;
        }

        this.future = [];

        if (
            !this.boundary &&
            group &&
            last?.group === group &&
            time - last.time >= 0 &&
            time - last.time < GROUP_WINDOW &&
            sameSelections(before, last.after) &&
            !multiline
        ) {
            last.after = this.ranges;
            last.bytes += bytes;
            last.patches.push(patches);
            last.time = time;
        }
        else {
            this.past.push({ after: this.ranges, before, bytes, group, patches: [patches], time });
        }

        this.boundary = false;
        this.bytes += bytes;

        while (this.past.length > this.limit || this.bytes > this.byteLimit) {
            this.bytes -= this.past.shift()!.bytes;
        }

        this.emit(options.source ?? 'command', true, before, [next.delta.edits]);

        return { accepted: true, changed: true };
    }

    undo() {
        return this.travel(false);
    }

    undoSelection() {
        return this.travelSelection(false);
    }
}


export {
    EditorDocument,
    floorIndex,
    lineEnd,
    lineStarts,
    normalizeSelections,
    preferredEol,
    sameSelection,
    sameSelections,
    selection
};
export type { Change, Delta, Edit, Selection, Snapshot, TransactionOptions, TransactionResult };
