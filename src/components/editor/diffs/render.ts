import { highlightLine, type Language, type LexState, type Token } from '../code/syntax';
import type { Range } from './engine';


// Runs one line may split into before it renders as plain text.
const BUDGET = 3000;

const ESCAPE = /[&<>"]/;

const ESCAPES: Record<string, string> = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };

// Longer lines skip highlighting.
const LONG = 10000;


function escape(text: string) {
    return ESCAPE.test(text) ? text.replace(/[&<>"]/g, (character) => ESCAPES[character]) : text;
}


// Tokens per line of one side. Lexer states are computed in order and kept, so a line far down costs one pass to reach
// once, and lines are tokenized only when shown.
const highlighter = (lines: readonly string[], language: Language) => {
    let states: LexState[] = [''];

    return (index: number): readonly Token[] => {
        if (language === 'plain' || index < 0 || index >= lines.length || lines[index].length > LONG) {
            return [];
        }

        for (let i = states.length - 1; i < index; i++) {
            states.push(lines[i].length > LONG ? '' : highlightLine(lines[i], language, states[i]).state);
        }

        return highlightLine(lines[index], language, states[index]).tokens;
    };
};

// One line as markup: token colors, plus changed-word marks with 'kind' as their class.
const markup = (text: string, tokens: readonly Token[], marks: readonly Range[], kind: string) => {
    if (!text.length) {
        return '';
    }

    if (text.length > LONG || tokens.length + marks.length > BUDGET) {
        return escape(text);
    }

    let points = [0, text.length];

    for (let i = 0, n = tokens.length; i < n; i++) {
        points.push(tokens[i].from, tokens[i].to);
    }

    for (let i = 0, n = marks.length; i < n; i++) {
        points.push(marks[i].from, marks[i].to);
    }

    points.sort((a, b) => a - b);

    let m = 0,
        out = '',
        t = 0;

    for (let i = 0, n = points.length - 1; i < n; i++) {
        let from = points[i],
            to = Math.min(points[i + 1], text.length);

        if (to <= from) {
            continue;
        }

        while (t < tokens.length && tokens[t].to <= from) {
            t++;
        }

        while (m < marks.length && marks[m].to <= from) {
            m++;
        }

        let classes = t < tokens.length && tokens[t].from <= from ? `diffs-token--${tokens[t].kind}` : '',
            piece = escape(text.slice(from, to));

        if (m < marks.length && marks[m].from <= from) {
            classes += (classes ? ' ' : '') + kind;
        }

        out += classes ? `<span class="${classes}">${piece}</span>` : piece;
    }

    return out;
};


export { escape, highlighter, markup };
