const ALLOWED = new Set(['A', 'BR', 'EM', 'MARK', 'P', 'STRONG']);

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

// Saved values are rendered back as HTML, so only the formatting the toolbar can produce survives.
function sanitize(root: Node) {
    let nodes = [...root.childNodes];

    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        if (node.nodeType === Node.TEXT_NODE) {
            continue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            node.parentNode?.removeChild(node);
            continue;
        }

        let element = node as Element;

        sanitize(element);

        if (!ALLOWED.has(element.tagName)) {
            unwrap(element);
            continue;
        }

        let href = element.tagName === 'A' ? element.getAttribute('href') : null;

        for (let attributes = [...element.attributes], j = 0, m = attributes.length; j < m; j++) {
            element.removeAttribute(attributes[j].name);
        }

        if (href && safe(href)) {
            element.setAttribute('href', href);
        }
    }

    return root;
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


export { closest, same, sanitize, select, unwrap };
