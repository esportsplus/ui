import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { EditorDocument } from './document';
import type { BracketPair, FoldRange } from './folding';
import type { NativeText, Placeholder } from './projection';
import type { Match } from './search';
import type { SyntaxCache, Token } from './syntax';


// The gutter marker: none, open, or folded.
type Fold = 0 | 1 | 2;

// A highlighted range within one native line; 'kind' is its class list, and 'style' custom properties for the span it
// starts, set only from text the mark has checked.
type Mark = { from: number; kind: string; style?: string; to: number };

// What one paint highlights across the visible lines: find matches (source offsets) from 'index' on with the active
// one, diagnostics (source offsets), occurrences of the selection (native offsets), the bracket pair at the caret and
// fold placeholders.
type Paint = {
    active: number;
    diagnostics: readonly Mark[];
    index: number;
    matches: readonly Match[];
    occurrences: readonly { from: number; to: number }[];
    pair: BracketPair | null;
    placeholders: Placeholder[];
};

// One pooled row, shared by the text and the gutter. A slot keeps its elements while it scrolls through lines, and
// each field writes only when it changes.
type Slot = {
    active: boolean;
    // The change the line has against the baseline ('added', 'deleted' or 'modified'), or ''.
    change: string;
    fold: Fold;
    height: number;
    html: string;
    // Native line shown, -1 while unused.
    line: number;
    number: number;
    // A class tinting the whole row, or ''.
    tint: string;
    top: number;
};


// Segments one line may split into before it renders as plain text.
const BUDGET = 3000;

const ESCAPE = /[&<>]/;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

// Longer lines skip highlighting.
const LONG = 10000;

// Marks of one kind drawn per line.
const PER_LINE = 200;


function escape(text: string) {
    return ESCAPE.test(text) ? text.replace(/[&<>]/g, (character) => ESCAPES[character]) : text;
}

function walker(element: HTMLElement) {
    return element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
}


// Marks within the native line [from, to), relative to its start.
const marks = (projection: NativeText, from: number, to: number, paint: Paint) => {
    let { diagnostics, index, matches, occurrences, pair, placeholders } = paint,
        length = to - from,
        out: Mark[] = [],
        sourceFrom = projection.toSource(from),
        sourceTo = projection.toSource(to);

    for (let i = 0, n = placeholders.length; i < n; i++) {
        let at = placeholders[i].at;

        if (at >= from && at < to) {
            out.push({ from: at - from, kind: 'code-editor-placeholder', to: at - from + 1 });
        }
    }

    for (let j = index, count = 0; j < matches.length && matches[j].from <= sourceTo && count < PER_LINE; j++) {
        if (matches[j].to < sourceFrom) {
            continue;
        }

        let end = Math.min(length, projection.toNative(matches[j].to) - from),
            start = Math.max(0, projection.toNative(matches[j].from) - from);

        if (end > start) {
            out.push({ from: start, kind: j === paint.active ? 'code-editor-match --active' : 'code-editor-match', to: end });
            count++;
        }
    }

    for (let i = 0, n = diagnostics.length, count = 0; i < n && count < PER_LINE; i++) {
        let mark = diagnostics[i];

        if (mark.to <= sourceFrom || mark.from >= sourceTo) {
            continue;
        }

        let end = Math.min(length, projection.toNative(mark.to) - from),
            start = Math.max(0, projection.toNative(mark.from) - from);

        if (end > start) {
            out.push({ from: start, kind: mark.kind, to: end });
            count++;
        }
    }

    for (let i = 0, n = occurrences.length, count = 0; i < n && count < PER_LINE; i++) {
        let mark = occurrences[i];

        if (mark.to > from && mark.from < to) {
            out.push({ from: Math.max(0, mark.from - from), kind: 'code-editor-occurrence', to: Math.min(length, mark.to - from) });
            count++;
        }
    }

    if (pair) {
        for (let at of [pair.from, pair.to]) {
            let native = projection.toNative(at);

            if (native >= from && native < to && projection.toSource(native) === at) {
                out.push({ from: native - from, kind: 'code-editor-bracket', to: native - from + 1 });
            }
        }
    }

    return out;
};

// A native line as markup: token colors, marks and visible whitespace, each run one span.
const markup = (text: string, colors: readonly Token[], highlights: readonly Mark[], whitespace: boolean) => {
    if (!text.length) {
        return '';
    }

    if (text.length > LONG || colors.length > BUDGET) {
        return escape(text);
    }

    let points = [0, text.length];

    for (let i = 0, n = colors.length; i < n; i++) {
        points.push(colors[i].from, colors[i].to);
    }

    for (let i = 0, n = highlights.length; i < n; i++) {
        points.push(highlights[i].from, highlights[i].to);
    }

    if (whitespace) {
        for (let i = 0, n = text.length; i < n; i++) {
            let code = text.charCodeAt(i);

            if (code === 32 || code === 9) {
                points.push(i, i + 1);
            }
        }
    }

    if (points.length > BUDGET) {
        return escape(text);
    }

    points.sort((a, b) => a - b);

    let out = '',
        t = 0;

    for (let i = 0, n = points.length - 1; i < n; i++) {
        let from = points[i],
            to = points[i + 1];

        if (to <= from || from >= text.length) {
            continue;
        }

        while (t < colors.length && colors[t].to <= from) {
            t++;
        }

        let classes = t < colors.length && colors[t].from <= from ? `code-editor-token--${colors[t].kind}` : '',
            piece = text.slice(from, Math.min(to, text.length)),
            style = '';

        for (let j = 0, m = highlights.length; j < m; j++) {
            let mark = highlights[j];

            if (mark.from <= from && mark.to > from) {
                classes += (classes ? ' ' : '') + mark.kind;

                if (mark.style && mark.from === from) {
                    style += mark.style;
                }
            }
        }

        if (whitespace && to === from + 1) {
            let code = text.charCodeAt(from);

            if (code === 32 || code === 9) {
                classes += (classes ? ' ' : '') + (code === 9 ? 'code-editor-tab' : 'code-editor-space');
            }
        }

        out += classes ? `<span class="${classes}"${style && ` style="${style.replace(/"/g, '&quot;')}"`}>${escape(piece)}</span>` : escape(piece);
    }

    return out;
};

// A pool of row slots; 'resize' grows or shrinks it, and slot i shows the lines at i modulo its size.
const pool = () => {
    let slots = reactive([] as Slot[]);

    return {
        resize: (size: number) => {
            while (slots.length < size) {
                slots.push(reactive({ active: false, change: '', fold: 0 as Fold, height: 0, html: '', line: -1, number: 0, tint: '', top: 0 }));
            }

            if (slots.length > size) {
                slots.splice(size, slots.length - size);
            }
        },
        slots,
        template: () => html.reactive(slots, (slot) => html`
            <div
                class='code-editor-line'
                ${{
                    class: [() => slot.active && '--active', () => slot.line < 0 && 'code-editor-line--unused', () => slot.tint],
                    innerHTML: () => slot.html,
                    style: () => `height: ${slot.height}px; top: ${slot.top}px;`
                }}
            ></div>
        `)
    };
};


// Offsets in [1, length] where a rendered row wraps onto a new visual row, found in one pass over its text. An offset
// on a node boundary resolves to the end of the earlier node, and one past the text to the end of the last node.
const rowBreaks = (element: HTMLElement, length: number, half: number) => {
    let base = 0,
        breaks: number[] = [],
        last: Text | null = null,
        range = element.ownerDocument.createRange(),
        texts = walker(element),
        y = 0;

    for (let text = texts.nextNode() as Text | null; text && base < length; text = texts.nextNode() as Text | null) {
        let start = last ? 1 : 0;

        last = text;

        for (let offset = start, n = Math.min(text.length, length - base); offset <= n; offset++) {
            range.setStart(text, offset);
            range.setEnd(text, offset);

            let rect = range.getClientRects()[0];

            if (base + offset === 0) {
                y = rect?.top ?? 0;
            }
            else if (rect && rect.top > y + half) {
                breaks.push(base + offset);
                y = rect.top;
            }
        }

        base += text.length;
    }

    if (last && base < length) {
        range.setStart(last, last.length);
        range.setEnd(last, last.length);

        let rect = range.getClientRects()[0];

        if (rect && rect.top > y + half) {
            breaks.push(base + 1);
        }
    }

    return breaks;
};

// Offset within a rendered row under a client point, for text the arithmetic layout can't place.
const rowOffset = (element: HTMLElement, x: number, y: number) => {
    let doc = element.ownerDocument as Document & {
            caretPositionFromPoint?: (x: number, y: number) => { offset: number; offsetNode: Node } | null;
        },
        point = doc.caretPositionFromPoint?.(x, y),
        range = point ? null : doc.caretRangeFromPoint?.(x, y),
        node = point?.offsetNode ?? range?.startContainer,
        offset = point?.offset ?? range?.startOffset ?? 0;

    if (!node || !element.contains(node)) {
        return null;
    }

    let texts = walker(element),
        total = 0;

    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
        if (text === node) {
            return total + offset;
        }

        total += (text as Text).length;
    }

    return null;
};

// Client caret rectangle at an offset within a rendered row.
const rowRect = (element: HTMLElement, offset: number) => {
    let range = element.ownerDocument.createRange(),
        texts = walker(element),
        last: Text | null = null;

    for (let text = texts.nextNode() as Text | null; text; text = texts.nextNode() as Text | null) {
        last = text;

        if (offset <= text.length) {
            range.setStart(text, offset);
            range.setEnd(text, offset);

            return range.getClientRects()[0] ?? null;
        }

        offset -= text.length;
    }

    if (!last) {
        return null;
    }

    range.setStart(last, last.length);
    range.setEnd(last, last.length);

    return range.getClientRects()[0] ?? null;
};

// Tokens of the native line [from, to). Without folds it's the source line itself; a fold joins the source lines on
// either side of its placeholder, with the hidden tokens left out.
const tokens = (
    cache: SyntaxCache,
    document: EditorDocument,
    projection: NativeText,
    folded: readonly FoldRange[],
    index: number,
    from: number,
    to: number
): readonly Token[] => {
    if (!folded.length) {
        return cache.lineTokens(index);
    }

    let f = 0,
        first = document.lineAt(projection.toSource(from)),
        last = document.lineAt(projection.toSource(to)),
        out: Token[] = [];

    // Folds are sorted by start and token starts only grow, so folds ending before a token never hide a later one.
    for (let line = first; line <= last; line++) {
        let start = document.lineStart(line),
            list = cache.lineTokens(line);

        for (let i = 0, n = list.length; i < n; i++) {
            let a = start + list[i].from,
                b = start + list[i].to,
                hidden = false;

            while (f < folded.length && folded[f].to < a) {
                f++;
            }

            for (let k = f, m = folded.length; k < m && folded[k].from <= a; k++) {
                if (b <= folded[k].to) {
                    hidden = true;
                    break;
                }
            }

            if (hidden) {
                continue;
            }

            let left = Math.max(0, projection.toNative(a) - from),
                right = Math.min(to - from, projection.toNative(b) - from);

            if (right > left) {
                out.push({ from: left, kind: list[i].kind, to: right });
            }
        }
    }

    return out;
};


export { marks, markup, pool, rowBreaks, rowOffset, rowRect, tokens };
export type { Fold, Mark, Paint, Slot };
