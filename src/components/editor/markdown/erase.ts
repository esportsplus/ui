import type { Inline } from './inline';


type Span = { from: number; to: number };


const LINE_BREAK = /[\r\n]/;

const WIDTHS: Partial<Record<Inline['kind'], number>> = { em: 1, strike: 2, strong: 2 };


let graphemes: Intl.Segmenter | undefined;


// Length of the grapheme ending at 'offset' (backward) or starting there, without crossing 'limit'.
function grapheme(text: string, offset: number, limit: number, backward: boolean) {
    graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });

    let window = backward ? text.slice(Math.max(limit, offset - 16), offset) : text.slice(offset, Math.min(limit, offset + 16)),
        length = 0;

    for (let { segment } of graphemes.segment(window)) {
        if (!backward) {
            return segment.length;
        }

        length = segment.length;
    }

    return length;
}


// The source a Backspace or Delete at 'offset' removes, from the visible runs of text around it, sorted and absolute.
// Markup between runs is never deleted alone: the visible character past it goes instead, or for a line break, the
// break and the markup with it. Null when no run lies on that side.
const reach = (text: string, spans: readonly Span[], offset: number, backward: boolean): Span | null => {
    let next: Span | null = null,
        previous: Span | null = null;

    for (let i = 0, n = spans.length; i < n; i++) {
        let span = spans[i];

        if (span.from === span.to) {
            continue;
        }

        if (backward ? span.from < offset && offset <= span.to : span.from <= offset && offset < span.to) {
            return backward
                ? { from: offset - grapheme(text, offset, span.from, true), to: offset }
                : { from: offset, to: offset + grapheme(text, offset, span.to, false) };
        }

        if (span.to <= offset) {
            previous = span;
        }
        else if (!next && span.from >= offset) {
            next = span;
        }
    }

    if (backward) {
        if (!previous) {
            return null;
        }

        return LINE_BREAK.test(text.slice(previous.to, offset))
            ? { from: previous.to, to: offset }
            : { from: previous.to - grapheme(text, previous.to, previous.from, true), to: previous.to };
    }

    if (!next) {
        return null;
    }

    return LINE_BREAK.test(text.slice(offset, next.from))
        ? { from: offset, to: next.from }
        : { from: next.from, to: next.from + grapheme(text, next.from, next.to, false) };
};

// Widens a deletion that empties emphasis, strikethrough or code to take its delimiters, outward through nesting,
// so none are left behind as text. Token offsets are relative to 'base'.
const widen = (text: string, tokens: readonly Inline[], base: number, span: Span): Span => {
    let found = true;

    while (found) {
        found = false;

        let visit = (list: readonly Inline[]) => {
            for (let i = 0, n = list.length; i < n && !found; i++) {
                let token = list[i];

                if (base + token.from === span.from && base + token.to === span.to) {
                    let width = WIDTHS[token.kind] ?? 0;

                    if (token.kind === 'code') {
                        while (text[span.from - width - 1] === '`') {
                            width++;
                        }
                    }

                    if (width && span.from - width >= 0) {
                        span = { from: span.from - width, to: span.to + width };
                        found = true;
                    }

                    return;
                }

                if (token.children && base + token.from <= span.from && span.to <= base + token.to) {
                    visit(token.children);
                }
            }
        };

        visit(tokens);
    }

    return span;
};


export { reach, widen };
export type { Span };
