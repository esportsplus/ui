/** Browser-standard grapheme boundaries for custom multi-caret navigation/deletion. Source offsets stay UTF-16. */
let segmenter =
    typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function stepCharacter(value: string, offset: number, backwards = false) {
    offset = Math.max(0, Math.min(value.length, offset));
    if ((backwards && offset === 0) || (!backwards && offset === value.length)) return offset;
    let from =
        Math.max(value.lastIndexOf('\n', Math.max(0, offset - 1)), value.lastIndexOf('\r', Math.max(0, offset - 1))) +
        1;
    if (backwards && from === offset) return Math.max(0, offset - (value.slice(offset - 2, offset) === '\r\n' ? 2 : 1));
    let nextLF = value.indexOf('\n', offset),
        nextCR = value.indexOf('\r', offset),
        to = Math.min(nextLF < 0 ? value.length : nextLF, nextCR < 0 ? value.length : nextCR);
    if (!backwards && to === offset)
        return Math.min(value.length, offset + (value.slice(offset, offset + 2) === '\r\n' ? 2 : 1));
    let text = value.slice(from, to),
        previous = from;
    if (segmenter) {
        for (let part of segmenter.segment(text)) {
            let start = from + part.index,
                end = start + part.segment.length;
            if (backwards && end >= offset) return start;
            if (!backwards && end > offset) return end;
            previous = end;
        }
    } else
        for (let character of text) {
            let end = previous + character.length;
            if (backwards && end >= offset) return previous;
            if (!backwards && end > offset) return end;
            previous = end;
        }
    return backwards ? previous : to;
}
