import { diffLines } from '../diffs/engine';
import type { Edit } from './document';


// A changed run of lines against the baseline, 0-based and half-open: [from, to) in the document, 'original' in the
// baseline. A deletion has from === to and is drawn at the top of line 'from'.
type LineChange = {
    from: number;
    kind: 'added' | 'deleted' | 'modified';
    original: { from: number; to: number };
    to: number;
};


const BREAK = /\r\n|\r|\n/g;

const TRAILING_BREAK = /(?:\r\n|\r|\n)$/;


// Lines with their line breaks; a text ending in a break has an empty last line, as the document counts them.
function lines(text: string) {
    let at = 0,
        out: string[] = [];

    for (let match of text.matchAll(BREAK)) {
        out.push(text.slice(at, match.index + match[0].length));
        at = match.index + match[0].length;
    }

    out.push(text.slice(at));

    return out;
}

function offset(list: readonly string[], index: number) {
    let total = 0;

    for (let i = 0; i < index; i++) {
        total += list[i].length;
    }

    return total;
}


// The kind of each changed line (0-based), as the gutter draws it; a deletion marks the line below it.
const changeLines = (changes: readonly LineChange[], count: number) => {
    let out = new Map<number, LineChange['kind']>();

    for (let i = 0, n = changes.length; i < n; i++) {
        let change = changes[i];

        if (change.kind === 'deleted') {
            let line = Math.min(change.from, count - 1);

            if (!out.has(line)) {
                out.set(line, 'deleted');
            }

            continue;
        }

        for (let line = change.from; line < change.to; line++) {
            out.set(line, change.kind);
        }
    }

    return out;
};

// Line changes from the baseline to the text.
const lineChanges = (baseline: string, text: string): LineChange[] => {
    let changes = diffLines(baseline, text),
        out: LineChange[] = [];

    for (let i = 0, n = changes.length; i < n; i++) {
        let { modified, original } = changes[i];

        out.push({
            from: modified.from,
            kind: original.from === original.to ? 'added' : modified.from === modified.to ? 'deleted' : 'modified',
            original: { from: original.from, to: original.to },
            to: modified.to
        });
    }

    return out;
};

// The edit that puts a change's baseline lines back, line breaks in the document's own style.
const revertChange = (baseline: string, text: string, change: LineChange, eol: string): Edit => {
    let current = lines(text),
        from = offset(current, change.from),
        insert = lines(baseline).slice(change.original.from, change.original.to).map((line) => line.replace(TRAILING_BREAK, eol)).join(''),
        to = offset(current, change.to);

    // Lines deleted from the end of the text come back after its last line, which has no break of its own.
    if (change.from === current.length) {
        insert = eol + insert;
    }
    // Lines added at the end go with the break before them.
    else if (!insert && change.from > 0 && change.to === current.length) {
        from -= current[change.from - 1].match(TRAILING_BREAK)?.[0].length ?? 0;
    }

    return { from, insert, to };
};


export { changeLines, lineChanges, revertChange };
export type { LineChange };
