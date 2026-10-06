import type { Decoration } from './decorations';


// What next and previous step between: files git reports changed, or files with errors or warnings.
type Jump = 'change' | 'problem';


const SEPARATOR = /[\\/]/;


// The ids that would hold 'id' were ids paths, nearest first: 'src/lib/index.ts' gives 'src/lib', then 'src'. A
// decorated file inside a lazy folder isn't known until the folder loads, and this is how a jump finds which to load.
function enclosing(id: string) {
    let out: string[] = [],
        parts = id.split(SEPARATOR);

    for (let end = id.length, i = parts.length - 1; i > 0; i--) {
        end -= parts[i].length + 1;

        if (end > 0) {
            out.push(id.slice(0, end));
        }
    }

    return out;
}

// A change counts whether staged or not; an ignored file is no change.
function flagged(decoration: Decoration | undefined, kind: Jump) {
    if (!decoration) {
        return false;
    }

    if (kind === 'problem') {
        return !!(decoration.errors || decoration.warnings);
    }

    let status = decoration.status ?? decoration.staged;

    return !!status && status !== 'ignored';
}

// Tree order of two places, compared folder by folder from the top, so a folder comes before everything in it.
function order(x: readonly number[], y: readonly number[]) {
    for (let i = 0, n = Math.min(x.length, y.length); i < n; i++) {
        if (x[i] !== y[i]) {
            return x[i] - y[i];
        }
    }

    return x.length - y.length;
}

// Which of 'places', in tree order, is the first past 'here' going 'step' ways, wrapping round; with no 'here' the
// first or last. -1 when there are none.
function seek(places: readonly (readonly number[])[], here: readonly number[] | null, step: 1 | -1) {
    let n = places.length;

    if (!n) {
        return -1;
    }

    if (here) {
        for (let i = 0; i < n; i++) {
            let at = step === 1 ? i : n - 1 - i;

            if (order(places[at], here) * step > 0) {
                return at;
            }
        }
    }

    return step === 1 ? 0 : n - 1;
}


export { enclosing, flagged, order, seek };
export type { Jump };
