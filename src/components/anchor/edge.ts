// The anchor placements ('n' top center, 'ne' top right, ...) an element can be pinned by, as the signs of the edges
// each touches. Their stylesheet half is 'anchor/scss'.


type Edge = {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
};


const EDGES: Record<string, Edge> = {
    e: { x: 1, y: 0 },
    n: { x: 0, y: -1 },
    ne: { x: 1, y: -1 },
    nw: { x: -1, y: -1 },
    s: { x: 0, y: 1 },
    se: { x: 1, y: 1 },
    sw: { x: -1, y: 1 },
    w: { x: -1, y: 0 }
};


// The placement modifier ('<block>--n', '<block>--ne', ...) the element carries; undefined when it carries none.
const edge = (element: Element, block: string): Edge | undefined => {
    for (let key in EDGES) {
        if (element.classList.contains(`${block}--${key}`)) {
            return EDGES[key];
        }
    }
};


export { edge };
export type { Edge };
