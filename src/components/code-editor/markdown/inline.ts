type Inline = {
    children?: Inline[];
    from: number;
    href?: string;
    kind: 'code' | 'em' | 'link' | 'strike' | 'strong' | 'text';
    reference?: boolean;
    text: string;
    to: number;
};

type References = ReadonlyMap<string, string>;


const ABSOLUTE = /^[a-z][a-z\d+.-]*:/i;

const ANGLE = /^<([^<>]*)>/;

const CONTROL = /[\u0000- \u007f\\]/;

const CONTROL_ESCAPE = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

const DESTINATION_ESCAPES = /\\([()\\])/g;

const DESTINATION_TITLE = /\s+["'][\s\S]*$/;

const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const LINE_BREAKS = /\r\n|\r|\n/g;

// Nesting deeper than this renders as text.
const MAX_DEPTH = 30;

const NOT_SPACE = /[^ ]/;

const NO_IMAGE = /^(?:mailto:|tel:)/i;

const PUNCTUATION = /[\p{P}\p{S}]/u;

const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;

const SPACES = /\s+/g;

const WHITESPACE = /\s/u;


function balanced(text: string, at: number, opening: string, closing: string) {
    let angle = false,
        depth = 1,
        quote = '';

    for (let i = at + 1, n = text.length; i < n; i++) {
        if (escaped(text, i)) {
            continue;
        }

        if (opening === '(') {
            if (quote) {
                if (text[i] === quote) {
                    quote = '';
                }

                continue;
            }

            if (angle) {
                if (text[i] === '>') {
                    angle = false;
                }

                continue;
            }

            if ((text[i] === '"' || text[i] === "'") && WHITESPACE.test(text[i - 1] ?? ' ')) {
                quote = text[i];
                continue;
            }

            if (text[i] === '<') {
                angle = true;
                continue;
            }
        }
        else if (text[i] === '`') {
            let end = codeEnd(text, i, run(text, i));

            if (end >= 0) {
                i = end + run(text, end) - 1;
                continue;
            }
        }

        if (text[i] === opening) {
            depth++;
        }
        else if (text[i] === closing && --depth === 0) {
            return i;
        }
    }

    return -1;
}

function codeEnd(text: string, at: number, length: number) {
    for (let i = at + length, n = text.length; i < n; i++) {
        if (text[i] !== '`') {
            continue;
        }

        let count = run(text, i);

        if (count === length) {
            return i;
        }

        i += count - 1;
    }

    return -1;
}

function delimiterEnd(text: string, at: number, length: number, width: number) {
    let character = text[at],
        nested: number[] = [];

    for (let i = at + width, n = text.length; i < n; i++) {
        if (escaped(text, i)) {
            continue;
        }

        if (text[i] === '`') {
            let end = codeEnd(text, i, run(text, i));

            if (end >= 0) {
                i = end + run(text, end) - 1;
                continue;
            }
        }

        if (text[i] !== character) {
            continue;
        }

        let consumed = 0,
            count = run(text, i),
            flank = flanking(text, i, count),
            remaining = count;

        if (flank.close) {
            while (nested.length && remaining >= nested[nested.length - 1]) {
                let size = nested.pop()!;

                consumed += size;
                remaining -= size;
            }

            // CommonMark's rule of three: a run that both opens and closes can't pair with one whose total is a
            // multiple of three unless both are.
            let odd = character !== '~' &&
                (flank.open || flanking(text, at, length).close) &&
                (length + count) % 3 === 0 &&
                (length % 3 !== 0 || count % 3 !== 0);

            if (!nested.length && remaining >= width && !odd) {
                return i + consumed;
            }
        }

        if (flank.open && (!flank.close || nested.length || remaining < width)) {
            nested.push(character === '~' ? 2 : count);
        }

        i += count - 1;
    }

    return -1;
}

function destination(text: string) {
    let angle = ANGLE.exec(text),
        url = angle ? angle[1] : text.replace(DESTINATION_TITLE, '');

    return safeUrl(url.replace(DESTINATION_ESCAPES, '$1'));
}

function escaped(text: string, at: number) {
    let count = 0;

    while (text[--at] === '\\') {
        count++;
    }

    return count % 2 === 1;
}

function flanking(text: string, at: number, length: number) {
    let after = text[at + length] ?? ' ',
        before = text[at - 1] ?? ' ',
        afterPunctuation = PUNCTUATION.test(after),
        afterSpace = WHITESPACE.test(after),
        beforePunctuation = PUNCTUATION.test(before),
        beforeSpace = WHITESPACE.test(before),
        left = !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation),
        right = !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation);

    if (text[at] === '_') {
        return { close: right && (!left || afterPunctuation), open: left && (!right || beforePunctuation) };
    }

    return { close: right, open: left };
}

function run(text: string, at: number) {
    let end = at + 1;

    while (text[end] === text[at]) {
        end++;
    }

    return end - at;
}


// Parsed markup cut to [from, to), for a slice of a large block, without reparsing the fragments.
const clipInline = (tokens: readonly Inline[], from: number, to: number): Inline[] => {
    let out: Inline[] = [];

    for (let i = 0, n = tokens.length; i < n; i++) {
        let token = tokens[i];

        if (token.from >= to || token.to <= from) {
            continue;
        }

        let end = Math.min(to, token.to),
            start = Math.max(from, token.from);

        out.push({
            ...token,
            children: token.children ? clipInline(token.children, start, end) : undefined,
            from: start,
            text: token.text.slice(start - token.from, end - token.from),
            to: end
        });
    }

    return out;
};

// Delimiter runs follow left and right flanking and skip escaped closers and code spans. Offsets start at 'origin'.
const parseInline = (source: string, origin = 0, depth = 0, references: References = new Map()): Inline[] => {
    if (depth > MAX_DEPTH) {
        return [{ from: origin, kind: 'text', text: source, to: origin + source.length }];
    }

    let i = 0,
        result: Inline[] = [],
        start = 0;

    let plain = (end: number) => {
        if (end > start) {
            result.push({ from: origin + start, kind: 'text', text: source.slice(start, end), to: origin + end });
        }
    };

    while (i < source.length) {
        if (source[i] === '\\' && ESCAPABLE.test(source[i + 1] ?? '')) {
            plain(i);
            result.push({ from: origin + i + 1, kind: 'text', text: source[i + 1], to: origin + i + 2 });
            i += 2;
            start = i;
            continue;
        }

        if (source[i] === '`') {
            let count = run(source, i),
                end = codeEnd(source, i, count);

            if (end < 0) {
                i += count;
                continue;
            }

            let text = source.slice(i + count, end).replace(LINE_BREAKS, ' ');

            if (text.startsWith(' ') && text.endsWith(' ') && NOT_SPACE.test(text)) {
                text = text.slice(1, -1);
            }

            plain(i);
            result.push({ from: origin + i + count, kind: 'code', text, to: origin + end });
            i = end + count;
            start = i;
            continue;
        }

        // Images keep their source text.
        if (source[i] === '[' && source[i - 1] !== '!') {
            let close = balanced(source, i, '[', ']'),
                end = -1,
                href: string | undefined,
                reference = false;

            if (close >= 0 && source[close + 1] === '(') {
                end = balanced(source, close + 1, '(', ')');

                if (end >= 0) {
                    href = destination(source.slice(close + 2, end).trim());
                }
            }
            else if (close >= 0) {
                let label = source[close + 1] === '[' ? balanced(source, close + 1, '[', ']') : -1,
                    name = label >= 0 ? source.slice(close + 2, label) || source.slice(i + 1, close) : source.slice(i + 1, close),
                    resolved = references.get(referenceLabel(name));

                if (resolved !== undefined) {
                    end = label >= 0 ? label : close;
                    href = safeUrl(resolved);
                    reference = true;
                }
            }

            if (end >= 0) {
                let from = reference ? i : i + 1,
                    to = reference ? end + 1 : close,
                    text = source.slice(from, to);

                plain(i);
                result.push({
                    children: reference ? undefined : parseInline(text, origin + from, depth + 1, references),
                    from: origin + from,
                    href,
                    kind: 'link',
                    reference,
                    text,
                    to: origin + to
                });
                i = end + 1;
                start = i;
                continue;
            }
        }

        if (source[i] === '*' || source[i] === '_' || source.startsWith('~~', i)) {
            let character = source[i],
                count = run(source, i),
                width = character === '~' ? 2 : count % 2 === 1 ? 1 : 2,
                end = flanking(source, i, count).open ? delimiterEnd(source, i, count, width) : -1;

            if (end > i + width) {
                let text = source.slice(i + width, end);

                plain(i);
                result.push({
                    children: parseInline(text, origin + i + width, depth + 1, references),
                    from: origin + i + width,
                    kind: character === '~' ? 'strike' : width === 2 ? 'strong' : 'em',
                    text,
                    to: origin + end
                });
                i = end + width;
                start = i;
                continue;
            }
        }

        i++;
    }

    plain(source.length);

    return result;
};

const referenceLabel = (text: string) => {
    return text.trim().replace(SPACES, ' ').toLocaleLowerCase();
};

// Only web, mail and phone links and relative paths survive; anything that could run script or embed data doesn't.
const safeUrl = (value: string, image = false): string | undefined => {
    value = value.trim();

    if (CONTROL.test(value) || CONTROL_ESCAPE.test(value)) {
        return undefined;
    }

    if (SAFE_SCHEME.test(value)) {
        return image && NO_IMAGE.test(value) ? undefined : value;
    }

    if (ABSOLUTE.test(value) || value.startsWith('//')) {
        return undefined;
    }

    return value;
};


export { clipInline, parseInline, referenceLabel, safeUrl };
export type { Inline, References };
