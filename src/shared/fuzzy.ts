type Match = {
    // Positions in the text of the matched characters, ascending.
    indices: number[];
    score: number;
};


// After fzf's weights, but for a gap's length: names are short and skimmed by their words, so reaching a boundary
// outweighs the letters skipped on the way, while a gap still costs less than a match earns.
const BOUNDARY = 8;

const CAMEL = 7;

// A run carries at least this much, so 'ind' in 'index' beats three scattered letters.
const CONSECUTIVE = 4;

// Flags in 'steps': how a cell's skipped score was reached, extending the gap before it rather than opening one.
const EXTENDED = 2;

// The first query character leans hardest on landing at a boundary, where names are skimmed from.
const FIRST = 2;

const GAP_EXTEND = -0.25;

const GAP_START = -3;

// Flags in 'steps': how a cell's matched score was reached, following on from the previous character's match.
const JOINED = 1;

// Tie-breakers kept under a gap's start for ordinary names: earlier first match, then fewer spare characters.
const LEADING = 0.02;

const LENGTH = 0.01;

const MATCH = 16;


// Scratch reused across calls, grown on demand, so matching thousands of names per keystroke allocates only results.
// 'folds' caches lowercase forms of non-ASCII code units, 0 meaning not looked up yet.
let bonuses = new Int32Array(64),
    folds = new Uint16Array(65536),
    lowers = new Uint16Array(64),
    matched = new Float64Array(256),
    runs = new Int32Array(256),
    skipped = new Float64Array(256),
    starts = new Int32Array(16),
    steps = new Uint8Array(256),
    texts = new Uint16Array(64);


function fold(code: number) {
    if (code < 128) {
        return code >= 65 && code <= 90 ? code + 32 : code;
    }

    let known = folds[code];

    if (known === 0) {
        let lower = String.fromCharCode(code).toLowerCase();

        // Some characters lowercase to several, like 'İ'; they stay as they are so positions keep lining up.
        known = folds[code] = lower.length === 1 ? lower.charCodeAt(0) : code;
    }

    return known;
}

// 0 separator or other, 1 lowercase, 2 uppercase, 3 digit.
function kind(code: number) {
    if (code >= 97 && code <= 122) {
        return 1;
    }

    if (code >= 65 && code <= 90) {
        return 2;
    }

    if (code >= 48 && code <= 57) {
        return 3;
    }

    if (code < 128) {
        return 0;
    }

    return fold(code) === code ? 1 : 2;
}


// Subsequence match of 'query' in 'text', best alignment first. A lowercase query character matches either case; an
// uppercase one only itself.
export default (query: string, text: string): Match | null => {
    let m = query.length,
        n = text.length;

    if (m === 0) {
        return { indices: [], score: 0 };
    }

    if (m > n) {
        return null;
    }

    if (m > starts.length) {
        starts = new Int32Array(m * 2);
    }

    if (n > texts.length) {
        bonuses = new Int32Array(n * 2);
        lowers = new Uint16Array(n * 2);
        texts = new Uint16Array(n * 2);
    }

    // The earliest place each query character can match, which also rejects most names before any scoring.
    for (let i = 0, j = 0; i < m; i++, j++) {
        let q = query.charCodeAt(i),
            lower = fold(q),
            exact = lower !== q;

        while (j < n) {
            let t = text.charCodeAt(j);

            if (exact ? t === q : fold(t) === lower) {
                break;
            }

            j++;
        }

        if (j === n) {
            return null;
        }

        starts[i] = j;
    }

    for (let j = 0, previous = 0; j < n; j++) {
        let code = text.charCodeAt(j),
            current = kind(code);

        // The name's start counts as a word's start and no more, so '.env' still ranks above 'environment.ts'.
        bonuses[j] = j === 0 || (previous === 0 && current !== 0)
            ? BOUNDARY
            : (previous === 1 && current === 2) || (previous !== 3 && current === 3)
                ? CAMEL
                : 0;
        lowers[j] = fold(code);
        previous = current;
        texts[j] = code;
    }

    if (m * n > matched.length) {
        matched = new Float64Array(m * n * 2);
        runs = new Int32Array(m * n * 2);
        skipped = new Float64Array(m * n * 2);
        steps = new Uint8Array(m * n * 2);
    }

    // At row i, column j: matched, the best with query[i] on text[j]; skipped, the best with query[i] earlier and
    // text[j] skipped after it; runs, how many query characters in a row end on text[j]. Kept apart, a gap's start and
    // its extension each cost what they should. A row spans starts[i] to the last column leaving room for the rest of
    // the query, so every cell a row reads from the one above was written by this call.
    for (let i = 0; i < m; i++) {
        let q = query.charCodeAt(i),
            lower = fold(q),
            exact = lower !== q,
            end = n - m + i,
            row = i * n,
            up = row - n;

        for (let j = starts[i]; j <= end; j++) {
            let cell = row + j,
                run = 0,
                score = -Infinity,
                step = 0;

            if (j === starts[i]) {
                skipped[cell] = -Infinity;
            }
            else {
                let extend = skipped[cell - 1] + GAP_EXTEND,
                    open = matched[cell - 1] + GAP_START;

                if (extend > open) {
                    skipped[cell] = extend;
                    step = EXTENDED;
                }
                else {
                    skipped[cell] = open;
                }
            }

            if (exact ? texts[j] === q : lowers[j] === lower) {
                let bonus = bonuses[j];

                if (i === 0) {
                    run = 1;
                    score = MATCH + bonus * FIRST;
                }
                else {
                    let before = runs[up + j - 1],
                        joined = -Infinity,
                        length = before + 1;

                    if (before > 0) {
                        let head = bonuses[j - before],
                            carried = bonus;

                        // A run takes the bonus it started on, unless a fresh boundary inside it is worth more.
                        if (bonus >= BOUNDARY && bonus > head) {
                            length = 1;
                        }
                        else {
                            carried = Math.max(bonus, head, CONSECUTIVE);
                        }

                        joined = matched[up + j - 1] + MATCH + carried;
                    }

                    score = skipped[up + j - 1] + MATCH + bonus;
                    run = 1;

                    if (joined >= score) {
                        run = length;
                        score = joined;
                        step |= JOINED;
                    }
                }
            }

            matched[cell] = score;
            runs[cell] = run;
            steps[cell] = step;
        }
    }

    let best = -Infinity,
        last = n - 1,
        row = (m - 1) * n;

    for (let j = starts[m - 1]; j < n; j++) {
        if (matched[row + j] > best) {
            best = matched[row + j];
            last = j;
        }
    }

    let indices = new Array<number>(m);

    for (let i = m - 1, j = last, skipping = false; i >= 0; j--) {
        let step = steps[i * n + j];

        if (skipping) {
            skipping = (step & EXTENDED) !== 0;
            continue;
        }

        indices[i--] = j;
        skipping = (step & JOINED) === 0;
    }

    return { indices, score: best - indices[0] * LEADING - (n - m) * LENGTH };
};
