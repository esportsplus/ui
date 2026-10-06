import { clamp } from '~/shared/clamp';


const SEGMENTER =
    typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;


function isBreak(code: number) {
    return code === 10 || code === 13;
}


// Next grapheme boundary from 'offset', so custom multi-caret movement and deletion never split a cluster. Offsets
// stay UTF-16; CRLF is one step.
const stepCharacter = (value: string, offset: number, backwards = false) => {
    let n = value.length;

    offset = clamp(offset, 0, n);

    if ((backwards && offset === 0) || (!backwards && offset === n)) {
        return offset;
    }

    let from = offset,
        to = offset;

    while (from > 0 && !isBreak(value.charCodeAt(from - 1))) {
        from--;
    }

    while (to < n && !isBreak(value.charCodeAt(to))) {
        to++;
    }

    if (backwards && from === offset) {
        let crlf = value.charCodeAt(offset - 1) === 10 && value.charCodeAt(offset - 2) === 13;

        return Math.max(0, offset - (crlf ? 2 : 1));
    }

    if (!backwards && to === offset) {
        return Math.min(n, offset + (value.charCodeAt(offset) === 13 && value.charCodeAt(offset + 1) === 10 ? 2 : 1));
    }

    let previous = from;

    if (SEGMENTER) {
        for (let part of SEGMENTER.segment(value.slice(from, to))) {
            let start = from + part.index,
                end = start + part.segment.length;

            if (backwards && end >= offset) {
                return start;
            }

            if (!backwards && end > offset) {
                return end;
            }

            previous = end;
        }
    }
    else {
        for (let character of value.slice(from, to)) {
            let end = previous + character.length;

            if (backwards && end >= offset) {
                return previous;
            }

            if (!backwards && end > offset) {
                return end;
            }

            previous = end;
        }
    }

    return backwards ? previous : to;
};


export { stepCharacter };
