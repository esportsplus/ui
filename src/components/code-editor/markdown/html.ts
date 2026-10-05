import { safeUrl } from './inline';


type SafeAttributes = { alt?: string; href?: string; src?: string; title?: string };

type SafeElement = { attributes: SafeAttributes; children: SafeNode[]; tag: Tag };

type SafeNode = SafeElement | string;

// What the sanitizer reads of a parsed node; a DOM node satisfies it.
type Source = {
    childNodes: ArrayLike<Source>;
    getAttribute?: (name: string) => string | null;
    localName?: string;
    nodeType: number;
    textContent: string | null;
};

type Tag =
    | 'a'
    | 'blockquote'
    | 'br'
    | 'code'
    | 'details'
    | 'div'
    | 'em'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'hr'
    | 'img'
    | 'li'
    | 'ol'
    | 'p'
    | 'pre'
    | 's'
    | 'span'
    | 'strong'
    | 'sub'
    | 'summary'
    | 'sup'
    | 'table'
    | 'tbody'
    | 'td'
    | 'th'
    | 'thead'
    | 'tr'
    | 'ul';


// Allowed tags and what they render as; presentational synonyms fold into one tag.
const ALLOWED: Record<string, Tag> = {
    a: 'a',
    b: 'strong',
    blockquote: 'blockquote',
    br: 'br',
    code: 'code',
    del: 's',
    details: 'details',
    div: 'div',
    em: 'em',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    hr: 'hr',
    i: 'em',
    img: 'img',
    li: 'li',
    ol: 'ol',
    p: 'p',
    pre: 'pre',
    s: 's',
    span: 'span',
    strong: 'strong',
    sub: 'sub',
    summary: 'summary',
    sup: 'sup',
    table: 'table',
    tbody: 'tbody',
    td: 'td',
    th: 'th',
    thead: 'thead',
    tr: 'tr',
    ul: 'ul'
};

// Dropped with everything inside them; any other unknown tag is unwrapped to its children.
const DISCARD = new Set([
    'base',
    'button',
    'embed',
    'form',
    'iframe',
    'input',
    'link',
    'math',
    'meta',
    'noscript',
    'object',
    'script',
    'select',
    'style',
    'svg',
    'template',
    'textarea'
]);

const MAX_DEPTH = 40;


function children(source: Source, depth: number, out: SafeNode[]) {
    let nodes = source.childNodes;

    for (let i = 0, n = nodes.length; i < n; i++) {
        project(nodes[i], depth, out);
    }

    return out;
}

function project(source: Source, depth: number, out: SafeNode[]) {
    if (depth > MAX_DEPTH) {
        return;
    }

    if (source.nodeType === 3) {
        out.push(source.textContent ?? '');
        return;
    }

    if (source.nodeType !== 1) {
        return;
    }

    let name = (source.localName ?? '').toLowerCase(),
        tag = ALLOWED[name];

    if (DISCARD.has(name)) {
        return;
    }

    if (!tag) {
        children(source, depth + 1, out);
        return;
    }

    let attributes: SafeAttributes = {},
        title = source.getAttribute?.('title');

    if (title) {
        attributes.title = title;
    }

    if (tag === 'a') {
        let href = safeUrl(source.getAttribute?.('href') ?? '');

        if (href) {
            attributes.href = href;
        }
    }
    else if (tag === 'img') {
        let alt = source.getAttribute?.('alt') ?? '',
            src = safeUrl(source.getAttribute?.('src') ?? '', true);

        if (!src) {
            out.push(alt);
            return;
        }

        attributes.alt = alt;
        attributes.src = src;
    }

    out.push({ attributes, children: tag === 'br' || tag === 'hr' || tag === 'img' ? [] : children(source, depth + 1, []), tag });
}


// Parses inertly, then keeps a strict allowlist of tags and attributes. Source HTML never reaches a live element
// or a raw HTML slot: the result is plain data for compiled templates to render.
const sanitize = (source: Source): SafeNode[] => children(source, 0, []);

const sanitizeHtml = (html: string, parser: DOMParser) => sanitize(parser.parseFromString(html, 'text/html').body);


export { sanitize, sanitizeHtml };
export type { SafeElement, SafeNode, Source, Tag };
