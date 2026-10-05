import { EditorDocument, floorIndex, lineEnd, type Edit } from '../document';
import type { CompletionItem, Position, Range } from './protocol';

export function positionAt(doc: EditorDocument, offset: number): Position {
    offset = Math.max(0, Math.min(doc.value.length, offset));
    let line = Math.max(0, floorIndex(doc.starts, offset));
    return { line, character: Math.min(offset, lineEnd(doc.value, doc.starts, line)) - doc.starts[line]! };
}
export function offsetAtPosition(doc: EditorDocument, p: Position): number | null {
    if (
        !Number.isInteger(p.line) ||
        p.line < 0 ||
        p.line >= doc.starts.length ||
        !Number.isInteger(p.character) ||
        p.character < 0
    )
        return null;
    return Math.min(doc.starts[p.line]! + p.character, lineEnd(doc.value, doc.starts, p.line));
}
export function editRange(doc: EditorDocument, range: Range): { from: number; to: number } | null {
    let from = offsetAtPosition(doc, range.start),
        to = offsetAtPosition(doc, range.end);
    return from === null || to === null || to < from ? null : { from, to };
}
export function wordStart(text: string, offset: number) {
    return offset - (/[\w$]*$/.exec(text.slice(0, offset))?.[0].length ?? 0);
}
export function localWords(text: string, offset: number): CompletionItem[] {
    let from = wordStart(text, offset),
        prefix = text.slice(from, offset),
        words = new Set<string>();
    for (let match of text.matchAll(/[A-Za-z_$][\w$]*/g)) {
        if (match.index === from || match[0] === prefix || !match[0].startsWith(prefix)) continue;
        words.add(match[0]);
        if (words.size >= 200) break;
    }
    return [...words].sort().map((label) => ({ label }));
}
export type SnippetStop = { index: number; from: number; to: number };
/** Standard tab stops, defaults, choices, escaping and repeated numeric mirrors. */
export function expandSnippet(source: string) {
    let text = '',
        stops: SnippetStop[] = [],
        values = new Map<number, string>();
    let pattern = /\\([\\$}])|\$\{(\d+)(?::([^{}]*?)|\|([^{}]*?)\|)?\}|\$(\d+)/g,
        cursor = 0;
    for (let m of source.matchAll(pattern)) {
        text += source.slice(cursor, m.index);
        cursor = m.index! + m[0].length;
        if (m[1]) {
            text += m[1];
            continue;
        }
        let index = Number(m[2] ?? m[5]),
            value = values.get(index) ?? m[3] ?? m[4]?.split(',')[0] ?? '';
        values.set(index, value);
        stops.push({ index, from: text.length, to: text.length + value.length });
        text += value;
    }
    text += source.slice(cursor);
    stops.sort((a, b) => (a.index || Infinity) - (b.index || Infinity) || a.from - b.from);
    return { text, stops };
}
/** Keep a snippet session only while an edit stays inside its active placeholder. */
export function remapSnippet(
    stops: readonly SnippetStop[],
    activeIndex: number,
    before: string,
    after: string
): SnippetStop[] | null {
    let active = stops[activeIndex];
    if (!active) return null;
    let from = 0,
        to = before.length,
        end = after.length;
    while (from < Math.min(before.length, after.length, active.from) && before[from] === after[from]) from++;
    while (to > Math.max(from, active.to) && end > from && before[to - 1] === after[end - 1]) {
        to--;
        end--;
    }
    if (from < active.from || to > active.to) return null;
    let delta = after.length - before.length;
    return stops.map((stop, index) =>
        index === activeIndex
            ? { ...stop, to: stop.to + delta }
            : stop.from >= to
              ? { ...stop, from: stop.from + delta, to: stop.to + delta }
              : { ...stop }
    );
}
export function applyCompletion(doc: EditorDocument, item: CompletionItem, offset: number, commit = '') {
    let main = item.textEdit
        ? editRange(doc, 'range' in item.textEdit ? item.textEdit.range : item.textEdit.replace)
        : { from: wordStart(doc.value, offset), to: offset };
    if (!main) return null;
    let source = item.textEdit?.newText ?? item.insertText ?? item.label,
        snippet = item.insertTextFormat === 2 ? expandSnippet(source) : { text: source, stops: [] as SnippetStop[] },
        edits: Edit[] = [{ ...main, insert: snippet.text + (snippet.text.endsWith(commit) ? '' : commit) }];
    for (let additional of item.additionalTextEdits ?? []) {
        let range = editRange(doc, additional.range);
        if (!range) return null;
        edits.push({ ...range, insert: additional.newText });
    }
    let shift = edits
            .slice(1)
            .filter((edit) => edit.to <= main.from)
            .reduce((sum, edit) => sum + edit.insert.length - (edit.to - edit.from), 0),
        origin = main.from + shift,
        first = snippet.stops[0],
        end = origin + edits[0]!.insert.length,
        result = doc.transact(edits, {
            source: 'completion',
            selection: { start: first ? origin + first.from : end, end: first ? origin + first.to : end }
        });
    if (!result.accepted) return null;
    return snippet.stops.map((stop) => ({ ...stop, from: origin + stop.from, to: origin + stop.to }));
}
export function languageIdFor(path: string) {
    let extension = path.split('.').at(-1)?.toLowerCase() ?? '';
    return (
        (
            {
                ts: 'typescript',
                tsx: 'typescript',
                mts: 'typescript',
                cts: 'typescript',
                js: 'javascript',
                jsx: 'javascript',
                mjs: 'javascript',
                cjs: 'javascript',
                css: 'css',
                scss: 'css',
                html: 'html',
                json: 'json',
                md: 'markdown',
                markdown: 'markdown',
                py: 'python'
            } as Record<string, string>
        )[extension] ?? 'plaintext'
    );
}
export function fileUri(cwd: string, path: string) {
    let joined = /^(?:\/|[A-Za-z]:)/.test(path) ? path : cwd.replace(/[\\/]+$/, '') + '/' + path;
    joined = joined.replace(/\\/g, '/');
    if (!joined.startsWith('/')) joined = '/' + joined;
    return (
        'file://' +
        joined
            .split('/')
            .map((segment, index) =>
                index === 1 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)
            )
            .join('/')
    );
}
