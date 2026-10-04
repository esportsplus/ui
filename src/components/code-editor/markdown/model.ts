import { EditorDocument, floorIndex, lineEnd, preferredEol, type Edit, type Selection } from '../document';

export type MarkdownBlock = {
    kind: 'paragraph' | 'heading' | 'quote' | 'list' | 'fence' | 'code' | 'frontmatter' | 'html' | 'rule' | 'blank';
    from: number;
    to: number;
    contentFrom: number;
    contentTo: number;
    level?: number;
    task?: { offset: number; checked: boolean };
    marker?: string;
    language?: string;
    /** Source indentation columns (tabs use four-column stops), retained for nested containers. */
    indent?: number;
    quoteDepth?: number;
    lines?: { from: number; to: number; contentFrom: number; contentTo: number }[];
    /** View-only slices of a large logical block; the document model retains the whole block. */
    continuation?: boolean;
    continues?: boolean;
};
export { parseInline, safeUrl } from './inline';
export type { Inline } from './inline';
import { referenceLabel } from './inline';

const special =
    /^(?:\s*$| {0,3}#{1,6}(?:\s|$)| {0,3}>|\s*(?:[-+*]|\d+[.)])\s+|(?: {4}|\t)| {0,3}(?:`{3,}|~{3,})| {0,3}(?:<\/?[A-Za-z]|<!--)| {0,3}(?:[-*_][ \t]*){3,}$)/;
export function indentColumns(text: string) {
    let columns = 0;
    for (let char of text) {
        if (char === ' ') columns++;
        else if (char === '\t') columns += 4 - (columns % 4);
        else break;
    }
    return columns;
}
export function quotePrefix(text: string) {
    let cursor = 0,
        depth = 0;
    while (true) {
        let match = /^ {0,3}>[ \t]?/.exec(text.slice(cursor));
        if (!match) break;
        cursor += match[0].length;
        depth++;
    }
    return { length: cursor, depth };
}
export function markdownReferences(text: string) {
    let references = new Map<string, string>();
    for (let match of text.matchAll(
        /^ {0,3}\[([^\]\r\n]+)\]:[ \t]*(?:<([^<>\r\n]+)>|(\S+))(?:[ \t]+["'(].*)?[ \t]*\r?$/gm
    )) {
        let label = referenceLabel(match[1]!);
        if (!references.has(label)) references.set(label, match[2] ?? match[3]!);
    }
    return references;
}
export function parseMarkdown(doc: EditorDocument): MarkdownBlock[] {
    let text = doc.value,
        starts = doc.starts,
        blocks: MarkdownBlock[] = [],
        i = 0;
    const line = (n: number) => text.slice(starts[n], lineEnd(text, starts, n));
    const end = (n: number) => starts[n + 1] ?? text.length;
    const fm = /^(?:\uFEFF)?---(?:\r\n|\r|\n)([\s\S]*?)(?:\r\n|\r|\n)(?:---|\.\.\.)[ \t]*(?:(?:\r\n|\r|\n)|$)/.exec(
        text
    );
    if (fm) {
        blocks.push({
            kind: 'frontmatter',
            from: 0,
            to: fm[0].length,
            contentFrom: text.indexOf(fm[1]!),
            contentTo: text.indexOf(fm[1]!) + fm[1]!.length
        });
        while (i < starts.length && starts[i]! < fm[0].length) i++;
    }
    for (; i < starts.length; i++) {
        let original = line(i),
            quote = quotePrefix(original),
            raw = original.slice(quote.length),
            from = starts[i]!,
            contentTo = lineEnd(text, starts, i),
            block: MarkdownBlock = {
                kind: 'paragraph',
                from,
                to: end(i),
                contentFrom: from + quote.length,
                contentTo,
                quoteDepth: quote.depth,
                indent: 0
            };
        let fence = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(raw),
            heading = /^( {0,3})(#{1,6})(?:[ \t]+|$)/.exec(raw),
            list = /^([ \t]*)([-+*]|\d+[.)])([ \t]+)(?:\[([ xX])\]([ \t]+))?/.exec(raw);
        if (fence) {
            block.kind = 'fence';
            block.language = fence[3]!.trim();
            block.contentFrom = end(i);
            let marker = fence[2]!,
                j = i + 1;
            while (
                j < starts.length &&
                !new RegExp('^ {0,3}' + (marker[0] === '`' ? '`' : '~') + '{' + marker.length + ',}[ \\t]*$').test(
                    line(j).slice(quotePrefix(line(j)).length)
                )
            )
                j++;
            block.contentTo = starts[j] ?? text.length;
            block.to = j < starts.length ? end(j) : text.length;
            block.lines = [];
            for (let n = i + 1; n < j; n++) {
                let prefix = quotePrefix(line(n));
                block.lines.push({
                    from: starts[n]!,
                    to: end(n),
                    contentFrom: starts[n]! + prefix.length,
                    contentTo: lineEnd(text, starts, n)
                });
            }
            i = Math.min(j, starts.length - 1);
        } else if (!raw.trim()) block.kind = 'blank';
        else if (heading) {
            block.kind = 'heading';
            block.level = heading[2]!.length;
            block.contentFrom += heading[0].length;
            block.contentTo -= /[ \t]+#+[ \t]*$/.exec(raw)?.[0].length ?? 0;
        } else if (/^ {0,3}(?:[-*_][ \t]*){3,}$/.test(raw)) block.kind = 'rule';
        else if (list) {
            block.kind = 'list';
            block.marker = list[2];
            block.contentFrom += list[0].length;
            block.indent = indentColumns(list[1]!);
            if (list[4] !== undefined)
                block.task = {
                    offset: from + quote.length + list[0].indexOf('[') + 1,
                    checked: list[4].toLowerCase() === 'x'
                };
            let required = indentColumns(list[1]!) + list[2]!.length + list[3]!.length;
            while (i + 1 < starts.length) {
                let prefix = quotePrefix(line(i + 1)),
                    value = line(i + 1).slice(prefix.length);
                if (
                    prefix.depth !== quote.depth ||
                    !value.trim() ||
                    indentColumns(value) < required ||
                    /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.test(value)
                )
                    break;
                if (!block.lines) block.lines = [{ from, to: block.to, contentFrom: block.contentFrom, contentTo }];
                let removed = 0,
                    columns = 0;
                while (columns < required && (value[removed] === ' ' || value[removed] === '\t')) {
                    columns += value[removed] === '\t' ? 4 - (columns % 4) : 1;
                    removed++;
                }
                i++;
                block.to = end(i);
                block.contentTo = lineEnd(text, starts, i);
                block.lines.push({
                    from: starts[i]!,
                    to: end(i),
                    contentFrom: starts[i]! + prefix.length + removed,
                    contentTo: block.contentTo
                });
            }
        } else if (indentColumns(raw) >= 4) {
            block.kind = 'code';
            block.lines = [];
            let j = i;
            while (j < starts.length) {
                let prefix = quotePrefix(line(j)),
                    value = line(j).slice(prefix.length);
                if (prefix.depth !== quote.depth || (value.trim() && indentColumns(value) < 4)) break;
                let removed = 0,
                    columns = 0;
                while (columns < 4 && (value[removed] === ' ' || value[removed] === '\t')) {
                    columns += value[removed] === '\t' ? 4 - (columns % 4) : 1;
                    removed++;
                }
                block.lines.push({
                    from: starts[j]!,
                    to: end(j),
                    contentFrom: starts[j]! + prefix.length + removed,
                    contentTo: lineEnd(text, starts, j)
                });
                j++;
            }
            // Trailing blank lines belong to the following block, not the code widget.
            while (
                block.lines.length > 1 &&
                !text.slice(block.lines.at(-1)!.contentFrom, block.lines.at(-1)!.contentTo).trim()
            ) {
                block.lines.pop();
                j--;
            }
            block.to = end(j - 1);
            block.contentFrom = block.lines[0]!.contentFrom;
            block.contentTo = block.lines.at(-1)!.contentTo;
            i = j - 1;
        } else if (quote.depth) {
            block.kind = 'quote';
            block.lines = [{ from, to: end(i), contentFrom: block.contentFrom, contentTo }];
            while (i + 1 < starts.length) {
                let prefix = quotePrefix(line(i + 1)),
                    next = line(i + 1).slice(prefix.length);
                if ((prefix.depth !== quote.depth && !(quote.depth === 1 && prefix.depth === 0)) || special.test(next))
                    break;
                i++;
                block.to = end(i);
                block.contentTo = lineEnd(text, starts, i);
                block.lines.push({
                    from: starts[i]!,
                    to: end(i),
                    contentFrom: starts[i]! + prefix.length,
                    contentTo: block.contentTo
                });
            }
        } else if (/^ {0,3}(?:<\/?[A-Za-z]|<!--)/.test(raw)) {
            block.kind = 'html';
            while (i + 1 < starts.length && line(i + 1).trim()) {
                i++;
                block.to = end(i);
                block.contentTo = lineEnd(text, starts, i);
            }
        } else if (i + 1 < starts.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(line(i + 1))) {
            block.kind = 'heading';
            block.level = line(i + 1).trim()[0] === '=' ? 1 : 2;
            block.to = end(++i);
        } else {
            while (i + 1 < starts.length && (!special.test(line(i + 1)) || /^(?: {4}|\t)/.test(line(i + 1)))) {
                i++;
                block.to = end(i);
                block.contentTo = lineEnd(text, starts, i);
            }
        }
        blocks.push(block);
    }
    return blocks;
}

export function blocksAt(blocks: MarkdownBlock[], selection: Pick<Selection, 'start' | 'end'>) {
    let touched = blocks.filter((block) =>
        selection.start === selection.end
            ? selection.start >= block.from && (selection.start < block.to || block === blocks.at(-1))
            : selection.start < block.to && selection.end > block.from
    );
    return touched.length ? { from: touched[0]!.from, to: touched.at(-1)!.to } : { from: 0, to: 0 };
}

function lineContext(doc: EditorDocument) {
    let offset = doc.selection.start,
        index = Math.max(0, floorIndex(doc.starts, offset)),
        from = doc.starts[index]!,
        to = lineEnd(doc.value, doc.starts, index),
        text = doc.value.slice(from, to);
    let quote = text.slice(0, quotePrefix(text).length),
        rest = text.slice(quote.length),
        list = /^(\s*)([-+*]|(\d+)([.)]))[ \t]+(?:\[([ xX])\][ \t]+)?/.exec(rest);
    return { from, to, index, text, quote, list, prefix: quote + (list?.[0] ?? '') };
}
export function markdownEnter(doc: EditorDocument): boolean {
    let { from, index, text, quote, list, prefix } = lineContext(doc),
        { start, end } = doc.selection;
    let blocks = parseMarkdown(doc),
        block = blocks.find((b) => start >= b.from && start < b.to);
    if (block?.kind === 'fence' || block?.kind === 'code' || block?.kind === 'frontmatter' || block?.kind === 'html')
        return false;
    if ((!quote && !list) || start < from + prefix.length) return false;
    if (!text.slice(prefix.length).trim()) {
        let at = list ? quote.length : quote.lastIndexOf('>'),
            remove = prefix.length - at;
        return doc.replace(from + at, from + prefix.length, '', {
            source: 'markdown-unwrap',
            selection: { start: Math.max(from, start - remove), end: Math.max(from, end - remove) }
        });
    }
    let next = quote;
    if (list)
        next +=
            list[1]! +
            (list[3] ? `${Number(list[3]) + 1}${list[4]}` : list[2]) +
            ' ' +
            (list[5] !== undefined ? '[ ] ' : '');
    let insert = preferredEol(doc.value) + next;
    let edits: Edit[] = [{ from: start, to: end, insert }];
    if (list?.[3]) {
        let expected = Number(list[3]) + 1;
        for (let line = index + 1; line < doc.starts.length; line++) {
            let offset = doc.starts[line]!,
                value = doc.value.slice(offset, lineEnd(doc.value, doc.starts, line));
            if (!value.trim()) continue;
            if (!value.startsWith(quote)) break;
            let candidate = /^(\s*)(\d+)([.)])[ \t]+/.exec(value.slice(quote.length));
            if (!candidate || candidate[1] !== list[1] || candidate[3] !== list[4] || Number(candidate[2]) !== expected)
                break;
            let from = offset + quote.length + candidate[1]!.length;
            edits.push({ from, to: from + candidate[2]!.length, insert: String(++expected) });
        }
    }
    return doc.transact(edits, { source: 'markdown-enter', selection: { start: start + insert.length } });
}
export function markdownBackspace(doc: EditorDocument): boolean {
    if (doc.selection.start !== doc.selection.end) return false;
    let { from, quote, list, prefix } = lineContext(doc),
        offset = doc.selection.start;
    if (!prefix || offset !== from + prefix.length) return false;
    let start = from + (list ? quote.length : quote.lastIndexOf('>'));
    return doc.replace(start, offset, '', { source: 'markdown-unwrap', selection: { start } });
}
export function toggleMarkdown(doc: EditorDocument, marker: '*' | '**'): boolean {
    let { start, end, direction } = doc.selection,
        text = doc.value;
    if (start === end) {
        while (start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1]!)) start--;
        while (end < text.length && /[\p{L}\p{N}_]/u.test(text[end]!)) end++;
    }
    let selected = text.slice(start, end),
        edit: Edit;
    if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
        edit = { from: start, to: end, insert: selected.slice(marker.length, -marker.length) };
        end -= marker.length * 2;
    } else if (text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker) {
        edit = { from: start - marker.length, to: end + marker.length, insert: selected };
        start -= marker.length;
        end -= marker.length;
    } else {
        edit = { from: start, to: end, insert: marker + selected + marker };
        start += marker.length;
        end += marker.length;
    }
    return doc.transact([edit], { source: 'markdown-format', selection: { start, end, direction } });
}
export function toggleTask(doc: EditorDocument, task: NonNullable<MarkdownBlock['task']>): boolean {
    if (
        doc.value[task.offset - 1] !== '[' ||
        doc.value[task.offset + 1] !== ']' ||
        !/[ xX]/.test(doc.value[task.offset] ?? '')
    )
        return false;
    return doc.replace(task.offset, task.offset + 1, /x/i.test(doc.value[task.offset]!) ? ' ' : 'x', {
        source: 'markdown-task',
        selection: doc.selection
    });
}
