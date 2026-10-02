import { caret, has, join, LAYERS, length, list, plain, restyle, sort, type Block, type Doc, type Edit, type Kind, type Mark, type Run, type Span } from './model';


type Part = {
    block: number;
    from: number;
    to: number;
};


// The last block the span reaches into: one it ends at the very start of (a triple click) it doesn't.
function last({ end, start }: Span) {
    return end.block > start.block && end.offset === 0 ? end.block - 1 : end.block;
}

// The span split per block, so no change ever straddles two.
function parts(doc: Doc, span: Span): Part[] {
    let out: Part[] = [];

    for (let i = span.start.block, n = last(span); i <= n; i++) {
        let from = i === span.start.block ? span.start.offset : 0,
            to = i === span.end.block ? span.end.offset : length(doc[i].runs);

        if (from < to) {
            out.push({ block: i, from, to });
        }
    }

    return out;
}

function restyled(doc: Doc, span: Span, fn: (run: Run) => Run): Edit {
    let next = doc.slice();

    for (let { block: i, from, to } of parts(doc, span)) {
        next[i] = { ...next[i], runs: restyle(next[i].runs, from, to, fn) };
    }

    return { doc: next, selection: { anchor: span.start, focus: span.end } };
}


// Every selected character carries the mark.
const active = (doc: Doc, span: Span, mark: Mark) => {
    let list = parts(doc, span);

    if (!list.length) {
        return false;
    }

    for (let { block: i, from, to } of list) {
        let at = 0;

        for (let run of doc[i].runs) {
            let end = at + run.text.length;

            if (end > from && at < to && !has(run, mark)) {
                return false;
            }

            at = end;
        }
    }

    return true;
};

const check = (doc: Doc, index: number, checked: boolean): Doc => {
    let next = doc.slice();

    next[index] = { ...doc[index], checked };

    return next;
};

const clear = (doc: Doc, span: Span) => restyled(doc, span, (run) => ({ href: '', marks: [], text: run.text }));

// The link the whole span sits in, and its full extent.
const extent = (doc: Doc, { end, start }: Span) => {
    if (start.block !== end.block) {
        return null;
    }

    let at = 0,
        links: { from: number, href: string, to: number }[] = [];

    for (let run of doc[start.block].runs) {
        let to = at + run.text.length,
            previous = links[links.length - 1];

        if (run.href && previous?.href === run.href && previous.to === at) {
            previous.to = to;
        }
        else if (run.href) {
            links.push({ from: at, href: run.href, to });
        }

        at = to;
    }

    for (let { from, href, to } of links) {
        if (from <= start.offset && start.offset < to && end.offset <= to) {
            return { href, span: { end: { block: start.block, offset: to }, start: { block: start.block, offset: from } } };
        }
    }

    return null;
};

const kindAt = (doc: Doc, span: Span): Kind => doc[span.start.block]?.kind ?? 'paragraph';

const link = (doc: Doc, span: Span, href: string | null) => restyled(doc, span, (run) => ({ href: href ?? '', marks: run.marks, text: run.text }));

// Turns every block the span reaches into 'target'; quotes and code blocks merge them, one line each.
const setKind = (doc: Doc, span: Span, target: Kind): Edit => {
    let blocks: Block[] = [],
        first = span.start.block,
        next = doc.slice(),
        n = last(span);

    if (target === 'codeblock' || target === 'quote') {
        let runs: Run[][] = [];

        for (let i = first; i <= n; i++) {
            if (i > first) {
                runs.push([{ href: '', marks: [], text: '\n' }]);
            }

            runs.push(target === 'codeblock' ? plain(doc[i].runs) : doc[i].runs);
        }

        blocks.push({ ...doc[first], checked: false, kind: target, runs: join(...runs) });
    }
    else {
        for (let i = first; i <= n; i++) {
            blocks.push({ ...doc[i], checked: target === 'task' && doc[i].checked, kind: target });
        }
    }

    next.splice(first, n - first + 1, ...blocks);

    let end = first + blocks.length - 1;

    return {
        doc: next,
        selection: { anchor: { block: first, offset: 0 }, focus: { block: end, offset: length(next[end].runs) } }
    };
};

const toggle = (doc: Doc, span: Span, mark: Exclude<Mark, 'link'>) => {
    let on = active(doc, span, mark),
        // Code holds plain text: only the marks around the whole selection stay around it.
        shared = LAYERS.filter((m) => m !== 'link' && m !== mark && active(doc, span, m));

    return restyled(doc, span, (run) => {
        let marks = run.marks.filter((m) => m !== mark);

        if (!on) {
            marks = sort([...(mark === 'code' ? shared : marks), mark]);
        }

        return { href: run.href, marks, text: run.text };
    });
};

// Backspace at the start of a list item turns it into text, as it does a heading, quote or code block that has no
// block before it to join.
const unformat = (doc: Doc, index: number): Edit | null => {
    let target = doc[index];

    if (target.kind === 'paragraph' || (!list(target.kind) && index > 0)) {
        return null;
    }

    let next = doc.slice();

    next[index] = { ...target, checked: false, kind: 'paragraph' };

    return { doc: next, selection: caret({ block: index, offset: 0 }) };
};


export { active, check, clear, extent, kindAt, link, parts, setKind, toggle, unformat };
