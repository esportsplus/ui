import { changes, diffSequences, type Change } from './engine';


// A conflict block in merged text. Offsets span from the start of its '<<<<<<<' line to past the end of its
// '>>>>>>>' line; 'line' is its first line, 0-based. The sections keep their own line breaks.
type ConflictMarker = {
    base: string | null;
    current: string;
    from: number;
    incoming: string;
    line: number;
    to: number;
};

type MergeChoice = 'both' | 'current' | 'incoming';

// A run of the merge. 'equal' is unchanged on both sides, 'current' and 'incoming' changed on that side only, 'same'
// changed alike on both, and 'conflict' changed differently. Without a base every difference is a conflict.
type MergeRegion = {
    base: readonly string[] | null;
    current: readonly string[];
    incoming: readonly string[];
    kind: 'conflict' | 'current' | 'equal' | 'incoming' | 'same';
};

type MergeResult = {
    conflicts: number;
    regions: MergeRegion[];
    // Merged text with conflict markers around whatever could not be merged.
    text: string;
};

// Where the sections of a block being read start and end, -1 until seen.
type Open = {
    at: number;
    base: number;
    baseStart: number;
    current: number;
    line: number;
    separator: number;
    separatorEnd: number;
};


const EOL = /\r\n|\r|\n/;

const LINE = /\r\n|\r|\n|$/g;

const MARKER_BASE = '|||||||';

const MARKER_CURRENT = '<<<<<<<';

const MARKER_INCOMING = '>>>>>>>';

const MARKER_SEPARATOR = '=======';

const TRAILING_EOL = /(?:\r\n|\r|\n)$/;


function delta(list: readonly Change[], first: number, last: number) {
    let out = 0;

    for (let i = first; i < last; i++) {
        out += (list[i].modified.to - list[i].modified.from) - (list[i].original.to - list[i].original.from);
    }

    return out;
}

function equal(a: readonly string[], b: readonly string[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0, n = a.length; i < n; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

function is(line: string, marker: string) {
    return line.startsWith(marker) && (line.length === marker.length || line[marker.length] === ' ');
}

function threeWay(origin: readonly string[], ours: readonly string[], theirs: readonly string[]) {
    let left = changes(diffSequences(origin, ours)),
        right = changes(diffSequences(origin, theirs)),
        out: MergeRegion[] = [],
        at = 0,
        i = 0,
        j = 0,
        shiftLeft = 0,
        shiftRight = 0;

    while (i < left.length || j < right.length) {
        let first = j >= right.length || (i < left.length && left[i].original.from <= right[j].original.from),
            start = first ? left[i].original.from : right[j].original.from,
            end = start,
            li = i,
            rj = j;

        // A chunk grows while a change on either side overlaps or touches it.
        for (let grown = true; grown;) {
            grown = false;

            while (i < left.length && left[i].original.from <= end) {
                end = Math.max(end, left[i++].original.to);
                grown = true;
            }

            while (j < right.length && right[j].original.from <= end) {
                end = Math.max(end, right[j++].original.to);
                grown = true;
            }
        }

        if (start > at) {
            let lines = origin.slice(at, start);

            out.push({ base: lines, current: lines, incoming: lines, kind: 'equal' });
        }

        let mine = ours.slice(start + shiftLeft, end + shiftLeft + delta(left, li, i)),
            yours = theirs.slice(start + shiftRight, end + shiftRight + delta(right, rj, j)),
            kind: MergeRegion['kind'] = 'conflict';

        if (li === i) {
            kind = 'incoming';
        }
        else if (rj === j) {
            kind = 'current';
        }
        else if (equal(mine, yours)) {
            kind = 'same';
        }

        out.push({ base: origin.slice(start, end), current: mine, incoming: yours, kind });
        shiftLeft += delta(left, li, i);
        shiftRight += delta(right, rj, j);
        at = end;
    }

    if (at < origin.length) {
        let lines = origin.slice(at);

        out.push({ base: lines, current: lines, incoming: lines, kind: 'equal' });
    }

    return out;
}

function twoWay(ours: readonly string[], theirs: readonly string[]) {
    let list = changes(diffSequences(ours, theirs)),
        out: MergeRegion[] = [],
        at = 0;

    for (let i = 0, n = list.length; i < n; i++) {
        let change = list[i];

        if (change.original.from > at) {
            let lines = ours.slice(at, change.original.from);

            out.push({ base: null, current: lines, incoming: lines, kind: 'equal' });
        }

        out.push({
            base: null,
            current: ours.slice(change.original.from, change.original.to),
            incoming: theirs.slice(change.modified.from, change.modified.to),
            kind: 'conflict'
        });
        at = change.original.to;
    }

    if (at < ours.length) {
        let lines = ours.slice(at);

        out.push({ base: null, current: lines, incoming: lines, kind: 'equal' });
    }

    return out;
}


// Three-way merge by lines: a change on one side only is taken, and changes on both sides that overlap or touch
// conflict unless they are identical. Without a base every difference between the sides conflicts.
const diff3 = (base: string | null, current: string, incoming: string): MergeResult => {
    let ours = current.split(EOL),
        theirs = incoming.split(EOL),
        regions = base === null ? twoWay(ours, theirs) : threeWay(base.split(EOL), ours, theirs),
        conflicts = 0,
        lines: string[] = [];

    for (let i = 0, n = regions.length; i < n; i++) {
        let region = regions[i];

        if (region.kind !== 'conflict') {
            lines.push(...(region.kind === 'incoming' ? region.incoming : region.current));
            continue;
        }

        conflicts++;
        lines.push(`${MARKER_CURRENT} current`, ...region.current);

        if (region.base) {
            lines.push(`${MARKER_BASE} base`, ...region.base);
        }

        lines.push(MARKER_SEPARATOR, ...region.incoming, `${MARKER_INCOMING} incoming`);
    }

    return { conflicts, regions, text: lines.join(EOL.exec(current)?.[0] ?? '\n') };
};

// Every complete conflict block in 'text', in order. A block opened again before it closes starts over.
const conflictMarkers = (text: string): ConflictMarker[] => {
    let index = 0,
        open: Open | null = null,
        out: ConflictMarker[] = [];

    LINE.lastIndex = 0;

    for (let at = 0; ; index++) {
        let match = LINE.exec(text)!,
            next = match.index + match[0].length,
            line = text.slice(at, match.index);

        if (is(line, MARKER_CURRENT)) {
            open = { at, base: -1, baseStart: -1, current: next, line: index, separator: -1, separatorEnd: -1 };
        }
        else if (open && open.separator < 0) {
            if (open.base < 0 && is(line, MARKER_BASE)) {
                open.base = at;
                open.baseStart = next;
            }
            else if (line === MARKER_SEPARATOR) {
                open.separator = at;
                open.separatorEnd = next;
            }
        }
        else if (open && is(line, MARKER_INCOMING)) {
            out.push({
                base: open.base < 0 ? null : text.slice(open.baseStart, open.separator),
                current: text.slice(open.current, open.base < 0 ? open.separator : open.base),
                from: open.at,
                incoming: text.slice(open.separatorEnd, at),
                line: open.line,
                to: next
            });
            open = null;
        }

        if (!match[0]) {
            break;
        }

        at = next;
    }

    return out;
};

// The text that replaces a conflict block for a choice. A block on the last line, without a line break of its own,
// drops the trailing one its sections carry.
const resolveMarker = (text: string, marker: ConflictMarker, choice: MergeChoice) => {
    let out = choice === 'current' ? marker.current : choice === 'incoming' ? marker.incoming : marker.current + marker.incoming;

    if (marker.to === text.length && !TRAILING_EOL.test(text)) {
        out = out.replace(TRAILING_EOL, '');
    }

    return out;
};


export { conflictMarkers, diff3, resolveMarker };
export type { ConflictMarker, MergeChoice, MergeRegion, MergeResult };
