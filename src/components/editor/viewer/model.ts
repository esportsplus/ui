import { EditorDocument } from '../code/document';
import { structureOf } from '../code/folding';
import { SyntaxCache, type Language, type Token } from '../code/syntax';


// One source line: its markup, text and tokens, and the end (exclusive) of the lines its fold hides, or -1 when it
// starts none.
type Line = { end: number; html: string; text: string; tokens: readonly Token[] };

type Options = { fold?: boolean; whitespace?: boolean };


// Runs one line may split into before it renders as plain text.
const BUDGET = 3000;

const ESCAPE = /[&<>"]/;

const ESCAPES: Record<string, string> = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };

// Longer lines skip highlighting.
const LONG = 10000;

const NO_TOKENS: readonly Token[] = [];


function escape(text: string) {
    return ESCAPE.test(text) ? text.replace(/[&<>"]/g, (character) => ESCAPES[character]) : text;
}

function markup(text: string, tokens: readonly Token[], whitespace: boolean) {
    if (text.length > LONG || tokens.length > BUDGET) {
        return escape(text);
    }

    let at = 0,
        out = '';

    for (let i = 0, n = tokens.length; i < n; i++) {
        let { from, kind, to } = tokens[i];

        if (to <= at) {
            continue;
        }

        from = Math.max(from, at);

        if (from > at) {
            out += piece(text.slice(at, from), whitespace);
        }

        out += `<span class="code-viewer-token--${kind}">${piece(text.slice(from, to), whitespace)}</span>`;
        at = to;
    }

    return at < text.length ? out + piece(text.slice(at), whitespace) : out;
}

// Text as markup; visible whitespace marks each space and tab, keeping the character itself for selection and copy.
function piece(text: string, whitespace: boolean) {
    if (!whitespace) {
        return escape(text);
    }

    let out = '',
        start = 0;

    for (let i = 0, n = text.length; i < n; i++) {
        let code = text.charCodeAt(i);

        if (code !== 32 && code !== 9) {
            continue;
        }

        out += escape(text.slice(start, i)) + (code === 9 ? '<span class="code-viewer-tab">\t</span>' : '<span class="code-viewer-space"> </span>');
        start = i + 1;
    }

    return out + escape(text.slice(start));
}


// Lines with their markup and folds. A line's fold is its largest; bracket folds leave the closing line shown, and a
// section running to the end of the document hides through the last line.
const outline = (source: string, language: Language, { fold = true, whitespace = false }: Options = {}): Line[] => {
    let cache = new SyntaxCache(new EditorDocument(source), language),
        document = cache.document,
        lines: Line[] = [];

    for (let i = 0, n = document.lineCount; i < n; i++) {
        let text = document.lineText(i),
            tokens = language === 'plain' ? NO_TOKENS : cache.lineTokens(i);

        lines.push({ end: -1, html: markup(text, tokens, whitespace), text, tokens });
    }

    if (!fold) {
        return lines;
    }

    let folds = structureOf(cache).folds;

    for (let i = 0, n = folds.length; i < n; i++) {
        let range = folds[i],
            end = range.close === undefined && range.to === document.value.length ? range.endLine : range.endLine - 1,
            line = lines[range.line - 1];

        if (line.end === -1 && end > range.line) {
            line.end = end;
        }
    }

    return lines;
};

// Which lines the folded ones hide; a fold inside a folded one stays folded underneath.
const hidden = (lines: readonly Line[], folded: ReadonlySet<number>) => {
    let out = new Array<boolean>(lines.length).fill(false);

    for (let i = 0, n = lines.length; i < n; i++) {
        if (!out[i] && folded.has(i) && lines[i].end > i) {
            out.fill(true, i + 1, lines[i].end);
        }
    }

    return out;
};


export { hidden, outline };
export type { Line, Options };
