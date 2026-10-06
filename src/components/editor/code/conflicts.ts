import type { Edit } from './document';


// A merge conflict block: offsets [start, end) cover it from the '<<<<<<<' line through the '>>>>>>>' line and its
// line break; each side keeps its own line breaks; 'line' (1-based) is the '<<<<<<<' line.
type Conflict = {
    base: string | null;
    current: string;
    end: number;
    incoming: string;
    line: number;
    start: number;
};

// The block's marker lines, 1-based: '|||||||' (or -1 without a base), '=======' and '>>>>>>>'.
type Block = Conflict & {
    close: number;
    divider: number;
    middle: number;
};

type Resolution = 'both' | 'current' | 'incoming' | (string & {});

// What a line of a block is, for tinting.
type Tint = 'base' | 'current' | 'divider' | 'incoming';


const MARKERS = ['<<<<<<<', '|||||||', '=======', '>>>>>>>'] as const;


// The marker a line opens with: 0 to 3 in 'MARKERS' order, or -1. Seven characters exactly, then the end of the line
// or a space and a label; '=======' takes no label.
function marker(line: string) {
    if (line.length < 7) {
        return -1;
    }

    let kind = MARKERS.indexOf(line.slice(0, 7) as typeof MARKERS[number]);

    if (kind === -1 || line.length === 7) {
        return kind;
    }

    if (kind === 2) {
        return line.slice(7).trim() ? -1 : 2;
    }

    let next = line.charCodeAt(7);

    return next === 32 || next === 9 ? kind : -1;
}


// Every well-formed conflict block in order; an unfinished or malformed one is skipped.
const conflictsOf = (text: string): Block[] => {
    let out: Block[] = [];

    if (text.indexOf('<<<<<<<') === -1) {
        return out;
    }

    // Offsets where each side's text starts and the marker lines seen so far; 'stage' is the marker expected next.
    let block = { base: -1, divider: -1, dividerAt: -1, from: -1, incoming: -1, line: -1, middle: -1, middleAt: -1, start: -1 },
        stage = 0;

    for (let at = 0, line = 1, n = text.length; ; line++) {
        let newline = text.indexOf('\n', at),
            stop = newline === -1 ? n : newline,
            next = newline === -1 ? n : newline + 1,
            kind = marker(text.slice(at, stop > at && text.charCodeAt(stop - 1) === 13 ? stop - 1 : stop));

        if (kind === 0) {
            block = { base: -1, divider: -1, dividerAt: -1, from: next, incoming: -1, line, middle: -1, middleAt: -1, start: at };
            stage = 1;
        }
        else if (kind === 1 && stage === 1) {
            block.base = next;
            block.middle = line;
            block.middleAt = at;
            stage = 2;
        }
        else if (kind === 2 && (stage === 1 || stage === 2)) {
            block.divider = line;
            block.dividerAt = at;
            block.incoming = next;
            stage = 3;
        }
        else if (kind === 3 && stage === 3) {
            out.push({
                base: block.middle === -1 ? null : text.slice(block.base, block.dividerAt),
                close: line,
                current: text.slice(block.from, block.middle === -1 ? block.dividerAt : block.middleAt),
                divider: block.divider,
                end: next,
                incoming: text.slice(block.incoming, at),
                line: block.line,
                middle: block.middle,
                start: block.start
            });
            stage = 0;
        }

        if (newline === -1) {
            break;
        }

        at = next;
    }

    return out;
};

// The edit that settles a conflict: one side, both in order, or any text. When the block ends the text without a line
// break, the side's own last line break goes too, so nothing is added at the end.
const resolveConflict = (text: string, conflict: Conflict, resolution: Resolution): Edit => {
    let side = resolution === 'both' || resolution === 'current' || resolution === 'incoming',
        insert = resolution === 'current'
            ? conflict.current
            : resolution === 'incoming'
                ? conflict.incoming
                : resolution === 'both'
                    ? conflict.current + conflict.incoming
                    : resolution;

    if (side && conflict.end === text.length && !/[\r\n]$/.test(text)) {
        insert = insert.replace(/(?:\r\n|\r|\n)$/, '');
    }

    return { from: conflict.start, insert, to: conflict.end };
};

// The tint of each line (1-based) inside the blocks.
const tints = (blocks: readonly Block[]) => {
    let out = new Map<number, Tint>();

    for (let i = 0, n = blocks.length; i < n; i++) {
        let block = blocks[i],
            base = block.middle === -1 ? block.divider : block.middle;

        for (let line = block.line; line < base; line++) {
            out.set(line, 'current');
        }

        for (let line = base; line < block.divider; line++) {
            out.set(line, 'base');
        }

        out.set(block.divider, 'divider');

        for (let line = block.divider + 1; line <= block.close; line++) {
            out.set(line, 'incoming');
        }
    }

    return out;
};


export { conflictsOf, resolveConflict, tints };
export type { Block, Conflict, Resolution, Tint };
