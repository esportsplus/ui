import { diffSequences, type Range } from './engine';


type Token = { from: number; text: string; to: number };

// Changed character ranges inside a replaced pair of lines, per side.
type Words = { modified: Range[]; original: Range[] };


// Longer lines are not aligned word by word; the cost grows with their product.
const MAX = 2000;

const SPACE = /^\s+$/;

const TOKEN = /\w+|\s+|[^\w\s]/g;


function blank(token: Token) {
    return SPACE.test(token.text);
}

// Adjacent ranges, or ranges only whitespace apart, read as one change.
function mark(out: Range[], text: string, token: Token) {
    let last = out[out.length - 1];

    if (last && (last.to === token.from || SPACE.test(text.slice(last.to, token.from)))) {
        last.to = token.to;
        return;
    }

    out.push({ from: token.from, to: token.to });
}

function tokenize(text: string) {
    let out: Token[] = [];

    for (let match of text.matchAll(TOKEN)) {
        out.push({ from: match.index, text: match[0], to: match.index + match[0].length });
    }

    return out;
}


// Words and punctuation that changed between two versions of a line. Null when the lines are too long, or share no
// word at all, since the whole line already reads as changed.
const words = (original: string, modified: string, ignoreWhitespace = false): Words | null => {
    if (original.length > MAX || modified.length > MAX) {
        return null;
    }

    let a = tokenize(original),
        b = tokenize(modified),
        ops = diffSequences(a, b, (x, y) => x.text === y.text || (ignoreWhitespace && blank(x) && blank(y))),
        out: Words = { modified: [], original: [] },
        shared = false;

    for (let i = 0, n = ops.length; i < n; i++) {
        let op = ops[i];

        if (op.type === 'equal') {
            shared ||= !blank(a[op.a]);
            continue;
        }

        let token = op.type === 'delete' ? a[op.a] : b[op.b];

        if (ignoreWhitespace && blank(token)) {
            continue;
        }

        if (op.type === 'delete') {
            mark(out.original, original, token);
        }
        else {
            mark(out.modified, modified, token);
        }
    }

    return shared ? out : null;
};


export { words };
export type { Words };
