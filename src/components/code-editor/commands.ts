import { stepCharacter } from './selection';
import { contexts, structures } from './folding';
import { type Language, highlightLine } from './syntax';
import {
    EditorDocument,
    floorIndex,
    lineEnd,
    preferredEol,
    selection,
    sameSelections,
    type TransactionOptions,
    type Selection,
    type Edit
} from './document';

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

type CommandTarget = Pick<EditorDocument, 'value' | 'selection' | 'starts' | 'replace' | 'select'>;

function selectedLines(doc: Pick<EditorDocument, 'value' | 'selection' | 'starts'>) {
    let { start, end } = doc.selection,
        first = floorIndex(doc.starts, start),
        last = floorIndex(doc.starts, end);
    if (end > start && doc.starts[last] === end) last--;
    return { first, last };
}

function singleInsertText(doc: CommandTarget, text: string, source = 'insert') {
    let { start, end } = doc.selection,
        caret = start + text.length;
    return doc.replace(start, end, text, { source, selection: { start: caret, end: caret } });
}

function singleNewline(doc: CommandTarget, unit = '    ', language: Language = 'plain') {
    let { start, end } = doc.selection,
        index = floorIndex(doc.starts, start),
        prefix = doc.value.slice(doc.starts[index], start),
        padding = /^[\t ]*/.exec(prefix)![0],
        left = prefix.trimEnd().at(-1) ?? '',
        right = doc.value.slice(end),
        eol = preferredEol(doc.value),
        opens =
            /[({[]/.test(left) ||
            (language === 'python' && left === ':') ||
            (language === 'html' && /<[\w:-]+[^>]*>$/.test(prefix) && !/<\//.test(prefix)),
        close = PAIRS[left],
        inner = padding + (opens ? unit : ''),
        text = eol + inner;
    // Between a pair, leave the closing delimiter at the original indentation.
    if (opens && close && right.startsWith(close)) text += eol + padding;
    let caret = start + eol.length + inner.length;
    return doc.replace(start, end, text, { source: 'newline', selection: { start: caret, end: caret } });
}

/** Conservative character assistance, not language-aware parsing. */
function singleBracket(doc: CommandTarget, character: string) {
    let { start, end, direction } = doc.selection,
        close = PAIRS[character],
        before = doc.value[start - 1] ?? '',
        after = doc.value[end] ?? '';
    if (start === end && /[)\]}"'`]/.test(character) && after === character && before !== '\\') {
        doc.select({ start: start + 1, end: start + 1 });
        return true;
    }
    if (!close || before === '\\') return false;
    if (start === end && ((/["'`]/.test(character) && /[\w$]/.test(before)) || (after && !/[\s)\]}>,;:]/.test(after))))
        return false;
    let selected = doc.value.slice(start, end);
    doc.replace(start, end, character + selected + close, {
        source: 'bracket',
        selection: { start: start + 1, end: end + 1, direction }
    });
    return true;
}

function singleDeletePair(doc: CommandTarget) {
    let { start, end } = doc.selection;
    if (start !== end || !PAIRS[doc.value[start - 1]] || PAIRS[doc.value[start - 1]] !== doc.value[start]) return false;
    return doc.replace(start - 1, start + 1, '', { source: 'deletePair', selection: { start: start - 1 } });
}

function singleToggleComment(doc: EditorDocument, marker: string | false, block?: readonly [string, string]) {
    let { first, last } = selectedLines(doc),
        edits: Edit[] = [];
    if (!marker) {
        if (!block) return false;
        let from = doc.starts[first],
            to = lineEnd(doc.value, doc.starts, last),
            text = doc.value.slice(from, to),
            [open, close] = block;
        if (!open || !close) return false;
        if (text.startsWith(open) && text.endsWith(close) && text.length >= open.length + close.length) {
            edits = [
                { from, to: from + open.length, insert: '' },
                { from: to - close.length, to, insert: '' }
            ];
        } else
            edits = [
                { from, to: from, insert: open },
                { from: to, to, insert: close }
            ];
    } else {
        let lines = [] as { from: number; text: string }[];
        for (let i = first; i <= last; i++) {
            let from = doc.starts[i],
                text = doc.value.slice(from, lineEnd(doc.value, doc.starts, i));
            if (!text.trim()) continue;
            let padding = /^[\t ]*/.exec(text)![0].length;
            lines.push({ from: from + padding, text: text.slice(padding) });
        }
        let remove = lines.length > 0 && lines.every((line) => line.text.startsWith(marker));
        edits = lines.map(({ from, text }) => ({
            from,
            to: from + (remove ? marker.length + (text[marker.length] === ' ' ? 1 : 0) : 0),
            insert: remove ? '' : marker + ' '
        }));
    }
    return doc.transact(edits, { source: 'comment' });
}

/** Runs selection-local assistance against the same original source and commits once. */
function eachRange(doc: EditorDocument, source: string, run: (local: CommandTarget, index: number) => boolean) {
    let edits: Edit[] = [],
        destinations: { range: Selection; from: number }[] = [];
    for (let [index, range] of doc.selections.entries()) {
        let next = range,
            edit: Edit | undefined;
        let local: CommandTarget = {
            value: doc.value,
            starts: doc.starts,
            get selection() {
                return next;
            },
            select(value) {
                next = selection(value, doc.value.length);
            },
            replace(from: number, to: number, insert: string, options: TransactionOptions = {}) {
                edit = { from, to, insert };
                let length = doc.value.length + insert.length - (to - from);
                next = selection(options.selection ?? { start: from + insert.length }, length);
                return true;
            }
        };
        if (!run(local, index)) return false;
        if (edit && doc.value.slice(edit.from, edit.to) !== edit.insert) edits.push(edit);
        destinations.push({ range: next, from: edit?.from ?? range.start });
    }
    let sorted = [...edits].sort((a, b) => a.from - b.from);
    if (source === 'delete') {
        let merged: Edit[] = [];
        for (let edit of sorted) {
            let last = merged.at(-1);
            if (last && edit.from <= last.to)
                merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, edit.to), insert: '' };
            else merged.push(edit);
        }
        sorted = merged;
    }
    if (sorted.some((edit, index) => index > 0 && edit.from < sorted[index - 1].to)) return false;
    let ranges = destinations.map((item) => {
        if (source === 'delete') {
            let map = (position: number) => {
                let shift = 0;
                for (let edit of sorted) {
                    if (position < edit.from) break;
                    if (position <= edit.to) return edit.from + shift;
                    shift -= edit.to - edit.from;
                }
                return position + shift;
            };
            return { ...item.range, start: map(item.range.start), end: map(item.range.end) };
        }
        let shift = sorted
            .filter((edit) => edit.from < item.from)
            .reduce((sum, edit) => sum + edit.insert.length - (edit.to - edit.from), 0);
        return { ...item.range, start: item.range.start + shift, end: item.range.end + shift };
    });
    if (!edits.length) {
        let changed = !sameSelections(doc.selections, ranges);
        doc.selectMany(ranges);
        return source === 'bracket' && changed;
    }
    return doc.transact(sorted, { source, selections: ranges, group: source === 'input' ? 'insertText' : undefined });
}
export function insertText(doc: EditorDocument, text: string | readonly string[], source = 'insert') {
    return eachRange(doc, source, (local, index) =>
        singleInsertText(local, typeof text === 'string' ? text : (text[index % text.length] ?? ''), source)
    );
}
export function newline(doc: EditorDocument, unit = '    ', language: Language = 'plain') {
    let protectedAt = contexts(
        doc.value,
        language,
        doc.selections.map((range) => range.start)
    );
    return eachRange(doc, 'newline', (local) => {
        let context = protectedAt.get(local.selection.start);
        if (context && ['string', 'comment', 'regexp'].includes(context.kind)) {
            let index = floorIndex(local.starts, local.selection.start),
                padding = /^[\t ]*/.exec(local.value.slice(local.starts[index], local.selection.start))![0];
            return singleInsertText(local, preferredEol(local.value) + padding, 'newline');
        }
        return singleNewline(local, unit, language);
    });
}
export function bracket(doc: EditorDocument, character: string, language: Language = 'plain') {
    let protectedAt = contexts(
        doc.value,
        language,
        doc.selections.map((range) => range.start)
    );
    return eachRange(doc, 'bracket', (local) => {
        let context = protectedAt.get(local.selection.start),
            protectedToken = context && ['string', 'comment', 'regexp'].includes(context.kind),
            closer = /[)\]}"'`]/.test(character) && local.value[local.selection.end] === character;
        return (
            ((!protectedToken || closer) && singleBracket(local, character)) ||
            (doc.selections.length > 1 && singleInsertText(local, character, 'bracket'))
        );
    });
}
export function deletePair(doc: EditorDocument) {
    return eachRange(doc, 'deletePair', singleDeletePair);
}
function linesForSelections(doc: EditorDocument) {
    let lines = new Set<number>();
    for (let range of doc.selections) {
        let first = floorIndex(doc.starts, range.start),
            last = floorIndex(doc.starts, range.end);
        if (range.end > range.start && doc.starts[last] === range.end) last--;
        for (let line = first; line <= last; line++) lines.add(line);
    }
    return [...lines].sort((a, b) => a - b);
}
export function indent(doc: EditorDocument, unit = '    ', outdent = false) {
    if (!unit || !/^[\t ]+$/.test(unit)) return false;
    if (!outdent && doc.selections.every((range) => range.start === range.end)) return insertText(doc, unit, 'indent');
    let edits: Edit[] = linesForSelections(doc).map((line) => {
        let from = doc.starts[line],
            text = doc.value.slice(from, lineEnd(doc.value, doc.starts, line)),
            count = outdent
                ? text.startsWith('\t')
                    ? 1
                    : Math.min(/^ */.exec(text)![0].length, unit === '\t' ? 4 : unit.length)
                : 0;
        return { from, to: from + count, insert: outdent ? '' : unit };
    });
    return doc.transact(edits, { source: outdent ? 'outdent' : 'indent' });
}
export function toggleComment(doc: EditorDocument, marker: string | false, block?: readonly [string, string]) {
    if (doc.selections.length === 1) return singleToggleComment(doc, marker, block);
    let lines = linesForSelections(doc),
        edits: Edit[] = [];
    if (marker) {
        let candidates = lines
            .map((line) => {
                let from = doc.starts[line],
                    text = doc.value.slice(from, lineEnd(doc.value, doc.starts, line)),
                    padding = /^[\t ]*/.exec(text)![0].length;
                return { from: from + padding, text: text.slice(padding) };
            })
            .filter((line) => line.text.trim());
        let remove = candidates.length > 0 && candidates.every((line) => line.text.startsWith(marker));
        edits = candidates.map((line) => ({
            from: line.from,
            to: line.from + (remove ? marker.length + (line.text[marker.length] === ' ' ? 1 : 0) : 0),
            insert: remove ? '' : marker + ' '
        }));
    } else {
        if (!block?.[0] || !block[1]) return false;
        let groups: number[][] = [];
        for (let line of lines) {
            let group = groups.at(-1);
            if (group && group.at(-1) === line - 1) group.push(line);
            else groups.push([line]);
        }
        for (let group of groups) {
            let from = doc.starts[group[0]],
                to = lineEnd(doc.value, doc.starts, group.at(-1)!),
                text = doc.value.slice(from, to),
                [open, close] = block;
            if (text.startsWith(open) && text.endsWith(close) && text.length >= open.length + close.length)
                edits.push({ from, to: from + open.length, insert: '' }, { from: to - close.length, to, insert: '' });
            else edits.push({ from, to: from, insert: open }, { from: to, to, insert: close });
        }
    }
    return doc.transact(edits, { source: 'comment' });
}
export function deleteCharacter(doc: EditorDocument, backwards = true, word = false) {
    return eachRange(doc, 'delete', (local) => {
        let { start, end } = local.selection;
        if (start === end) {
            if (word) {
                if (backwards) start -= /(?:\s+|[\w$]+|[^\w\s$]+)$/.exec(local.value.slice(0, start))?.[0].length ?? 0;
                else end += /^(?:\s+|[\w$]+|[^\w\s$]+)/.exec(local.value.slice(end))?.[0].length ?? 0;
            } else if (backwards) start = stepCharacter(local.value, start, true);
            else end = stepCharacter(local.value, end);
        }
        if (start === end) return true;
        return local.replace(start, end, '', { selection: { start }, source: 'delete' });
    });
}
export function addNextOccurrence(doc: EditorDocument, all = false) {
    let primary = doc.selection,
        text = doc.value.slice(primary.start, primary.end);
    if (!text) {
        let left = /[\w$]+$/.exec(doc.value.slice(0, primary.start))?.[0].length ?? 0,
            right = /^[\w$]+/.exec(doc.value.slice(primary.end))?.[0].length ?? 0;
        if (!left && !right) return false;
        doc.select({ start: primary.start - left, end: primary.end + right });
        return true;
    }
    let found: Selection[] = [...doc.selections],
        offset = all ? 0 : Math.max(...found.map((range) => range.end)),
        wrapped = false;
    while (found.length < 1000) {
        let at = doc.value.indexOf(text, offset);
        if (at < 0) {
            if (all || wrapped) break;
            offset = 0;
            wrapped = true;
            continue;
        }
        if (wrapped && at >= primary.start) break;
        if (!found.some((range) => at < range.end && at + text.length > range.start)) {
            found.push({ start: at, end: at + text.length, direction: 'none' });
            if (!all) break;
        }
        offset = at + Math.max(1, text.length);
    }
    doc.selectMany(found);
    return true;
}
export function selectLine(doc: EditorDocument) {
    doc.selectMany(
        doc.selections.map((range) => {
            let first = floorIndex(doc.starts, range.start),
                last = floorIndex(doc.starts, range.end);
            return { start: doc.starts[first], end: doc.starts[last + 1] ?? doc.value.length };
        })
    );
}
export function lineCommand(
    doc: EditorDocument,
    command: 'moveUp' | 'moveDown' | 'copyUp' | 'copyDown' | 'delete' | 'blank'
) {
    let selected = linesForSelections(doc),
        groups: number[][] = [];
    for (let line of selected) {
        let group = groups.at(-1);
        if (group && group.at(-1) === line - 1) group.push(line);
        else groups.push([line]);
    }
    let lines = doc.starts.map((from, id) => ({ id, text: doc.value.slice(from, lineEnd(doc.value, doc.starts, id)) })),
        endings = doc.starts
            .slice(1)
            .map((from, index) => doc.value.slice(lineEnd(doc.value, doc.starts, index), from)),
        eol = preferredEol(doc.value);
    for (let group of [...groups].reverse()) {
        let first = group[0],
            count = group.length,
            last = group.at(-1)!;
        if (command === 'delete') lines.splice(first, count);
        else if (command === 'blank') lines.splice(last + 1, 0, { id: -1, text: '' });
        else if (command === 'copyUp' || command === 'copyDown')
            lines.splice(
                command === 'copyUp' ? first : last + 1,
                0,
                ...lines.slice(first, last + 1).map((line) => ({ ...line }))
            );
        else if (command === 'moveUp' && first > 0) {
            let previous = lines.splice(first - 1, 1)[0];
            lines.splice(last, 0, previous);
        } else if (command === 'moveDown' && last + 1 < lines.length) {
            let next = lines.splice(last + 1, 1)[0];
            lines.splice(first, 0, next);
        }
    }
    if (!lines.length) lines = [{ id: -1, text: '' }];
    let starts: number[] = [],
        value = '';
    for (let [index, line] of lines.entries()) {
        starts.push(value.length);
        value += line.text;
        if (index < lines.length - 1) value += endings[index] ?? eol;
    }
    let map = (offset: number) => {
        let position = doc.position(offset),
            id = position.line - 1,
            index =
                command === 'copyDown'
                    ? lines.map((line) => line.id).lastIndexOf(id)
                    : lines.findIndex((line) => line.id === id);
        if (index < 0) index = Math.min(id, lines.length - 1);
        if (command === 'blank' && selected.includes(id)) {
            let blank = lines.findIndex((line, index) => line.id === id && lines[index + 1]?.id === -1);
            if (blank >= 0) return starts[blank + 1];
        }
        return starts[index] + Math.min(position.column - 1, lines[index].text.length);
    };
    let ranges = doc.selections.map((range) => ({
        start: map(range.start),
        end: map(range.end),
        direction: range.direction
    }));
    let from = 0,
        to = doc.value.length,
        end = value.length;
    while (from < Math.min(to, end) && doc.value[from] === value[from]) from++;
    while (to > from && end > from && doc.value[to - 1] === value[end - 1]) {
        to--;
        end--;
    }
    return doc.transact([{ from, to, insert: value.slice(from, end) }], { source: command, selections: ranges });
}

/** Reindent lexical block boundaries; intentionally does not emulate a full language formatter. */
export function reindent(doc: EditorDocument, language: Language, unit = '    ') {
    let selected = new Set(linesForSelections(doc)),
        edits: Edit[] = [],
        depth = 0,
        state = '';
    for (let index = 0; index < doc.starts.length; index++) {
        let from = doc.starts[index],
            text = doc.value.slice(from, lineEnd(doc.value, doc.starts, index)),
            lex = highlightLine(text, language, state);
        state = lex.state;
        let code = text
                .split('')
                .map((character, offset) =>
                    lex.tokens.some(
                        (token) =>
                            token.from <= offset &&
                            token.to > offset &&
                            ['string', 'comment', 'regexp'].includes(token.kind)
                    )
                        ? ' '
                        : character
                )
                .join(''),
            closing = /^\s*[)}\]]/.test(code) ? 1 : 0;
        if (selected.has(index) && text.trim()) {
            let padding = /^[\t ]*/.exec(text)![0];
            edits.push({
                from,
                to: from + padding.length,
                insert: unit.repeat(Math.max(0, Math.min(100, depth - closing)))
            });
        }
        for (let character of code)
            if ('([{'.includes(character)) depth++;
            else if (')]}'.includes(character)) depth = Math.max(0, depth - 1);
    }
    return doc.transact(edits, { source: 'reindent' });
}
export function transpose(doc: EditorDocument) {
    return eachRange(doc, 'transpose', (local) => {
        let { start, end } = local.selection;
        if (start !== end || start === 0) return false;
        let at = start;
        if (at === local.value.length) at = stepCharacter(local.value, at, true);
        if (at === 0) return false;
        let left = stepCharacter(local.value, at, true),
            right = stepCharacter(local.value, at);
        if (/[\r\n]/.test(local.value.slice(left, right))) return false;
        return local.replace(left, right, local.value.slice(at, right) + local.value.slice(left, at), {
            selection: { start: right },
            source: 'transpose'
        });
    });
}

/** Align a freshly typed closing delimiter with its lexical opener on an otherwise empty line. */
export function closeIndent(doc: EditorDocument, character: string, language: Language) {
    if (!/^[)}\]]$/.test(character)) return false;
    let protectedAt = contexts(
        doc.value,
        language,
        doc.selections.map((range) => range.start)
    );
    return eachRange(doc, 'closeIndent', (local) => {
        let { start, end } = local.selection,
            index = floorIndex(local.starts, start),
            from = local.starts[index],
            prefix = local.value.slice(from, start);
        if (start !== end || !prefix || !/^[\t ]+$/.test(prefix) || protectedAt.has(start)) return false;
        let pair = structures(local.value.slice(0, start) + character, language).pairs.find(
            (pair) => pair.to === start
        );
        if (!pair) return false;
        let line = floorIndex(local.starts, pair.from),
            padding = /^[\t ]*/.exec(local.value.slice(local.starts[line], pair.from))![0];
        return local.replace(from, start, padding + character, { selection: { start: from + padding.length + 1 } });
    });
}
