import { EditorDocument, type Edit } from './document';

export type SearchOptions = { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean };
export type Match = Readonly<{ from: number; to: number; text: string; replacement: string }>;
export type SearchResult = Readonly<{ matches: readonly Match[]; error: string; truncated: boolean }>;
const WORD = /[\p{L}\p{N}_$]/u;
export const MATCH_LIMIT = 10000;

/** Regex is an explicit opt-in; arbitrary regex execution cannot be time-bounded on the main thread. */
export function search(
    text: string,
    query: string,
    options: SearchOptions = {},
    replacement = '',
    limit = MATCH_LIMIT
): SearchResult {
    let matches: Match[] = [];
    if (!query) return { matches, error: '', truncated: false };
    let expression: RegExp;
    try {
        expression = new RegExp(
            options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options.caseSensitive ? 'gu' : 'giu'
        );
    } catch (error) {
        return { matches, error: error instanceof Error ? error.message : String(error), truncated: false };
    }
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text))) {
        let from = match.index,
            to = from + match[0].length,
            left = Array.from(text.slice(Math.max(0, from - 2), from)).at(-1) ?? '',
            right = Array.from(text.slice(to, to + 2))[0] ?? '';
        if (!options.wholeWord || ((!left || !WORD.test(left)) && (!right || !WORD.test(right)))) {
            if (matches.length >= limit) return { matches, error: '', truncated: true };
            matches.push(
                Object.freeze({
                    from,
                    to,
                    text: match[0],
                    replacement: options.regex ? expandReplacement(replacement, match, text) : replacement
                })
            );
        }
        if (match[0].length === 0) {
            if (expression.lastIndex >= text.length) break;
            expression.lastIndex += (text.codePointAt(expression.lastIndex) ?? 0) > 0xffff ? 2 : 1;
        }
    }
    return { matches, error: '', truncated: false };
}

/** JS replacement tokens, without re-running a regex on a sliced match (lookarounds keep their context). */
function expandReplacement(template: string, match: RegExpExecArray, text: string) {
    return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (token, key: string) => {
        if (key === '$') return '$';
        if (key === '&') return match[0];
        if (key === '`') return text.slice(0, match.index);
        if (key === "'") return text.slice(match.index + match[0].length);
        if (key.startsWith('<')) return match.groups ? (match.groups[key.slice(1, -1)] ?? '') : token;
        let index = Number(key);
        if (index > 0 && index < match.length) return match[index] ?? '';
        if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < match.length)
            return (match[Number(key[0])] ?? '') + key[1];
        return token;
    });
}

export function nextMatch(matches: readonly Match[], start: number, end: number, backwards = false, current = -1) {
    if (!matches.length) return -1;
    if (current >= 0 && matches[current]?.from === start && matches[current]?.to === end) {
        return (current + (backwards ? -1 : 1) + matches.length) % matches.length;
    }
    if (backwards) {
        for (let i = matches.length - 1; i >= 0; i--) if (matches[i].to <= start) return i;
        return matches.length - 1;
    }
    let index = matches.findIndex((match) => match.from >= end);
    return index < 0 ? 0 : index;
}

export function replaceMatches(doc: EditorDocument, result: SearchResult, all = true, index = 0) {
    // Never silently replace only a truncated subset when asked for all.
    if (result.error || (all && result.truncated)) return false;
    let matches = all ? result.matches : result.matches.slice(index, index + 1);
    if (!matches.length || matches.some((match) => doc.value.slice(match.from, match.to) !== match.text)) return false;
    let edits: Edit[] = matches.map((match) => ({ from: match.from, to: match.to, insert: match.replacement })),
        first = edits[0],
        caret = first.from + first.insert.length;
    return doc.transact(edits, {
        source: all ? 'replaceAll' : 'replace',
        selection: { start: first.from, end: caret }
    });
}
