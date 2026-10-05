import { clamp } from '~/shared/clamp';
import { floorIndex, lineStarts } from './document';
import type { NativeText } from './projection';


type LayoutLine = { breaks: number[]; from: number; height: number; number: number; to: number; top: number };

type Rect = { height: number; left: number; top: number; width: number };


// Characters a line can't break after, whatever follows: letters, digits and openers, after Blink's ASCII table.
const BREAK_NEVER_AFTER = new Set([36, 39, 40, 47, 60, 64, 91, 94, 95, 96, 123, 127]);

// Characters a line can't break before.
const BREAK_NEVER_BEFORE = new Set([33, 41, 44, 46, 47, 58, 59, 63, 93, 125]);

// Characters a line may break before, after most punctuation.
const BREAK_OPENERS = new Set([40, 60, 91, 123]);

// Width comparisons tolerate float drift in summed advances; Blink lays out in 1/64 px units.
const EPSILON = 1 / 64;

// Breaks kept per width before the oldest are dropped; lines only reach the cache once they wrap.
const LIMIT = 20000;

const NONE: readonly number[] = [];

// Inclusive code unit ranges, in pairs, drawn two columns wide: Hangul Jamo, CJK, Hangul syllables, compatibility
// ideographs and forms, fullwidth forms, and high surrogates (emoji and other astral characters).
const WIDE = [
    0x1100, 0x115f,
    0x2e80, 0xa4cf,
    0xac00, 0xd7a3,
    0xd800, 0xdbff,
    0xf900, 0xfaff,
    0xfe30, 0xfe4f,
    0xff00, 0xff60
];


function alphanumeric(code: number) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

// Blink's fast line break pairs for printable ASCII, which a monospace code font fully determines.
function breakable(before: number, a: number, b: number) {
    if (a === 45) {
        if (b >= 48 && b <= 57) {
            return alphanumeric(before);
        }

        return b !== 36 && !BREAK_NEVER_BEFORE.has(b);
    }

    if (alphanumeric(a) || BREAK_NEVER_AFTER.has(a) || a > 127) {
        return false;
    }

    if (BREAK_NEVER_BEFORE.has(b)) {
        return false;
    }

    if (a === 63) {
        return b !== 34 && b !== 39;
    }

    return BREAK_OPENERS.has(b);
}

// Wide East Asian and emoji code units take two columns in the estimate; a low surrogate's pair already counted.
function columns(code: number) {
    if (code >= 0xdc00 && code <= 0xdfff) {
        return 0;
    }

    for (let i = 0, n = WIDE.length; i < n; i += 2) {
        if (code >= WIDE[i] && code <= WIDE[i + 1]) {
            return 2;
        }
    }

    return 1;
}

// Text past Latin-1 shapes and breaks by font and Unicode rules no arithmetic reproduces; such lines are estimated
// until the view measures them.
function irregular(text: string) {
    for (let i = 0, n = text.length; i < n; i++) {
        let code = text.charCodeAt(i);

        if (code > 0xff || (code < 32 && code !== 9)) {
            return true;
        }
    }

    return false;
}

// Row starts after the first, relative to the line, for 'white-space: pre-wrap' with 'overflow-wrap: break-word':
// spaces hang at a row's end, a row breaks at its last opportunity that fits, and a word wider than a row breaks
// where it overflows.
function wrap(text: string, width: number, charWidth: number, tabSize: number): readonly number[] {
    let breaks: number[] | undefined,
        last = -1,
        row = 0,
        x = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        let code = text.charCodeAt(i);

        if (code === 32 || code === 9) {
            x += code === 9 ? (tabSize - (Math.round(x / charWidth) % tabSize)) * charWidth : charWidth;
            continue;
        }

        let advance = columns(code) * charWidth,
            previous = i > row ? text.charCodeAt(i - 1) : -1;

        if (
            previous === 32 ||
            previous === 9 ||
            (previous > 32 && breakable(i > 1 ? text.charCodeAt(i - 2) : 0, previous, code)) ||
            (previous > 0x2e7f && columns(code) === 2)
        ) {
            last = i;
        }

        if (i > row && x + advance > width + EPSILON) {
            row = last > row ? last : i;
            x = 0;

            for (let j = row; j < i; j++) {
                x += columns(text.charCodeAt(j)) * charWidth;
            }

            (breaks ??= []).push(row);
            last = -1;

            if (x + advance > width + EPSILON && i > row) {
                row = i;
                x = 0;
                breaks.push(row);
            }
        }

        x += advance;
    }

    return breaks ?? NONE;
}


// Line geometry for a native projection in a monospace font: rows by arithmetic, a Fenwick tree of row counts for
// wrapped tops, and per-line breaks cached by text for the current width. Lines the arithmetic can't settle are
// estimated until 'measure' records what the DOM drew.
class EditorLayout {
    readonly charWidth: number;
    readonly lineHeight: number;
    readonly tabSize: number;
    readonly width: number;
    readonly wrap: boolean;
    private breaks: (readonly number[])[] = [];
    private cache: Map<string, readonly number[]>;
    private estimates: Set<number> = new Set();
    private folded: boolean;
    private numbers: number[] | null = null;
    private projection: NativeText;
    private source: string;
    private starts: number[];
    private total = 0;
    private tree: number[] = [];


    constructor(
        projection: NativeText,
        source: string,
        width: number,
        lineHeight: number,
        charWidth: number,
        tabSize: number,
        wrap: boolean,
        // Breaks by line text, kept by the caller across layouts for as long as the width, font and tab size hold.
        cache = new Map<string, readonly number[]>()
    ) {
        this.cache = cache;
        this.charWidth = charWidth;
        this.folded = projection.placeholders().length > 0;
        this.lineHeight = lineHeight;
        this.projection = projection;
        this.source = source;
        this.starts = lineStarts(projection.value);
        this.tabSize = tabSize;
        this.width = width;
        this.wrap = wrap;

        if (wrap) {
            for (let i = 0, n = this.starts.length; i < n; i++) {
                this.breaks.push(this.compute(i));
            }

            this.index();
        }
    }


    private compute(index: number) {
        let text = this.text(index),
            widest = text.length * this.charWidth;

        if (irregular(text)) {
            this.estimates.add(index);
            widest *= 2;
        }

        // A line narrower than a row at its widest needs no scan.
        if (widest * (text.indexOf('\t') < 0 ? 1 : this.tabSize) <= this.width) {
            return NONE;
        }

        let cached = this.cache.get(text);

        if (cached) {
            return cached;
        }

        let breaks = wrap(text, this.width, this.charWidth, this.tabSize);

        if (this.cache.size >= LIMIT) {
            this.cache.delete(this.cache.keys().next().value!);
        }

        this.cache.set(text, breaks);

        return breaks;
    }

    // Rebuilds the Fenwick tree of row counts; O(lines), so a keystroke's splice stays well under a millisecond.
    private index() {
        let breaks = this.breaks,
            n = breaks.length,
            tree = new Array<number>(n + 1).fill(0),
            total = 0;

        for (let i = 1; i <= n; i++) {
            let rows = breaks[i - 1].length + 1;

            total += rows;
            tree[i] += rows;

            let parent = i + (i & -i);

            if (parent <= n) {
                tree[parent] += tree[i];
            }
        }

        this.total = total;
        this.tree = tree;
    }

    private row(index: number, offset: number) {
        let breaks = this.breaks[index] ?? NONE,
            local = offset - this.starts[index];

        return breaks.length ? floorIndex(breaks, local) + 1 : 0;
    }

    // Rows above line 'index'.
    private rowsBefore(index: number) {
        if (!this.wrap) {
            return index;
        }

        let sum = 0,
            tree = this.tree;

        for (let i = index; i > 0; i -= i & -i) {
            sum += tree[i];
        }

        return sum;
    }

    private segment(index: number, row: number) {
        let breaks = this.breaks[index] ?? NONE,
            from = this.starts[index];

        return {
            from: row ? from + breaks[row - 1] : from,
            to: row < breaks.length ? from + breaks[row] : this.end(index)
        };
    }

    private text(index: number) {
        return this.projection.value.slice(this.starts[index], this.end(index));
    }


    get count() {
        return this.starts.length;
    }

    get height() {
        return (this.wrap ? this.total : this.starts.length) * this.lineHeight;
    }

    get lines(): LayoutLine[] {
        let out: LayoutLine[] = [];

        for (let i = 0, n = this.starts.length; i < n; i++) {
            let breaks = [this.starts[i]];

            for (let b of this.breaks[i] ?? NONE) {
                breaks.push(this.starts[i] + b);
            }

            out.push({
                breaks,
                from: this.starts[i],
                height: this.rows(i) * this.lineHeight,
                number: this.number(i),
                to: this.end(i),
                top: this.top(i)
            });
        }

        return out;
    }

    // Native offsets of every row start after the first, absolute.
    breaksOf(index: number): readonly number[] {
        return this.breaks[index] ?? NONE;
    }

    // A wrapped line whose rows are estimates the DOM should settle once drawn.
    estimated(index: number) {
        return this.estimates.has(index);
    }

    // Applies one native edit, [from, to) of the old text replaced up to 'end' of the new: the lines it touched are
    // rescanned and every later line shifts.
    edit(projection: NativeText, from: number, to: number, end: number) {
        let starts = this.starts,
            first = Math.max(0, floorIndex(starts, from)),
            last = Math.max(first, floorIndex(starts, to)),
            text = projection.value,
            delta = end - to,
            added: number[] = [];

        this.folded = projection.placeholders().length > 0;
        this.numbers = null;
        this.projection = projection;

        for (let p = text.indexOf('\n', starts[first]); p >= 0 && p < end; p = text.indexOf('\n', p + 1)) {
            added.push(p + 1);
        }

        let next = starts.slice(0, first + 1);

        for (let i = 0, n = added.length; i < n; i++) {
            next.push(added[i]);
        }

        for (let i = last + 1, n = starts.length; i < n; i++) {
            next.push(starts[i] + delta);
        }

        let inserted = added.length + 1,
            removed = last - first + 1;

        this.starts = next;

        if (!this.wrap) {
            return { first, inserted, removed };
        }

        if (this.estimates.size) {
            let estimates = new Set<number>();

            for (let i of this.estimates) {
                if (i < first) {
                    estimates.add(i);
                }
                else if (i > last) {
                    estimates.add(i + inserted - removed);
                }
            }

            this.estimates = estimates;
        }

        let breaks: (readonly number[])[] = [];

        for (let i = first, n = first + inserted; i < n; i++) {
            breaks.push(this.compute(i));
        }

        this.breaks.splice(first, removed, ...breaks);
        this.index();

        return { first, inserted, removed };
    }

    end(index: number) {
        let next = this.starts[index + 1];

        return next === undefined ? this.projection.value.length : next - 1;
    }

    // Line whose rows cover 'y', clamped to the document.
    indexAt(y: number) {
        let n = this.starts.length;

        if (!this.wrap) {
            return clamp(Math.floor(y / this.lineHeight), 0, n - 1);
        }

        let target = Math.floor(Math.max(0, y) / this.lineHeight),
            index = 0,
            tree = this.tree;

        for (let step = 1 << Math.floor(Math.log2(n || 1)); step > 0; step >>= 1) {
            let next = index + step;

            if (next <= n && tree[next] <= target) {
                index = next;
                target -= tree[next];
            }
        }

        return Math.min(index, n - 1);
    }

    lineAt(offset: number) {
        return Math.max(0, floorIndex(this.starts, offset));
    }

    lineFrom(index: number) {
        return this.starts[index];
    }

    // Records rows the DOM drew for a line the arithmetic could only estimate; true when its height changed.
    measure(index: number, breaks: readonly number[]) {
        this.estimates.delete(index);

        if (!this.wrap) {
            return false;
        }

        let previous = this.breaks[index] ?? NONE,
            same = previous.length === breaks.length;

        for (let i = 0; same && i < breaks.length; i++) {
            same = previous[i] === breaks[i];
        }

        if (same) {
            return false;
        }

        this.breaks[index] = breaks.length ? breaks : NONE;

        if (previous.length === breaks.length) {
            return false;
        }

        this.index();

        return true;
    }

    // Source line number of a native line; folds merge lines, so they step it past the hidden ones.
    number(index: number) {
        if (!this.folded) {
            return index + 1;
        }

        let numbers = this.numbers;

        if (!numbers) {
            let source = lineStarts(this.source);

            numbers = this.numbers = [];

            for (let i = 0, n = this.starts.length; i < n; i++) {
                numbers.push(floorIndex(source, this.projection.toSource(this.starts[i])) + 1);
            }
        }

        return numbers[index];
    }

    // Native offset nearest to a content-box point.
    offset(x: number, y: number) {
        let index = this.indexAt(y),
            rows = this.rows(index),
            row = clamp(Math.floor((y - this.top(index)) / this.lineHeight), 0, rows - 1),
            { from, to } = this.segment(index, row),
            text = this.projection.value,
            left = 0;

        for (let i = from; i < to; i++) {
            let code = text.charCodeAt(i),
                advance = code === 9
                    ? (this.tabSize - (Math.round(left / this.charWidth) % this.tabSize)) * this.charWidth
                    : columns(code) * this.charWidth;

            if (x < left + advance / 2) {
                return i;
            }

            left += advance;
        }

        // A wrapped row's last offset is the next row's first; stay on this one.
        return row < rows - 1 && to > from ? to - 1 : to;
    }

    // Content-box caret rectangle for a native offset; an offset at a wrap point opens the next row.
    rect(offset: number): Rect {
        offset = clamp(offset, 0, this.projection.value.length);

        let index = this.lineAt(offset),
            row = this.row(index, offset),
            { from } = this.segment(index, row),
            text = this.projection.value,
            left = 0;

        for (let i = from; i < offset; i++) {
            let code = text.charCodeAt(i);

            left += code === 9
                ? (this.tabSize - (Math.round(left / this.charWidth) % this.tabSize)) * this.charWidth
                : columns(code) * this.charWidth;
        }

        return { height: this.lineHeight, left, top: this.top(index) + row * this.lineHeight, width: 1 };
    }

    rows(index: number) {
        return (this.breaks[index]?.length ?? 0) + 1;
    }

    top(index: number) {
        return this.rowsBefore(index) * this.lineHeight;
    }

    // Native lines overlapping [top, bottom).
    visible(top: number, bottom: number) {
        let first = this.indexAt(top),
            last = this.indexAt(Math.max(top, bottom - 1));

        return { first, last: last + 1 };
    }
}


export { EditorLayout, irregular };
export type { LayoutLine, Rect };
