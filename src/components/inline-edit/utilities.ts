const PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);


function closest(node: Node, tag: string, root: HTMLElement) {
    let element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement,
        found = element?.closest(tag);

    return found && found !== root && root.contains(found) ? found : null;
}

function safe(href: string) {
    try {
        return PROTOCOLS.has(new URL(href, location.href).protocol);
    }
    catch {
        return false;
    }
}

function same(a: Range | null, b: Range) {
    return !!a
        && a.startContainer === b.startContainer
        && a.startOffset === b.startOffset
        && a.endContainer === b.endContainer
        && a.endOffset === b.endOffset;
}

function select(range: Range) {
    let selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);
}

function unwrap(element: Element) {
    let parent = element.parentNode;

    if (!parent) {
        return;
    }

    while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
}


export { closest, safe, same, select, unwrap };
