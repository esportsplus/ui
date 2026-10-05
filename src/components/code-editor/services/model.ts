import type { Edit, EditorDocument } from '../document';
import type { CompletionItem, Position, Range } from './protocol';


type Span = { from: number; to: number };

type Stop = { from: number; index: number; to: number };


const LANGUAGES: Record<string, string> = {
    cjs: 'javascript',
    css: 'css',
    cts: 'typescript',
    html: 'html',
    js: 'javascript',
    json: 'json',
    jsx: 'javascript',
    markdown: 'markdown',
    md: 'markdown',
    mjs: 'javascript',
    mts: 'typescript',
    py: 'python',
    scss: 'scss',
    ts: 'typescript',
    tsx: 'typescript'
};

// Escapes, '${1:default}', '${1|one,two|}', '${1}' and '$1'; placeholders don't nest.
const SNIPPET = /\\([\\$}])|\$\{(\d+)(?::([^{}]*?)|\|([^{}]*?)\|)?\}|\$(\d+)/g;

const URI = /^[a-z][a-z\d+.-]*:\/\//i;

const WORD = /[A-Za-z_$][\w$]*/g;

// Local completion stops collecting after this many distinct words.
const WORDS = 200;


function identifier(code: number) {
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 36 || code === 95;
}


const applyCompletion = (doc: EditorDocument, item: CompletionItem, offset: number, commit = '') => {
    let main = item.textEdit
        ? spanOf(doc, 'range' in item.textEdit ? item.textEdit.range : item.textEdit.replace)
        : { from: wordStart(doc.value, offset), to: offset };

    if (!main) {
        return null;
    }

    let source = item.textEdit?.newText ?? item.insertText ?? item.label,
        snippet = item.insertTextFormat === 2 ? expandSnippet(source) : { stops: [] as Stop[], text: source },
        edits: Edit[] = [{ from: main.from, insert: snippet.text + (snippet.text.endsWith(commit) ? '' : commit), to: main.to }];

    for (let additional of item.additionalTextEdits ?? []) {
        let span = spanOf(doc, additional.range);

        if (!span) {
            return null;
        }

        edits.push({ from: span.from, insert: additional.newText, to: span.to });
    }

    let shift = 0;

    for (let i = 1, n = edits.length; i < n; i++) {
        if (edits[i].to <= main.from) {
            shift += edits[i].insert.length - (edits[i].to - edits[i].from);
        }
    }

    let origin = main.from + shift,
        end = origin + edits[0].insert.length,
        first = snippet.stops[0],
        result = doc.transact(edits, {
            selection: { end: first ? origin + first.to : end, start: first ? origin + first.from : end },
            source: 'completion'
        });

    if (!result.accepted) {
        return null;
    }

    return snippet.stops.map((stop) => ({ from: origin + stop.from, index: stop.index, to: origin + stop.to }));
};

// Tab stops in visiting order ($1, $2, ... then $0), with defaults, the first choice, escapes and repeated mirrors.
const expandSnippet = (source: string) => {
    let cursor = 0,
        stops: Stop[] = [],
        text = '',
        values = new Map<number, string>();

    for (let match of source.matchAll(SNIPPET)) {
        text += source.slice(cursor, match.index);
        cursor = match.index + match[0].length;

        if (match[1]) {
            text += match[1];
            continue;
        }

        let index = Number(match[2] ?? match[5]),
            value = values.get(index) ?? match[3] ?? match[4]?.split(',')[0] ?? '';

        values.set(index, value);
        stops.push({ from: text.length, index, to: text.length + value.length });
        text += value;
    }

    text += source.slice(cursor);
    stops.sort((a, b) => (a.index || Infinity) - (b.index || Infinity) || a.from - b.from);

    return { stops, text };
};

// A 'file://' URI for a path, relative ones resolved against 'cwd'. Every segment is kept and percent-encoded, '.'
// and '..' are resolved, Windows drives keep their letter and UNC paths their host; a URI passes through.
const fileUri = (cwd: string, path: string) => {
    if (URI.test(path)) {
        return path;
    }

    let normalized = path.replace(/\\/g, '/'),
        absolute = normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized),
        full = absolute ? normalized : `${cwd.replace(/\\/g, '/').replace(/\/+$/, '')}/${normalized}`,
        host = '';

    let unc = /^\/\/([^/]+)(\/.*)?$/.exec(full);

    if (unc) {
        host = unc[1];
        full = unc[2] ?? '/';
    }

    let drive = /^\/?([A-Za-z]:)(.*)$/.exec(full),
        prefix = drive ? `/${drive[1]}` : '',
        segments: string[] = [];

    if (drive) {
        full = drive[2];
    }

    let parts = full.split('/');

    for (let i = 0, n = parts.length; i < n; i++) {
        let part = parts[i];

        if (part === '..') {
            segments.pop();
        }
        else if (part && part !== '.') {
            segments.push(encodeURIComponent(part));
        }
    }

    let trailing = segments.length > 0 && /\/\.{0,2}$/.test(full) ? '/' : '';

    return `file://${encodeURIComponent(host)}${prefix}/${segments.join('/')}${trailing}`;
};

const languageIdFor = (path: string) => {
    let name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1),
        dot = name.lastIndexOf('.');

    return (dot > 0 && LANGUAGES[name.slice(dot + 1).toLowerCase()]) || 'plaintext';
};

// Distinct document words starting with the word before 'offset', other than itself.
const localWords = (text: string, offset: number): CompletionItem[] => {
    let from = wordStart(text, offset),
        prefix = text.slice(from, offset),
        words = new Set<string>();

    for (let match of text.matchAll(WORD)) {
        if (match.index === from || match[0] === prefix || !match[0].startsWith(prefix)) {
            continue;
        }

        words.add(match[0]);

        if (words.size >= WORDS) {
            break;
        }
    }

    return [...words].sort().map((label) => ({ label }));
};

// Follows a snippet session through edits. Each batch must land inside the active placeholder, which grows or
// shrinks with it while later stops shift; anything else ends the session with null.
const mapStops = (stops: readonly Stop[], active: number, batches: readonly (readonly Edit[])[]) => {
    let next = stops.map((stop) => ({ ...stop }));

    for (let i = 0, n = batches.length; i < n; i++) {
        let batch = batches[i],
            current = next[active],
            delta = 0;

        if (!current) {
            return null;
        }

        for (let j = 0, m = batch.length; j < m; j++) {
            let edit = batch[j];

            if (edit.from < current.from || edit.to > current.to) {
                return null;
            }

            delta += edit.insert.length - (edit.to - edit.from);
        }

        let end = current.to;

        for (let j = 0, m = next.length; j < m; j++) {
            let stop = next[j];

            if (j === active) {
                stop.to += delta;
            }
            else if (stop.from >= end) {
                stop.from += delta;
                stop.to += delta;
            }
        }
    }

    return next;
};

const offsetAt = (doc: EditorDocument, position: Position) => {
    let { character, line } = position;

    if (!Number.isInteger(line) || line < 0 || line >= doc.lineCount || !Number.isInteger(character) || character < 0) {
        return null;
    }

    return Math.min(doc.lineStart(line) + character, doc.lineEnd(line));
};

const positionAt = (doc: EditorDocument, offset: number): Position => {
    let line = doc.lineAt(offset);

    return { character: Math.min(Math.max(0, offset), doc.lineEnd(line)) - doc.lineStart(line), line };
};

const spanOf = (doc: EditorDocument, range: Range): Span | null => {
    let from = offsetAt(doc, range.start),
        to = offsetAt(doc, range.end);

    return from === null || to === null || to < from ? null : { from, to };
};

const wordStart = (text: string, offset: number) => {
    let from = offset;

    while (from > 0 && identifier(text.charCodeAt(from - 1))) {
        from--;
    }

    return from;
};


export { applyCompletion, expandSnippet, fileUri, identifier, languageIdFor, localWords, mapStops, offsetAt, positionAt, spanOf, wordStart };
export type { Span, Stop };
