import { BLOCKS, MARKS, TAGS, plain, type Mark } from './markdown';
import { closest, unwrap } from './utilities';


type Kind = 'bullet' | 'codeblock' | 'h1' | 'h2' | 'h3' | 'ordered' | 'paragraph' | 'quote' | 'task';

type Part = {
    range: Range;
    unit: HTMLElement;
};


const ANY = Object.keys(MARKS).join(',').toLowerCase();

const ELEMENTS: Record<Exclude<Kind, 'bullet' | 'ordered' | 'task'>, string> = {
    codeblock: 'pre',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    paragraph: 'p',
    quote: 'blockquote'
};


// A unit's inline content; nested blocks (a browser div inside a quote) become lines of it.
function content(unit: HTMLElement): Node[] {
    if (unit.tagName === 'PRE') {
        return lines(plain(unit));
    }

    let nodes: Node[] = [];

    for (let node of [...unit.childNodes]) {
        // Non-editable islands (a checklist box) belong to the unit, not its text.
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('contenteditable') === 'false') {
            continue;
        }

        if (node.nodeType === Node.ELEMENT_NODE && BLOCKS.has((node as Element).tagName)) {
            if (nodes.length) {
                nodes.push(document.createElement('br'));
            }

            nodes.push(...content(node as HTMLElement));
        }
        else {
            nodes.push(node);
        }
    }

    return nodes;
}

// Splits 'list' so the items from 'first' to 'last' are the only ones left in it.
function isolate(list: HTMLElement, first: HTMLElement, last: HTMLElement) {
    let after = list.cloneNode(false) as HTMLElement,
        before = list.cloneNode(false) as HTMLElement;

    while (list.firstChild && list.firstChild !== first) {
        before.append(list.firstChild);
    }

    while (last.nextSibling) {
        after.append(last.nextSibling);
    }

    if (before.childNodes.length) {
        list.before(before);
    }

    if (after.childNodes.length) {
        list.after(after);
    }
}

// Takes the selected part of 'part' out of every 'selector' element, splitting those that reach past the selection.
// Returns markers at its edges; they outlive the moves, where the range's own boundaries would not.
function lift({ range, unit }: Part, selector: string): [Text, Text] {
    let end = document.createTextNode(''),
        start = document.createTextNode(''),
        tail = range.cloneRange();

    tail.collapse(false);
    tail.insertNode(end);
    range.insertNode(start);

    let straddling = new Set<HTMLElement>();

    for (let marker of [start, end]) {
        for (let element = marker.parentElement; element && element !== unit; element = element.parentElement) {
            if (element.matches(selector)) {
                straddling.add(element);
            }
        }
    }

    for (let element of straddling) {
        if (element.contains(start)) {
            let head = document.createRange();

            head.setStart(element, 0);
            head.setEndBefore(start);
            spill(element, head.extractContents(), 'before');
        }

        if (element.contains(end)) {
            let rest = document.createRange();

            rest.setStartAfter(end);
            rest.setEnd(element, element.childNodes.length);
            spill(element, rest.extractContents(), 'after');
        }

        unwrap(element);
    }

    let inner = document.createRange();

    inner.setStartAfter(start);
    inner.setEndBefore(end);

    for (let element of [...unit.querySelectorAll<HTMLElement>(selector)]) {
        if (inner.intersectsNode(element)) {
            unwrap(element);
        }
    }

    return [start, end];
}

function lines(text: string) {
    let nodes: Node[] = [],
        split = text.split('\n');

    for (let i = 0, n = split.length; i < n; i++) {
        if (i > 0) {
            nodes.push(document.createElement('br'));
        }

        if (split[i]) {
            nodes.push(document.createTextNode(split[i]));
        }
    }

    return nodes;
}

// Top-level text the browser left outside any block goes into a paragraph; a plain div becomes one.
function normalize(editor: HTMLElement) {
    let run: Node[] = [];

    let flush = () => {
        if (run.some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent?.trim())) {
            let p = document.createElement('p');

            editor.insertBefore(p, run[0]);
            p.append(...run);
        }
        else {
            run.forEach((node) => node.parentNode?.removeChild(node));
        }

        run = [];
    };

    for (let node of [...editor.childNodes]) {
        let tag = (node as Element).tagName;

        if (node.nodeType !== Node.ELEMENT_NODE || !BLOCKS.has(tag)) {
            run.push(node);
            continue;
        }

        flush();

        if (tag === 'DIV' && ![...(node as Element).children].some((child) => BLOCKS.has(child.tagName))) {
            let p = document.createElement('p');

            p.append(...node.childNodes);
            node.parentNode?.replaceChild(p, node);
        }
    }

    flush();
}

// The selection split per unit (a top-level block or a list item), so no transform ever straddles two blocks.
function parts(editor: HTMLElement, range: Range): Part[] {
    let out: Part[] = [];

    for (let unit of units(editor, range)) {
        let part = document.createRange();

        part.selectNodeContents(unit);

        if (unit.contains(range.startContainer)) {
            part.setStart(range.startContainer, range.startOffset);
        }

        if (unit.contains(range.endContainer)) {
            part.setEnd(range.endContainer, range.endOffset);
        }

        if (!part.collapsed) {
            out.push({ range: part, unit });
        }
    }

    return out;
}

function selector(mark: Mark) {
    return Object.keys(MARKS).filter((tag) => MARKS[tag] === mark).join(',').toLowerCase();
}

function settle(editor: HTMLElement, markers: [Text, Text][]) {
    let range = document.createRange();

    range.setStartAfter(markers[0][0]);
    range.setEndBefore(markers[markers.length - 1][1]);

    for (let [start, end] of markers) {
        start.remove();
        end.remove();
    }

    // Splitting a partly selected mark can leave an empty shell behind.
    for (let element of [...editor.querySelectorAll(ANY)]) {
        if (!element.textContent) {
            element.remove();
        }
    }

    // Boundaries between nodes sit outside a new mark; moved in, the toolbar reads it as applied.
    for (let node = range.startContainer.childNodes[range.startOffset]; node?.nodeType === Node.ELEMENT_NODE; node = node.firstChild!) {
        range.setStart(node, 0);
    }

    for (let node = range.endContainer.childNodes[range.endOffset - 1]; node?.nodeType === Node.ELEMENT_NODE; node = node.lastChild!) {
        range.setEnd(node, node.childNodes.length);
    }

    return range;
}

function spill(element: HTMLElement, fragment: DocumentFragment, side: 'after' | 'before') {
    if (!fragment.textContent) {
        return;
    }

    let copy = element.cloneNode(false) as HTMLElement;

    copy.append(fragment);
    element[side](copy);
}

function units(editor: HTMLElement, range: Range) {
    let out: HTMLElement[] = [];

    for (let child of [...editor.children] as HTMLElement[]) {
        if (!range.intersectsNode(child)) {
            continue;
        }

        if (child.tagName === 'UL' || child.tagName === 'OL') {
            for (let item of [...child.children] as HTMLElement[]) {
                if (range.intersectsNode(item)) {
                    out.push(item);
                }
            }
        }
        else {
            out.push(child);
        }
    }

    // A selection ending at the very start of a block (a triple click) doesn't reach into it.
    let last = out[out.length - 1];

    if (out.length > 1 && last) {
        let reach = document.createRange();

        reach.setStart(last, 0);
        reach.setEnd(range.endContainer, range.endOffset);

        if (!reach.toString()) {
            out.pop();
        }
    }

    return out;
}

// Wraps everything between the markers in a new 'mark' element.
function wrap(start: Text, end: Text, mark: Mark, href = '') {
    let between = document.createRange(),
        element = document.createElement(TAGS[mark]);

    between.setStartAfter(start);
    between.setEndBefore(end);

    let fragment = between.extractContents();

    if (!fragment.textContent) {
        return;
    }

    if (mark === 'code') {
        element.textContent = fragment.textContent;
    }
    else {
        element.append(fragment);
    }

    if (href) {
        element.setAttribute('href', href);
    }

    between.insertNode(element);
}


const active = (editor: HTMLElement, range: Range, mark: Mark) => {
    let found = closest(range.startContainer, selector(mark), editor);

    return !!found && found === closest(range.endContainer, selector(mark), editor);
};

const clear = (editor: HTMLElement, range: Range) => {
    let list = parts(editor, range);

    return list.length ? settle(editor, list.map((part) => lift(part, ANY))) : null;
};

const kind = (unit: Element | undefined): Kind => {
    switch (unit?.tagName) {
        case 'BLOCKQUOTE':
            return 'quote';
        case 'H1':
            return 'h1';
        case 'H2':
            return 'h2';
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
            return 'h3';
        case 'LI':
            return unit.parentElement?.tagName === 'OL' ? 'ordered' : unit.parentElement?.hasAttribute('data-task') ? 'task' : 'bullet';
        case 'PRE':
            return 'codeblock';
        default:
            return 'paragraph';
    }
};

const link = (editor: HTMLElement, range: Range, href: string | null) => {
    let list = parts(editor, range);

    if (!list.length) {
        return null;
    }

    let markers = list.map((part) => lift(part, selector('link')));

    if (href) {
        for (let [start, end] of markers) {
            wrap(start, end, 'link', href);
        }
    }

    return settle(editor, markers);
};

// Turns every unit the selection touches into 'target'; quotes and code blocks merge them, one line each.
const setBlock = (editor: HTMLElement, range: Range, target: Kind) => {
    normalize(editor);

    let list = units(editor, range);

    if (!list.length) {
        return null;
    }

    for (let i = 0, n = list.length; i < n; i++) {
        let parent = list[i].parentElement;

        if (list[i].tagName !== 'LI' || !parent) {
            continue;
        }

        let items = list.filter((unit) => unit.parentElement === parent);

        isolate(parent, items[0], items[items.length - 1]);
        i += items.length - 1;
    }

    let containers = [...new Set(list.map((unit) => (unit.tagName === 'LI' ? unit.parentElement! : unit)))],
        nodes: HTMLElement[] = [];

    if (target === 'bullet' || target === 'ordered' || target === 'task') {
        let element = document.createElement(target === 'ordered' ? 'ol' : 'ul');

        if (target === 'task') {
            element.setAttribute('data-task', '');
        }

        for (let unit of list) {
            let item = document.createElement('li');

            if (target === 'task') {
                item.setAttribute('data-checked', unit.getAttribute('data-checked') ?? 'false');
            }

            item.append(...content(unit));
            element.append(item);
        }

        nodes.push(element);
    }
    else if (target === 'codeblock' || target === 'quote') {
        let element = document.createElement(ELEMENTS[target]);

        for (let i = 0, n = list.length; i < n; i++) {
            if (i > 0) {
                element.append(target === 'codeblock' ? '\n' : document.createElement('br'));
            }

            if (target === 'codeblock') {
                element.append(plain(list[i]));
            }
            else {
                element.append(...content(list[i]));
            }
        }

        nodes.push(element);
    }
    else {
        for (let unit of list) {
            let element = document.createElement(ELEMENTS[target]);

            element.append(...content(unit));
            nodes.push(element);
        }
    }

    containers[0].before(...nodes);

    for (let container of containers) {
        container.remove();
    }

    // An empty block has no line to put the caret on.
    for (let element of [...nodes, ...nodes.flatMap((node) => [...node.querySelectorAll<HTMLElement>('li')])]) {
        if (!element.childNodes.length) {
            element.append(document.createElement('br'));
        }
    }

    let next = document.createRange(),
        last = nodes[nodes.length - 1];

    next.setStart(nodes[0], 0);
    next.setEnd(last, last.childNodes.length);

    return next;
};

const toggle = (editor: HTMLElement, range: Range, mark: Exclude<Mark, 'link'>) => {
    let list = parts(editor, range);

    if (!list.length) {
        return null;
    }

    let on = list.every((part) => active(editor, part.range, mark)),
        markers = list.map((part) => lift(part, selector(mark)));

    if (!on) {
        for (let [start, end] of markers) {
            wrap(start, end, mark);
        }
    }

    return settle(editor, markers);
};


export { active, clear, kind, link, normalize, setBlock, toggle, units };
export type { Kind };
