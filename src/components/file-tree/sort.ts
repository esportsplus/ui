import type { FileTreeElement as Element } from '.';


type Case = 'insensitive' | 'lower' | 'upper';

type Comparator = (a: Element, b: Element) => number;

type Options = {
    // 'insensitive' interleaves cases; 'upper' and 'lower' list names starting in that case first, as a
    // case-sensitive listing does.
    case?: Case;
    order?: Order;
    // Code point order in place of the locale's: no natural numbers, and accented letters sort after 'z'.
    unicode?: boolean;
};

// 'type' groups files by extension and 'modified' lists the newest first; both keep folders first.
type Order = 'files' | 'folders' | 'mixed' | 'modified' | 'type';

type Sort = Comparator | Options | Order | 'none';


function extension(name: string) {
    let dot = name.lastIndexOf('.');

    // A dotfile's leading dot starts its name, not an extension.
    return dot > 0 ? name.slice(dot + 1) : '';
}

function names(options: Options) {
    // Names starting in the other case go after the rest.
    let late = options.case === 'upper' ? /^\p{Ll}/u : options.case === 'lower' ? /^\p{Lu}/u : null,
        compare = options.unicode
            ? (late ? points : (a: string, b: string) => points(a.toLowerCase(), b.toLowerCase()) || points(a, b))
            : new Intl.Collator('en', {
                caseFirst: options.case === 'lower' || options.case === 'upper' ? options.case : 'false',
                numeric: true,
                sensitivity: late ? 'variant' : 'base'
            }).compare;

    if (!late) {
        return compare;
    }

    return (a: string, b: string) => (+late.test(a) - +late.test(b)) || compare(a, b);
}

function points(a: string, b: string) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function time(element: Element) {
    return element.modified === undefined ? -Infinity : +element.modified;
}


// The comparator a 'sort' option stands for; undefined keeps the source order.
export default (sort: Sort, folder: (element: Element) => boolean): Comparator | undefined => {
    if (sort === 'none') {
        return undefined;
    }

    if (typeof sort === 'function') {
        return sort;
    }

    let options = typeof sort === 'string' ? { order: sort } : sort,
        compare = names(options),
        order = options.order ?? 'folders';

    return (a, b) => {
        let x = folder(a),
            y = folder(b);

        if (x !== y && order !== 'mixed') {
            return x === (order !== 'files') ? -1 : 1;
        }

        if (order === 'modified') {
            let p = time(a),
                q = time(b);

            if (p !== q) {
                return q > p ? 1 : -1;
            }
        }
        else if (order === 'type' && !x) {
            let result = compare(extension(a.name), extension(b.name));

            if (result) {
                return result;
            }
        }

        return compare(a.name, b.name);
    };
};

export type { Case, Options, Order, Sort };
