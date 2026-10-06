import { stepCharacter } from './selection';
import type { EditorDocument, Selection } from './document';
import type { EditorLayout } from './layout';
import type { NativeText } from './projection';


type Move = {
    // Jumps to the document's start or end instead (Mod+Home, and on Apple keyboards Mod+ArrowUp).
    boundary?: boolean;
    extend: boolean;
    // Per-range x the caret keeps while moving vertically; filled in by vertical moves.
    goals: number[];
    key: string;
    // Height a page move covers.
    page: number;
    word?: boolean;
};


const WORD_BACKWARD = /(?:\s+|[\w$]+|[^\w\s$]+)$/;

const WORD_FORWARD = /^(?:\s+|[\w$]+|[^\w\s$]+)/;

// Words are looked for this far around the caret.
const WORD_WINDOW = 1000;


// Where every range goes for a navigation key: characters by grapheme, words by class, Home to the indentation then
// the line start, and vertical moves through the layout at each range's goal column.
const move = (
    document: EditorDocument,
    layout: EditorLayout,
    projection: NativeText,
    lineHeight: number,
    { boundary, extend, goals, key, page, word }: Move
) => {
    let value = document.value;

    return document.selections.map((range, index): Partial<Selection> => {
        let anchor = range.direction === 'backward' ? range.end : range.start,
            head = range.direction === 'backward' ? range.start : range.end,
            next = head,
            rect = layout.rect(projection.toNative(head));

        if (boundary && (key === 'Home' || key === 'ArrowUp')) {
            next = 0;
        }
        else if (boundary && (key === 'End' || key === 'ArrowDown')) {
            next = value.length;
        }
        else if (key === 'ArrowLeft' || key === 'ArrowRight') {
            let backward = key === 'ArrowLeft';

            if (!extend && range.start !== range.end) {
                next = backward ? range.start : range.end;
            }
            else if (word && backward) {
                next = head - (WORD_BACKWARD.exec(value.slice(Math.max(0, head - WORD_WINDOW), head))?.[0].length ?? 0);
            }
            else if (word) {
                next = head + (WORD_FORWARD.exec(value.slice(head, head + WORD_WINDOW))?.[0].length ?? 0);
            }
            else {
                next = stepCharacter(value, head, backward);
            }
        }
        else if (key === 'Home' || key === 'End') {
            let at = layout.offset(key === 'Home' ? 0 : Number.MAX_SAFE_INTEGER, rect.top + lineHeight / 2);

            if (key === 'Home') {
                let indented = at + /^[\t ]*/.exec(projection.value.slice(at, layout.end(layout.lineAt(at))))![0].length;

                at = projection.toNative(head) === indented ? at : indented;
            }

            next = projection.toSource(at);
        }
        else {
            let delta = (key === 'ArrowUp' || key === 'PageUp' ? -1 : 1) * (key.startsWith('Page') ? page : lineHeight),
                x = goals[index] ?? rect.left;

            goals[index] = x;
            next = projection.toSource(layout.offset(x, rect.top + delta + lineHeight / 2));
        }

        if (!extend) {
            return { start: next };
        }

        return { direction: next < anchor ? 'backward' : 'forward', end: Math.max(anchor, next), start: Math.min(anchor, next) };
    });
};


export { move };
