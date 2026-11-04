import { clamp } from '~/shared/clamp';


// The turns in view, 'end' exclusive; an empty range lights nothing.
type Range = {
    end: number;
    start: number;
};


// The range once 'index' leads it, keeping its size: as far as the thread can scroll, so near the end the last turns
// fill it instead.
const lead = (index: number, range: Range, total: number): Range => {
    let size = Math.min(Math.max(range.end - range.start, 1), total),
        start = clamp(index, 0, total - size);

    return { end: start + size, start };
};

// The smallest range covering every index; null when there are none, so a caller can keep the last range rather than
// light nothing while scrolling across a gap between turns.
const span = (indexes: Iterable<number>): Range | null => {
    let end = -1,
        start = Infinity;

    for (let index of indexes) {
        if (index < 0) {
            continue;
        }

        if (index < start) {
            start = index;
        }

        if (index >= end) {
            end = index + 1;
        }
    }

    return end === -1 ? null : { end, start };
};

// The turn the previous or next button leads with, one either side of the first in view; -1 when the range is already
// at that end of the thread, which disables the button. With nothing in view yet, next goes to the first turn.
const step = (direction: -1 | 1, range: Range, total: number) => {
    if (range.end <= range.start) {
        return direction === 1 && range.start < total ? range.start : -1;
    }

    if (direction === -1) {
        return range.start > 0 ? Math.min(range.start, total) - 1 : -1;
    }

    return range.end < total ? range.start + 1 : -1;
};


export { lead, span, step };
export type { Range };
