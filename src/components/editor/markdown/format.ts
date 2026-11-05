import { blockAt, contentEnd, quotePrefix, type MarkdownBlock } from './model';
import type { Edit, EditorDocument, Selection } from '../code/document';
import { parseInline, type Inline } from './inline';


// The kinds of block the toolbar turns lines into.
type BlockKind = 'bullet' | 'codeblock' | 'h1' | 'h2' | 'h3' | 'ordered' | 'paragraph' | 'quote' | 'task';

type Context = {
    blocks: readonly MarkdownBlock[];
    document: EditorDocument;
    // A block's inline markup, its offsets relative to the block's start.
    tokens: (block: MarkdownBlock) => readonly Inline[];
};

type Formats = {
    block: BlockKind | null;
    // The link the selection sits in, as written.
    link: string | null;
    marks: Record<Mark, boolean>;
};

type Mark = 'bold' | 'code' | 'highlight' | 'italic' | 'strike';

// A run of a block's text the selection covers, absolute, with the block's markup and the row it sits in.
type Slice = { base: number; from: number; row: [number, number]; to: number; tokens: readonly Inline[] };


const DELIMITERS: Record<Exclude<Mark, 'code'>, string> = {
    bold: '**',
    highlight: '==',
    italic: '*',
    strike: '~~'
};

const FENCE_LINE = /^ {0,3}(?:`{3,}|~{3,})/;

const HEADING_PREFIX = /^ {0,3}#{1,6}(?:[ \t]+|$)/;

const KINDS: Record<Mark, Inline['kind']> = {
    bold: 'strong',
    code: 'code',
    highlight: 'highlight',
    italic: 'em',
    strike: 'strike'
};

// Characters a link destination can't hold bare.
const LINK_UNSAFE = /[()<>\s]/g;

const LIST_PREFIX = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;

const MARKS: Mark[] = ['bold', 'code', 'highlight', 'italic', 'strike'];

// Blocks whose text takes inline markup.
const PROSE = new Set<MarkdownBlock['kind']>(['heading', 'list', 'paragraph', 'quote']);

const SPACE = /\s/;

const WORD = /[\p{L}\p{N}_]/u;


// The opening and closing delimiters around a token, as source ranges; null for plain text.
function delimiters(text: string, token: Inline, base: number): [Edit, Edit] | null {
    let from = base + token.from,
        to = base + token.to;

    if (token.kind === 'code') {
        let width = 0;

        while (text[from - width - 1] === '`') {
            width++;
        }

        return [{ from: from - width, insert: '', to: from }, { from: to, insert: '', to: to + width }];
    }

    if (token.kind === 'link') {
        if (token.reference) {
            return null;
        }

        let close = destinationEnd(text, to);

        return close < 0 ? null : [{ from: from - 1, insert: '', to: from }, { from: to, insert: '', to: close }];
    }

    let width = token.kind === 'em' ? 1 : token.kind === 'text' ? 0 : 2;

    return width ? [{ from: from - width, insert: '', to: from }, { from: to, insert: '', to: to + width }] : null;
}

// The offset after a link's '(destination)', from the ']' at 'at'; -1 when it isn't one.
function destinationEnd(text: string, at: number) {
    if (text[at] !== ']' || text[at + 1] !== '(') {
        return -1;
    }

    let depth = 0;

    for (let i = at + 1, n = text.length; i < n; i++) {
        if (text[i] === '\\') {
            i++;
        }
        else if (text[i] === '(') {
            depth++;
        }
        else if (text[i] === ')' && --depth === 0) {
            return i + 1;
        }
    }

    return -1;
}

// The innermost token of 'kind' holding [from, to], with the base its offsets add to; a link holds its whole syntax.
function enclosing(text: string, tokens: readonly Inline[], base: number, kind: Inline['kind'], from: number, to: number): Inline | null {
    let found: Inline | null = null;

    for (let i = 0, n = tokens.length; i < n; i++) {
        let token = tokens[i],
            outer = span(text, token, base);

        if ((outer ? outer[0] : base + token.from) > from || (outer ? outer[1] : base + token.to) < to) {
            continue;
        }

        if (token.kind === kind) {
            found = token;
        }

        if (token.children) {
            found = enclosing(text, token.children, base, kind, from, to) ?? found;
        }
    }

    return found;
}

// Every token of 'kind' (or of any formatting kind when null) touching [from, to].
function inside(tokens: readonly Inline[], base: number, kind: Inline['kind'] | null, from: number, to: number, out: Inline[] = []) {
    for (let i = 0, n = tokens.length; i < n; i++) {
        let token = tokens[i];

        if (base + token.to < from || base + token.from > to) {
            continue;
        }

        if (token.kind !== 'text' && (kind === null || token.kind === kind)) {
            out.push(token);
        }

        if (token.children) {
            inside(token.children, base, kind, from, to, out);
        }
    }

    return out;
}

// Where an offset lands once 'edits' apply; 'after' moves it past text inserted exactly there.
function map(offset: number, edits: readonly Edit[], after: boolean) {
    let shift = 0;

    for (let i = 0, n = edits.length; i < n; i++) {
        let { from, insert, to } = edits[i];

        if (to < offset || (to === offset && (from < to || after))) {
            shift += insert.length - (to - from);
        }
        else if (from < offset) {
            shift += from - offset;
        }
    }

    return offset + shift;
}

// How many formatting tokens there are in 'tokens', nested ones included.
function count(tokens: readonly Inline[]): number {
    let n = 0;

    for (let i = 0, m = tokens.length; i < m; i++) {
        let token = tokens[i];

        n += (token.kind === 'text' ? 0 : 1) + (token.children ? count(token.children) : 0);
    }

    return n;
}

// Applies 'edits' as one step, the selection ('range', or the document's) following the text it held.
function commit(context: Context, edits: Edit[], source: string, range: { end: number; start: number } = context.document.selection) {
    let { direction } = context.document.selection,
        { end, start } = range;

    if (!edits.length) {
        return false;
    }

    edits.sort((a, b) => a.from - b.from || a.to - b.to);

    let next: Selection = {
        direction,
        end: map(end, edits, start === end),
        start: map(start, edits, true)
    };

    return context.document.transact(edits, { selection: next, source }).changed;
}

// The selection's runs of prose, a row at a time, trimmed of the spaces markup can't start or end on.
function slices(context: Context, from: number, to: number) {
    let { blocks, document } = context,
        out: Slice[] = [],
        text = document.value;

    for (let i = blockAt(blocks, from), n = blocks.length; i < n && blocks[i].from <= to; i++) {
        let block = blocks[i];

        if (!PROSE.has(block.kind)) {
            continue;
        }

        let rows = block.lines ?? [block];

        for (let j = 0, m = rows.length; j < m; j++) {
            let a = Math.max(from, rows[j].contentFrom),
                b = Math.min(to, rows[j].contentTo);

            while (a < b && SPACE.test(text[a])) {
                a++;
            }

            while (b > a && SPACE.test(text[b - 1])) {
                b--;
            }

            if (a < b) {
                let tokens = context.tokens(block),
                    [c, d] = snap(text, tokens, block.from, a, b);

                out.push({ base: block.from, from: c, row: [rows[j].contentFrom, rows[j].contentTo], to: d, tokens });
            }
            else if (from === to && a === b && rows[j].contentFrom <= a && a <= rows[j].contentTo) {
                out.push({
                    base: block.from,
                    from: a,
                    row: [rows[j].contentFrom, rows[j].contentTo],
                    to: b,
                    tokens: context.tokens(block)
                });
            }
        }
    }

    return out;
}

// Whether 'edits' leave the row's markup whole: 'removed' tokens gone, one added, and nothing else lost to delimiters
// that can't open or close where they landed.
function parses(text: string, row: [number, number], edits: readonly Edit[], removed: number) {
    let at = row[0],
        next = '';

    for (let edit of [...edits].sort((a, b) => a.from - b.from || a.to - b.to)) {
        next += text.slice(at, edit.from) + edit.insert;
        at = edit.to;
    }

    next += text.slice(at, row[1]);

    return count(parseInline(next, 0, 0, new Map())) ===
        count(parseInline(text.slice(row[0], row[1]), 0, 0, new Map())) - removed + 1;
}

// A run reaching into a link's hidden '](destination)', or across its edges, takes the whole link: markup can't
// split one. Runs inside the link's text stay as they are; code spans are taken whole, as markup inside one is text.
function snap(text: string, tokens: readonly Inline[], base: number, from: number, to: number): [number, number] {
    for (let i = 0, n = tokens.length; i < n; i++) {
        let token = tokens[i],
            outer = span(text, token, base);

        if (
            outer &&
            from < outer[1] &&
            to > outer[0] &&
            (token.kind === 'code' || from < base + token.from || to > base + token.to)
        ) {
            from = Math.min(from, outer[0]);
            to = Math.max(to, outer[1]);
        }

        if (token.children) {
            [from, to] = snap(text, token.children, base, from, to);
        }
    }

    return [from, to];
}

// A code span with its backticks, or an inline link's whole '[text](destination)', absolute; null for anything else.
function span(text: string, token: Inline, base: number): [number, number] | null {
    if (token.kind === 'code') {
        let pair = delimiters(text, token, base)!;

        return [pair[0].from, pair[1].to];
    }

    if (token.kind !== 'link' || token.reference) {
        return null;
    }

    let close = destinationEnd(text, base + token.to);

    return close < 0 ? null : [base + token.from - 1, close];
}

// A run grown out to the spaces around it, so its marks open and close on word edges.
function widen(text: string, part: Slice): Slice {
    let from = part.from,
        to = part.to;

    while (from > part.row[0] && !SPACE.test(text[from - 1])) {
        from--;
    }

    while (to < part.row[1] && !SPACE.test(text[to])) {
        to++;
    }

    [from, to] = snap(text, part.tokens, part.base, from, to);

    return { ...part, from, to };
}

// The word around a caret, or the caret itself between words.
function word(text: string, offset: number) {
    let from = offset,
        to = offset;

    while (from > 0 && WORD.test(text[from - 1])) {
        from--;
    }

    while (to < text.length && WORD.test(text[to])) {
        to++;
    }

    return { from, to };
}


// The kind of block at a source offset, as the toolbar names it; null for blocks it can't turn into.
const blockKindAt = (context: Context, offset: number): BlockKind | null => {
    let block = context.blocks[blockAt(context.blocks, offset)];

    switch (block?.kind) {
        case 'code':
        case 'fence':
            return 'codeblock';
        case 'heading':
            return (block.level ?? 1) <= 3 ? (`h${block.level ?? 1}` as BlockKind) : null;
        case 'list':
            return block.task ? 'task' : /\d/.test(block.marker ?? '') ? 'ordered' : 'bullet';
        case 'quote':
            return 'quote';
        case 'blank':
        case 'paragraph':
            return block.quoteDepth ? 'quote' : 'paragraph';
        default:
            return null;
    }
};

// Removes every inline format in the selection: emphasis, highlights, code and links keep only their text.
const clearFormats = (context: Context) => {
    let { end, start } = context.document.selection,
        edits: Edit[] = [],
        seen = new Set<number>(),
        text = context.document.value;

    for (let slice of slices(context, start, end)) {
        for (let token of inside(slice.tokens, slice.base, null, slice.from, slice.to)) {
            let pair = delimiters(text, token, slice.base);

            if (pair && !seen.has(pair[0].from)) {
                seen.add(pair[0].from);
                edits.push(...pair);
            }
        }
    }

    return commit(context, edits, 'markdown-format');
};

const formatsAt = (context: Context): Formats => {
    let { end, start } = context.document.selection,
        text = context.document.value,
        parts = slices(context, start, end),
        marks = {} as Record<Mark, boolean>,
        link: string | null = null;

    for (let i = 0, n = MARKS.length; i < n; i++) {
        let kind = KINDS[MARKS[i]];

        marks[MARKS[i]] = parts.length > 0 && parts.every((part) => !!enclosing(text, part.tokens, part.base, kind, part.from, part.to));
    }

    if (parts.length === 1) {
        link = enclosing(text, parts[0].tokens, parts[0].base, 'link', parts[0].from, parts[0].to)?.href ?? null;
    }

    return { block: blockKindAt(context, start), link, marks };
};

// Sets or replaces the link over the selection; a null address takes the link off and keeps its text.
const setLink = (context: Context, href: string | null) => {
    let { end, start } = context.document.selection,
        text = context.document.value,
        parts = slices(context, start, end),
        part = parts[0];

    if (parts.length !== 1) {
        return false;
    }

    let existing = enclosing(text, part.tokens, part.base, 'link', part.from, part.to),
        destination = href?.replace(LINK_UNSAFE, encodeURIComponent);

    if (existing && !existing.reference) {
        let to = part.base + existing.to,
            close = destinationEnd(text, to);

        if (close < 0) {
            return false;
        }

        if (destination === undefined) {
            return commit(context, [...delimiters(text, existing, part.base)!], 'markdown-link');
        }

        return commit(context, [{ from: to + 2, insert: destination, to: close - 1 }], 'markdown-link');
    }

    if (destination === undefined || part.from === part.to) {
        return false;
    }

    return commit(context, [
        { from: part.from, insert: '[', to: part.from },
        { from: part.to, insert: `](${destination})`, to: part.to }
    ], 'markdown-link');
};

// Turns the lines the selection touches into one kind of block: their own markers go and the new one takes their place.
// A paragraph left after a list or quote, or a list or quote before a paragraph, is set apart by a blank line so it
// doesn't run on into it.
const setBlockKind = (context: Context, kind: BlockKind) => {
    let { document } = context,
        { end, start } = document.selection,
        first = document.lineAt(start),
        last = document.lineAt(end),
        current = blockKindAt(context, start),
        edits: Edit[] = [],
        eol = document.eol;

    if (end > start && end === document.lineStart(last) && last > first) {
        last--;
    }

    // A code block's fences go before its lines take the new kind.
    if (current === 'codeblock') {
        let block = context.blocks[blockAt(context.blocks, start)];

        if (block.kind === 'fence') {
            let open = document.lineAt(block.from),
                close = document.lineAt(Math.max(block.from, contentEnd(document.value, block)));

            if (FENCE_LINE.test(document.lineText(close)) && close > open) {
                edits.push({ from: document.lineStart(close) - eol.length, insert: '', to: document.lineEnd(close) });
            }

            edits.push({ from: document.lineStart(open), insert: '', to: document.lineStart(open + 1) });
            first = Math.max(first, open + 1);
            last = Math.min(Math.max(last, first), close - 1);
        }

        if (kind === 'codeblock') {
            return false;
        }
    }

    let number = 1;

    for (let line = first; line <= last; line++) {
        let value = document.lineText(line),
            quote = quotePrefix(value).length,
            rest = value.slice(quote),
            marker = HEADING_PREFIX.exec(rest)?.[0] ?? LIST_PREFIX.exec(rest)?.[0] ?? '',
            from = document.lineStart(line),
            prefix = '';

        switch (kind) {
            case 'bullet':
                prefix = '- ';
                break;
            case 'h1':
            case 'h2':
            case 'h3':
                prefix = '#'.repeat(Number(kind[1])) + ' ';
                break;
            case 'ordered':
                prefix = `${number++}. `;
                break;
            case 'quote':
                prefix = '> ';
                break;
            case 'task':
                prefix = '- [ ] ';
                break;
        }

        edits.push({ from, insert: prefix, to: from + quote + marker.length });
    }

    if (kind === 'codeblock') {
        edits.push(
            { from: document.lineStart(first), insert: '```' + eol, to: document.lineStart(first) },
            { from: document.lineEnd(last), insert: eol + '```', to: document.lineEnd(last) }
        );
    }

    let container = (line: number) => {
            let value = document.lineText(line);

            return !!value.trim() && (quotePrefix(value).length > 0 || LIST_PREFIX.test(value));
        },
        prose = (line: number) => {
            let value = document.lineText(line);

            return !!value.trim()
                && !quotePrefix(value).length
                && !FENCE_LINE.test(value)
                && !HEADING_PREFIX.test(value)
                && !LIST_PREFIX.test(value);
        },
        nested = kind === 'bullet' || kind === 'ordered' || kind === 'quote' || kind === 'task';

    if (kind === 'paragraph' && first > 0 && container(first - 1)) {
        edits.push({ from: document.lineStart(first), insert: eol, to: document.lineStart(first) });
    }

    if (nested && last + 1 < document.lineCount && prose(last + 1)) {
        edits.push({ from: document.lineEnd(last), insert: eol, to: document.lineEnd(last) });
    }

    return commit(context, edits, 'markdown-block');
};

// Wraps the selection in a mark, or takes the mark off when all of it already carries one. A caret takes the word
// around it; between words it gets an empty pair to type into.
const toggleMark = (context: Context, mark: Mark) => {
    let { document } = context,
        { end, start } = document.selection,
        text = document.value,
        kind = KINDS[mark],
        edits: Edit[] = [];

    if (start === end) {
        let around = word(text, start);

        start = around.from;
        end = around.to;
    }

    let open = mark === 'code' ? '`' : DELIMITERS[mark],
        parts = slices(context, start, end),
        active = parts.length > 0 && parts.every((part) => !!enclosing(text, part.tokens, part.base, kind, part.from, part.to));

    if (!parts.length) {
        return false;
    }

    if (start === end && !active) {
        return document.replace(start, end, open + open, { selection: { start: start + open.length }, source: 'markdown-format' });
    }

    let seen = new Set<number>(),
        // The edits marking 'part', or null when they wouldn't parse; 'selected' is the run the selection asked for.
        // Marks of the same kind inside it merge into the new one. Code takes the marks inside it, as markup in code is
        // text, but those that held all of 'selected' move outside it so the text keeps them.
        wrap = (part: Slice, selected: Slice) => {
            let after = open,
                before = open,
                local: Edit[] = [],
                removed = 0;

            for (let token of inside(part.tokens, part.base, mark === 'code' ? null : kind, part.from, part.to)) {
                let pair = delimiters(text, token, part.base);

                if (!pair || seen.has(pair[0].from) || pair[0].from < part.from || pair[1].to > part.to) {
                    continue;
                }

                local.push(...pair);
                removed++;

                if (mark === 'code' && part.base + token.from <= selected.from && part.base + token.to >= selected.to) {
                    after += text.slice(pair[1].from, pair[1].to);
                    before = text.slice(pair[0].from, pair[0].to) + before;
                    removed--;
                }
            }

            local.push({ from: part.from, insert: before, to: part.from }, { from: part.to, insert: after, to: part.to });

            return parses(text, part.row, local, removed) ? local : null;
        };

    // The selection keeps to the text the marks went on, past spaces they skipped; marks grown out to words leave it
    // where it was, so it still reads as inside them.
    let range = { end: parts[parts.length - 1].to, start: parts[0].from };

    for (let i = 0, n = parts.length; i < n; i++) {
        let part = parts[i];

        if (active) {
            let pair = delimiters(text, enclosing(text, part.tokens, part.base, kind, part.from, part.to)!, part.base);

            if (pair && !seen.has(pair[0].from)) {
                seen.add(pair[0].from);
                edits.push(...pair);
            }

            continue;
        }

        // Inside a word, beside other markup, marks can't always open or close; on the word's edges they always can.
        let local = wrap(part, part);

        if (!local) {
            local = wrap(widen(text, part), part);
        }

        if (!local) {
            return false;
        }

        for (let j = 0, m = local.length; j < m; j += 2) {
            seen.add(local[j].from);
        }

        edits.push(...local);
    }

    let selection = document.selection;

    return commit(context, edits, 'markdown-format', selection.start === selection.end ? selection : range);
};


export { blockKindAt, clearFormats, formatsAt, setBlockKind, setLink, toggleMark };
export type { BlockKind, Context, Formats, Mark };
