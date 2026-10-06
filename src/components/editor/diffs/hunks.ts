import { diffSequences, type Range } from './engine';


// Two texts aligned line by line, with every changed run and the totals for a header.
type Diff = {
    additions: number;
    changes: DiffChange[];
    deletions: number;
    modified: readonly string[];
    original: readonly string[];
    rows: Row[];
};

// One contiguous changed run, as 'onaccept' and 'onrevert' receive it. 'original' and 'modified' are 0-based,
// half-open line ranges, the texts are those lines joined with '\n', and 'rows' indexes 'Diff.rows'.
type DiffChange = {
    index: number;
    modified: Range;
    modifiedText: string;
    original: Range;
    originalText: string;
    rows: Range;
};

// Changes grouped with their surrounding context, git style; 'changes' indexes 'Diff.changes'.
type Hunk = {
    changes: Range;
    modified: Range;
    original: Range;
    rows: Range;
};

type Layout = {
    // Unchanged rows outside every hunk, hidden behind an "N hidden lines" row, leading and trailing ones included.
    gaps: Range[];
    hunks: Hunk[];
};

// One aligned row; 'original' and 'modified' are 0-based line indexes, null on the side the row is absent from.
type Row = {
    modified: number | null;
    original: number | null;
    type: RowType;
};

type RowType = 'delete' | 'equal' | 'insert';


const EOL = /\r\n|\r|\n/;


function eol(text: string) {
    return EOL.exec(text)?.[0] ?? '\n';
}

function splice(text: string, range: Range, replacement: string, empty: boolean) {
    let lines = text.split(EOL);

    lines.splice(range.from, range.to - range.from, ...(empty ? [] : replacement.split('\n')));

    return lines.join(eol(text));
}


// Takes one change into the original text: its original lines become the modified ones.
const acceptChange = (original: string, change: DiffChange) => {
    return splice(original, change.original, change.modifiedText, change.modified.from === change.modified.to);
};

// Every row of both texts in order, with each changed run; 'ignoreWhitespace' compares lines without their leading
// and trailing whitespace.
const diffTexts = (original: string, modified: string, { ignoreWhitespace = false }: { ignoreWhitespace?: boolean } = {}): Diff => {
    let a = original.split(EOL),
        b = modified.split(EOL),
        ops = ignoreWhitespace
            ? diffSequences(a.map((line) => line.trim()), b.map((line) => line.trim()))
            : diffSequences(a, b),
        additions = 0,
        changes: DiffChange[] = [],
        current: DiffChange | null = null,
        deletions = 0,
        rows: Row[] = new Array(ops.length);

    for (let i = 0, n = ops.length; i < n; i++) {
        let op = ops[i];

        if (op.type === 'equal') {
            current = null;
            rows[i] = { modified: op.b, original: op.a, type: 'equal' };
            continue;
        }

        if (!current) {
            current = {
                index: changes.length,
                modified: { from: op.b, to: op.b },
                modifiedText: '',
                original: { from: op.a, to: op.a },
                originalText: '',
                rows: { from: i, to: i }
            };
            changes.push(current);
        }

        current.rows.to = i + 1;

        if (op.type === 'delete') {
            current.original.to = op.a + 1;
            deletions++;
            rows[i] = { modified: null, original: op.a, type: 'delete' };
        }
        else {
            current.modified.to = op.b + 1;
            additions++;
            rows[i] = { modified: op.b, original: null, type: 'insert' };
        }
    }

    for (let i = 0, n = changes.length; i < n; i++) {
        let change = changes[i];

        change.modifiedText = b.slice(change.modified.from, change.modified.to).join('\n');
        change.originalText = a.slice(change.original.from, change.original.to).join('\n');
    }

    return { additions, changes, deletions, modified: b, original: a, rows };
};

// Groups changes into hunks with 'context' unchanged rows around each, merging hunks whose context would touch; the
// rest are gaps. Identical texts are one gap.
const hunks = (diff: Diff, context = 3): Layout => {
    let { changes, rows } = diff,
        gaps: Range[] = [],
        out: Hunk[] = [],
        total = rows.length;

    context = Math.max(0, context);

    for (let i = 0, n = changes.length; i < n; i++) {
        let change = changes[i],
            from = Math.max(0, change.rows.from - context),
            last = out[out.length - 1];

        if (last && from <= last.rows.to) {
            last.changes.to = i + 1;
            last.rows.to = Math.min(total, change.rows.to + context);
            continue;
        }

        out.push({
            changes: { from: i, to: i + 1 },
            modified: { from: 0, to: 0 },
            original: { from: 0, to: 0 },
            rows: { from, to: Math.min(total, change.rows.to + context) }
        });
    }

    let at = 0;

    for (let i = 0, n = out.length; i < n; i++) {
        let hunk = out[i],
            first = rows[hunk.rows.from],
            last = rows[hunk.rows.to - 1];

        if (hunk.rows.from > at) {
            gaps.push({ from: at, to: hunk.rows.from });
        }

        at = hunk.rows.to;

        // A row absent from one side still sits between two lines of it; count from the change's own ranges there.
        hunk.original = {
            from: first.original ?? changes[hunk.changes.from].original.from,
            to: last.original === null ? changes[hunk.changes.to - 1].original.to : last.original + 1
        };
        hunk.modified = {
            from: first.modified ?? changes[hunk.changes.from].modified.from,
            to: last.modified === null ? changes[hunk.changes.to - 1].modified.to : last.modified + 1
        };
    }

    if (at < total) {
        gaps.push({ from: at, to: total });
    }

    return { gaps, hunks: out };
};

// Takes one change back out of the modified text: its modified lines become the original ones.
const revertChange = (modified: string, change: DiffChange) => {
    return splice(modified, change.modified, change.originalText, change.original.from === change.original.to);
};


export { acceptChange, diffTexts, hunks, revertChange };
export type { Diff, DiffChange, Hunk, Layout, Row, RowType };
