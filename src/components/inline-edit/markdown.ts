import { safe } from './utilities';


type Feature = Block | Mark | 'clear' | 'copy';

type Block = 'bullet' | 'codeblock' | 'heading' | 'ordered' | 'quote' | 'task';

type Mark = 'bold' | 'code' | 'highlight' | 'italic' | 'link' | 'strike';

type Rule = {
    mark: Mark;
    pattern: RegExp;
};


const BLOCKS = new Set(['BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'OL', 'P', 'PRE', 'UL']);

// Escaped ASCII punctuation is parked on the private use area while marks are matched, so it can't delimit one.
const PARKED = /[\uE000-\uE07F]/g;

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

const TAGS: Record<Mark, string> = {
    bold: 'strong',
    code: 'code',
    highlight: 'mark',
    italic: 'em',
    link: 'a',
    strike: 's'
};

// Aliases the browser or a paste can leave behind.
const MARKS: Record<string, Mark> = {
    A: 'link',
    B: 'bold',
    CODE: 'code',
    DEL: 'strike',
    EM: 'italic',
    I: 'italic',
    MARK: 'highlight',
    S: 'strike',
    STRIKE: 'strike',
    STRONG: 'bold'
};


function append(parent: Node, text: string) {
    let lines = text.split('\n');

    for (let i = 0, n = lines.length; i < n; i++) {
        if (i > 0) {
            parent.appendChild(document.createElement('br'));
        }

        if (lines[i]) {
            parent.appendChild(document.createTextNode(lines[i]));
        }
    }
}

function block(element: HTMLElement, features: Set<Feature>): string {
    let tag = element.tagName;

    if (tag[0] === 'H' && tag.length === 2) {
        let text = paragraph([...element.childNodes], features);

        return features.has('heading') && text ? `${'#'.repeat(Math.min(Number(tag[1]), 3))} ${text.replace(/\n/g, ' ')}` : text;
    }

    if (tag === 'BLOCKQUOTE') {
        let text = paragraph(flatten(element), features);

        return features.has('quote') && text ? text.split('\n').map((line) => `> ${line}`).join('\n') : text;
    }

    if (tag === 'PRE') {
        let text = plain(element).replace(/\n+$/, '');

        return features.has('codeblock') ? `\`\`\`\n${text}\n\`\`\`` : paragraph([document.createTextNode(text)], features);
    }

    if (tag === 'UL' || tag === 'OL') {
        let items = [...element.children].filter((child) => child.tagName === 'LI') as HTMLElement[],
            kind: Block = tag === 'OL' ? 'ordered' : element.hasAttribute('data-task') || items.some((item) => item.hasAttribute('data-checked')) ? 'task' : 'bullet',
            lines: string[] = [];

        for (let i = 0, n = items.length; i < n; i++) {
            let text = paragraph(flatten(items[i]), features).replace(/\n/g, ' ');

            if (!features.has(kind)) {
                lines.push(text);
            }
            else if (kind === 'ordered') {
                lines.push(`${i + 1}. ${text}`);
            }
            else if (kind === 'task') {
                lines.push(`- [${items[i].getAttribute('data-checked') === 'true' ? 'x' : ' '}] ${text}`);
            }
            else {
                lines.push(`- ${text}`);
            }
        }

        return lines.filter(Boolean).join(features.has(kind) ? '\n' : '\n\n');
    }

    // A div the browser wrapped around blocks of its own.
    if ([...element.children].some((child) => BLOCKS.has(child.tagName))) {
        return blocks(element, features);
    }

    return paragraph([...element.childNodes], features);
}

function blocks(root: Node, features: Set<Feature>) {
    let out: string[] = [],
        run: Node[] = [];

    let flush = () => {
        let text = paragraph(run, features);

        if (text) {
            out.push(text);
        }

        run = [];
    };

    for (let node of root.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && BLOCKS.has((node as Element).tagName)) {
            flush();

            let text = block(node as HTMLElement, features);

            if (text) {
                out.push(text);
            }
        }
        else {
            run.push(node);
        }
    }

    flush();

    return out.join('\n\n');
}

// Only characters that could open or close enabled formatting are escaped, so prose like 'snake_case' or 'a == b'
// stays readable in the saved markdown.
function escape(text: string, features: Set<Feature>) {
    text = text.replace(/\\/g, '\\\\');

    if (features.has('bold') || features.has('italic')) {
        text = text.replace(/[*_]/g, (c: string, i: number, s: string) => {
            let after = s[i + 1] ?? '',
                before = s[i - 1] ?? '';

            // '_' only delimits at a word boundary; '*' anywhere it touches text.
            let delimits = c === '*'
                ? /\S/.test(before) || /\S/.test(after)
                : (!/\w/.test(before) && /\S/.test(after)) || (/\S/.test(before) && !/\w/.test(after));

            return delimits ? `\\${c}` : c;
        });
    }

    if (features.has('code')) {
        text = text.replace(/`/g, '\\`');
    }

    if (features.has('highlight')) {
        text = pairs(text, '=');
    }

    if (features.has('link')) {
        text = text.replace(/[[\]]/g, '\\$&');
    }

    if (features.has('strike')) {
        text = pairs(text, '~');
    }

    return text;
}

// Nested blocks inside a quote or list item are read as lines of it.
function flatten(element: HTMLElement) {
    let nodes: Node[] = [];

    for (let node of element.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && BLOCKS.has((node as Element).tagName)) {
            if (nodes.length) {
                nodes.push(document.createElement('br'));
            }

            nodes.push(...flatten(node as HTMLElement));
        }
        else {
            nodes.push(node);
        }
    }

    return nodes;
}

function inline(nodes: Iterable<Node>, features: Set<Feature>): string {
    let out = '';

    for (let node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            out += escape((node as Text).data.replace(/\u00A0/g, ' '), features);
            continue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }

        let element = node as HTMLElement,
            mark = MARKS[element.tagName];

        // Non-editable islands are interface (a checklist box), not content.
        if (element.getAttribute('contenteditable') === 'false') {
            continue;
        }

        if (element.tagName === 'BR') {
            out += '\n';
            continue;
        }

        if (!mark || !features.has(mark)) {
            out += inline(element.childNodes, features);
            continue;
        }

        if (mark === 'code') {
            let text = plain(element).replace(/\n/g, ' ');

            if (text) {
                out += text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
            }

            continue;
        }

        let text = inline(element.childNodes, features),
            core = text.trim();

        if (!core) {
            out += text;
            continue;
        }

        // Delimiters only bind to text, so surrounding spaces move outside them.
        let lead = text.slice(0, text.indexOf(core)),
            trail = text.slice(text.indexOf(core) + core.length);

        if (mark === 'link') {
            let href = element.getAttribute('href') ?? '';

            // encodeURIComponent leaves parentheses alone, and an unbalanced one would end the address early.
            out += lead + (safe(href) ? `[${core}](${href.replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)})` : core) + trail;
        }
        else {
            out += lead + wrap(mark, core, (out + lead).slice(-1), trail[0] ?? element.nextSibling?.textContent?.[0] ?? '') + trail;
        }
    }

    return out;
}

// Inline markdown into 'parent'; '\n' becomes a line break.
function marks(text: string, features: Set<Feature>, parent: Node) {
    while (text) {
        let found: { match: RegExpExecArray, rule: Rule } | null = null;

        for (let i = 0, n = RULES.length; i < n; i++) {
            let rule = RULES[i];

            if (!features.has(rule.mark)) {
                continue;
            }

            let match = rule.pattern.exec(text);

            if (match && (!found || match.index < found.match.index)) {
                found = { match, rule };
            }
        }

        if (!found) {
            append(parent, unpark(text));
            return;
        }

        let { match, rule } = found;

        if (match.index > 0) {
            append(parent, unpark(text.slice(0, match.index)));
        }

        text = text.slice(match.index + match[0].length);

        let element = document.createElement(TAGS[rule.mark]);

        if (rule.mark === 'code') {
            element.textContent = unpark(match[1], true);
        }
        else if (rule.mark === 'link') {
            let href = unpark(match[2]);

            if (!safe(href)) {
                marks(match[1], features, parent);
                continue;
            }

            element.setAttribute('href', href);
            marks(match[1], features, element);
        }
        else {
            marks(match[1] ?? match[2], features, element);
        }

        parent.appendChild(element);
    }
}

// Paragraph text, with a line that would open an enabled block escaped so it reads back as text.
function paragraph(nodes: Node[], features: Set<Feature>) {
    return inline(nodes, features)
        .split('\n')
        .map((line) => {
            line = line.trim();

            if (
                (features.has('heading') && /^#{1,6}\s/.test(line)) ||
                (features.has('quote') && line[0] === '>') ||
                ((features.has('bullet') || features.has('task')) && /^[-*+]\s/.test(line))
            ) {
                return `\\${line}`;
            }

            if (features.has('ordered') && /^\d+[.)]\s/.test(line)) {
                return line.replace(/^(\d+)/, '$1\\');
            }

            if (features.has('codeblock') && line.startsWith('```')) {
                return `\\${line}`;
            }

            return line;
        })
        .join('\n')
        .replace(/^\n+|\n+$/g, '');
}

// A doubled '=' or '~' delimits only when it touches text on one side.
function pairs(text: string, c: string) {
    return text.replace(new RegExp(`\\${c}\\${c}`, 'g'), (pair: string, i: number, s: string) =>
        /\S/.test(s[i - 1] ?? '') || /\S/.test(s[i + 2] ?? '') ? `\\${c}\\${c}` : pair
    );
}

function park(text: string) {
    return text.replace(/\\([!-/:-@[-`{-~])/g, (_, c: string) => String.fromCharCode(0xE000 + c.charCodeAt(0)));
}

function plain(element: Node): string {
    let out = '';

    for (let node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            out += (node as Text).data;
        }
        else if ((node as Element).tagName === 'BR') {
            out += '\n';
        }
        else if ((node as Element).getAttribute?.('contenteditable') !== 'false') {
            out += plain(node);
        }
    }

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
            return /\w/.test(before) || /\w/.test(after) ? `*${text}*` : `_${text}_`;
        default:
            return `~~${text}~~`;
    }
}



// Builds nodes directly rather than through innerHTML, so nothing in the text is ever read as markup.
const parse = (markdown: string, features: Set<Feature>, multiline: boolean) => {
    let fragment = document.createDocumentFragment();

    if (!multiline) {
        marks(park(markdown.replace(/\s+/g, ' ').trim()), features, fragment);
        return fragment;
    }

    let lines = markdown.replace(/\r\n?/g, '\n').split('\n'),
        n = lines.length;

    let opens = (line: string) =>
        (features.has('heading') && /^#{1,3}\s/.test(line)) ||
        (features.has('quote') && /^>/.test(line)) ||
        (features.has('codeblock') && /^```/.test(line)) ||
        ((features.has('bullet') || features.has('task')) && /^[-*+]\s/.test(line)) ||
        (features.has('ordered') && /^\d+[.)]\s/.test(line));

    for (let i = 0; i < n;) {
        let line = lines[i],
            match: RegExpMatchArray | null;

        if (!line.trim()) {
            i++;
            continue;
        }

        if (features.has('codeblock') && line.startsWith('```')) {
            let body: string[] = [],
                pre = document.createElement('pre');

            for (i++; i < n && !lines[i].startsWith('```'); i++) {
                body.push(lines[i]);
            }

            pre.textContent = body.join('\n');
            fragment.appendChild(pre);
            i++;
            continue;
        }

        if (features.has('heading') && (match = line.match(/^(#{1,3})\s+(.*)$/))) {
            let heading = document.createElement(`h${match[1].length}`);

            marks(park(match[2].trim()), features, heading);
            fragment.appendChild(heading);
            i++;
            continue;
        }

        if (features.has('quote') && line.startsWith('>')) {
            let body: string[] = [],
                quote = document.createElement('blockquote');

            for (; i < n && lines[i].startsWith('>'); i++) {
                body.push(lines[i].replace(/^>\s?/, ''));
            }

            marks(park(body.join('\n')), features, quote);
            fragment.appendChild(quote);
            continue;
        }

        let list = (
            (features.has('task') && /^[-*+]\s+\[[ xX]\]\s/.test(line) && 'task') ||
            (features.has('bullet') && /^[-*+]\s/.test(line) && 'bullet') ||
            (features.has('ordered') && /^\d+[.)]\s/.test(line) && 'ordered')
        ) as Block | false;

        if (list) {
            let element = document.createElement(list === 'ordered' ? 'ol' : 'ul'),
                pattern = list === 'task' ? /^[-*+]\s+\[([ xX])\]\s+(.*)$/ : list === 'bullet' ? /^[-*+]\s+()(.*)$/ : /^\d+[.)]\s+()(.*)$/;

            if (list === 'task') {
                element.setAttribute('data-task', '');
            }

            for (; i < n && (match = lines[i].match(pattern)); i++) {
                let item = document.createElement('li');

                if (list === 'task') {
                    item.setAttribute('data-checked', match[1] === ' ' ? 'false' : 'true');
                }

                marks(park(match[2].trim()), features, item);
                element.appendChild(item);
            }

            fragment.appendChild(element);
            continue;
        }

        let body: string[] = [],
            p = document.createElement('p');

        for (; i < n && lines[i].trim() && (!body.length || !opens(lines[i])); i++) {
            body.push(lines[i].trim());
        }

        marks(park(body.join('\n')), features, p);
        fragment.appendChild(p);
    }

    return fragment;
};

const serialize = (root: Node, features: Set<Feature>, multiline: boolean) => {
    if (!multiline) {
        return inline(root.childNodes, features).replace(/\s*\n\s*/g, ' ').trim();
    }

    return blocks(root, features).trim();
};


export { BLOCKS, MARKS, TAGS, parse, plain, serialize };
export type { Block, Feature, Mark };
