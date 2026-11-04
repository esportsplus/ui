import { blockAt, contentEnd, quotePrefix, type MarkdownBlock } from './model';
import type { Edit, EditorDocument, Selection } from '../code/document';
import type { Inline } from './inline';


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

// A run of a block's text the selection covers, absolute, with the block's markup.
type Slice = { base: number; from: number; to: number; tokens: readonly Inline[] };


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

// The innermost token of 'kind' holding [from, to], with the base its offsets add to.
function enclosing(tokens: readonly Inline[], base: number, kind: Inline['kind'], from: number, to: number): Inline | null {
    let found: Inline | null = null;

    for (let i = 0, n = tokens.length; i < n; i++) {
        let token = tokens[i];

        if (base + token.from > from || base + token.to < to) {
            continue;
        }

        if (token.kind === kind) {
            found = token;
        }

        if (token.children) {
            found = enclosing(token.children, base, kind, from, to) ?? found;
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

// Applies 'edits' as one step, the selection following the text it held.
function commit(context: Context, edits: Edit[], source: string) {
    let { direction, end, start } = context.document.selection;

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

            if (a < b || (from === to && a === b && rows[j].contentFrom <= a && a <= rows[j].contentTo)) {
                out.push({ base: block.from, from: a, to: b, tokens: context.tokens(block) });
            }
        }
    }

    return out;
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
        parts = slices(context, start, end),
        marks = {} as Record<Mark, boolean>,
        link: string | null = null;

    for (let i = 0, n = MARKS.length; i < n; i++) {
        let kind = KINDS[MARKS[i]];

        marks[MARKS[i]] = parts.length > 0 && parts.every((part) => !!enclosing(part.tokens, part.base, kind, part.from, part.to));
    }

    if (parts.length === 1) {
        link = enclosing(parts[0].tokens, parts[0].base, 'link', parts[0].from, parts[0].to)?.href ?? null;
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

    let existing = enclosing(part.tokens, part.base, 'link', part.from, part.to),
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
        active = parts.length > 0 && parts.every((part) => !!enclosing(part.tokens, part.base, kind, part.from, part.to));

    if (!parts.length) {
        return false;
    }

    if (start === end && !active) {
        return document.replace(start, end, open + open, { selection: { start: start + open.length }, source: 'markdown-format' });
    }

    let seen = new Set<number>(),
        strip = (part: Slice, token: Inline) => {
            let pair = delimiters(text, token, part.base);

            if (pair && !seen.has(pair[0].from)) {
                seen.add(pair[0].from);
                edits.push(...pair);
            }
        };

    for (let i = 0, n = parts.length; i < n; i++) {
        let part = parts[i];

        if (active) {
            strip(part, enclosing(part.tokens, part.base, kind, part.from, part.to)!);
            continue;
        }

        // Marks of the same kind inside the run merge into the one around it.
        for (let token of inside(part.tokens, part.base, kind, part.from, part.to)) {
            if (part.base + token.from >= part.from && part.base + token.to <= part.to) {
                strip(part, token);
            }
        }

        edits.push({ from: part.from, insert: open, to: part.from }, { from: part.to, insert: open, to: part.to });
    }

    return commit(context, edits, 'markdown-format');
};


export { blockKindAt, clearFormats, formatsAt, setBlockKind, setLink, toggleMark };
export type { BlockKind, Context, Formats, Mark };
