// Myers O(ND) diff over sequences, after the forked engine in t3code's @t3tools/diffs.


// A run that differs between the two sides, as half-open index ranges: an empty 'original' range is a pure insertion
// at 'original.from', an empty 'modified' range a pure deletion at 'modified.from'.
type Change = {
    modified: Range;
    original: Range;
};

type Op = {
    // Index into the original side for 'equal' and 'delete'.
    a: number;
    // Index into the modified side for 'equal' and 'insert'.
    b: number;
    type: 'delete' | 'equal' | 'insert';
};

type Range = { from: number; to: number };


const EOL = /\r\n|\r|\n/;


function middle<T>(a: readonly T[], b: readonly T[], start: number, endA: number, endB: number, eq: (x: T, y: T) => boolean) {
    let n = endA - start,
        m = endB - start,
        out: Op[] = [];

    if (n === 0 || m === 0) {
        for (let i = 0; i < n; i++) {
            out.push({ a: start + i, b: start, type: 'delete' });
        }

        for (let j = 0; j < m; j++) {
            out.push({ a: start, b: start + j, type: 'insert' });
        }

        return out;
    }

    let max = n + m,
        offset = max,
        trace: Int32Array[] = [],
        v = new Int32Array(2 * max + 1);

    // Each step only keeps the diagonals it can reach, so the trace grows with D squared rather than D times N + M.
    outer: for (let d = 0; d <= max; d++) {
        trace.push(v.slice(offset - d, offset + d + 1));

        for (let k = -d; k <= d; k += 2) {
            let index = offset + k,
                x = k === -d || (k !== d && v[index - 1] < v[index + 1]) ? v[index + 1] : v[index - 1] + 1,
                y = x - k;

            while (x < n && y < m && eq(a[start + x], b[start + y])) {
                x++;
                y++;
            }

            v[index] = x;

            if (x >= n && y >= m) {
                break outer;
            }
        }
    }

    let x = n,
        y = m;

    for (let d = trace.length - 1; d > 0; d--) {
        let row = trace[d],
            k = x - y,
            previous = k === -d || (k !== d && row[d + k - 1] < row[d + k + 1]) ? k + 1 : k - 1,
            px = row[d + previous],
            py = px - previous;

        while (x > px && y > py) {
            x--;
            y--;
            out.push({ a: start + x, b: start + y, type: 'equal' });
        }

        if (x === px) {
            y--;
            out.push({ a: start + x, b: start + y, type: 'insert' });
        }
        else {
            x--;
            out.push({ a: start + x, b: start + y, type: 'delete' });
        }
    }

    while (x > 0 && y > 0) {
        x--;
        y--;
        out.push({ a: start + x, b: start + y, type: 'equal' });
    }

    while (y > 0) {
        y--;
        out.push({ a: start + x, b: start + y, type: 'insert' });
    }

    while (x > 0) {
        x--;
        out.push({ a: start + x, b: start + y, type: 'delete' });
    }

    return out.reverse();
}


// One op per aligned element, in order. The common prefix and suffix are trimmed first, which dominates real diffs.
const diffSequences = <T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): Op[] => {
    let n = a.length,
        m = b.length,
        start = 0;

    while (start < n && start < m && eq(a[start], b[start])) {
        start++;
    }

    let endA = n,
        endB = m;

    while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) {
        endA--;
        endB--;
    }

    let out: Op[] = [];

    for (let i = 0; i < start; i++) {
        out.push({ a: i, b: i, type: 'equal' });
    }

    let inner = middle(a, b, start, endA, endB, eq);

    for (let i = 0, k = inner.length; i < k; i++) {
        out.push(inner[i]);
    }

    for (let i = endA, j = endB; i < n; i++, j++) {
        out.push({ a: i, b: j, type: 'equal' });
    }

    return out;
};

// The runs that differ, merging adjacent deletes and inserts into one change each.
const changes = (ops: readonly Op[]): Change[] => {
    let out: Change[] = [],
        current: Change | null = null;

    for (let i = 0, n = ops.length; i < n; i++) {
        let op = ops[i];

        if (op.type === 'equal') {
            current = null;
            continue;
        }

        if (!current) {
            current = { modified: { from: op.b, to: op.b }, original: { from: op.a, to: op.a } };
            out.push(current);
        }

        if (op.type === 'delete') {
            current.original.to = op.a + 1;
        }
        else {
            current.modified.to = op.b + 1;
        }
    }

    return out;
};

// Changed line ranges between two texts, line endings ignored.
const diffLines = (original: string, modified: string): Change[] => {
    if (original === modified) {
        return [];
    }

    return changes(diffSequences(original.split(EOL), modified.split(EOL)));
};


export { changes, diffLines, diffSequences };
export type { Change, Op, Range };
