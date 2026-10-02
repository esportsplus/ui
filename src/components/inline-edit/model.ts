type Block = {
    checked: boolean;
    // Identity across edits: a block keeps its key while its text changes, so only what changed renders again.
    key: symbol;
    kind: Kind;
    runs: Run[];
};

type Doc = Block[];

type Edit = {
    doc: Doc;
    selection: Selection;
};

type Kind = 'bullet' | 'codeblock' | 'h1' | 'h2' | 'h3' | 'ordered' | 'paragraph' | 'quote' | 'task';

type Mark = 'bold' | 'code' | 'highlight' | 'italic' | 'link' | 'strike';

type Pos = {
    block: number;
    offset: number;
};

// Text sharing one style; '\n' is a line break inside the block. A link is its 'href', not one of 'marks'.
type Run = {
    href: string;
    marks: Mark[];
    text: string;
};

type Selection = {
    anchor: Pos;
    focus: Pos;
};

type Span = {
    end: Pos;
    start: Pos;
};

type Tree = { children: Tree[], href: string, mark: Mark } | { text: string };


// Outermost first: how marks nest when rendered and written as markdown. Code is innermost, so it can sit inside the
// others but never holds them.
const LAYERS: Mark[] = ['link', 'bold', 'italic', 'strike', 'highlight', 'code'];

const LISTS = new Set<Kind>(['bullet', 'ordered', 'task']);


function key(run: Run, layer: Mark) {
    if (layer === 'link') {
        return run.href;
    }

    return run.marks.includes(layer) ? layer : '';
}

function style(run: Run, text: string): Run {
    return { href: run.href, marks: run.marks, text };
}


const block = (kind: Kind, runs: Run[], checked = false): Block => ({ checked, key: Symbol(), kind, runs });

const caret = (pos: Pos): Selection => ({ anchor: pos, focus: pos });

// The runs from 'from' to 'to'.
const cut = (runs: Run[], from: number, to = Infinity): Run[] => {
    let at = 0,
        out: Run[] = [];

    for (let i = 0, n = runs.length; i < n; i++) {
        let run = runs[i],
            end = at + run.text.length;

        if (end > from && at < to) {
            out.push(style(run, run.text.slice(Math.max(0, from - at), Math.min(run.text.length, to - at))));
        }

        at = end;
    }

    return out;
};

const empty = (doc: Doc) => doc.every((b) => !text(b.runs).trim());

const has = (run: Run, mark: Mark) => mark === 'link' ? !!run.href : run.marks.includes(mark);

const insert = (doc: Doc, span: Span, runs: Run[]): Edit => {
    let next = remove(doc, span).doc,
        { block: i, offset } = span.start,
        target = next[i];

    next[i] = {
        ...target,
        runs: join(cut(target.runs, 0, offset), target.kind === 'codeblock' ? plain(runs) : runs, cut(target.runs, offset))
    };

    return { doc: next, selection: caret({ block: i, offset: offset + length(runs) }) };
};

// Adjacent runs of one style merge and empty ones go, so equal content always has the same runs.
const join = (...lists: Run[][]): Run[] => {
    let out: Run[] = [];

    for (let i = 0, n = lists.length; i < n; i++) {
        for (let run of lists[i]) {
            if (!run.text) {
                continue;
            }

            let last = out[out.length - 1];

            if (last && same(last, run)) {
                out[out.length - 1] = style(last, last.text + run.text);
            }
            else {
                out.push(run);
            }
        }
    }

    return out;
};

const length = (runs: Run[]) => {
    let n = 0;

    for (let i = 0, m = runs.length; i < m; i++) {
        n += runs[i].text.length;
    }

    return n;
};

const list = (kind: Kind) => LISTS.has(kind);

// The runs as a tree of marks, each mark spanning as much as it can, in the order of LAYERS.
const nest = (runs: Run[], depth = 0): Tree[] => {
    if (depth === LAYERS.length) {
        return runs.map((run) => ({ text: run.text }));
    }

    let layer = LAYERS[depth],
        out: Tree[] = [];

    for (let i = 0, n = runs.length; i < n;) {
        let j = i,
            value = key(runs[i], layer);

        while (j < n && key(runs[j], layer) === value) {
            j++;
        }

        let children = nest(runs.slice(i, j), depth + 1);

        if (value) {
            out.push({ children, href: layer === 'link' ? value : '', mark: layer });
        }
        else {
            out.push(...children);
        }

        i = j;
    }

    return out;
};

const order = ({ anchor, focus }: Selection): Span => {
    if (anchor.block < focus.block || (anchor.block === focus.block && anchor.offset <= focus.offset)) {
        return { end: focus, start: anchor };
    }

    return { end: anchor, start: focus };
};

// Paste: several blocks land between the halves of the block at the caret, which keeps whichever half has text.
const paste = (doc: Doc, span: Span, blocks: Doc): Edit => {
    if (blocks.length === 1 && blocks[0].kind === 'paragraph') {
        return insert(doc, span, blocks[0].runs);
    }

    let next = remove(doc, span).doc,
        { block: i, offset } = span.start,
        target = next[i],
        head = cut(target.runs, 0, offset),
        tail = cut(target.runs, offset),
        middle: Block[] = [];

    if (head.length) {
        middle.push({ ...target, runs: head });
    }

    middle.push(...blocks);

    if (tail.length) {
        middle.push(block(target.kind, tail));
    }

    next.splice(i, 1, ...middle);

    let last = i + (head.length ? 1 : 0) + blocks.length - 1;

    return { doc: next, selection: caret({ block: last, offset: length(next[last].runs) }) };
};

const plain = (runs: Run[]): Run[] => {
    let value = text(runs);

    return value ? [{ href: '', marks: [], text: value }] : [];
};

// Deletes the span; the blocks at its ends join into the first, with its kind.
const remove = (doc: Doc, { end, start }: Span): Edit => {
    let next = doc.slice(),
        first = doc[start.block],
        last = doc[end.block];

    if (start.block !== end.block || start.offset !== end.offset) {
        let rest = cut(last.runs, end.offset);

        next.splice(start.block, end.block - start.block + 1, {
            ...first,
            runs: join(cut(first.runs, 0, start.offset), first.kind === 'codeblock' ? plain(rest) : rest)
        });
    }

    return { doc: next, selection: caret(start) };
};

// The runs restyled from 'from' to 'to'; the rest keep theirs.
const restyle = (runs: Run[], from: number, to: number, fn: (run: Run) => Run) => {
    return join(cut(runs, 0, from), cut(runs, from, to).map(fn), cut(runs, to));
};

const same = (a: Run, b: Run) => {
    if (a.href !== b.href || a.marks.length !== b.marks.length) {
        return false;
    }

    for (let i = 0, n = a.marks.length; i < n; i++) {
        if (a.marks[i] !== b.marks[i]) {
            return false;
        }
    }

    return true;
};

// The content between the span's ends, whole blocks with their kinds.
const slice = (doc: Doc, { end, start }: Span): Doc => {
    let out: Doc = [];

    for (let i = start.block; i <= end.block; i++) {
        let b = doc[i];

        out.push({
            ...b,
            runs: cut(b.runs, i === start.block ? start.offset : 0, i === end.block ? end.offset : Infinity)
        });
    }

    return out;
};

// Enter: list items continue the list (an empty one leaves it), headings end in a paragraph, and quotes and code
// blocks take a new line, leaving on a second Enter at their end.
// Marks without repeats, in the order of LAYERS, so equal styles compare equal.
const sort = (marks: Mark[]) => [...new Set(marks)].sort((a, b) => LAYERS.indexOf(a) - LAYERS.indexOf(b));

const split = (doc: Doc, span: Span): Edit => {
    let next = remove(doc, span).doc,
        { block: i, offset } = span.start,
        target = next[i],
        content = text(target.runs),
        size = content.length;

    if (list(target.kind) && !size) {
        next[i] = { ...target, checked: false, kind: 'paragraph' };
        return { doc: next, selection: caret({ block: i, offset: 0 }) };
    }

    if (target.kind === 'codeblock' || target.kind === 'quote') {
        if (offset !== size || !content.endsWith('\n')) {
            return insert(next, { end: span.start, start: span.start }, [{ href: '', marks: [], text: '\n' }]);
        }

        next.splice(i, 1, { ...target, runs: cut(target.runs, 0, size - 1) }, block('paragraph', []));
        return { doc: next, selection: caret({ block: i + 1, offset: 0 }) };
    }

    let kind: Kind = target.kind[0] === 'h' && offset === size ? 'paragraph' : target.kind;

    next.splice(i, 1, { ...target, runs: cut(target.runs, 0, offset) }, block(kind, cut(target.runs, offset)));

    return { doc: next, selection: caret({ block: i + 1, offset: 0 }) };
};

// What typing at 'offset' takes on: the style of the text before it, or after it at the start. Links and code stop
// at their edges, so typing past them is plain.
const styleAt = (runs: Run[], offset: number): Run => {
    let at = 0,
        before: Run | null = null,
        after: Run | null = null;

    for (let i = 0, n = runs.length; i < n; i++) {
        let run = runs[i],
            end = at + run.text.length;

        if (at < offset && offset <= end) {
            before = run;
        }

        if (at <= offset && offset < end && !after) {
            after = run;
        }

        at = end;
    }

    let source = before ?? after;

    if (!source) {
        return { href: '', marks: [], text: '' };
    }

    let edge = !before || !after || !same(before, after);

    return {
        href: edge ? '' : source.href,
        marks: edge ? source.marks.filter((mark) => mark !== 'code') : source.marks,
        text: ''
    };
};

const text = (runs: Run[]) => {
    let out = '';

    for (let i = 0, n = runs.length; i < n; i++) {
        out += runs[i].text;
    }

    return out;
};


export {
    block,
    caret, cut,
    empty,
    has,
    insert,
    join,
    LAYERS, length, list,
    nest,
    order,
    paste, plain,
    remove, restyle,
    same, slice, sort, split, styleAt,
    text
};
export type { Block, Doc, Edit, Kind, Mark, Pos, Run, Selection, Span, Tree };
