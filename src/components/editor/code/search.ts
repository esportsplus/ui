import type { Delta, Edit, EditorDocument } from './document';


type Match = Readonly<{ from: number; replacement: string; text: string; to: number }>;

type Memo = {
    key: string;
    revision: number;
    result: SearchResult;
};

type SearchOptions = { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean };

type SearchResult = Readonly<{ error: string; matches: readonly Match[]; truncated: boolean }>;


const ESCAPE = /[.*+?^${}()|[\]\\]/g;

const MATCH_LIMIT = 10000;

const MEMO_LIMIT = 4;

const MEMOS = new WeakMap<EditorDocument, Memo[]>();

const TOKENS = /\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g;

const WORD = /[\p{L}\p{N}_$]/u;


function compile(query: string, options: SearchOptions) {
    return new RegExp(options.regex ? query : query.replace(ESCAPE, '\\$&'), options.caseSensitive ? 'gu' : 'giu');
}

// JS replacement tokens, without re-running a regex on a sliced match, so lookarounds keep their context.
function expandReplacement(template: string, match: RegExpExecArray, text: string) {
    return template.replace(TOKENS, (token, key: string) => {
        if (key === '$') {
            return '$';
        }

        if (key === '&') {
            return match[0];
        }

        if (key === '`') {
            return text.slice(0, match.index);
        }

        if (key === "'") {
            return text.slice(match.index + match[0].length);
        }

        if (key.startsWith('<')) {
            return match.groups ? (match.groups[key.slice(1, -1)] ?? '') : token;
        }

        let index = Number(key);

        if (index > 0 && index < match.length) {
            return match[index] ?? '';
        }

        if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < match.length) {
            return (match[Number(key[0])] ?? '') + key[1];
        }

        return token;
    });
}

// Literal matches of a query no proper prefix of which is also its suffix can't overlap, so every occurrence is a
// match wherever a scan starts; only then can a rescan of edited windows stand in for a full one.
function incremental(query: string, options: SearchOptions) {
    if (options.regex || !query) {
        return false;
    }

    let folded = options.caseSensitive ? query : query.toLowerCase();

    for (let length = 1; length < folded.length; length++) {
        if (folded.startsWith(folded.slice(folded.length - length))) {
            return false;
        }
    }

    return true;
}

function isWholeWord(text: string, from: number, to: number) {
    let left = Array.from(text.slice(Math.max(0, from - 2), from)).at(-1) ?? '',
        right = Array.from(text.slice(to, to + 2))[0] ?? '';

    return (!left || !WORD.test(left)) && (!right || !WORD.test(right));
}

function key(query: string, options: SearchOptions, replacement: string, limit: number) {
    let flags = `${+!!options.caseSensitive}${+!!options.regex}${+!!options.wholeWord}`;

    return [flags, limit, query.length, query, replacement].join('\u0000');
}

// Maps a previous literal result through 'deltas': matches clear of every edit shift, the rest are rescanned in the
// windows the edits touched. Null when the result can't be carried over and a full scan must run.
function update(
    text: string,
    previous: SearchResult,
    deltas: readonly Delta[],
    query: string,
    options: SearchOptions,
    replacement: string,
    limit: number
) {
    if (previous.error || previous.truncated) {
        return null;
    }

    let dirty: [number, number][] = [],
        margin = query.length + 2,
        matches: Match[] = [...previous.matches];

    for (let i = 0, n = deltas.length; i < n; i++) {
        let edits = deltas[i].edits,
            kept: Match[] = [];

        for (let j = 0, m = matches.length; j < m; j++) {
            let match = matches[j];

            if (!touches(edits, match.from - 2, match.to + 2)) {
                kept.push({ ...match, from: shift(edits, match.from), to: shift(edits, match.to) });
            }
        }

        for (let j = 0, m = dirty.length; j < m; j++) {
            dirty[j] = [shift(edits, dirty[j][0]), shift(edits, dirty[j][1])];
        }

        let delta = 0;

        for (let j = 0, m = edits.length; j < m; j++) {
            let edit = edits[j];

            dirty.push([edit.from + delta, edit.from + delta + edit.insert.length]);
            delta += edit.insert.length - (edit.to - edit.from);
        }

        matches = kept;
    }

    dirty.sort((a, b) => a[0] - b[0]);

    let expression = compile(query, options),
        found: Match[] = [],
        windows: [number, number][] = [];

    for (let i = 0, n = dirty.length; i < n; i++) {
        let from = Math.max(0, dirty[i][0] - margin),
            last = windows[windows.length - 1],
            to = Math.min(text.length, dirty[i][1] + margin);

        if (last && from <= last[1]) {
            last[1] = Math.max(last[1], to);
        }
        else {
            windows.push([from, to]);
        }
    }

    for (let i = 0, n = windows.length; i < n; i++) {
        let [from, to] = windows[i],
            match: RegExpExecArray | null,
            slice = text.slice(from, to);

        expression.lastIndex = 0;

        while ((match = expression.exec(slice))) {
            let at = from + match.index,
                end = at + match[0].length;

            if (!options.wholeWord || isWholeWord(text, at, end)) {
                found.push(Object.freeze({ from: at, replacement, text: match[0], to: end }));
            }
        }
    }

    let merged: Match[] = [],
        seen = new Set<number>(),
        all = matches.concat(found).sort((a, b) => a.from - b.from);

    for (let i = 0, n = all.length; i < n; i++) {
        if (!seen.has(all[i].from)) {
            seen.add(all[i].from);
            merged.push(Object.isFrozen(all[i]) ? all[i] : Object.freeze(all[i]));
        }
    }

    if (merged.length > limit) {
        return null;
    }

    return { error: '', matches: merged, truncated: false };
}

// A position inside a replaced range moves to the start of its replacement.
function shift(edits: readonly Edit[], offset: number) {
    let delta = 0;

    for (let i = 0, n = edits.length; i < n; i++) {
        let edit = edits[i];

        if (edit.to > offset) {
            return edit.from < offset ? edit.from + delta : offset + delta;
        }

        delta += edit.insert.length - (edit.to - edit.from);
    }

    return offset + delta;
}

function touches(edits: readonly Edit[], from: number, to: number) {
    for (let i = 0, n = edits.length; i < n; i++) {
        if (edits[i].from <= to && edits[i].to >= from) {
            return true;
        }
    }

    return false;
}


const nextMatch = (matches: readonly Match[], start: number, end: number, backwards = false, current = -1) => {
    let n = matches.length;

    if (!n) {
        return -1;
    }

    if (current >= 0 && matches[current]?.from === start && matches[current]?.to === end) {
        return (current + (backwards ? -1 : 1) + n) % n;
    }

    let hi = n,
        lo = 0;

    // First match ending after 'start' going back, or starting at or after 'end' going forward.
    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if (backwards ? matches[mid].to <= start : matches[mid].from < end) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    if (backwards) {
        return lo > 0 ? lo - 1 : n - 1;
    }

    return lo < n ? lo : 0;
};

const replaceMatches = (doc: EditorDocument, result: SearchResult, all = true, index = 0) => {
    // Never silently replace only a truncated subset when asked for all.
    if (result.error || (all && result.truncated)) {
        return false;
    }

    let matches = all ? result.matches : result.matches.slice(index, index + 1),
        value = doc.value;

    if (!matches.length) {
        return false;
    }

    for (let i = 0, n = matches.length; i < n; i++) {
        let match = matches[i];

        if (match.to - match.from !== match.text.length || !value.startsWith(match.text, match.from)) {
            return false;
        }
    }

    let edits: Edit[] = matches.map((match) => ({ from: match.from, insert: match.replacement, to: match.to })),
        first = edits[0];

    return doc.transact(edits, {
        selection: { end: first.from + first.insert.length, start: first.from },
        source: all ? 'replaceAll' : 'replace'
    }).changed;
};

// Regex is an explicit opt-in; arbitrary regex execution can't be time-bounded on the main thread.
const search = (
    text: string,
    query: string,
    options: SearchOptions = {},
    replacement = '',
    limit = MATCH_LIMIT
): SearchResult => {
    let matches: Match[] = [];

    if (!query) {
        return { error: '', matches, truncated: false };
    }

    let expression: RegExp;

    try {
        expression = compile(query, options);
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error), matches, truncated: false };
    }

    let match: RegExpExecArray | null;

    while ((match = expression.exec(text))) {
        let from = match.index,
            to = from + match[0].length;

        if (!options.wholeWord || isWholeWord(text, from, to)) {
            if (matches.length >= limit) {
                return { error: '', matches, truncated: true };
            }

            matches.push(
                Object.freeze({
                    from,
                    replacement: options.regex ? expandReplacement(replacement, match, text) : replacement,
                    text: match[0],
                    to
                })
            );
        }

        if (match[0].length === 0) {
            if (expression.lastIndex >= text.length) {
                break;
            }

            expression.lastIndex += (text.codePointAt(expression.lastIndex) ?? 0) > 0xffff ? 2 : 1;
        }
    }

    return { error: '', matches, truncated: false };
};

// 'search' over a document, remembered per query until the text changes; after an edit, a literal query rescans only
// around the edits instead of the whole text.
const searchDocument = (
    doc: EditorDocument,
    query: string,
    options: SearchOptions = {},
    replacement = '',
    limit = MATCH_LIMIT
): SearchResult => {
    let id = key(query, options, replacement, limit),
        memos = MEMOS.get(doc);

    if (!memos) {
        MEMOS.set(doc, memos = []);
    }

    let index = memos.findIndex((memo) => memo.key === id),
        memo = index >= 0 ? memos.splice(index, 1)[0] : null,
        result: SearchResult | null = null;

    if (memo && memo.revision === doc.revision) {
        result = memo.result;
    }
    else if (memo && incremental(query, options)) {
        let deltas = doc.deltas(memo.revision);

        result = deltas && update(doc.value, memo.result, deltas, query, options, replacement, limit);
    }

    result ??= search(doc.value, query, options, replacement, limit);
    memos.unshift({ key: id, revision: doc.revision, result });

    if (memos.length > MEMO_LIMIT) {
        memos.length = MEMO_LIMIT;
    }

    return result;
};


export { MATCH_LIMIT, nextMatch, replaceMatches, search, searchDocument };
export type { Match, SearchOptions, SearchResult };
