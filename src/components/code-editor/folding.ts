import { EditorDocument, floorIndex, lineStarts, type Edit } from './document';
import { SyntaxCache, type Frame, type Language, type LineSyntax, type Nesting } from './syntax';


type BracketPair = { from: number; to: number };

type FoldRange = {
    close?: number;
    endLine: number;
    from: number;
    line: number;
    open?: number;
    to: number;
};

type Structure = {
    folds: FoldRange[];
    pairs: BracketPair[];
};


const COMMENT_LINE = /^\s*#/;

const HEADER = /:\s*(?:#.*)?$/;

const HEADING = /^#{1,6}\s/;

const TRIPLE = new Set(["'''", '"""']);


// Preferred fold for a line: the one reaching furthest, then the largest, then the earliest. A header holding
// parameters and an inline type collapses its body rather than the first short pair on the line.
function better(a: FoldRange | null, b: FoldRange | null) {
    if (!a || !b) {
        return a ?? b;
    }

    if (a.endLine !== b.endLine) {
        return a.endLine > b.endLine ? a : b;
    }

    if (a.to - a.from !== b.to - b.from) {
        return a.to - a.from > b.to - b.from ? a : b;
    }

    return b.from < a.from ? b : a;
}

function bracketFold(cache: SyntaxCache, index: number, tag: boolean) {
    let best: FoldRange | null = null,
        nesting = cache.nesting(index),
        open: Frame[] = [],
        start = cache.document.lineStart(index);

    let frame = tag ? nesting.tags : nesting.brackets;

    while (frame && frame.entry === nesting.entry) {
        open.push(frame);
        frame = frame.parent;
    }

    // Outermost first: the first of these to close reaches furthest.
    for (let i = open.length - 1; i >= 0; i--) {
        let close = closing(cache, open[i], index, tag);

        if (close >= 0) {
            return range(cache.document, start + open[i].at, close);
        }
    }

    for (let i = 0, n = nesting.closed.length; i < n; i++) {
        let { at, frame } = nesting.closed[i];

        if (frame.entry === nesting.entry && isTag(frame) === tag) {
            best = better(best, range(cache.document, start + frame.at, start + at));
        }
    }

    return best;
}

function closedAt(nesting: Nesting, at: number) {
    for (let i = 0, n = nesting.closed.length; i < n; i++) {
        let closed = nesting.closed[i];

        if (closed.at === at && !isTag(closed.frame)) {
            return closed.frame;
        }
    }

    return null;
}

// Offset of the closer that pops 'frame', which is open somewhere on line 'index'.
function closeOf(cache: SyntaxCache, frame: Frame, index: number) {
    let nesting = cache.nesting(index);

    for (let i = 0, n = nesting.closed.length; i < n; i++) {
        if (nesting.closed[i].frame === frame) {
            return cache.document.lineStart(index) + nesting.closed[i].at;
        }
    }

    return closing(cache, frame, index, false);
}

// Offset of the closer that pops 'frame', open at the end of line 'index'; -1 when nothing closes it.
function closing(cache: SyntaxCache, frame: Frame, index: number, tag: boolean) {
    for (let j = index + 1, n = cache.lineCount; j < n; j++) {
        let nesting = cache.nesting(j);

        if ((tag ? nesting.tagLow : nesting.low) >= frame.depth) {
            continue;
        }

        for (let k = 0, m = nesting.closed.length; k < m; k++) {
            if (nesting.closed[k].frame === frame) {
                return cache.document.lineStart(j) + nesting.closed[k].at;
            }
        }

        return -1;
    }

    return -1;
}

function commentFold(cache: SyntaxCache, index: number) {
    let entry = cache.line(index);

    if (entry.start.includes('comment') || !entry.end.includes('comment')) {
        return null;
    }

    for (let j = index + 1, n = cache.lineCount; j < n; j++) {
        if (!cache.line(j).end.includes('comment')) {
            return range(cache.document, cache.document.lineStart(index), cache.document.lineStart(j));
        }
    }

    return null;
}

function fenceFold(cache: SyntaxCache, index: number) {
    let entry = cache.line(index);

    if (entry.start.startsWith('fence:') || !entry.end.startsWith('fence:')) {
        return null;
    }

    for (let j = index + 1, n = cache.lineCount; j < n; j++) {
        if (!cache.line(j).end.startsWith('fence:')) {
            return range(cache.document, cache.document.lineStart(index), cache.document.lineStart(j));
        }
    }

    return null;
}

function headingFold(cache: SyntaxCache, index: number) {
    let document = cache.document,
        level = headingLevel(cache, index);

    if (!level) {
        return null;
    }

    for (let j = index + 1, n = document.lineCount; j < n; j++) {
        let next = headingLevel(cache, j);

        if (next && next <= level) {
            return section(document, index, j);
        }
    }

    return section(document, index, document.lineCount);
}

function headingLevel(cache: SyntaxCache, index: number) {
    let text = cache.document.lineText(index);

    if (!HEADING.test(text) || cache.stateAt(index).startsWith('fence:')) {
        return 0;
    }

    let level = 0;

    while (text[level] === '#') {
        level++;
    }

    return level;
}

function indentFold(cache: SyntaxCache, index: number) {
    let document = cache.document,
        indent = indentOf(cache, index);

    if (indent < 0 || !HEADER.test(document.lineText(index))) {
        return null;
    }

    for (let j = index + 1, n = document.lineCount; j < n; j++) {
        let next = indentOf(cache, j);

        if (next >= 0 && next <= indent) {
            return section(document, index, j);
        }
    }

    return section(document, index, document.lineCount);
}

// Indentation width of a line that opens or closes Python blocks; -1 for blank lines, comments and string bodies.
function indentOf(cache: SyntaxCache, index: number) {
    let text = cache.document.lineText(index);

    if (!text.trim() || COMMENT_LINE.test(text) || TRIPLE.has(cache.stateAt(index))) {
        return -1;
    }

    let indent = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        if (text[i] === '\t') {
            indent += 4 - (indent % 4);
        }
        else if (text[i] === ' ') {
            indent++;
        }
        else {
            break;
        }
    }

    return indent;
}

function isTag(frame: Frame) {
    return frame.name !== '(' && frame.name !== '[' && frame.name !== '{';
}

// Line start of the line holding 'entry', searching back from 'index'.
function lineOf(cache: SyntaxCache, entry: LineSyntax, index: number) {
    for (let j = index; j >= 0; j--) {
        if (cache.line(j) === entry) {
            return j;
        }
    }

    return -1;
}

// The frame an opener at column 'at' of the nesting's line pushed.
function openedAt(nesting: Nesting, at: number) {
    for (let i = 0, n = nesting.closed.length; i < n; i++) {
        let frame = nesting.closed[i].frame;

        if (frame.entry === nesting.entry && frame.at === at && !isTag(frame)) {
            return frame;
        }
    }

    for (let frame = nesting.brackets; frame && frame.entry === nesting.entry; frame = frame.parent) {
        if (frame.at === at) {
            return frame;
        }
    }

    return null;
}

function openOf(cache: SyntaxCache, frame: Frame, index: number) {
    return cache.document.lineStart(lineOf(cache, frame.entry, index)) + frame.at;
}

// Only a pair spanning lines folds, as in CodeMirror: one closing on its own line would hide nothing worth a marker,
// and folding all would collapse every one-line parameter list.
function range(document: EditorDocument, open: number, close: number): FoldRange | null {
    if (close <= open + 1) {
        return null;
    }

    let endLine = document.lineAt(close) + 1,
        line = document.lineAt(open) + 1;

    if (endLine === line) {
        return null;
    }

    return { close, endLine, from: open + 1, line, open, to: close };
}

// A header's body: the lines after it, up to the line at 'end' or the end of the document.
function section(document: EditorDocument, index: number, end: number): FoldRange | null {
    if (end <= index + 1) {
        return null;
    }

    let to = end < document.lineCount ? document.lineStart(end) : document.value.length;

    return { endLine: document.lineAt(to) + 1, from: document.lineStart(index + 1), line: index + 1, to };
}

// Bracket stack at column 'at' of line 'index', with the marks before it applied; 'inclusive' also applies an opener
// exactly at it.
function stackAt(cache: SyntaxCache, index: number, at: number, inclusive: boolean) {
    let marks = cache.marks(index),
        nesting = cache.nesting(index),
        stack = nesting.from;

    for (let i = 0, n = marks.length; i < n; i++) {
        let mark = marks[i];

        if (mark.tag) {
            continue;
        }

        if (mark.at > at || (mark.at === at && (mark.close || !inclusive))) {
            break;
        }

        if (mark.close) {
            let popped = closedAt(nesting, mark.at);

            if (popped) {
                stack = popped.parent;
            }
        }
        else {
            stack = openedAt(nesting, mark.at) ?? stack;
        }
    }

    return stack;
}


// Innermost fold hiding 'line' (1-based), searching up from it the way an editor folds from inside a block.
const enclosingFold = (cache: SyntaxCache, line: number) => {
    if (line < 1 || line > cache.lineCount) {
        return null;
    }

    let start = cache.document.lineStart(line - 1);

    for (let l = line; l >= 1; l--) {
        let fold = foldAt(cache, l);

        if (fold && fold.to > start) {
            return fold;
        }
    }

    return null;
};

// The fold a gutter marker on 'line' (1-based) collapses; null when nothing folds there.
const foldAt = (cache: SyntaxCache, line: number) => {
    if (line < 1 || line > cache.lineCount) {
        return null;
    }

    let index = line - 1,
        language = cache.language,
        best = better(bracketFold(cache, index, false), bracketFold(cache, index, true));

    best = better(best, commentFold(cache, index));

    if (language === 'markdown') {
        best = better(best, fenceFold(cache, index));
        best = better(best, headingFold(cache, index));
    }

    if (language === 'python') {
        best = better(best, indentFold(cache, index));
    }

    return best;
};

// Each batch is in its own pre-edit offsets, grouped history travel included. Insertions at either boundary stay
// visible; editing a hidden character, or a fold's own delimiters, reveals the fold.
const mapFolds = (
    folds: readonly FoldRange[],
    batches: readonly (readonly Edit[])[],
    source: EditorDocument | string
): FoldRange[] => {
    let mapped = [...folds];

    for (let i = 0, n = batches.length; i < n; i++) {
        let batch = batches[i],
            next: FoldRange[] = [];

        let shift = (offset: number, right: boolean) => {
            let delta = 0;

            for (let k = 0, m = batch.length; k < m; k++) {
                let edit = batch[k];

                if (edit.to < offset || (edit.to === offset && (right || edit.from !== edit.to))) {
                    delta += edit.insert.length - (edit.to - edit.from);
                }
            }

            return delta;
        };

        for (let j = 0, m = mapped.length; j < m; j++) {
            let fold = mapped[j];

            if (
                batch.some((edit) =>
                    edit.from === edit.to
                        ? edit.from > fold.from && edit.from < fold.to
                        : (edit.from < fold.to && edit.to > fold.from) ||
                          (fold.open !== undefined && edit.from <= fold.open && edit.to > fold.open) ||
                          (fold.close !== undefined && edit.from <= fold.close && edit.to > fold.close)
                )
            ) {
                continue;
            }

            next.push({
                ...fold,
                close: fold.close === undefined ? undefined : fold.close + shift(fold.close, true),
                from: fold.from + shift(fold.from, true),
                open: fold.open === undefined ? undefined : fold.open + shift(fold.open, true),
                to: fold.to + shift(fold.to, false)
            });
        }

        mapped = next;
    }

    let starts = typeof source === 'string' ? lineStarts(source) : source.starts;

    return mapped.map((fold) => ({
        ...fold,
        endLine: floorIndex(starts, fold.close ?? fold.to) + 1,
        line: floorIndex(starts, fold.open ?? Math.max(0, fold.from - 1)) + 1
    }));
};

const matchingPair = (pairs: readonly BracketPair[], offset: number) => {
    for (let i = 0, n = pairs.length; i < n; i++) {
        let pair = pairs[i];

        if (pair.from === offset || pair.to === offset || pair.from === offset - 1 || pair.to === offset - 1) {
            return pair;
        }
    }

    return null;
};

// Bracket opener still open at 'offset', the one a closer typed there would match.
const openBracket = (cache: SyntaxCache, offset: number) => {
    let document = cache.document,
        index = document.lineAt(offset),
        top = stackAt(cache, index, offset - document.lineStart(index), false);

    return top ? { from: openOf(cache, top, index), name: top.name } : null;
};

const outerFolds = (folds: readonly FoldRange[]) => {
    let reach = -1,
        result: FoldRange[] = [],
        sorted = [...folds].sort((a, b) => a.from - b.from || b.to - a.to);

    for (let i = 0, n = sorted.length; i < n; i++) {
        let fold = sorted[i];

        if (fold.to > reach) {
            result.push(fold);
            reach = fold.to;
        }
    }

    return result;
};

// Smallest bracket pair enclosing [from, to] and larger than it, for growing a selection outwards.
const pairAround = (cache: SyntaxCache, from: number, to: number): BracketPair | null => {
    let document = cache.document,
        index = document.lineAt(from);

    for (let frame = stackAt(cache, index, from - document.lineStart(index), true); frame; frame = frame.parent) {
        let close = closeOf(cache, frame, index),
            open = openOf(cache, frame, index);

        if (close >= to && (open < from || close > to)) {
            return { from: open, to: close };
        }
    }

    return null;
};

// The bracket pair touching 'offset' from either side; when both sides touch one, the pair that closes first.
const pairAt = (cache: SyntaxCache, offset: number): BracketPair | null => {
    let best: BracketPair | null = null,
        document = cache.document,
        index = document.lineAt(offset),
        marks = cache.marks(index),
        nesting = cache.nesting(index),
        start = document.lineStart(index);

    for (let i = 0, n = marks.length; i < n; i++) {
        let mark = marks[i],
            pair: BracketPair | null = null;

        if (mark.tag || (mark.at !== offset - start && mark.at !== offset - start - 1)) {
            continue;
        }

        if (mark.close) {
            let frame = closedAt(nesting, mark.at);

            if (frame) {
                pair = { from: openOf(cache, frame, index), to: start + mark.at };
            }
        }
        else {
            let frame = openedAt(nesting, mark.at),
                close = frame ? closeOf(cache, frame, index) : -1;

            if (close >= 0) {
                pair = { from: start + mark.at, to: close };
            }
        }

        if (pair && (!best || pair.to < best.to)) {
            best = pair;
        }
    }

    return best;
};

// Every fold and bracket pair in the document, in one pass over the cache; for 'fold all' and the like.
const structureOf = (cache: SyntaxCache): Structure => {
    let comment = -1,
        document = cache.document,
        fence = -1,
        folds: FoldRange[] = [],
        headings: { index: number; level: number }[] = [],
        language = cache.language,
        lines = new Map<LineSyntax, number>(),
        n = document.lineCount,
        pairs: BracketPair[] = [],
        python: { index: number; indent: number }[] = [];

    let add = (fold: FoldRange | null) => {
        if (fold) {
            folds.push(fold);
        }
    };

    for (let j = 0; j < n; j++) {
        let entry = cache.line(j),
            nesting = cache.nesting(j),
            start = document.lineStart(j);

        lines.set(entry, j);

        if (entry.end.includes('comment') && !entry.start.includes('comment')) {
            comment = start;
        }

        if (comment >= 0 && !entry.end.includes('comment')) {
            add(range(document, comment, start));
            comment = -1;
        }

        if (language === 'markdown') {
            if (entry.end.startsWith('fence:') && !entry.start.startsWith('fence:')) {
                fence = start;
            }

            if (fence >= 0 && !entry.end.startsWith('fence:')) {
                add(range(document, fence, start));
                fence = -1;
            }
        }

        for (let tags = 0; tags < 2; tags++) {
            for (let k = 0, m = nesting.closed.length; k < m; k++) {
                let { at, frame } = nesting.closed[k];

                if (isTag(frame) !== !!tags) {
                    continue;
                }

                let open = document.lineStart(lines.get(frame.entry)!) + frame.at;

                if (!tags) {
                    pairs.push({ from: open, to: start + at });
                }

                add(range(document, open, start + at));
            }
        }

        if (language === 'python') {
            let indent = indentOf(cache, j);

            if (indent >= 0) {
                while (python.length && python[python.length - 1].indent >= indent) {
                    add(section(document, python.pop()!.index, j));
                }

                if (HEADER.test(document.lineText(j))) {
                    python.push({ index: j, indent });
                }
            }
        }

        if (language === 'markdown') {
            let level = headingLevel(cache, j);

            if (level) {
                while (headings.length && headings[headings.length - 1].level >= level) {
                    add(section(document, headings.pop()!.index, j));
                }

                headings.push({ index: j, level });
            }
        }
    }

    for (let i = 0, m = python.length; i < m; i++) {
        add(section(document, python[i].index, n));
    }

    for (let i = 0, m = headings.length; i < m; i++) {
        add(section(document, headings[i].index, n));
    }

    folds.sort(
        (a, b) => a.line - b.line || b.endLine - a.endLine || b.to - b.from - (a.to - a.from) || a.from - b.from
    );

    return { folds, pairs };
};

const structures = (source: string, language: Language) => {
    return structureOf(new SyntaxCache(new EditorDocument(source), language));
};


export {
    enclosingFold,
    foldAt,
    mapFolds,
    matchingPair,
    openBracket,
    outerFolds,
    pairAround,
    pairAt,
    structureOf,
    structures
};
export type { BracketPair, FoldRange, Structure };
