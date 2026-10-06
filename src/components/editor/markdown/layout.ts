import type { FoldRange } from '../code/folding';
import type { MarkdownBlock, Row } from './model';


type Cache = {
    folded: WeakMap<MarkdownBlock, Unit>;
    plain: WeakMap<MarkdownBlock, Unit[]>;
    raw: WeakMap<MarkdownBlock, Unit[]>;
};

type Metrics = {
    charWidth: number;
    fontSize: number;
    lineHeight: number;
    // Horizontal space one level of quote nesting takes.
    quoteIndent: number;
    width: number;
};

// What the surface draws for a block, or a slice of a large one. Units keep their block's identity while its text
// is unchanged, so their DOM and measured height survive edits elsewhere.
type Unit = {
    // The editing field, standing in for the blocks under the primary selection.
    active?: boolean;
    block: MarkdownBlock;
    continuation: boolean;
    continues: boolean;
    estimate: number;
    // Layout generation 'estimate' was made for.
    estimated: number;
    // The collapsed fold this unit heads.
    fold?: FoldRange;
    // Height the DOM drew.
    height: number;
    // Layout generation 'height' was measured in; a width or font change makes it an estimate again.
    measured: number;
    // Source text instead of formatting, for blocks holding secondary carets.
    raw: boolean;
    // A slice's rows, offsets relative to the block's start; none for the whole block.
    rows?: Row[];
};

type Window = { end: number; start: number };


// Pixels drawn above and below the viewport.
const OVERSCAN = 240;

// Font scale of each heading level; the stylesheet's heading variants use the same ratios.
const SCALES = [1, 1.7, 1.45, 1.25, 1.1, 1, 0.95];

// Headings this level or higher set their own line height, as a multiple of their font size.
const SCALED_LINE = 1.3;

// Blocks beyond these sizes render as bounded slices.
const SLICE_CHARACTERS = 8192;

const SLICE_LINES = 32;

// Units rendered at once, whatever their heights.
const WINDOW_LIMIT = 120;


function create(block: MarkdownBlock, rows?: Row[], continuation = false, continues = false, raw = false): Unit {
    return { block, continuation, continues, estimate: 0, estimated: -1, height: 0, measured: -1, raw, rows };
}

function relative(block: MarkdownBlock, row: Row): Row {
    let base = block.from;

    return { contentFrom: row.contentFrom - base, contentTo: row.contentTo - base, from: row.from - base, to: row.to - base };
}

// A block as one unit, or for a large one, slices of whole rows (long paragraph rows cut every SLICE_CHARACTERS) of
// at most SLICE_LINES rows and SLICE_CHARACTERS characters each.
function slice(block: MarkdownBlock, text: string, raw: boolean): Unit[] {
    if (
        block.kind === 'frontmatter' ||
        block.kind === 'html' ||
        (block.contentTo - block.contentFrom <= SLICE_CHARACTERS && (block.lines?.length ?? 0) <= SLICE_LINES)
    ) {
        return [create(block, undefined, false, false, raw)];
    }

    let code = block.kind === 'code' || block.kind === 'fence',
        lines = block.lines,
        pieces: Row[] = [],
        rows: Row[] = [];

    if (lines) {
        for (let i = 0, n = lines.length; i < n; i++) {
            rows.push(relative(block, lines[i]));
        }
    }
    else {
        let cursor = block.contentFrom;

        while (cursor <= block.contentTo) {
            let end = cursor;

            while (end < block.contentTo && text.charCodeAt(end) !== 10 && text.charCodeAt(end) !== 13) {
                end++;
            }

            let next = end + (text.charCodeAt(end) === 13 && text.charCodeAt(end + 1) === 10 ? 2 : 1);

            rows.push(relative(block, { contentFrom: cursor, contentTo: end, from: cursor, to: Math.min(next, block.to) }));

            if (end >= block.contentTo) {
                break;
            }

            cursor = next;
        }
    }

    for (let i = 0, n = rows.length; i < n; i++) {
        let row = rows[i];

        // A long code line stays one inert, horizontally scrolling text node.
        if (code) {
            pieces.push(row);
            continue;
        }

        for (let from = row.contentFrom; ; from += SLICE_CHARACTERS) {
            let to = Math.min(row.contentTo, from + SLICE_CHARACTERS);

            pieces.push({
                contentFrom: from,
                contentTo: to,
                from: from === row.contentFrom ? row.from : from,
                to: to === row.contentTo ? row.to : to
            });

            if (to >= row.contentTo) {
                break;
            }
        }
    }

    let out: Unit[] = [];

    for (let start = 0, n = pieces.length; start < n;) {
        let characters = 0,
            end = start;

        while (
            end < n &&
            end - start < SLICE_LINES &&
            characters + pieces[end].contentTo - pieces[end].contentFrom <= SLICE_CHARACTERS
        ) {
            characters += pieces[end].contentTo - pieces[end].contentFrom;
            end++;
        }

        if (end === start) {
            end++;
        }

        out.push(create(block, pieces.slice(start, end), start > 0, end < n, raw));
        start = end;
    }

    return out;
}


// The units the surface shows, in order: blocks under a fold are left out and its header stands for it, blocks
// [active.first, active.last) are the editing field, and blocks 'raw' picks show their source.
const arrange = (
    blocks: readonly MarkdownBlock[],
    text: string,
    folds: readonly FoldRange[],
    cache: Cache,
    active: { first: number; last: number; unit: Unit } | null,
    raw: ((index: number) => boolean) | null
) => {
    let f = 0,
        out: Unit[] = [];

    for (let i = 0, n = blocks.length; i < n; i++) {
        if (active && i === active.first) {
            out.push(active.unit);
            i = active.last - 1;
            continue;
        }

        let block = blocks[i];

        while (f < folds.length && folds[f].to <= block.from) {
            f++;
        }

        let fold = folds[f];

        if (fold && block.from >= fold.from && block.from < fold.to) {
            continue;
        }

        if (fold && fold.open === block.from) {
            let unit = cache.folded.get(block);

            if (!unit || unit.fold!.from !== fold.from || unit.fold!.to !== fold.to || unit.fold!.endLine !== fold.endLine) {
                unit = create(block);
                unit.fold = fold;
                cache.folded.set(block, unit);
            }

            out.push(unit);
            continue;
        }

        let raws = raw?.(i) ?? false,
            map = raws ? cache.raw : cache.plain,
            units = map.get(block);

        if (!units) {
            map.set(block, units = slice(block, text, raws));
        }

        for (let j = 0, m = units.length; j < m; j++) {
            out.push(units[j]);
        }
    }

    return out;
};

const cache = (): Cache => ({ folded: new WeakMap(), plain: new WeakMap(), raw: new WeakMap() });

const headingScale = (level = 0) => SCALES[level] ?? 1;

// Source offset a unit starts at.
const unitStart = (unit: Unit) => unit.block.from + (unit.rows ? unit.rows[0].from : 0);


// Tops of the units by prefix sums, rebuilt lazily after any height changes; a keystroke's rebuild is a pass over
// numbers. Unmeasured units are estimated from their text for a monospace font.
class MarkdownLayout {
    units: Unit[] = [];
    private dirty = true;
    private generation = 0;
    private metrics: Metrics = { charWidth: 8, fontSize: 13, lineHeight: 20, quoteIndent: 10, width: 600 };
    private text = '';
    private tops = new Float64Array(1);


    private estimate(unit: Unit) {
        let block = unit.block,
            { charWidth, fontSize, lineHeight, quoteIndent, width } = this.metrics;

        if (unit.fold || block.kind === 'frontmatter') {
            return lineHeight;
        }

        let scale = headingScale(block.level),
            line = block.level && block.level <= 2 ? fontSize * scale * SCALED_LINE : lineHeight,
            columns = Math.max(8, Math.floor(Math.max(40, width - block.indent * charWidth - block.quoteDepth * quoteIndent) / (charWidth * scale))),
            code = block.kind === 'code' || block.kind === 'fence',
            rows = unit.rows ?? block.lines,
            count = 0,
            text = this.text;

        if (rows) {
            for (let i = 0, n = rows.length; i < n; i++) {
                count += code ? 1 : Math.max(1, Math.ceil((rows[i].contentTo - rows[i].contentFrom) / columns));
            }
        }
        else {
            let from = block.contentFrom,
                to = block.contentTo;

            for (let i = from; i <= to; i++) {
                if (i === to || text.charCodeAt(i) === 10) {
                    count += Math.max(1, Math.ceil((i - from) / columns));
                    from = i + 1;
                }
            }
        }

        let padding = code ? (unit.continuation ? 0 : 1) + (unit.continues ? 0 : 1) : 0;

        return Math.max(line, count * line + padding);
    }

    private index() {
        let units = this.units,
            n = units.length,
            tops = this.tops.length > n ? this.tops : new Float64Array(Math.max(n + 1, this.tops.length * 2)),
            y = 0;

        for (let i = 0; i < n; i++) {
            tops[i] = y;
            y += this.height(units[i]);
        }

        tops[n] = y;
        this.dirty = false;
        this.tops = tops;
    }


    get total() {
        if (this.dirty) {
            this.index();
        }

        return this.tops[this.units.length];
    }

    // Unit covering content y, clamped to the units.
    at(y: number) {
        if (this.dirty) {
            this.index();
        }

        let hi = this.units.length,
            lo = 0,
            tops = this.tops;

        while (lo < hi) {
            let mid = (lo + hi) >>> 1;

            if (tops[mid + 1] <= y) {
                lo = mid + 1;
            }
            else {
                hi = mid;
            }
        }

        return Math.min(lo, Math.max(0, this.units.length - 1));
    }

    // Takes new metrics; true when they change the estimates, which also turns every measurement into one.
    configure(metrics: Metrics) {
        let current = this.metrics;

        if (
            current.charWidth === metrics.charWidth &&
            current.fontSize === metrics.fontSize &&
            current.lineHeight === metrics.lineHeight &&
            current.quoteIndent === metrics.quoteIndent &&
            current.width === metrics.width
        ) {
            return false;
        }

        this.dirty = true;
        this.generation++;
        this.metrics = metrics;

        return true;
    }

    height(unit: Unit) {
        if (unit.measured === this.generation) {
            return unit.height;
        }

        if (unit.estimated !== this.generation) {
            unit.estimate = this.estimate(unit);
            unit.estimated = this.generation;
        }

        return unit.estimate;
    }

    // Index of the unit holding source 'offset'.
    indexOf(offset: number) {
        let hi = this.units.length,
            lo = 0,
            units = this.units;

        while (lo < hi) {
            let mid = (lo + hi) >>> 1;

            if (unitStart(units[mid]) <= offset) {
                lo = mid + 1;
            }
            else {
                hi = mid;
            }
        }

        return Math.max(0, lo - 1);
    }

    // Records a drawn height; true when it differs from what the layout had.
    measure(unit: Unit, height: number) {
        if (!(height > 0) || !Number.isFinite(height)) {
            return false;
        }

        let previous = this.height(unit);

        unit.height = height;
        unit.measured = this.generation;

        if (Math.abs(previous - height) < 0.5) {
            return false;
        }

        this.dirty = true;

        return true;
    }

    set(units: Unit[], text: string) {
        this.dirty = true;
        this.text = text;
        this.units = units;
    }

    top(index: number) {
        if (this.dirty) {
            this.index();
        }

        return this.tops[Math.max(0, Math.min(index, this.units.length))];
    }

    // Units to render for a viewport at content y: those within OVERSCAN of it, at most WINDOW_LIMIT.
    window(y: number, height: number, overscan = OVERSCAN): Window {
        let n = this.units.length;

        if (!n) {
            return { end: 0, start: 0 };
        }

        let start = this.at(Math.max(0, y - overscan)),
            end = Math.min(n, this.at(y + Math.max(1, height) + overscan) + 1);

        if (end - start > WINDOW_LIMIT) {
            start = Math.max(start, this.at(y) - 12);
            end = Math.min(n, start + WINDOW_LIMIT);
        }

        return { end, start };
    }
}


export { arrange, cache, headingScale, MarkdownLayout, SCALED_LINE, SLICE_LINES, unitStart, WINDOW_LIMIT };
export type { Unit };
