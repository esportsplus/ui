import { clamp } from '~/shared/clamp';
import {
    EditorDocument,
    floorIndex,
    sameSelections,
    selection,
    type Edit,
    type Selection,
    type TransactionOptions
} from './document';
import { openBracket } from './folding';
import { stepCharacter } from './selection';
import { syntaxCache, type Language, type Token } from './syntax';


type CommandTarget = Pick<EditorDocument, 'eol' | 'replace' | 'select' | 'selection' | 'starts' | 'value'>;

type LineCommand = 'blank' | 'copyDown' | 'copyUp' | 'delete' | 'moveDown' | 'moveUp';

type Row = { id: number; text: string };


const BLANK = /\s/;

const CLOSE_BRACKETS = ')]}';

const CLOSERS = ')]}"\'`';

const HTML_CLOSE = /<\//;

const HTML_OPEN = /<[\w:-]+[^>]*>$/;

const INDENT = /^[\t ]*/;

const LINE_BREAK = /[\r\n]/;

const NEEDS_SPACE = /[\s)\]}>,;:]/;

const OPENERS = '([{';

const PAIRS: Record<string, string> = {
    '"': '"',
    "'": "'",
    '(': ')',
    '[': ']',
    '`': '`',
    '{': '}'
};

const PROTECTED = new Set<Token['kind']>(['comment', 'regexp', 'string']);

const SPACES = /^ */;

const WHITESPACE = /^[\t ]+$/;

const WORD = /[\w$]/;


// Character class for word-wise deletion: whitespace, identifier characters, or punctuation runs.
function classOf(character: string) {
    return BLANK.test(character) ? 0 : WORD.test(character) ? 1 : 2;
}

// Runs selection-local assistance against the same original source and commits once.
function eachRange(doc: EditorDocument, source: string, run: (local: CommandTarget, index: number) => boolean) {
    let destinations: { from: number; range: Selection }[] = [],
        edits: Edit[] = [],
        ranges = doc.selections;

    for (let index = 0, n = ranges.length; index < n; index++) {
        let edit: Edit | undefined,
            range = ranges[index],
            next = range;

        let local: CommandTarget = {
            eol: doc.eol,
            replace(from: number, to: number, insert: string, options: TransactionOptions = {}) {
                let length = doc.value.length + insert.length - (to - from);

                edit = { from, insert, to };
                next = selection(options.selection ?? { start: from + insert.length }, length);

                return true;
            },
            select(value) {
                next = selection(value, doc.value.length);
            },
            get selection() {
                return next;
            },
            starts: doc.starts,
            value: doc.value
        };

        if (!run(local, index)) {
            return false;
        }

        if (edit && doc.value.slice(edit.from, edit.to) !== edit.insert) {
            edits.push(edit);
        }

        destinations.push({ from: edit?.from ?? range.start, range: next });
    }

    let sorted = [...edits].sort((a, b) => a.from - b.from);

    if (source === 'delete') {
        let merged: Edit[] = [];

        for (let i = 0, n = sorted.length; i < n; i++) {
            let edit = sorted[i],
                last = merged[merged.length - 1];

            if (last && edit.from <= last.to) {
                merged[merged.length - 1] = { from: last.from, insert: '', to: Math.max(last.to, edit.to) };
            }
            else {
                merged.push(edit);
            }
        }

        sorted = merged;
    }

    let shifts = [0];

    for (let i = 0, n = sorted.length; i < n; i++) {
        if (i && sorted[i].from < sorted[i - 1].to) {
            return false;
        }

        shifts.push(shifts[i] + sorted[i].insert.length - (sorted[i].to - sorted[i].from));
    }

    let next = destinations.map(({ from, range }) => {
        if (source !== 'delete') {
            let shift = shifts[search(sorted, from, false)];

            return { ...range, end: range.end + shift, start: range.start + shift };
        }

        let map = (position: number) => {
            let index = search(sorted, position, true),
                edit = sorted[index];

            return edit && edit.from <= position ? edit.from + shifts[index] : position + shifts[index];
        };

        return { ...range, end: map(range.end), start: map(range.start) };
    });

    if (!edits.length) {
        let changed = !sameSelections(doc.selections, next);

        doc.selectMany(next);

        return source === 'bracket' && changed;
    }

    return doc.transact(sorted, {
        group: source === 'input' ? 'insertText' : undefined,
        selections: next,
        source
    }).changed;
}

// Runs of consecutive line indexes.
function groupsOf(lines: readonly number[]) {
    let groups: number[][] = [];

    for (let i = 0, n = lines.length; i < n; i++) {
        let group = groups[groups.length - 1];

        if (group && group[group.length - 1] === lines[i] - 1) {
            group.push(lines[i]);
        }
        else {
            groups.push([lines[i]]);
        }
    }

    return groups;
}

function lineStart(doc: CommandTarget, offset: number) {
    return doc.starts[floorIndex(doc.starts, offset)];
}

// Every line a selection touches, once, ascending; a selection ending at a line start leaves that line out.
function linesForSelections(doc: EditorDocument) {
    let lines = new Set<number>(),
        ranges = doc.selections;

    for (let i = 0, n = ranges.length; i < n; i++) {
        let range = ranges[i],
            first = doc.lineAt(range.start),
            last = doc.lineAt(range.end);

        if (range.end > range.start && doc.lineStart(last) === range.end) {
            last--;
        }

        for (let line = first; line <= last; line++) {
            lines.add(line);
        }
    }

    return [...lines].sort((a, b) => a - b);
}

// A caret inside a string, comment or regexp gets no pairing or extra indentation.
function protectedAt(doc: EditorDocument, language: Language, offset: number) {
    if (language === 'plain') {
        return false;
    }

    let token = syntaxCache(doc, language).tokenAt(offset);

    return !!token && PROTECTED.has(token.kind);
}

// Index of the first edit whose start (or, for 'inclusive', end) is at or after 'position'.
function search(edits: readonly Edit[], position: number, inclusive: boolean) {
    let hi = edits.length,
        lo = 0;

    while (lo < hi) {
        let mid = (lo + hi) >>> 1;

        if ((inclusive ? edits[mid].to : edits[mid].from) < position) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }

    return lo;
}

// Conservative character assistance, not language-aware parsing.
function singleBracket(doc: CommandTarget, character: string) {
    let { direction, end, start } = doc.selection,
        after = doc.value[end] ?? '',
        before = doc.value[start - 1] ?? '',
        close = PAIRS[character];

    if (start === end && CLOSERS.includes(character) && after === character && before !== '\\') {
        doc.select({ end: start + 1, start: start + 1 });
        return true;
    }

    if (!close || before === '\\') {
        return false;
    }

    if (start === end && (('"\'`'.includes(character) && WORD.test(before)) || (after && !NEEDS_SPACE.test(after)))) {
        return false;
    }

    doc.replace(start, end, character + doc.value.slice(start, end) + close, {
        selection: { direction, end: end + 1, start: start + 1 },
        source: 'bracket'
    });

    return true;
}

function singleDeletePair(doc: CommandTarget) {
    let { end, start } = doc.selection,
        close = PAIRS[doc.value[start - 1]];

    if (start !== end || !close || close !== doc.value[start]) {
        return false;
    }

    return doc.replace(start - 1, start + 1, '', { selection: { start: start - 1 }, source: 'deletePair' });
}

function singleInsertText(doc: CommandTarget, text: string, source = 'insert') {
    let { end, start } = doc.selection,
        caret = start + text.length;

    return doc.replace(start, end, text, { selection: { end: caret, start: caret }, source });
}

function singleNewline(doc: CommandTarget, unit: string, language: Language) {
    let { end, start } = doc.selection,
        prefix = doc.value.slice(lineStart(doc, start), start),
        padding = INDENT.exec(prefix)![0],
        left = prefix.trimEnd().at(-1) ?? '',
        opens =
            (left !== '' && OPENERS.includes(left)) ||
            (language === 'python' && left === ':') ||
            (language === 'html' && HTML_OPEN.test(prefix) && !HTML_CLOSE.test(prefix)),
        close = PAIRS[left],
        inner = padding + (opens ? unit : ''),
        text = doc.eol + inner;

    // Between a pair, the closing delimiter keeps the original indentation.
    if (opens && close && doc.value.startsWith(close, end)) {
        text += doc.eol + padding;
    }

    let caret = start + doc.eol.length + inner.length;

    return doc.replace(start, end, text, { selection: { end: caret, start: caret }, source: 'newline' });
}

function wordEnd(text: string, offset: number) {
    if (offset >= text.length) {
        return offset;
    }

    let kind = classOf(text[offset]);

    while (offset < text.length && classOf(text[offset]) === kind) {
        offset++;
    }

    return offset;
}

function wordStart(text: string, offset: number) {
    if (offset <= 0) {
        return offset;
    }

    let kind = classOf(text[offset - 1]);

    while (offset > 0 && classOf(text[offset - 1]) === kind) {
        offset--;
    }

    return offset;
}


const addNextOccurrence = (doc: EditorDocument, all = false) => {
    let primary = doc.selection,
        text = doc.value.slice(primary.start, primary.end),
        value = doc.value;

    if (!text) {
        let end = primary.end,
            start = primary.start;

        while (start > 0 && WORD.test(value[start - 1])) {
            start--;
        }

        while (end < value.length && WORD.test(value[end])) {
            end++;
        }

        if (start === primary.start && end === primary.end) {
            return false;
        }

        doc.select({ end, start });

        return true;
    }

    let found: Selection[] = [...doc.selections],
        offset = all ? 0 : Math.max(...found.map((range) => range.end)),
        wrapped = false;

    while (found.length < 1000) {
        let at = value.indexOf(text, offset);

        if (at < 0) {
            if (all || wrapped) {
                break;
            }

            offset = 0;
            wrapped = true;
            continue;
        }

        if (wrapped && at >= primary.start) {
            break;
        }

        if (!found.some((range) => at < range.end && at + text.length > range.start)) {
            found.push({ direction: 'none', end: at + text.length, start: at });

            if (!all) {
                break;
            }
        }

        offset = at + Math.max(1, text.length);
    }

    doc.selectMany(found);

    return true;
};

const bracket = (doc: EditorDocument, character: string, language: Language = 'plain') => {
    // Anything else is plain typing, which the caller inserts as input so it groups into one undo step.
    if (!PAIRS[character] && !CLOSERS.includes(character)) {
        return false;
    }

    return eachRange(doc, 'bracket', (local) => {
        let closer = CLOSERS.includes(character) && local.value[local.selection.end] === character;

        return (
            ((closer || !protectedAt(doc, language, local.selection.start)) && singleBracket(local, character)) ||
            (doc.selections.length > 1 && singleInsertText(local, character, 'bracket'))
        );
    });
};

// Aligns a freshly typed closing delimiter with its lexical opener on an otherwise empty line.
const closeIndent = (doc: EditorDocument, character: string, language: Language) => {
    if (character.length !== 1 || !CLOSE_BRACKETS.includes(character)) {
        return false;
    }

    let cache = language === 'plain' ? null : syntaxCache(doc, language);

    return eachRange(doc, 'closeIndent', (local) => {
        let { end, start } = local.selection,
            from = lineStart(local, start),
            prefix = local.value.slice(from, start);

        if (start !== end || !WHITESPACE.test(prefix) || !cache || cache.tokenAt(start)) {
            return false;
        }

        let open = openBracket(cache, start);

        if (!open || PAIRS[open.name] !== character) {
            return false;
        }

        let padding = INDENT.exec(local.value.slice(lineStart(local, open.from), open.from))![0];

        return local.replace(from, start, padding + character, { selection: { start: from + padding.length + 1 } });
    });
};

const deleteCharacter = (doc: EditorDocument, backwards = true, word = false) => {
    return eachRange(doc, 'delete', (local) => {
        let { end, start } = local.selection;

        if (start === end) {
            if (word) {
                if (backwards) {
                    start = wordStart(local.value, start);
                }
                else {
                    end = wordEnd(local.value, end);
                }
            }
            else if (backwards) {
                start = stepCharacter(local.value, start, true);
            }
            else {
                end = stepCharacter(local.value, end);
            }
        }

        if (start === end) {
            return true;
        }

        return local.replace(start, end, '', { selection: { start }, source: 'delete' });
    });
};

const deletePair = (doc: EditorDocument) => {
    return eachRange(doc, 'deletePair', singleDeletePair);
};

const indent = (doc: EditorDocument, unit = '    ', outdent = false) => {
    if (!WHITESPACE.test(unit)) {
        return false;
    }

    if (!outdent && doc.selections.every((range) => range.start === range.end)) {
        return insertText(doc, unit, 'indent');
    }

    let edits = linesForSelections(doc).map((line): Edit => {
        let from = doc.lineStart(line),
            text = doc.lineText(line),
            count = 0;

        if (outdent) {
            count = text.startsWith('\t') ? 1 : Math.min(SPACES.exec(text)![0].length, unit === '\t' ? 4 : unit.length);
        }

        return { from, insert: outdent ? '' : unit, to: from + count };
    });

    return doc.transact(edits, { source: outdent ? 'outdent' : 'indent' }).changed;
};

const insertText = (doc: EditorDocument, text: string | readonly string[], source = 'insert') => {
    return eachRange(doc, source, (local, index) =>
        singleInsertText(local, typeof text === 'string' ? text : (text[index % text.length] ?? ''), source)
    );
};

// Moves, copies, deletes or blanks every selected line. Only the window of lines the groups span (plus a neighbour
// for moves) is rebuilt; each line-ending slot inside it keeps its own EOL, so mixed endings survive.
const lineCommand = (doc: EditorDocument, command: LineCommand) => {
    let groups = groupsOf(linesForSelections(doc)),
        first = Math.max(0, groups[0][0] - 1),
        last = Math.min(doc.lineCount - 1, groups[groups.length - 1].at(-1)! + 1),
        endings: string[] = [],
        rows: Row[] = [],
        selected = new Set(groups.flat());

    for (let line = first; line <= last; line++) {
        rows.push({ id: line, text: doc.lineText(line) });

        if (line < last) {
            endings.push(doc.value.slice(doc.lineEnd(line), doc.lineStart(line + 1)));
        }
    }

    for (let i = groups.length - 1; i >= 0; i--) {
        let group = groups[i],
            from = group[0] - first,
            to = group[group.length - 1] - first;

        switch (command) {
            case 'blank':
                rows.splice(to + 1, 0, { id: -1, text: '' });
                break;
            case 'copyDown':
            case 'copyUp':
                rows.splice(
                    command === 'copyUp' ? from : to + 1,
                    0,
                    ...rows.slice(from, to + 1).map((row) => ({ ...row }))
                );
                break;
            case 'delete':
                rows.splice(from, to - from + 1);
                break;
            case 'moveDown':
                if (to + 1 < rows.length) {
                    rows.splice(from, 0, rows.splice(to + 1, 1)[0]);
                }

                break;
            case 'moveUp':
                if (group[0] > 0) {
                    rows.splice(to, 0, rows.splice(from - 1, 1)[0]);
                }

                break;
        }
    }

    // Only a window spanning the whole document can lose every line: the neighbours are never selected.
    if (!rows.length) {
        rows = [{ id: -1, text: '' }];
    }

    let begin = doc.lineStart(first),
        finish = doc.lineEnd(last),
        starts: number[] = [],
        value = '';

    for (let i = 0, n = rows.length; i < n; i++) {
        starts.push(value.length);
        value += rows[i].text;

        if (i < n - 1) {
            value += endings[i] ?? doc.eol;
        }
    }

    let delta = value.length - (finish - begin);

    let map = (offset: number) => {
        if (offset < begin) {
            return offset;
        }

        if (offset > finish) {
            return offset + delta;
        }

        let position = doc.position(offset),
            id = position.line - 1,
            index =
                command === 'copyDown'
                    ? rows.map((row) => row.id).lastIndexOf(id)
                    : rows.findIndex((row) => row.id === id);

        if (index < 0) {
            index = Math.min(Math.max(0, id - first), rows.length - 1);
        }

        if (command === 'blank' && selected.has(id)) {
            let blank = rows.findIndex((row, i) => row.id === id && rows[i + 1]?.id === -1);

            if (blank >= 0) {
                return begin + starts[blank + 1];
            }
        }

        return begin + starts[index] + Math.min(position.column - 1, rows[index].text.length);
    };

    let end = begin + value.length,
        from = begin,
        ranges = doc.selections.map((range) => ({
            direction: range.direction,
            end: map(range.end),
            start: map(range.start)
        })),
        source = doc.value,
        to = finish;

    // Trimmed to what actually changed, so folds and marks outside the edit stay put.
    while (from < Math.min(to, end) && source[from] === value[from - begin]) {
        from++;
    }

    while (to > from && end > from && source[to - 1] === value[end - 1 - begin]) {
        to--;
        end--;
    }

    return doc.transact([{ from, insert: value.slice(from - begin, end - begin), to }], {
        selections: ranges,
        source: command
    }).changed;
};

const newline = (doc: EditorDocument, unit = '    ', language: Language = 'plain') => {
    return eachRange(doc, 'newline', (local) => {
        if (!protectedAt(doc, language, local.selection.start)) {
            return singleNewline(local, unit, language);
        }

        let start = local.selection.start,
            padding = INDENT.exec(local.value.slice(lineStart(local, start), start))![0];

        return singleInsertText(local, local.eol + padding, 'newline');
    });
};

// Reindents lexical block boundaries; intentionally not a language formatter.
const reindent = (doc: EditorDocument, language: Language, unit = '    ') => {
    let cache = language === 'plain' ? null : syntaxCache(doc, language),
        depth = 0,
        edits: Edit[] = [],
        selected = new Set(linesForSelections(doc));

    for (let index = 0, n = doc.lineCount; index < n; index++) {
        let closing = -1,
            k = 0,
            start = depth,
            text = doc.lineText(index),
            tokens = cache ? cache.lineTokens(index) : [];

        for (let i = 0, m = text.length; i < m; i++) {
            while (k < tokens.length && tokens[k].to <= i) {
                k++;
            }

            if (tokens[k] && tokens[k].from <= i && PROTECTED.has(tokens[k].kind)) {
                continue;
            }

            let character = text[i],
                close = CLOSE_BRACKETS.includes(character);

            if (closing < 0 && !BLANK.test(character)) {
                closing = close ? 1 : 0;
            }

            if (OPENERS.includes(character)) {
                depth++;
            }
            else if (close) {
                depth = Math.max(0, depth - 1);
            }
        }

        if (selected.has(index) && text.trim()) {
            let from = doc.lineStart(index);

            edits.push({
                from,
                insert: unit.repeat(clamp(start - Math.max(0, closing), 0, 100)),
                to: from + INDENT.exec(text)![0].length
            });
        }
    }

    return doc.transact(edits, { source: 'reindent' }).changed;
};

const selectLine = (doc: EditorDocument) => {
    doc.selectMany(
        doc.selections.map((range) => {
            let last = doc.lineAt(range.end);

            return {
                end: last + 1 < doc.lineCount ? doc.lineStart(last + 1) : doc.value.length,
                start: doc.lineStart(doc.lineAt(range.start))
            };
        })
    );
};

const toggleComment = (doc: EditorDocument, marker: string | false, block?: readonly [string, string]) => {
    let edits: Edit[] = [],
        lines = linesForSelections(doc);

    if (marker) {
        let candidates: { from: number; text: string }[] = [];

        for (let i = 0, n = lines.length; i < n; i++) {
            let text = doc.lineText(lines[i]),
                padding = INDENT.exec(text)![0].length;

            if (text.trim()) {
                candidates.push({ from: doc.lineStart(lines[i]) + padding, text: text.slice(padding) });
            }
        }

        let remove = candidates.length > 0 && candidates.every((line) => line.text.startsWith(marker));

        for (let i = 0, n = candidates.length; i < n; i++) {
            let { from, text } = candidates[i];

            edits.push({
                from,
                insert: remove ? '' : marker + ' ',
                to: from + (remove ? marker.length + (text[marker.length] === ' ' ? 1 : 0) : 0)
            });
        }
    }
    else {
        if (!block?.[0] || !block[1]) {
            return false;
        }

        let [open, close] = block,
            groups = groupsOf(lines);

        for (let i = 0, n = groups.length; i < n; i++) {
            let from = doc.lineStart(groups[i][0]),
                to = doc.lineEnd(groups[i][groups[i].length - 1]),
                text = doc.value.slice(from, to);

            if (text.startsWith(open) && text.endsWith(close) && text.length >= open.length + close.length) {
                edits.push({ from, insert: '', to: from + open.length }, { from: to - close.length, insert: '', to });
            }
            else {
                edits.push({ from, insert: open, to: from }, { from: to, insert: close, to });
            }
        }
    }

    return doc.transact(edits, { source: 'comment' }).changed;
};

const transpose = (doc: EditorDocument) => {
    return eachRange(doc, 'transpose', (local) => {
        let { end, start } = local.selection;

        if (start !== end || start === 0) {
            return false;
        }

        let at = start === local.value.length ? stepCharacter(local.value, start, true) : start;

        if (at === 0) {
            return false;
        }

        let left = stepCharacter(local.value, at, true),
            right = stepCharacter(local.value, at);

        if (LINE_BREAK.test(local.value.slice(left, right))) {
            return false;
        }

        return local.replace(left, right, local.value.slice(at, right) + local.value.slice(left, at), {
            selection: { start: right },
            source: 'transpose'
        });
    });
};


export {
    addNextOccurrence,
    bracket,
    closeIndent,
    deleteCharacter,
    deletePair,
    indent,
    insertText,
    lineCommand,
    newline,
    reindent,
    selectLine,
    toggleComment,
    transpose
};
export type { LineCommand };
