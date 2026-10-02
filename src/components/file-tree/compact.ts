import { html, type Attributes, type Renderable } from '@esportsplus/template';
import type { FileTreeElement as Element } from '.';


type Node<T> = {
    element: Element;
    // On a folder folded into a compact row: that row.
    host?: T;
    id: string;
    parent: T | null;
    // On a compact row: the folders above its own that it shows, outermost first.
    segments?: T[];
};

type Segment<T> = HTMLElement & { [SEGMENT]: T };


const SEGMENT = Symbol();


// Every folder above 'row', outermost first, the segments before it in its compact row included.
function ancestors<T extends Node<T>>(row: T) {
    let out = lineage(row).slice(0, -1);

    for (let node = (row.host ?? row).parent; node; node = node.parent) {
        out.unshift(...lineage(node));
    }

    return out;
}

function caption<T extends Node<T>>(row: T) {
    return row.segments ? lineage(row).map((node) => node.element.name).join('/') : row.element.name;
}

// Whether 'test' holds for the row's folder or any folded into it.
function holds<T extends Node<T>>(row: T, test: (id: string) => boolean) {
    return test(row.id) || !!row.segments?.some((node) => test(node.id));
}

// The folders a row stands for down to 'row', outermost first: a compact row's segments, then its own.
function lineage<T extends Node<T>>(row: T) {
    let host = row.host ?? row,
        out = host.segments ? [...host.segments, host] : [host];

    return out.slice(0, out.indexOf(row) + 1);
}

function same<T extends Node<T>>(a: T[] | undefined, b: T[] | undefined) {
    if (!a || !b) {
        return a === b;
    }

    return a.length === b.length && a.every((node, i) => node.element === b[i].element);
}

// The one folder 'element' shares its row with, as 'src' does in 'src/components': its only child shown, when that's
// a folder too. Neither may be locked, since a locked folder never opens, and a folder whose children aren't known
// yet, like a lazy one still to load, ends the chain.
function sole(element: Element, hidden: Set<string>, folder: (element: Element) => boolean) {
    let children = element.children,
        only: Element | null = null;

    if (!children || element.selectable === false) {
        return null;
    }

    for (let i = 0, n = children.length; i < n; i++) {
        if (hidden.has(children[i].id)) {
            continue;
        }

        if (only) {
            return null;
        }

        only = children[i];
    }

    return only && folder(only) && only.selectable !== false ? only : null;
}


// A compact row's name, 'src/components/ui', one segment per folder, each hovered, pressed and dropped on alone;
// 'name' renders a segment's name, as with the characters a search matched marked.
export default <T extends Node<T>>(row: T, part: (node: T) => Attributes[], name: (node: T) => Renderable<unknown>) => html`
    <span class='file-tree-name'>
        ${lineage(row).map((node, i) => html`${i ? html`<span aria-hidden='true' class='file-tree-separator'>/</span>` : ''}<span class='file-tree-segment' ${part(node)} ${{ onconnect: (element: Segment<T>) => { element[SEGMENT] = node; } }}>${name(node)}</span>`)}
    </span>
`;

export { ancestors, caption, holds, lineage, same, SEGMENT, sole };
export type { Segment };
