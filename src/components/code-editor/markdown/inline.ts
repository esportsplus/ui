export type Inline = {
    kind: 'text' | 'strong' | 'em' | 'strike' | 'code' | 'link';
    from: number;
    to: number;
    text: string;
    href?: string;
    children?: Inline[];
    reference?: boolean;
};
export type References = ReadonlyMap<string, string>;
const punctuation = /[\p{P}\p{S}]/u,
    whitespace = /\s/u;
function escaped(text: string, at: number) {
    let n = 0;
    while (text[--at] === '\\') n++;
    return n % 2 === 1;
}
function run(text: string, at: number) {
    let end = at + 1;
    while (text[end] === text[at]) end++;
    return end - at;
}
function flanking(text: string, at: number, length: number) {
    let before = text[at - 1] ?? ' ',
        after = text[at + length] ?? ' ',
        beforeSpace = whitespace.test(before),
        afterSpace = whitespace.test(after),
        beforePunctuation = punctuation.test(before),
        afterPunctuation = punctuation.test(after),
        left = !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation),
        right = !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation);
    return text[at] === '_'
        ? { open: left && (!right || beforePunctuation), close: right && (!left || afterPunctuation) }
        : { open: left, close: right };
}
function codeEnd(text: string, at: number, length: number) {
    for (let i = at + length; i < text.length; i++)
        if (text[i] === '`') {
            let count = run(text, i);
            if (count === length) return i;
            i += count - 1;
        }
    return -1;
}
function delimiterEnd(text: string, at: number, length: number, width: number) {
    let nested: number[] = [],
        character = text[at];
    for (let i = at + width; i < text.length; i++) {
        if (escaped(text, i)) continue;
        if (text[i] === '`') {
            let end = codeEnd(text, i, run(text, i));
            if (end >= 0) {
                i = end + run(text, end) - 1;
                continue;
            }
        }
        if (text[i] !== character) continue;
        let count = run(text, i),
            flank = flanking(text, i, count),
            remaining = count,
            consumed = 0;
        if (flank.close) {
            while (nested.length && remaining >= nested[nested.length - 1]!) {
                let n = nested.pop()!;
                remaining -= n;
                consumed += n;
            }
            let oddRule =
                character !== '~' &&
                (flank.open || flanking(text, at, length).close) &&
                (length + count) % 3 === 0 &&
                (length % 3 !== 0 || count % 3 !== 0);
            if (!nested.length && remaining >= width && !oddRule) return i + consumed;
        }
        if (flank.open && (!flank.close || nested.length || remaining < width))
            nested.push(character === '~' ? 2 : count);
        i += count - 1;
    }
    return -1;
}
function balanced(text: string, at: number, opening: string, closing: string) {
    let depth = 1,
        quote = '',
        angle = false;
    for (let i = at + 1; i < text.length; i++) {
        if (escaped(text, i)) continue;
        if (opening === '(') {
            if (quote) {
                if (text[i] === quote) quote = '';
                continue;
            }
            if (angle) {
                if (text[i] === '>') angle = false;
                continue;
            }
            if ((text[i] === '"' || text[i] === "'") && whitespace.test(text[i - 1] ?? ' ')) {
                quote = text[i]!;
                continue;
            }
            if (text[i] === '<') {
                angle = true;
                continue;
            }
        } else if (text[i] === '`') {
            let end = codeEnd(text, i, run(text, i));
            if (end >= 0) {
                i = end + run(text, end) - 1;
                continue;
            }
        }
        if (text[i] === opening) depth++;
        else if (text[i] === closing && --depth === 0) return i;
    }
    return -1;
}
export function referenceLabel(text: string) {
    return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
export function safeUrl(value: string, image = false): string | undefined {
    value = value.trim();
    if (/[\u0000-\u0020\u007f\\]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return;
    if (/^(?:https?:|mailto:|tel:)/i.test(value)) return image && /^(?:mailto:|tel:)/i.test(value) ? undefined : value;
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return;
    return value;
}
function destination(text: string) {
    let angle = /^<([^<>]*)>/.exec(text),
        url = angle ? angle[1]! : text.replace(/\s+["'][\s\S]*$/, '');
    return safeUrl(url.replace(/\\([()\\])/g, '$1'));
}
/** Delimiter runs use left/right flanking and skip escaped closers and code spans. */
export function parseInline(source: string, origin = 0, depth = 0, references: References = new Map()): Inline[] {
    if (depth > 30) return [{ kind: 'text', text: source, from: origin, to: origin + source.length }];
    let result: Inline[] = [],
        start = 0,
        i = 0;
    const plain = (end: number) => {
        if (end > start)
            result.push({ kind: 'text', text: source.slice(start, end), from: origin + start, to: origin + end });
    };
    while (i < source.length) {
        if (source[i] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(source[i + 1] ?? '')) {
            plain(i);
            result.push({ kind: 'text', text: source[i + 1]!, from: origin + i + 1, to: origin + i + 2 });
            i += 2;
            start = i;
            continue;
        }
        if (source[i] === '`') {
            let count = run(source, i),
                end = codeEnd(source, i, count);
            if (end >= 0) {
                plain(i);
                let text = source.slice(i + count, end).replace(/\r\n|\r|\n/g, ' ');
                if (text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)) text = text.slice(1, -1);
                result.push({ kind: 'code', text, from: origin + i + count, to: origin + end });
                i = end + count;
                start = i;
                continue;
            }
            i += count;
            continue;
        }
        // Images retain source presentation, as in the reference's decorations.
        if (source[i] === '[' && source[i - 1] !== '!') {
            let labelEnd = balanced(source, i, '[', ']'),
                end = -1,
                href: string | undefined,
                reference = false;
            if (labelEnd >= 0 && source[labelEnd + 1] === '(') {
                end = balanced(source, labelEnd + 1, '(', ')');
                if (end >= 0) href = destination(source.slice(labelEnd + 2, end).trim());
            } else if (labelEnd >= 0) {
                let next = source[labelEnd + 1] === '[' ? balanced(source, labelEnd + 1, '[', ']') : -1,
                    name =
                        next >= 0
                            ? source.slice(labelEnd + 2, next) || source.slice(i + 1, labelEnd)
                            : source.slice(i + 1, labelEnd),
                    resolved = references.get(referenceLabel(name));
                if (resolved !== undefined) {
                    end = next >= 0 ? next : labelEnd;
                    href = safeUrl(resolved);
                    reference = true;
                }
            }
            if (end >= 0) {
                plain(i);
                let from = reference ? i : i + 1,
                    to = reference ? end + 1 : labelEnd,
                    text = source.slice(from, to);
                result.push({
                    kind: 'link',
                    text,
                    from: origin + from,
                    to: origin + to,
                    href,
                    reference,
                    children: reference ? undefined : parseInline(text, origin + from, depth + 1, references)
                });
                i = end + 1;
                start = i;
                continue;
            }
        }
        if (source[i] === '*' || source[i] === '_' || source.startsWith('~~', i)) {
            let count = run(source, i),
                character = source[i]!,
                width = character === '~' ? 2 : count % 2 === 1 ? 1 : 2,
                flank = flanking(source, i, count),
                end = flank.open ? delimiterEnd(source, i, count, width) : -1;
            if (end > i + width) {
                plain(i);
                let text = source.slice(i + width, end);
                result.push({
                    kind: character === '~' ? 'strike' : width === 2 ? 'strong' : 'em',
                    text,
                    from: origin + i + width,
                    to: origin + end,
                    children: parseInline(text, origin + i + width, depth + 1, references)
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
}

/** Clip already parsed logical markup to a viewport slice without reparsing unmatched fragments. */
export function clipInline(tokens: readonly Inline[], from: number, to: number): Inline[] {
    return tokens
        .filter((token) => token.from < to && token.to > from)
        .map((token) => {
            let start = Math.max(from, token.from),
                end = Math.min(to, token.to);
            return {
                ...token,
                from: start,
                to: end,
                text: token.text.slice(start - token.from, end - token.from),
                children: token.children ? clipInline(token.children, start, end) : undefined
            };
        });
}
