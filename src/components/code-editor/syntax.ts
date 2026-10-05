import type { Delta, EditorDocument } from './document';


type Closed = Readonly<{ at: number; frame: Frame }>;

type CssMode = 'declaration' | 'rule' | 'selector' | 'value';

type Entry = {
    end: LexState;
    marks: Mark[] | null;
    start: LexState;
    tokens: Token[];
};

// An opener still waiting for its closer; persistent, so a stack is shared by every line it reaches unchanged.
type Frame = Readonly<{
    at: number;
    depth: number;
    entry: LineSyntax;
    name: string;
    parent: Frame | null;
}>;

type HighlightedLine = { state: LexState; tokens: Token[] };

type Language =
    | 'css'
    | 'html'
    | 'javascript'
    | 'json'
    | 'jsonc'
    | 'jsx'
    | 'markdown'
    | 'plain'
    | 'python'
    | 'scss'
    | 'tsx'
    | 'typescript';

type LexState = string;

type LineSyntax = Readonly<{
    end: LexState;
    start: LexState;
    tokens: readonly Token[];
}>;

// A structural bracket or tag outside strings, comments and regular expressions; 'at' is its column.
type Mark = Readonly<{
    at: number;
    close: boolean;
    name: string;
    tag: boolean;
}>;

// Bracket and tag stacks across one line: what it starts with, what it ends with, every frame it closes, and the
// shallowest depth it reaches, so a scan for an opener's closer skips lines that never get that deep.
type Nesting = Readonly<{
    brackets: Frame | null;
    closed: readonly Closed[];
    entry: LineSyntax;
    from: Frame | null;
    low: number;
    tagFrom: Frame | null;
    tagLow: number;
    tags: Frame | null;
}>;

type ScriptFrame = {
    closing?: boolean;
    depth: number;
    mode: 'code' | 'comment' | 'jsx' | 'tag' | 'template';
    void?: boolean;
};

type Token = Readonly<{
    from: number;
    kind:
        | 'color'
        | 'comment'
        | 'function'
        | 'keyword'
        | 'number'
        | 'operator'
        | 'property'
        | 'regexp'
        | 'selector'
        | 'string'
        | 'tag'
        | 'type'
        | 'variable';
    to: number;
}>;


const ATTRIBUTE = /[\w:-]+/y;

const CACHES = new WeakMap<EditorDocument, Map<Language, SyntaxCache>>();

const CSS_HEX = /#[\da-f]{3,8}(?![\w-])/iy;

const CSS_IDENT = /(?:--|-?[a-z_])[\w-]*/iy;

const CSS_NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:%|[a-z]+)?/iy;

const DECLARATION = /(?:\$|--)?[\w-]+\s*:/y;

const EMBED_CLOSE: Record<string, RegExp> = {
    script: /<\/script\s*>/i,
    style: /<\/style\s*>/i
};

const ENTITY = /&(?:#\d+|#x[\da-f]+|\w+);/iy;

const EXTENSIONS: Record<string, Language> = {
    cjs: 'javascript',
    css: 'css',
    cts: 'typescript',
    htm: 'html',
    html: 'html',
    js: 'javascript',
    json: 'json',
    jsonc: 'jsonc',
    jsx: 'javascript',
    markdown: 'markdown',
    md: 'markdown',
    mjs: 'javascript',
    mts: 'typescript',
    py: 'python',
    pyi: 'python',
    scss: 'scss',
    svg: 'html',
    ts: 'typescript',
    tsx: 'typescript',
    vue: 'html',
    xml: 'html'
};

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;

const GENERIC_CALL = /<[^>]*>\s*\(/y;

const HTML_DECLARATION = /<[!?][^>]*>?/y;

const HTML_TAG = /<(\/?)([\w:-]+)/y;

const JSX_KEYWORDS = new Set(['await', 'case', 'default', 'return', 'yield']);

const JSX_PRECEDERS = '(=,:?&|{[!;>';

const JSX_START =/<\/?(?:[A-Za-z][\w.:-]*|>)/y;

const JSX_TAG = /<(\/?)(?:[A-Za-z][\w.:-]*|(?=>))/y;

const KEYWORDS = new Set(
    (
        'and as assert async await break case catch class const continue debugger def default del delete do elif else ' +
        'enum except export extends false finally for from function global if implements import in instanceof ' +
        'interface is lambda let new nonlocal not null of or package pass private protected public raise readonly ' +
        'return self static super switch this throw true try type typeof undefined var void while with yield None True ' +
        'False'
    ).split(' ')
);

const LINE_LIMIT = 10000;

const LITERALS = new Set(['False', 'None', 'True', 'false', 'null', 'true', 'undefined']);

const MARKDOWN: [RegExp, Token['kind']][] = [
    [/^\s{0,3}#{1,6}\s.*$/g, 'keyword'],
    [/`+[^`]*`+/g, 'string'],
    [/!?\[[^\]]*\]\([^)]*\)/g, 'property'],
    [/\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_/g, 'type'],
    [/^\s*(?:[-*>]|\d+\.)\s/g, 'operator'],
    [/<!--.*?(?:-->|$)/g, 'comment']
];

const NUMBER = /0[xob][\da-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[-+]?\d+)?/iy;

const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

const OPERATORS = '{}()[];,:=+-*/<>!?&|';

const PROTECTED = new Set<Token['kind']>(['comment', 'regexp', 'string']);

const REGEX_KEYWORDS = new Set(['case', 'return', 'throw']);

const REGEX_PRECEDERS = '=(:,!&|?;{';

const SEPARATOR = /[\\/]/;

const SPACE = /\s/;

const TAG = /<(\/?)([\w:-]+)\b[^>]*>/g;

const TAGGED = new Set<Language>(['html', 'javascript', 'jsx', 'tsx', 'typescript']);

const TYPE_PRECEDERS = new Set(['class', 'extends', 'interface', 'namespace', 'new', 'type']);

const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;


function after(text: string, i: number) {
    while (i < text.length && SPACE.test(text[i])) {
        i++;
    }

    return i;
}

function before(text: string, i: number) {
    i--;

    while (i >= 0 && SPACE.test(text[i])) {
        i--;
    }

    return i;
}

function cssStatement(text: string, i: number, scss: boolean): CssMode {
    let j = after(text, i),
        n = text.length,
        paren = 0,
        terminator = '';

    if (text[j] === '@') {
        return 'rule';
    }

    for (let k = j; k < n; k++) {
        let ch = text[k];

        if (ch === '"' || ch === "'") {
            k = skipString(text, k);
            continue;
        }

        if (text.startsWith('/*', k)) {
            let end = text.indexOf('*/', k + 2);

            k = end < 0 ? n : end + 1;
            continue;
        }

        if (scss && text.startsWith('//', k)) {
            break;
        }

        if (scss && ch === '#' && text[k + 1] === '{') {
            let end = text.indexOf('}', k + 2);

            k = end < 0 ? n : end;
            continue;
        }

        if (ch === '(') {
            paren++;
        }
        else if (ch === ')') {
            paren = Math.max(0, paren - 1);
        }
        else if (!paren && ch === '{') {
            return 'selector';
        }
        else if (!paren && (ch === ';' || ch === '}')) {
            terminator = ch;
            break;
        }
    }

    DECLARATION.lastIndex = j;

    if (DECLARATION.test(text)) {
        let colon = DECLARATION.lastIndex;

        // 'a:hover' alone on a line is a selector awaiting its block; 'color: red' is a declaration.
        if (text[colon] !== ':' && (terminator || colon >= n || SPACE.test(text[colon]))) {
            return 'declaration';
        }

        return 'selector';
    }

    return terminator ? 'value' : 'selector';
}

function highlightBasic(text: string, language: Language, initial: LexState = ''): HighlightedLine {
    let i = 0,
        n = text.length,
        state = initial,
        tokens: Token[] = [];

    if (language === 'plain' || n > LINE_LIMIT) {
        return { state: '', tokens };
    }

    let script = language === 'javascript' || language === 'typescript',
        code = script || language === 'jsonc',
        json = language === 'json' || language === 'jsonc';

    while (i < n) {
        let ch = text[i],
            from = i;

        if (state) {
            let end = state === 'comment' ? '*/' : state === 'html-comment' ? '-->' : state,
                at = text.indexOf(end, i);

            // Escaped template delimiters are skipped; interpolation is intentionally lexical.
            while (state === '`' && at >= 0) {
                let escapes = 0;

                for (let j = at - 1; j >= 0 && text[j] === '\\'; j--) {
                    escapes++;
                }

                if (escapes % 2 === 0) {
                    break;
                }

                at = text.indexOf(end, at + 1);
            }

            i = at < 0 ? n : at + end.length;
            tokens.push({ from, kind: state.includes('comment') ? 'comment' : 'string', to: i });

            if (at >= 0) {
                state = '';
            }

            continue;
        }

        if ((code && text.startsWith('//', i)) || (language === 'python' && ch === '#')) {
            tokens.push({ from: i, kind: 'comment', to: n });
            break;
        }

        if (code && text.startsWith('/*', i)) {
            let at = text.indexOf('*/', i + 2);

            i = at < 0 ? n : at + 2;
            state = at < 0 ? 'comment' : '';
            tokens.push({ from, kind: 'comment', to: i });
            continue;
        }

        if (language === 'python' && (text.startsWith("'''", i) || text.startsWith('"""', i))) {
            let quote = text.slice(i, i + 3),
                at = text.indexOf(quote, i + 3);

            i = at < 0 ? n : at + 3;
            state = at < 0 ? quote : '';
            tokens.push({ from, kind: 'string', to: i });
            continue;
        }

        if (ch === '"' || (language !== 'json' && ch === "'") || (script && ch === '`')) {
            let closed = false,
                quote = text[i++];

            while (i < n) {
                if (text[i] === '\\') {
                    i = Math.min(i + 2, n);
                    continue;
                }

                if (text[i++] === quote) {
                    closed = true;
                    break;
                }
            }

            if (!closed && quote === '`') {
                state = '`';
            }

            tokens.push({ from, kind: json && text[after(text, i)] === ':' ? 'property' : 'string', to: i });
            continue;
        }

        if (script && ch === '/' && regexAllowed(text, i)) {
            let end = regexEnd(text, i);

            if (end > 0) {
                i = end;
                tokens.push({ from, kind: 'regexp', to: i });
                continue;
            }
        }

        let point = text.charCodeAt(i);

        if (isDigit(point)) {
            NUMBER.lastIndex = i;
            NUMBER.test(text);
            i = NUMBER.lastIndex;
            tokens.push({ from, kind: 'number', to: i });
            continue;
        }

        if (isWordStart(point)) {
            i++;

            while (i < n && isWord(text.charCodeAt(i))) {
                i++;
            }

            tokens.push({ from, kind: identifier(text, from, i), to: i });
            continue;
        }

        if (OPERATORS.includes(ch)) {
            tokens.push({ from: i, kind: 'operator', to: i + 1 });
        }

        i++;
    }

    return { state, tokens };
}

function highlightCss(text: string, scss: boolean, initial: LexState): HighlightedLine {
    let attribute = false,
        interpolation = 0,
        i = 0,
        n = text.length,
        state = initial,
        tokens: Token[] = [];

    if (n > LINE_LIMIT) {
        return { state: '', tokens };
    }

    if (state === 'comment') {
        let at = text.indexOf('*/');

        i = at < 0 ? n : at + 2;
        tokens.push({ from: 0, kind: 'comment', to: i });

        if (at < 0) {
            return { state, tokens };
        }

        state = '';
    }

    let mode = cssStatement(text, i, scss);

    while (i < n) {
        let ch = text[i],
            from = i;

        if (SPACE.test(ch)) {
            i++;
            continue;
        }

        if (text.startsWith('/*', i)) {
            let at = text.indexOf('*/', i + 2);

            i = at < 0 ? n : at + 2;
            state = at < 0 ? 'comment' : '';
            tokens.push({ from, kind: 'comment', to: i });
            continue;
        }

        if (scss && text.startsWith('//', i)) {
            tokens.push({ from, kind: 'comment', to: n });
            break;
        }

        if (ch === '"' || ch === "'") {
            i = skipString(text, i) + 1;
            tokens.push({ from, kind: 'string', to: i });
            continue;
        }

        if (scss && text.startsWith('#{', i)) {
            interpolation++;
            i += 2;
            tokens.push({ from, kind: 'operator', to: i });
            continue;
        }

        if (ch === '}' && interpolation) {
            interpolation--;
            i++;
            tokens.push({ from, kind: 'operator', to: i });
            continue;
        }

        if (ch === ';' || ch === '{' || ch === '}') {
            attribute = false;
            i++;
            mode = cssStatement(text, i, scss);
            tokens.push({ from, kind: 'operator', to: i });
            continue;
        }

        if (ch === '$') {
            CSS_IDENT.lastIndex = i + 1;
            i = CSS_IDENT.test(text) ? CSS_IDENT.lastIndex : i + 1;
            tokens.push({ from, kind: 'variable', to: i });
            continue;
        }

        let current = interpolation ? 'value' : mode;

        if (current === 'selector') {
            i = selectorToken(text, i, tokens, attribute);

            if (ch === '[') {
                attribute = true;
            }
            else if (ch === ']') {
                attribute = false;
            }

            continue;
        }

        if (current === 'declaration') {
            if (ch === ':') {
                mode = 'value';
                i++;
                tokens.push({ from, kind: 'operator', to: i });
                continue;
            }

            CSS_IDENT.lastIndex = i;

            if (CSS_IDENT.test(text)) {
                i = CSS_IDENT.lastIndex;
                tokens.push({ from, kind: text.startsWith('--', from) ? 'variable' : 'property', to: i });
                continue;
            }

            i++;
            continue;
        }

        i = valueToken(text, i, tokens);
    }

    return { state, tokens };
}

function highlightHtml(text: string, initial: LexState): HighlightedLine {
    let i = 0,
        n = text.length,
        state = initial,
        tokens: Token[] = [];

    while (i < n) {
        if (state.startsWith('embed:')) {
            let [, mode, ...rest] = state.split(':'),
                match = EMBED_CLOSE[mode].exec(text.slice(i)),
                end = match ? i + match.index : n,
                result = highlightLine(text.slice(i, end), mode === 'style' ? 'css' : 'javascript', rest.join(':'));

            for (let j = 0, m = result.tokens.length; j < m; j++) {
                let token = result.tokens[j];

                tokens.push({ from: token.from + i, kind: token.kind, to: token.to + i });
            }

            if (!match) {
                return { state: 'embed:' + mode + ':' + result.state, tokens };
            }

            i = end;
            state = '';
        }

        if (state === 'html-comment' || text.startsWith('<!--', i)) {
            let end = text.indexOf('-->', i + (state ? 0 : 4)),
                to = end < 0 ? n : end + 3;

            tokens.push({ from: i, kind: 'comment', to });
            i = to;
            state = end < 0 ? 'html-comment' : '';
            continue;
        }

        if (!state && (text.startsWith('<!', i) || text.startsWith('<?', i))) {
            HTML_DECLARATION.lastIndex = i;
            HTML_DECLARATION.test(text);
            tokens.push({ from: i, kind: 'keyword', to: HTML_DECLARATION.lastIndex });
            i = HTML_DECLARATION.lastIndex;
            continue;
        }

        if (state.startsWith('tag:') || text[i] === '<') {
            let saved = state.startsWith('tag:') ? state.split(':') : null,
                match: RegExpExecArray | null = null;

            if (!saved) {
                HTML_TAG.lastIndex = i;
                match = HTML_TAG.exec(text);
            }

            if (!saved && !match) {
                tokens.push({ from: i, kind: 'operator', to: i + 1 });
                i++;
                continue;
            }

            let closing = saved ? saved[2] === '1' : !!match![1],
                complete = false,
                name = saved ? saved[1] : match![2].toLowerCase(),
                quote = saved?.[3] ?? '',
                selfClosing = false;

            if (match) {
                tokens.push({ from: i, kind: 'tag', to: i + match[0].length });
                i += match[0].length;
            }

            while (i < n) {
                let from = i;

                if (quote || text[i] === '"' || text[i] === "'") {
                    if (!quote) {
                        quote = text[i++];
                    }

                    while (i < n && text[i] !== quote) {
                        i++;
                    }

                    if (i < n) {
                        i++;
                        quote = '';
                    }

                    tokens.push({ from, kind: 'string', to: i });
                    continue;
                }

                if (text[i] === '>') {
                    selfClosing = text[i - 1] === '/';
                    tokens.push({ from: i, kind: 'operator', to: i + 1 });
                    i++;
                    complete = true;
                    break;
                }

                ATTRIBUTE.lastIndex = i;

                if (ATTRIBUTE.test(text)) {
                    i = ATTRIBUTE.lastIndex;
                    tokens.push({ from, kind: 'property', to: i });
                }
                else {
                    if (text[i] === '=' || text[i] === '/') {
                        tokens.push({ from: i, kind: 'operator', to: i + 1 });
                    }

                    i++;
                }
            }

            if (!complete) {
                return { state: 'tag:' + name + ':' + (closing ? '1' : '0') + ':' + quote, tokens };
            }

            state = !closing && !selfClosing && (name === 'script' || name === 'style') ? 'embed:' + name + ':' : '';
            continue;
        }

        if (text[i] === '&') {
            ENTITY.lastIndex = i;

            if (ENTITY.test(text)) {
                tokens.push({ from: i, kind: 'number', to: ENTITY.lastIndex });
                i = ENTITY.lastIndex;
                continue;
            }
        }

        i++;
    }

    return { state, tokens };
}

function highlightMarkdown(text: string, initial: LexState): HighlightedLine {
    let fence = FENCE.exec(text);

    if (initial.startsWith('fence:')) {
        let [, delimiter, mode, ...rest] = initial.split(':');

        if (fence && fence[1][0] === delimiter[0] && fence[1].length >= delimiter.length) {
            return { state: '', tokens: [{ from: 0, kind: 'operator', to: text.length }] };
        }

        let result = highlightLine(text, languageFor('file.' + mode), rest.join(':'));

        return { state: 'fence:' + delimiter + ':' + mode + ':' + result.state, tokens: result.tokens };
    }

    if (fence) {
        return {
            state: 'fence:' + fence[1] + ':' + fence[2] + ':',
            tokens: [{ from: 0, kind: 'operator', to: text.length }]
        };
    }

    let tokens: Token[] = [];

    for (let i = 0, n = MARKDOWN.length; i < n; i++) {
        let [pattern, kind] = MARKDOWN[i];

        pattern.lastIndex = 0;

        for (let match; (match = pattern.exec(text));) {
            let from = match.index,
                to = from + match[0].length;

            if (!tokens.some((token) => from < token.to && to > token.from)) {
                tokens.push({ from, kind, to });
            }
        }
    }

    return { state: '', tokens: tokens.sort((a, b) => a.from - b.from) };
}

// A small resumable mode stack: literal text stays protected while expression braces remain structural.
function highlightScript(text: string, language: Language, initial: LexState): HighlightedLine {
    let n = text.length;

    if (n > LINE_LIMIT) {
        return { state: '', tokens: [] };
    }

    let frames: ScriptFrame[] = initial.startsWith('script:')
            ? JSON.parse(initial.slice(7))
            : [{ depth: 0, mode: 'code' }],
        i = 0,
        plain = 0,
        tokens: Token[] = [];

    if (initial === 'comment') {
        frames.push({ depth: 0, mode: 'comment' });
    }

    if (initial === '`') {
        frames.push({ depth: 0, mode: 'template' });
    }

    let push = (from: number, to: number, kind: Token['kind']) => {
        if (to > from) {
            tokens.push({ from, kind, to });
        }
    };

    let flush = (to: number) => {
        if (to > plain) {
            let segment = highlightBasic(text.slice(plain, to), language).tokens;

            for (let j = 0, m = segment.length; j < m; j++) {
                tokens.push({ from: segment[j].from + plain, kind: segment[j].kind, to: segment[j].to + plain });
            }
        }

        plain = to;
    };

    while (i < n) {
        let frame = frames[frames.length - 1];

        if (frame.mode === 'comment') {
            let end = text.indexOf('*/', i),
                to = end < 0 ? n : end + 2;

            push(i, to, 'comment');
            i = plain = to;

            if (end >= 0) {
                frames.pop();
            }

            continue;
        }

        if (frame.mode === 'template') {
            let from = i;

            while (i < n) {
                if (text[i] === '\\') {
                    i = Math.min(n, i + 2);
                    continue;
                }

                if (text[i] === '`') {
                    i++;
                    frames.pop();
                    break;
                }

                if (text.startsWith('${', i)) {
                    push(from, i + 1, 'string');
                    push(i + 1, i + 2, 'operator');
                    i += 2;
                    frames.push({ depth: 1, mode: 'code' });
                    from = i;
                    break;
                }

                i++;
            }

            push(from, i, 'string');
            plain = i;
            continue;
        }

        if (frame.mode === 'jsx' || frame.mode === 'tag') {
            if (text[i] === '{') {
                push(i, i + 1, 'operator');
                i++;
                frames.push({ depth: 1, mode: 'code' });
                plain = i;
                continue;
            }

            if (frame.mode === 'jsx' && text[i] === '<') {
                JSX_TAG.lastIndex = i;

                let match = JSX_TAG.exec(text);

                if (match) {
                    let name = match[0].slice(match[1] ? 2 : 1);

                    push(i, i + match[0].length, 'tag');
                    i += match[0].length;
                    frames.push({ closing: !!match[1], depth: 0, mode: 'tag', void: VOID.test(name) });
                    plain = i;
                    continue;
                }
            }

            if (frame.mode === 'tag') {
                if (text[i] === '"' || text[i] === "'") {
                    let from = i,
                        quote = text[i++];

                    while (i < n && text[i] !== quote) {
                        i++;
                    }

                    if (i < n) {
                        i++;
                    }

                    push(from, i, 'string');
                    plain = i;
                    continue;
                }

                if (text[i] === '>') {
                    let self = text[i - 1] === '/' || frame.void;

                    push(i, i + 1, 'tag');
                    i++;
                    frames.pop();

                    let jsx = frames[frames.length - 1];

                    jsx.depth += frame.closing ? -1 : self ? 0 : 1;

                    if (jsx.depth === 0) {
                        frames.pop();
                    }

                    plain = i;
                    continue;
                }

                let from = i;

                while (i < n && !'{}>"\''.includes(text[i])) {
                    i++;
                }

                push(from, i, 'property');

                // A stray '}' inside a tag would otherwise stop the scan without consuming anything.
                if (i === from) {
                    push(i, i + 1, 'operator');
                    i++;
                }

                plain = i;
                continue;
            }

            let from = i;

            while (i < n && text[i] !== '{' && text[i] !== '<') {
                i++;
            }

            if (i === from) {
                i++;
            }

            push(from, i, 'string');
            plain = i;
            continue;
        }

        if (text.startsWith('//', i)) {
            flush(i);
            push(i, n, 'comment');
            i = plain = n;
            break;
        }

        if (text.startsWith('/*', i)) {
            flush(i);
            frames.push({ depth: 0, mode: 'comment' });

            let end = text.indexOf('*/', i + 2),
                to = end < 0 ? n : end + 2;

            push(i, to, 'comment');
            i = plain = to;

            if (end >= 0) {
                frames.pop();
            }

            continue;
        }

        if (text[i] === '"' || text[i] === "'") {
            let from = i;

            flush(i);

            let quote = text[i++];

            while (i < n) {
                if (text[i] === '\\') {
                    i = Math.min(n, i + 2);
                    continue;
                }

                if (text[i++] === quote) {
                    break;
                }
            }

            push(from, i, 'string');
            plain = i;
            continue;
        }

        if (text[i] === '/' && regexAllowed(text, i)) {
            let end = regexEnd(text, i);

            if (end > 0) {
                flush(i);
                push(i, end, 'regexp');
                i = plain = end;
                continue;
            }
        }

        if (text[i] === '`') {
            flush(i);
            push(i, i + 1, 'string');
            i++;
            plain = i;
            frames.push({ depth: 0, mode: 'template' });
            continue;
        }

        if (text[i] === '<' && jsxAllowed(text, i)) {
            JSX_START.lastIndex = GENERIC_CALL.lastIndex = i;

            if (JSX_START.test(text) && !GENERIC_CALL.test(text)) {
                flush(i);
                frames.push({ depth: 0, mode: 'jsx' });
                continue;
            }
        }

        if (frame.depth) {
            if (text[i] === '{') {
                frame.depth++;
            }

            if (text[i] === '}' && --frame.depth === 0) {
                i++;
                flush(i);
                frames.pop();
                continue;
            }
        }

        i++;
    }

    flush(n);

    if (frames.length === 1) {
        return { state: '', tokens };
    }

    if (frames.length === 2 && frames[1].mode === 'comment') {
        return { state: 'comment', tokens };
    }

    if (frames.length === 2 && frames[1].mode === 'template') {
        return { state: '`', tokens };
    }

    return { state: 'script:' + JSON.stringify(frames), tokens };
}

function identifier(text: string, from: number, to: number): Token['kind'] {
    let word = text.slice(from, to);

    if (LITERALS.has(word)) {
        return 'number';
    }

    if (KEYWORDS.has(word)) {
        return 'keyword';
    }

    let next = text[after(text, to)];

    if (next === '(') {
        return 'function';
    }

    let previous = before(text, from);

    if (word.charCodeAt(0) >= 65 && word.charCodeAt(0) <= 90) {
        return 'type';
    }

    if (previous >= 0 && previous < from - 1 && TYPE_PRECEDERS.has(wordEndingAt(text, previous))) {
        return 'type';
    }

    if (
        text[previous] === '.' ||
        next === ':' ||
        (next === '=' && text.lastIndexOf('<', from - 1) > text.lastIndexOf('>', from - 1))
    ) {
        return 'property';
    }

    return 'variable';
}

function isDigit(code: number) {
    return code >= 48 && code <= 57;
}

function isLetter(code: number) {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isWord(code: number) {
    return isWordStart(code) || isDigit(code);
}

function isWordStart(code: number) {
    return isLetter(code) || code === 95 || code === 36;
}

function structuralMarks(text: string, tokens: readonly Token[], language: Language) {
    let k = 0,
        marks: Mark[] = [];

    for (let i = 0, n = text.length; i < n; i++) {
        let ch = text[i],
            close = ch === ')' || ch === ']' || ch === '}';

        if (!close && ch !== '(' && ch !== '[' && ch !== '{') {
            continue;
        }

        while (k < tokens.length && tokens[k].to <= i) {
            k++;
        }

        if (tokens[k] && tokens[k].from <= i && PROTECTED.has(tokens[k].kind)) {
            continue;
        }

        marks.push({ at: i, close, name: ch, tag: false });
    }

    if (!TAGGED.has(language) || !text.includes('<')) {
        return marks;
    }

    TAG.lastIndex = 0;

    for (let match; (match = TAG.exec(text));) {
        let at = match.index,
            name = match[2].toLowerCase();

        // Only what the lexer took for a tag: a generic's '<T>' or a '<' inside a string never folds.
        if (
            match[0].endsWith('/>') ||
            VOID.test(name) ||
            !tokens.some((token) => token.from === at && token.kind === 'tag')
        ) {
            continue;
        }

        marks.push(
            match[1]
                ? { at, close: true, name, tag: true }
                : { at: at + match[0].length - 1, close: false, name, tag: true }
        );
    }

    return marks.sort((a, b) => a.at - b.at);
}

// JSX only starts where an expression can; after a name it's a comparison or type arguments ('Record<string, T>').
function jsxAllowed(text: string, i: number) {
    let j = before(text, i);

    if (j < 0 || JSX_PRECEDERS.includes(text[j])) {
        return true;
    }

    return JSX_KEYWORDS.has(wordEndingAt(text, j));
}

function regexAllowed(text: string, i: number) {
    let j = before(text, i);

    if (j < 0 || REGEX_PRECEDERS.includes(text[j])) {
        return true;
    }

    return j < i - 1 && REGEX_KEYWORDS.has(wordEndingAt(text, j));
}

// End offset of a regular expression literal starting at 'i', past its flags; -1 when it never closes.
function regexEnd(text: string, i: number) {
    let bracket = false,
        n = text.length;

    for (let at = i + 1; at < n; at++) {
        let ch = text[at];

        if (ch === '\\') {
            at++;
            continue;
        }

        if (ch === '[') {
            bracket = true;
        }
        else if (ch === ']') {
            bracket = false;
        }
        else if (ch === '/' && !bracket) {
            at++;

            while (at < n && isLetter(text.charCodeAt(at))) {
                at++;
            }

            return at;
        }
    }

    return -1;
}

function selectorToken(text: string, i: number, tokens: Token[], attribute: boolean) {
    let ch = text[i],
        from = i;

    if (attribute) {
        CSS_IDENT.lastIndex = i;

        if (CSS_IDENT.test(text)) {
            tokens.push({ from, kind: 'property', to: CSS_IDENT.lastIndex });
            return CSS_IDENT.lastIndex;
        }

        tokens.push({ from, kind: 'operator', to: i + 1 });
        return i + 1;
    }

    if (ch === '.' || ch === '#' || ch === '%' || ch === ':' || ch === '&') {
        let start = ch === ':' && text[i + 1] === ':' ? i + 2 : i + 1;

        CSS_IDENT.lastIndex = start;

        let end = CSS_IDENT.test(text) ? CSS_IDENT.lastIndex : start;

        if (end > i + 1 || ch === '&') {
            tokens.push({ from, kind: 'selector', to: end });
            return end;
        }
    }

    if (ch === '*') {
        tokens.push({ from, kind: 'selector', to: i + 1 });
        return i + 1;
    }

    let code = text.charCodeAt(i);

    if (isDigit(code) || ((ch === '+' || ch === '-' || ch === '.') && isDigit(text.charCodeAt(i + 1)))) {
        CSS_NUMBER.lastIndex = i;
        CSS_NUMBER.test(text);
        tokens.push({ from, kind: 'number', to: CSS_NUMBER.lastIndex });
        return CSS_NUMBER.lastIndex;
    }

    CSS_IDENT.lastIndex = i;

    if (CSS_IDENT.test(text)) {
        tokens.push({ from, kind: 'tag', to: CSS_IDENT.lastIndex });
        return CSS_IDENT.lastIndex;
    }

    if (OPERATORS.includes(ch) || ch === '>' || ch === '~') {
        tokens.push({ from, kind: 'operator', to: i + 1 });
    }

    return i + 1;
}

// Index of the closing quote, or the line's last index when the string runs on.
function skipString(text: string, i: number) {
    let n = text.length,
        quote = text[i];

    for (let k = i + 1; k < n; k++) {
        if (text[k] === '\\') {
            k++;
            continue;
        }

        if (text[k] === quote) {
            return k;
        }
    }

    return n - 1;
}

function valueToken(text: string, i: number, tokens: Token[]) {
    let ch = text[i],
        code = text.charCodeAt(i),
        from = i;

    if (ch === '@' || ch === '!') {
        CSS_IDENT.lastIndex = i + 1;

        let end = CSS_IDENT.test(text) ? CSS_IDENT.lastIndex : i + 1;

        tokens.push({ from, kind: end > i + 1 ? 'keyword' : 'operator', to: end });
        return end;
    }

    if (ch === '#') {
        CSS_HEX.lastIndex = i;

        if (CSS_HEX.test(text)) {
            tokens.push({ from, kind: 'color', to: CSS_HEX.lastIndex });
            return CSS_HEX.lastIndex;
        }
    }

    if (isDigit(code) || ((ch === '+' || ch === '-' || ch === '.') && isDigit(text.charCodeAt(i + 1)))) {
        CSS_NUMBER.lastIndex = i;
        CSS_NUMBER.test(text);
        tokens.push({ from, kind: 'number', to: CSS_NUMBER.lastIndex });
        return CSS_NUMBER.lastIndex;
    }

    CSS_IDENT.lastIndex = i;

    if (CSS_IDENT.test(text)) {
        let end = CSS_IDENT.lastIndex,
            word = text.slice(from, end);

        if (text[end] !== '(') {
            tokens.push({ from, kind: word.startsWith('--') ? 'variable' : 'keyword', to: end });
            return end;
        }

        tokens.push({ from, kind: 'function', to: end }, { from: end, kind: 'operator', to: end + 1 });

        // An unquoted url is raw text, slashes and all.
        if (word.toLowerCase() === 'url' && text[after(text, end + 1)] !== '"' && text[after(text, end + 1)] !== "'") {
            let close = text.indexOf(')', end + 1),
                to = close < 0 ? text.length : close;

            tokens.push({ from: end + 1, kind: 'string', to });
            return to;
        }

        return end + 1;
    }

    if (OPERATORS.includes(ch) || ch === '%') {
        tokens.push({ from, kind: 'operator', to: i + 1 });
    }

    return i + 1;
}

function wordEndingAt(text: string, end: number) {
    let start = end;

    while (start >= 0 && isWord(text.charCodeAt(start))) {
        start--;
    }

    return text.slice(start + 1, end + 1);
}


// Follows a document through its line deltas; entries for edited lines become holes, and everything from the first
// edited line on is revalidated before it's read.
class Lines<T> {
    dirty = 0;
    items: (T | undefined)[] = [];


    apply({ inserted, line, removed }: Delta) {
        let items = this.items;

        if (line >= items.length) {
            return;
        }

        if (line + removed >= items.length) {
            items.length = line;
        }
        else if (inserted === removed) {
            for (let i = line, n = line + removed; i < n; i++) {
                items[i] = undefined;
            }
        }
        else {
            this.items = items.slice(0, line).concat(new Array(inserted), items.slice(line + removed));
        }

        if (this.dirty > line) {
            this.dirty = line;
        }
    }

    clear() {
        this.dirty = 0;
        this.items = [];
    }
}


const closes = (stack: Frame | null, mark: Mark) => {
    if (!mark.tag) {
        return stack && stack.name === OPENERS[mark.name] ? stack : null;
    }

    while (stack && stack.name !== mark.name) {
        stack = stack.parent;
    }

    return stack;
};

const commentSyntax = (language: Language): { block?: readonly [string, string]; line: string | false } => {
    if (language === 'python') {
        return { line: '#' };
    }

    if (language === 'html' || language === 'markdown') {
        return { block: ['<!--', '-->'], line: false };
    }

    if (language === 'css' || language === 'scss') {
        return { block: ['/*', '*/'], line: false };
    }

    if (language === 'json') {
        return { line: false };
    }

    return { line: '//' };
};

// A small lexical highlighter, deliberately not a parser; tokens always slice the original line.
const highlightLine = (text: string, language: Language, initial: LexState = ''): HighlightedLine => {
    switch (language) {
        case 'css':
        case 'scss':
            return highlightCss(text, language === 'scss', initial);
        case 'html':
            return highlightHtml(text, initial);
        case 'javascript':
        case 'jsx':
            return highlightScript(text, 'javascript', initial);
        case 'markdown':
            return highlightMarkdown(text, initial);
        case 'tsx':
        case 'typescript':
            return highlightScript(text, 'typescript', initial);
        default:
            return highlightBasic(text, language, initial);
    }
};

const languageFor = (path = ''): Language => {
    let name = path.split(SEPARATOR).pop() ?? '',
        dot = name.lastIndexOf('.');

    return EXTENSIONS[name.slice(dot + 1).toLowerCase()] ?? 'plain';
};

// Per-line lexer states, tokens and bracket nesting for a document, kept across edits. Lines lex on demand, from the
// last valid line up to the one asked for; after an edit, lexing resumes at the first edited line and stops reusing
// nothing once a line starts in the state it started in before, so a keystroke re-lexes a line or two.
class SyntaxCache {
    readonly document: EditorDocument;
    readonly language: Language;
    private lexed = new Lines<Entry>();
    private nested = new Lines<Nesting>();
    private version: number;


    constructor(document: EditorDocument, language: Language) {
        this.document = document;
        this.language = language;
        this.version = document.revision;
    }


    private clampLine(index: number) {
        return Math.max(0, Math.min(this.document.lineCount - 1, Math.trunc(index) || 0));
    }

    private entry(line: number) {
        this.sync();

        let items = this.lexed.items;

        for (let j = this.lexed.dirty; j <= line; j++) {
            let entry = items[j],
                start = j ? items[j - 1]!.end : '';

            if (!entry || entry.start !== start) {
                let result = highlightLine(this.document.lineText(j), this.language, start);

                items[j] = { end: result.state, marks: null, start, tokens: result.tokens };
            }
        }

        this.lexed.dirty = Math.max(this.lexed.dirty, line + 1);

        return items[line]!;
    }

    private marksOf(line: number, entry: Entry) {
        return entry.marks ??= structuralMarks(this.document.lineText(line), entry.tokens, this.language);
    }

    private sync() {
        let revision = this.document.revision;

        if (revision === this.version) {
            return;
        }

        let deltas = this.document.deltas(this.version);

        this.version = revision;

        if (!deltas) {
            this.lexed.clear();
            this.nested.clear();
            return;
        }

        for (let i = 0, n = deltas.length; i < n; i++) {
            this.lexed.apply(deltas[i]);
            this.nested.apply(deltas[i]);
        }
    }


    get lineCount() {
        return this.document.lineCount;
    }

    line(index: number): LineSyntax {
        return this.entry(this.clampLine(index));
    }

    lineTokens(index: number): readonly Token[] {
        return this.entry(this.clampLine(index)).tokens;
    }

    marks(index: number): readonly Mark[] {
        index = this.clampLine(index);

        return this.marksOf(index, this.entry(index));
    }

    nesting(index: number): Nesting {
        index = this.clampLine(index);
        this.entry(index);

        let entries = this.lexed.items,
            items = this.nested.items;

        for (let j = this.nested.dirty; j <= index; j++) {
            let current = items[j],
                entry = entries[j]!,
                previous = j ? items[j - 1]! : null,
                brackets = previous?.brackets ?? null,
                tags = previous?.tags ?? null;

            if (current && current.entry === entry && current.from === brackets && current.tagFrom === tags) {
                continue;
            }

            let closed: Closed[] = [],
                low = brackets?.depth ?? 0,
                marks = this.marksOf(j, entry),
                tagLow = tags?.depth ?? 0;

            for (let k = 0, m = marks.length; k < m; k++) {
                let mark = marks[k],
                    stack = mark.tag ? tags : brackets;

                if (mark.close) {
                    let popped = closes(stack, mark);

                    if (!popped) {
                        continue;
                    }

                    closed.push({ at: mark.at, frame: popped });
                    stack = popped.parent;
                }
                else {
                    stack = { at: mark.at, depth: (stack?.depth ?? 0) + 1, entry, name: mark.name, parent: stack };
                }

                if (mark.tag) {
                    tagLow = Math.min(tagLow, stack?.depth ?? 0);
                    tags = stack;
                }
                else {
                    low = Math.min(low, stack?.depth ?? 0);
                    brackets = stack;
                }
            }

            items[j] = {
                brackets,
                closed,
                entry,
                from: previous?.brackets ?? null,
                low,
                tagFrom: previous?.tags ?? null,
                tagLow,
                tags
            };
        }

        this.nested.dirty = Math.max(this.nested.dirty, index + 1);

        return items[index]!;
    }

    stateAt(index: number) {
        return this.entry(this.clampLine(index)).start;
    }

    // The token a caret at 'offset' sits inside; a caret just past a closed string, comment or regexp is outside it,
    // and one at the start of a line that continues a comment or string is inside it.
    tokenAt(offset: number) {
        let document = this.document,
            line = document.lineAt(offset),
            local = offset - document.lineStart(line),
            entry = this.entry(line),
            tokens = entry.tokens;

        if (local === 0 && entry.start && tokens[0]?.from === 0 && PROTECTED.has(tokens[0].kind)) {
            return tokens[0];
        }

        for (let i = 0, n = tokens.length; i < n; i++) {
            let token = tokens[i];

            if (token.from >= local) {
                break;
            }

            if (token.to < local) {
                continue;
            }

            if (token.to === local) {
                let text = document.lineText(line);

                if (
                    (token.kind === 'string' && token.to - token.from > 1 && text[token.from] === text[token.to - 1]) ||
                    (token.kind === 'comment' && /\*\/|-->/.test(text.slice(token.to - 3, token.to))) ||
                    token.kind === 'regexp'
                ) {
                    continue;
                }
            }

            return token;
        }

        return null;
    }
}


// The cache shared by every reader of a document in one language, so commands, folding and rendering lex once.
const syntaxCache = (document: EditorDocument, language: Language) => {
    let caches = CACHES.get(document);

    if (!caches) {
        CACHES.set(document, caches = new Map());
    }

    let cache = caches.get(language);

    if (!cache) {
        caches.set(language, cache = new SyntaxCache(document, language));
    }

    return cache;
};


export { closes, commentSyntax, highlightLine, languageFor, SyntaxCache, syntaxCache };
export type { Frame, HighlightedLine, Language, LexState, LineSyntax, Mark, Nesting, Token };
