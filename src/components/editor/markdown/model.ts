import { preferredEol, type Edit, type EditorDocument, type Selection } from '../code/document';
import { referenceLabel } from './inline';


type Kind = 'blank' | 'code' | 'fence' | 'frontmatter' | 'heading' | 'html' | 'list' | 'paragraph' | 'quote' | 'rule';

type MarkdownBlock = {
    contentFrom: number;
    contentTo: number;
    // Holds link reference definitions, which links in every block resolve against.
    definitions?: boolean;
    from: number;
    // Source indentation columns (tabs stop every four columns), kept for nested containers.
    indent: number;
    kind: Kind;
    language?: string;
    level?: number;
    lines?: Row[];
    marker?: string;
    quoteDepth: number;
    task?: Task;
    to: number;
};

type Row = { contentFrom: number; contentTo: number; from: number; to: number };

// The previous parse's blocks 'dropped' at 'start' became [start, start + inserted); the rest kept their objects,
// shifted to the new text.
type Splice = { dropped: MarkdownBlock[]; inserted: number; start: number };

type Step = { block: MarkdownBlock; line: number };

type Task = { checked: boolean; offset: number };


const CODE_INDENT = 4;

const DEFINITION = /^ {0,3}\[[^\]\r\n]+\]:/;

const DEFINITIONS = /^ {0,3}\[([^\]\r\n]+)\]:[ \t]*(?:<([^<>\r\n]+)>|(\S+))(?:[ \t]+["'(].*)?[ \t]*\r?$/gm;

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

const FRONTMATTER = /^(?:﻿)?---(?:\r\n|\r|\n)([\s\S]*?)(?:\r\n|\r|\n)(?:---|\.\.\.)[ \t]*(?:(?:\r\n|\r|\n)|$)/;

const FRONTMATTER_START = /^﻿?---/;

const HEADING = /^( {0,3})(#{1,6})(?:[ \t]+|$)/;

const HEADING_CLOSE = /[ \t]+#+[ \t]*$/;

const HTML = /^ {0,3}(?:<\/?[A-Za-z]|<!--)/;

const INDENTED = /^(?: {4}|\t)/;

const LIST = /^([ \t]*)([-+*]|\d+[.)])([ \t]+)(?:\[([ xX])\]([ \t]+))?/;

const LIST_CONTEXT = /^(\s*)([-+*]|(\d+)([.)]))[ \t]+(?:\[([ xX])\][ \t]+)?/;

const LIST_ITEM = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/;

const ORDERED = /^(\s*)(\d+)([.)])[ \t]+/;

const QUOTE = / {0,3}>[ \t]?/y;

const RULE = /^ {0,3}(?:[-*_][ \t]*){3,}$/;

const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;

// Lines that start a block of their own, so they end a paragraph or a quote's lazy continuation.
const SPECIAL = /^(?:\s*$| {0,3}#{1,6}(?:\s|$)| {0,3}>|\s*(?:[-+*]|\d+[.)])\s+|(?: {4}|\t)| {0,3}(?:`{3,}|~{3,})| {0,3}(?:<\/?[A-Za-z]|<!--)| {0,3}(?:[-*_][ \t]*){3,}$)/;

// Items spliced in one call before a splice copies instead.
const SPREAD = 8192;

const TASK = /[ xX]/;

const TRAILING_EOL = /(?:\r\n|\r|\n)$/;

const WORD = /[\p{L}\p{N}_]/u;


// Line 'i' of a parse: its quote prefix and the text after it.
function at(text: string, starts: readonly number[], i: number) {
    let from = starts[i],
        to = end(text, starts, i),
        line = text.slice(from, to),
        quote = quotePrefix(line);

    return { from, line, quote, raw: line.slice(quote.length), to };
}

// End of line 'i' without its break.
function end(text: string, starts: readonly number[], i: number) {
    let to = starts[i + 1] ?? text.length,
        from = starts[i];

    if (to > from && text.charCodeAt(to - 1) === 10) {
        to--;
    }

    if (to > from && text.charCodeAt(to - 1) === 13) {
        to--;
    }

    return to;
}

// Characters to drop from 'value' to remove 'columns' columns of indentation.
function indentLength(value: string, columns: number) {
    let removed = 0,
        width = 0;

    while (width < columns && (value[removed] === ' ' || value[removed] === '\t')) {
        width += value[removed] === '\t' ? 4 - (width % 4) : 1;
        removed++;
    }

    return removed;
}

function lineContext(document: EditorDocument) {
    let index = document.lineAt(document.selection.start),
        from = document.lineStart(index),
        text = document.lineText(index),
        quote = text.slice(0, quotePrefix(text).length),
        list = LIST_CONTEXT.exec(text.slice(quote.length));

    return { from, index, list, prefix: quote + (list?.[0] ?? ''), quote, text };
}

// Start of the line after 'i'.
function next(text: string, starts: readonly number[], i: number) {
    return starts[i + 1] ?? text.length;
}

// Whether two parses of unchanged text found the same block.
function same(a: MarkdownBlock, b: MarkdownBlock) {
    return a.from === b.from &&
        a.to === b.to &&
        a.contentFrom === b.contentFrom &&
        a.contentTo === b.contentTo &&
        a.kind === b.kind &&
        a.level === b.level &&
        a.indent === b.indent &&
        a.quoteDepth === b.quoteDepth &&
        a.marker === b.marker &&
        a.language === b.language &&
        a.definitions === b.definitions &&
        a.task?.checked === b.task?.checked &&
        a.lines?.length === b.lines?.length;
}

// Array.splice, without spreading a whole document's blocks into one call's arguments.
function splice(list: MarkdownBlock[], start: number, count: number, items: MarkdownBlock[]) {
    if (items.length < SPREAD) {
        return list.splice(start, count, ...items);
    }

    let dropped = list.slice(start, start + count),
        tail = list.slice(start + count);

    list.length = start;

    for (let i = 0, n = items.length; i < n; i++) {
        list.push(items[i]);
    }

    for (let i = 0, n = tail.length; i < n; i++) {
        list.push(tail[i]);
    }

    return dropped;
}

// The block starting on line 'i', and the line after it.
function step(text: string, starts: readonly number[], i: number): Step {
    let count = starts.length,
        { from, quote, raw, to } = at(text, starts, i),
        block: MarkdownBlock = {
            contentFrom: from + quote.length,
            contentTo: to,
            from,
            indent: 0,
            kind: 'paragraph',
            quoteDepth: quote.depth,
            to: next(text, starts, i)
        },
        fence = FENCE.exec(raw),
        heading = HEADING.exec(raw),
        list = LIST.exec(raw);

    if (fence) {
        let close = new RegExp(`^ {0,3}${fence[2][0] === '`' ? '`' : '~'}{${fence[2].length},}[ \\t]*$`),
            j = i + 1;

        while (j < count && !close.test(at(text, starts, j).raw)) {
            j++;
        }

        block.contentFrom = next(text, starts, i);
        block.contentTo = starts[j] ?? text.length;
        block.kind = 'fence';
        block.language = fence[3].trim();
        block.lines = [];
        block.to = j < count ? next(text, starts, j) : text.length;

        for (let n = i + 1; n < j; n++) {
            let line = at(text, starts, n);

            block.lines.push({
                contentFrom: line.from + line.quote.length,
                contentTo: line.to,
                from: line.from,
                to: next(text, starts, n)
            });
        }

        return { block, line: Math.min(j, count - 1) + 1 };
    }

    if (!raw.trim()) {
        block.kind = 'blank';

        return { block, line: i + 1 };
    }

    if (heading) {
        block.contentFrom += heading[0].length;
        block.contentTo -= HEADING_CLOSE.exec(raw)?.[0].length ?? 0;
        block.kind = 'heading';
        block.level = heading[2].length;

        return { block, line: i + 1 };
    }

    if (RULE.test(raw)) {
        block.kind = 'rule';

        return { block, line: i + 1 };
    }

    if (list) {
        let required = indentColumns(list[1]) + list[2].length + list[3].length;

        block.contentFrom += list[0].length;
        block.indent = indentColumns(list[1]);
        block.kind = 'list';
        block.marker = list[2];

        if (list[4] !== undefined) {
            block.task = { checked: list[4].toLowerCase() === 'x', offset: from + quote.length + list[0].indexOf('[') + 1 };
        }

        while (i + 1 < count) {
            let line = at(text, starts, i + 1);

            if (
                line.quote.depth !== quote.depth ||
                !line.raw.trim() ||
                indentColumns(line.raw) < required ||
                LIST_ITEM.test(line.raw)
            ) {
                break;
            }

            block.lines ??= [{ contentFrom: block.contentFrom, contentTo: block.contentTo, from, to: block.to }];
            i++;
            block.contentTo = line.to;
            block.to = next(text, starts, i);
            block.lines.push({
                contentFrom: line.from + line.quote.length + indentLength(line.raw, required),
                contentTo: line.to,
                from: line.from,
                to: block.to
            });
        }

        return { block, line: i + 1 };
    }

    if (indentColumns(raw) >= CODE_INDENT) {
        let j = i,
            lines: Row[] = [];

        while (j < count) {
            let line = at(text, starts, j);

            if (line.quote.depth !== quote.depth || (line.raw.trim() && indentColumns(line.raw) < CODE_INDENT)) {
                break;
            }

            lines.push({
                contentFrom: line.from + line.quote.length + indentLength(line.raw, CODE_INDENT),
                contentTo: line.to,
                from: line.from,
                to: next(text, starts, j)
            });
            j++;
        }

        // Trailing blank lines belong to the following block, not the code widget.
        while (lines.length > 1 && !text.slice(lines[lines.length - 1].contentFrom, lines[lines.length - 1].contentTo).trim()) {
            lines.pop();
            j--;
        }

        block.contentFrom = lines[0].contentFrom;
        block.contentTo = lines[lines.length - 1].contentTo;
        block.kind = 'code';
        block.lines = lines;
        block.to = next(text, starts, j - 1);

        return { block, line: j };
    }

    if (quote.depth) {
        block.kind = 'quote';
        block.lines = [{ contentFrom: block.contentFrom, contentTo: to, from, to: block.to }];

        while (i + 1 < count) {
            let line = at(text, starts, i + 1);

            if ((line.quote.depth !== quote.depth && !(quote.depth === 1 && line.quote.depth === 0)) || SPECIAL.test(line.raw)) {
                break;
            }

            i++;
            block.contentTo = line.to;
            block.to = next(text, starts, i);
            block.lines.push({ contentFrom: line.from + line.quote.length, contentTo: line.to, from: line.from, to: block.to });
        }

        return { block, line: i + 1 };
    }

    if (HTML.test(raw)) {
        block.kind = 'html';

        while (i + 1 < count && at(text, starts, i + 1).line.trim()) {
            i++;
            block.contentTo = end(text, starts, i);
            block.to = next(text, starts, i);
        }

        return { block, line: i + 1 };
    }

    if (i + 1 < count && SETEXT.test(at(text, starts, i + 1).line)) {
        block.kind = 'heading';
        block.level = at(text, starts, i + 1).line.trim()[0] === '=' ? 1 : 2;
        block.to = next(text, starts, i + 1);

        return { block, line: i + 2 };
    }

    while (i + 1 < count) {
        let line = at(text, starts, i + 1).line;

        if (SPECIAL.test(line) && !INDENTED.test(line)) {
            break;
        }

        i++;
        block.contentTo = end(text, starts, i);
        block.to = next(text, starts, i);
    }

    block.definitions = DEFINITION.test(text.slice(block.contentFrom, block.contentTo)) || undefined;

    return { block, line: i + 1 };
}


// Index of the block holding 'offset': the last one starting at or before it.
const blockAt = (blocks: readonly MarkdownBlock[], offset: number) => {
    let hi = blocks.length,
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if (blocks[mid].from <= offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    return Math.max(0, lo - 1);
};

// The blocks [first, last) a selection touches; a caret at the very end belongs to the last block.
const blocksAt = (blocks: readonly MarkdownBlock[], selection: Pick<Selection, 'end' | 'start'>) => {
    if (!blocks.length) {
        return { first: 0, last: 0 };
    }

    let first = blockAt(blocks, selection.start),
        last = selection.end > selection.start ? blockAt(blocks, selection.end - 1) : first;

    return { first, last: last + 1 };
};

// The block's source without its final line break.
const contentEnd = (text: string, block: MarkdownBlock) => {
    return block.to - (TRAILING_EOL.exec(text.slice(Math.max(block.from, block.to - 2), block.to))?.[0].length ?? 0);
};

const indentColumns = (text: string) => {
    let columns = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        if (text[i] === ' ') {
            columns++;
        }
        else if (text[i] === '\t') {
            columns += 4 - (columns % 4);
        }
        else {
            break;
        }
    }

    return columns;
};

const markdownBackspace = (document: EditorDocument) => {
    if (document.selection.start !== document.selection.end) {
        return false;
    }

    let { from, list, prefix, quote } = lineContext(document),
        offset = document.selection.start;

    if (!prefix || offset !== from + prefix.length) {
        return false;
    }

    let start = from + (list ? quote.length : quote.lastIndexOf('>'));

    return document.replace(start, offset, '', { selection: { start }, source: 'markdown-unwrap' });
};

// Continues a list item or quote on Enter, renumbering the ordered items after it; on an empty item it ends the
// list instead. 'kind' names the block at the caret, where fenced, indented, HTML and frontmatter source is literal.
const markdownEnter = (document: EditorDocument, kind?: Kind) => {
    let { from, index, list, prefix, quote, text } = lineContext(document),
        { end, start } = document.selection;

    kind ??= parseMarkdown(document).find((block) => start >= block.from && start < block.to)?.kind;

    if (kind === 'code' || kind === 'fence' || kind === 'frontmatter' || kind === 'html') {
        return false;
    }

    if ((!quote && !list) || start < from + prefix.length) {
        return false;
    }

    if (!text.slice(prefix.length).trim()) {
        let at = list ? quote.length : quote.lastIndexOf('>'),
            remove = prefix.length - at;

        return document.replace(from + at, from + prefix.length, '', {
            selection: { end: Math.max(from, end - remove), start: Math.max(from, start - remove) },
            source: 'markdown-unwrap'
        });
    }

    let continued = quote;

    if (list) {
        continued += list[1] + (list[3] ? `${Number(list[3]) + 1}${list[4]}` : list[2]) + ' ' + (list[5] !== undefined ? '[ ] ' : '');
    }

    let insert = preferredEol(document.value) + continued,
        edits: Edit[] = [{ from: start, insert, to: end }];

    if (list?.[3]) {
        let expected = Number(list[3]) + 1;

        for (let line = index + 1, n = document.lineCount; line < n; line++) {
            let value = document.lineText(line);

            if (!value.trim()) {
                continue;
            }

            if (!value.startsWith(quote)) {
                break;
            }

            let candidate = ORDERED.exec(value.slice(quote.length));

            if (!candidate || candidate[1] !== list[1] || candidate[3] !== list[4] || Number(candidate[2]) !== expected) {
                break;
            }

            let at = document.lineStart(line) + quote.length + candidate[1].length;

            edits.push({ from: at, insert: String(++expected), to: at + candidate[2].length });
        }
    }

    return document.transact(edits, { selection: { start: start + insert.length }, source: 'markdown-enter' }).changed;
};

const markdownReferences = (text: string) => {
    let references = new Map<string, string>();

    for (let match of text.matchAll(DEFINITIONS)) {
        let label = referenceLabel(match[1]);

        if (!references.has(label)) {
            references.set(label, match[2] ?? match[3]);
        }
    }

    return references;
};

const parseMarkdown = (document: EditorDocument): MarkdownBlock[] => {
    let blocks: MarkdownBlock[] = [],
        starts = document.starts,
        text = document.value,
        front = FRONTMATTER.exec(text),
        i = 0;

    if (front) {
        let content = text.indexOf(front[1]);

        blocks.push({
            contentFrom: content,
            contentTo: content + front[1].length,
            from: 0,
            indent: 0,
            kind: 'frontmatter',
            quoteDepth: 0,
            to: front[0].length
        });

        while (i < starts.length && starts[i] < front[0].length) {
            i++;
        }
    }

    for (let n = starts.length; i < n;) {
        let { block, line } = step(text, starts, i);

        blocks.push(block);
        i = line;
    }

    return blocks;
};

const quotePrefix = (text: string) => {
    let cursor = 0,
        depth = 0;

    for (;;) {
        QUOTE.lastIndex = cursor;

        if (!QUOTE.test(text)) {
            break;
        }

        cursor = QUOTE.lastIndex;
        depth++;
    }

    return { depth, length: cursor };
};

// Brings 'blocks', parsed from an earlier text, up to the document after edits that changed only [from, to) of
// the new text and moved everything after by 'shift'. Parsing restarts a block before the edit (blank lines skipped,
// since an indented block can reach over them) and stops once a new block starts where an old one did; the old
// blocks from there on are the same source, shifted in place so they keep their identity.
const reparse = (blocks: MarkdownBlock[], document: EditorDocument, from: number, to: number, shift: number): Splice => {
    let text = document.value,
        front = blocks[0]?.kind === 'frontmatter';

    // Frontmatter only exists at the very start, and an edit anywhere can close an unclosed one.
    if (!blocks.length || (FRONTMATTER_START.test(text) && (!front || from <= blocks[0].to))) {
        let next = parseMarkdown(document);

        return { dropped: splice(blocks, 0, blocks.length, next), inserted: next.length, start: 0 };
    }

    let first = blockAt(blocks, from),
        start = Math.max(front ? 1 : 0, first - 1);

    while (start > (front ? 1 : 0) && blocks[start].kind === 'blank') {
        start--;
    }

    let starts = document.starts,
        count = starts.length,
        k = first,
        line = document.lineAt(blocks[start].from),
        parsed: MarkdownBlock[] = [];

    while (line < count) {
        let offset = starts[line];

        if (offset >= to) {
            while (k < blocks.length && blocks[k].from + shift < offset) {
                k++;
            }

            if (k < blocks.length && blocks[k].from + shift === offset) {
                break;
            }
        }

        let next = step(text, starts, line);

        parsed.push(next.block);
        line = next.line;
    }

    if (line >= count) {
        k = blocks.length;
    }

    // Blocks before the edit that parsed the same keep their objects, and with them their drawing.
    let kept = 0;

    while (kept < parsed.length && start + kept < k && parsed[kept].to <= from && same(parsed[kept], blocks[start + kept])) {
        kept++;
    }

    if (kept) {
        parsed.splice(0, kept);
        start += kept;
    }

    if (shift) {
        for (let i = k, n = blocks.length; i < n; i++) {
            shiftBlock(blocks[i], shift);
        }
    }

    return { dropped: splice(blocks, start, k - start, parsed), inserted: parsed.length, start };
};

const shiftBlock = (block: MarkdownBlock, by: number) => {
    block.contentFrom += by;
    block.contentTo += by;
    block.from += by;
    block.to += by;

    if (block.task) {
        block.task.offset += by;
    }

    let lines = block.lines;

    if (lines) {
        for (let i = 0, n = lines.length; i < n; i++) {
            let row = lines[i];

            row.contentFrom += by;
            row.contentTo += by;
            row.from += by;
            row.to += by;
        }
    }
};

const toggleMarkdown = (document: EditorDocument, marker: '*' | '**') => {
    let { direction, end, start } = document.selection,
        text = document.value,
        edit: Edit;

    if (start === end) {
        while (start > 0 && WORD.test(text[start - 1])) {
            start--;
        }

        while (end < text.length && WORD.test(text[end])) {
            end++;
        }
    }

    let selected = text.slice(start, end);

    if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
        edit = { from: start, insert: selected.slice(marker.length, -marker.length), to: end };
        end -= marker.length * 2;
    }
    else if (text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker) {
        edit = { from: start - marker.length, insert: selected, to: end + marker.length };
        start -= marker.length;
        end -= marker.length;
    }
    else {
        edit = { from: start, insert: marker + selected + marker, to: end };
        start += marker.length;
        end += marker.length;
    }

    return document.transact([edit], { selection: { direction, end, start }, source: 'markdown-format' }).changed;
};

const toggleTask = (document: EditorDocument, task: Task) => {
    let value = document.value;

    if (value[task.offset - 1] !== '[' || value[task.offset + 1] !== ']' || !TASK.test(value[task.offset] ?? '')) {
        return false;
    }

    return document.replace(task.offset, task.offset + 1, value[task.offset] === ' ' ? 'x' : ' ', {
        selection: document.selection,
        source: 'markdown-task'
    });
};


export {
    blockAt,
    blocksAt,
    contentEnd,
    indentColumns,
    markdownBackspace,
    markdownEnter,
    markdownReferences,
    parseMarkdown,
    quotePrefix,
    reparse,
    shiftBlock,
    toggleMarkdown,
    toggleTask
};
export type { Kind, MarkdownBlock, Row, Splice, Task };
