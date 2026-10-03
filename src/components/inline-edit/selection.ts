import type { Pos, Selection, Span } from './model';


const NON_BREAKING_SPACES = / /g;


// Every block the editor renders carries it; their order is the document's.
const BLOCK = '[data-block]';


function count(block: HTMLElement) {
    let n = 0;

    for (let leaf of leaves(block)) {
        n += leaf.nodeType === Node.TEXT_NODE ? (leaf as Text).length : 1;
    }

    return n;
}

// Its text and line breaks, which is what a position counts: not the checklist box (an island the caret never
// enters), and not the filler break that gives an empty or newline-ended block its last line.
function leaves(block: HTMLElement) {
    let out: Node[] = [],
        walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return NodeFilter.FILTER_ACCEPT;
                }

                let element = node as Element;

                if (element.getAttribute('contenteditable') === 'false') {
                    return NodeFilter.FILTER_REJECT;
                }

                return element.tagName === 'BR' && !element.hasAttribute('data-filler') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        out.push(node);
    }

    return out;
}

// A DOM boundary as a position: inside a block it counts what comes before it there; between blocks it is the start
// of the next one, or the end of the last.
function locate(editor: HTMLElement, node: Node, at: number): Pos | null {
    if (!editor.contains(node)) {
        return null;
    }

    let list = elements(editor),
        element = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest<HTMLElement>(BLOCK);

    if (element && editor.contains(element)) {
        return { block: list.indexOf(element), offset: offset(element, node, at) };
    }

    let boundary = document.createRange();

    boundary.setStart(node, at);

    for (let i = 0, n = list.length; i < n; i++) {
        if (boundary.comparePoint(list[i], 0) >= 0) {
            return { block: i, offset: 0 };
        }
    }

    let last = list.length - 1;

    return last < 0 ? null : { block: last, offset: count(list[last]) };
}

function offset(block: HTMLElement, node: Node, at: number) {
    let boundary = document.createRange(),
        n = 0;

    boundary.setStart(node, at);

    for (let leaf of leaves(block)) {
        if (leaf === node) {
            return n + at;
        }

        if (boundary.comparePoint(leaf, 0) >= 0) {
            break;
        }

        n += leaf.nodeType === Node.TEXT_NODE ? (leaf as Text).length : 1;
    }

    return n;
}

// A position as a DOM boundary. At the edge of two pieces of text it stays in the first, so typing there follows the
// text before the caret.
function point(block: HTMLElement, target: number): [Node, number] {
    let n = 0;

    for (let leaf of leaves(block)) {
        if (leaf.nodeType === Node.TEXT_NODE) {
            let size = (leaf as Text).length;

            if (target <= n + size) {
                return [leaf, target - n];
            }

            n += size;
        }
        else {
            if (target === n) {
                return [leaf.parentNode!, [...leaf.parentNode!.childNodes].indexOf(leaf as ChildNode)];
            }

            n += 1;
        }
    }

    let filler = block.querySelector('br[data-filler]');

    if (filler) {
        return [filler.parentNode!, [...filler.parentNode!.childNodes].indexOf(filler)];
    }

    return [block, block.childNodes.length];
}


// The model's selection from the document's, when it is in the editor.
const capture = (editor: HTMLElement): Selection | null => {
    let selection = window.getSelection();

    if (!selection || !selection.rangeCount || !selection.anchorNode || !selection.focusNode) {
        return null;
    }

    let anchor = locate(editor, selection.anchorNode, selection.anchorOffset),
        focus = locate(editor, selection.focusNode, selection.focusOffset);

    return anchor && focus ? { anchor, focus } : null;
};

const elements = (editor: HTMLElement) => [...editor.querySelectorAll<HTMLElement>(BLOCK)];

// The document's selection from the model's.
const restore = (editor: HTMLElement, { anchor, focus }: Selection) => {
    let list = elements(editor),
        from = list[anchor.block],
        to = list[focus.block],
        selection = window.getSelection();

    if (!from || !to || !selection) {
        return;
    }

    let [anchorNode, anchorOffset] = point(from, anchor.offset),
        [focusNode, focusOffset] = point(to, focus.offset);

    selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
};

// A range the browser reports (what an input will replace) as a span.
const target = (editor: HTMLElement, range: AbstractRange): Span | null => {
    let start = locate(editor, range.startContainer, range.startOffset),
        end = locate(editor, range.endContainer, range.endOffset);

    return start && end ? { end, start } : null;
};

// The block's text as the DOM holds it, for reading back what an input method wrote.
const written = (block: HTMLElement) => {
    let out = '';

    for (let leaf of leaves(block)) {
        out += leaf.nodeType === Node.TEXT_NODE ? (leaf as Text).data : '\n';
    }

    return out.replace(NON_BREAKING_SPACES, ' ');
};



export { capture, elements, restore, target, written };
