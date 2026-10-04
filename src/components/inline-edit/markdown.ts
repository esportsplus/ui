import { block, list, nest, sort, text, type Block, type Doc, type Kind, type Mark, type Run, type Tree } from './model';
import { INLINE_LINE_BREAKS, NON_BREAKING_SPACES, safe } from './utilities';


type Feature = Group | Mark | 'clear' | 'copy';

type Group = 'bullet' | 'codeblock' | 'heading' | 'ordered' | 'quote' | 'task';

type Rule = {
    mark: Mark;
    pattern: RegExp;
};


const BACKSLASHES = /\\/g;

const EMPHASIS_DELIMITERS = /[*_]/g;

const NON_WHITESPACE = /\S/;

const WORD_CHARACTER = /\w/;

const BACKTICKS = /`/g;

const BRACKETS = /[[\]]/g;

const NEWLINES = /\n/g;

const LINK_CHARACTERS = /[()\s]/g;

const HEADING_PREFIX = /^#{1,6}\s/;

const BULLET_PREFIX = /^[-*+]\s/;

const ORDERED_PREFIX = /^\d+[.)]\s/;

const ORDERED_NUMBER = /^(\d+)/;

const SURROUNDING_NEWLINES = /^\n+|\n+$/g;

const ESCAPED_PUNCTUATION = /\\([!-/:-@[-`{-~])/g;

const TRAILING_NEWLINES = /\n+$/;

const WHITESPACE = /\s+/g;

const LINE_BREAKS = /\r\n?/g;

const SUPPORTED_HEADING_PREFIX = /^#{1,3}\s/;

const QUOTE_PREFIX = /^>/;

const CODEBLOCK_PREFIX = /^```/;

const HEADING = /^(#{1,3})\s+(.*)$/;

const QUOTE_MARKER = /^>\s?/;

const TASK_PREFIX = /^[-*+]\s+\[[ xX]\]\s/;

const TASK_ITEM = /^[-*+]\s+\[([ xX])\]\s+(.*)$/;

const BULLET_ITEM = /^[-*+]\s+()(.*)$/;

const ORDERED_ITEM = /^\d+[.)]\s+()(.*)$/;

const MARK_PAIRS = {
    '=': /==/g,
    '~': /~~/g
};


// Escaped ASCII punctuation is parked on the private use area while marks are matched, so it can't delimit one.
const PARKED = /[-]/g;

// Earliest match wins; on a tie the rule listed first does, so '**' is read as bold before italic sees a '*'.
const RULES: Rule[] = [
    { mark: 'code', pattern: /`([^`\n]+)`/ },
    // Addresses may hold one level of balanced parentheses.
    { mark: 'link', pattern: /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/ },
    { mark: 'bold', pattern: /\*\*(?=\S)([^\n]*?\S)\*\*/ },
    { mark: 'strike', pattern: /~~(?=\S)([^\n]*?\S)~~/ },
    { mark: 'highlight', pattern: /==(?=\S)([^\n]*?\S)==/ },
    // '_' only between non-word characters (so snake_case stays text), '*' anywhere, including inside a word.
    { mark: 'italic', pattern: /(?<![\w\\])_(?=\S)([^\n]*?\S)_(?!\w)|(?<!\*)\*(?=[^\s*])([^\n]*?[^\s*])\*(?!\*)/ }
];


// Only characters that could open or close enabled formatting are escaped, so prose like 'snake_case' or 'a == b'
// stays readable in the saved markdown.
function escape(text: string, features: Set<Feature>) {
    text = text.replace(BACKSLASHES, '\\\\');

    if (features.has('bold') || features.has('italic')) {
        text = text.replace(EMPHASIS_DELIMITERS, (c: string, i: number, s: string) => {
            let after = s[i + 1] ?? '',
                before = s[i - 1] ?? '';

            // '_' only delimits at a word boundary; '*' anywhere it touches text.
            let delimits = c === '*'
                ? NON_WHITESPACE.test(before) || NON_WHITESPACE.test(after)
                : (!WORD_CHARACTER.test(before) && NON_WHITESPACE.test(after)) || (NON_WHITESPACE.test(before) && !WORD_CHARACTER.test(after));

            return delimits ? `\\${c}` : c;
        });
    }

    if (features.has('code')) {
        text = text.replace(BACKTICKS, '\\`');
    }

    if (features.has('highlight')) {
        text = pairs(text, '=');
    }

    if (features.has('link')) {
        text = text.replace(BRACKETS, '\\$&');
    }

    if (features.has('strike')) {
        text = pairs(text, '~');
    }

    return text;
}

// The first character a tree writes, to choose an italic delimiter that can't join the text after it.
function first(tree: Tree | undefined): string {
    if (!tree) {
        return '';
    }

    return 'text' in tree ? tree.text[0] ?? '' : first(tree.children[0]);
}

function inline(trees: Tree[], features: Set<Feature>): string {
    let out = '';

    for (let i = 0, n = trees.length; i < n; i++) {
        let tree = trees[i];

        if ('text' in tree) {
            out += escape(tree.text.replace(NON_BREAKING_SPACES, ' '), features);
            continue;
        }

        if (!features.has(tree.mark)) {
            out += inline(tree.children, features);
            continue;
        }

        if (tree.mark === 'code') {
            let value = plain(tree).replace(NEWLINES, ' ');

            out += value.includes('`') ? `\`\` ${value} \`\`` : `\`${value}\``;
            continue;
        }

        let value = inline(tree.children, features),
            core = value.trim();

        if (!core) {
            out += value;
            continue;
        }

        // Delimiters only bind to text, so surrounding spaces move outside them.
        let lead = value.slice(0, value.indexOf(core)),
            trail = value.slice(value.indexOf(core) + core.length);

        if (tree.mark === 'link') {
            // encodeURIComponent leaves parentheses alone, and an unbalanced one would end the address early.
            out += lead + (safe(tree.href) ? `[${core}](${tree.href.replace(LINK_CHARACTERS, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)})` : core) + trail;
        }
        else {
            out += lead + wrap(tree.mark, core, (out + lead).slice(-1), trail[0] ?? first(trees[i + 1])) + trail;
        }
    }

    return out;
}

// Inline markdown as runs styled on top of 'style'.
function marks(value: string, features: Set<Feature>, style: Run, out: Run[]) {
    while (value) {
        let found: { match: RegExpExecArray, rule: Rule } | null = null;

        for (let i = 0, n = RULES.length; i < n; i++) {
            let rule = RULES[i];

            if (!features.has(rule.mark)) {
                continue;
            }

            let match = rule.pattern.exec(value);

            if (match && (!found || match.index < found.match.index)) {
                found = { match, rule };
            }
        }

        if (!found) {
            out.push({ ...style, text: unpark(value) });
            return;
        }

        let { match, rule } = found;

        if (match.index > 0) {
            out.push({ ...style, text: unpark(value.slice(0, match.index)) });
        }

        value = value.slice(match.index + match[0].length);

        if (rule.mark === 'code') {
            out.push({ href: style.href, marks: sort([...style.marks, 'code']), text: unpark(match[1], true) });
        }
        else if (rule.mark === 'link') {
            let href = unpark(match[2]);

            marks(match[1], features, safe(href) ? { ...style, href } : style, out);
        }
        else {
            marks(match[1] ?? match[2], features, { ...style, marks: sort([...style.marks, rule.mark]) }, out);
        }
    }
}

// A doubled '=' or '~' delimits only when it touches text on one side.
function pairs(text: string, c: keyof typeof MARK_PAIRS) {
    return text.replace(MARK_PAIRS[c], (pair: string, i: number, s: string) =>
        NON_WHITESPACE.test(s[i - 1] ?? '') || NON_WHITESPACE.test(s[i + 2] ?? '') ? `\\${c}\\${c}` : pair
    );
}

// Paragraph text, with a line that would open an enabled block escaped so it reads back as text.
function paragraph(runs: Run[], features: Set<Feature>) {
    return inline(nest(runs), features)
        .split('\n')
        .map((line) => {
            line = line.trim();

            if (
                (features.has('heading') && HEADING_PREFIX.test(line)) ||
                (features.has('quote') && line[0] === '>') ||
                ((features.has('bullet') || features.has('task')) && BULLET_PREFIX.test(line))
            ) {
                return `\\${line}`;
            }

            if (features.has('ordered') && ORDERED_PREFIX.test(line)) {
                return line.replace(ORDERED_NUMBER, '$1\\');
            }

            if (features.has('codeblock') && line.startsWith('```')) {
                return `\\${line}`;
            }

            return line;
        })
        .join('\n')
        .replace(SURROUNDING_NEWLINES, '');
}

function park(text: string) {
    return text.replace(ESCAPED_PUNCTUATION, (_, c: string) => String.fromCharCode(0xE000 + c.charCodeAt(0)));
}

function plain(tree: Tree): string {
    return 'text' in tree ? tree.text : tree.children.map(plain).join('');
}

function runs(value: string, features: Set<Feature>) {
    let out: Run[] = [];

    marks(park(value), features, { href: '', marks: [], text: '' }, out);

    return out;
}

// Code keeps its backslashes; everywhere else an escape reads as the character itself.
function unpark(text: string, code = false) {
    return text.replace(PARKED, (c) => (code ? '\\' : '') + String.fromCharCode(c.charCodeAt(0) - 0xE000));
}

function wrap(mark: Mark, text: string, before: string, after: string) {
    switch (mark) {
        case 'bold':
            return `**${text}**`;
        case 'highlight':
            return `==${text}==`;
        case 'italic':
            // '_' can't sit inside a word, so an emphasised part of one uses '*'.
            return WORD_CHARACTER.test(before) || WORD_CHARACTER.test(after) ? `*${text}*` : `_${text}_`;
        default:
            return `~~${text}~~`;
    }
}

function write(group: Block[], features: Set<Feature>): string {
    let { kind, runs } = group[0];

    if (list(kind)) {
        let enabled = features.has(kind as Group),
            lines: string[] = [];

        for (let i = 0, n = group.length; i < n; i++) {
            let value = paragraph(group[i].runs, features).replace(NEWLINES, ' ');

            if (!enabled) {
                lines.push(value);
            }
            else if (kind === 'ordered') {
                lines.push(`${i + 1}. ${value}`);
            }
            else if (kind === 'task') {
                lines.push(`- [${group[i].checked ? 'x' : ' '}] ${value}`);
            }
            else {
                lines.push(`- ${value}`);
            }
        }

        return lines.filter(Boolean).join(enabled ? '\n' : '\n\n');
    }

    if (kind === 'codeblock') {
        let value = text(runs).replace(TRAILING_NEWLINES, '');

        return features.has('codeblock') ? `\`\`\`\n${value}\n\`\`\`` : paragraph([{ href: '', marks: [], text: value }], features);
    }

    let value = paragraph(runs, features);

    if (kind === 'quote') {
        return features.has('quote') && value ? value.split('\n').map((line) => `> ${line}`).join('\n') : value;
    }

    if (kind[0] === 'h') {
        return features.has('heading') && value ? `${'#'.repeat(Number(kind[1]))} ${value.replace(NEWLINES, ' ')}` : value;
    }

    return value;
}


// Always at least one block, so there is a line to put the caret on.
const parse = (markdown: string, features: Set<Feature>, multiline: boolean): Doc => {
    if (!multiline) {
        return [block('paragraph', runs(markdown.replace(WHITESPACE, ' ').trim(), features))];
    }

    let doc: Doc = [],
        lines = markdown.replace(LINE_BREAKS, '\n').split('\n'),
        n = lines.length;

    let opens = (line: string) =>
        (features.has('heading') && SUPPORTED_HEADING_PREFIX.test(line)) ||
        (features.has('quote') && QUOTE_PREFIX.test(line)) ||
        (features.has('codeblock') && CODEBLOCK_PREFIX.test(line)) ||
        ((features.has('bullet') || features.has('task')) && BULLET_PREFIX.test(line)) ||
        (features.has('ordered') && ORDERED_PREFIX.test(line));

    for (let i = 0; i < n;) {
        let line = lines[i],
            match: RegExpMatchArray | null;

        if (!line.trim()) {
            i++;
            continue;
        }

        if (features.has('codeblock') && line.startsWith('```')) {
            let body: string[] = [];

            for (i++; i < n && !lines[i].startsWith('```'); i++) {
                body.push(lines[i]);
            }

            doc.push(block('codeblock', body.length && body.join('\n') ? [{ href: '', marks: [], text: body.join('\n') }] : []));
            i++;
            continue;
        }

        if (features.has('heading') && (match = line.match(HEADING))) {
            doc.push(block(`h${match[1].length}` as Kind, runs(match[2].trim(), features)));
            i++;
            continue;
        }

        if (features.has('quote') && line.startsWith('>')) {
            let body: string[] = [];

            for (; i < n && lines[i].startsWith('>'); i++) {
                body.push(lines[i].replace(QUOTE_MARKER, ''));
            }

            doc.push(block('quote', runs(body.join('\n'), features)));
            continue;
        }

        let kind = (
            (features.has('task') && TASK_PREFIX.test(line) && 'task') ||
            (features.has('bullet') && BULLET_PREFIX.test(line) && 'bullet') ||
            (features.has('ordered') && ORDERED_PREFIX.test(line) && 'ordered')
        ) as Kind | false;

        if (kind) {
            let pattern = kind === 'task' ? TASK_ITEM : kind === 'bullet' ? BULLET_ITEM : ORDERED_ITEM;

            for (; i < n && (match = lines[i].match(pattern)); i++) {
                doc.push(block(kind, runs(match[2].trim(), features), kind === 'task' && match[1] !== ' '));
            }

            continue;
        }

        let body: string[] = [];

        for (; i < n && lines[i].trim() && (!body.length || !opens(lines[i])); i++) {
            body.push(lines[i].trim());
        }

        doc.push(block('paragraph', runs(body.join('\n'), features)));
    }

    if (!doc.length) {
        doc.push(block('paragraph', []));
    }

    return doc;
};

const serialize = (doc: Doc, features: Set<Feature>, multiline: boolean) => {
    if (!multiline) {
        return doc.map((b) => inline(nest(b.runs), features)).join(' ').replace(INLINE_LINE_BREAKS, ' ').trim();
    }

    let out: string[] = [];

    // Consecutive items of one kind of list are one list.
    for (let i = 0, n = doc.length; i < n;) {
        let j = i + 1;

        if (list(doc[i].kind)) {
            while (j < n && doc[j].kind === doc[i].kind) {
                j++;
            }
        }

        let value = write(doc.slice(i, j), features);

        if (value) {
            out.push(value);
        }

        i = j;
    }

    return out.join('\n\n').trim();
};


export { parse, serialize };
export type { Feature, Group };
