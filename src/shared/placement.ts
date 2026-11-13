import { fit, viewport } from './viewport';


type Align = 'center' | 'end' | 'start';

type Axis = 'x' | 'y';

// Which way a box covering its anchor grows from it: down or up, and right or left.
type Corner = 'ne' | 'nw' | 'se' | 'sw';

type Covering = {
    anchor: DOMRect;
    // The corner it last grew toward, kept on each axis it still fits along.
    corner?: Corner;
    height: number;
    margin: number;
    width: number;
};

type Expansion = {
    corner: Corner;
    // The room the box has to grow in, so a taller box can be capped to scroll.
    maxHeight: number;
    x: number;
    y: number;
};

type Options = {
    // Along the side: lined up with the anchor's start or end edge, or centered on it.
    align?: Align;
    anchor: DOMRect;
    // Keeps the box on that axis: beside the anchor ('x') or above and below it ('y'); left out, either.
    axis?: Axis;
    // Between the anchor and the box.
    gap?: number;
    height: number;
    // Kept clear between the box and the viewport's edges.
    margin: number;
    // The side it last opened on, kept while the box still fits there; left out, it opens where there's room.
    side?: Side;
    width: number;
};

type Placement = {
    // The room the box has on its side and across it, so a taller or wider box can be capped to scroll.
    maxHeight: number;
    maxWidth: number;
    side: Side;
    x: number;
    y: number;
};

type Side = 'e' | 'n' | 's' | 'w';


// Places a box over 'anchor', growing out of it toward 'corner', the one it last grew toward, on each axis it still fits
// along; otherwise down and right while they fit, else whichever way has more room. Shifted across to stay on screen,
// and capped to the room it has to grow in. Coordinates are the viewport's.
function expand({ anchor, corner, height, margin, width }: Covering): Expansion {
    let view = viewport(),
        down = view.height - margin - anchor.top,
        left = anchor.right - margin,
        right = view.width - margin - anchor.left,
        up = anchor.bottom - margin,
        downward = corner?.[0] === 'n' && up >= height ? false : down >= height || down >= up,
        rightward = corner?.[1] === 'w' && left >= width ? false : right >= width || right >= left,
        room = Math.max(0, downward ? down : up);

    return {
        corner: `${downward ? 's' : 'n'}${rightward ? 'e' : 'w'}` as Corner,
        maxHeight: room,
        x: fit(rightward ? anchor.left : anchor.right - width, width, view.width, margin),
        y: downward ? anchor.top : anchor.bottom - Math.min(height, room)
    };
}

// The viewport margin a surface asks for through '--viewport-margin', in pixels.
function margin(element: Element) {
    return parseFloat(getComputedStyle(element).getPropertyValue('--viewport-margin')) || 0;
}

// Places a box beside 'anchor' on 'side', the one it last opened on, while it still fits there. Otherwise it tries that
// side's opposite and then the other axis, or only 'axis' when given; with no side yet, above or below first. On each
// axis the side with more room goes first. With no side to fit on, it takes whichever of the first pair has more room,
// capped to that room. Across the side it lines up as 'align' asks, shifted to stay on screen. Coordinates are the
// viewport's.
function place({ align = 'center', anchor, axis, gap = 0, height, margin, side: last, width }: Options): Placement {
    let view = viewport(),
        room: Record<Side, number> = {
            e: view.width - anchor.right - gap - margin,
            n: anchor.top - gap - margin,
            s: view.height - anchor.bottom - gap - margin,
            w: anchor.left - gap - margin
        },
        sides: Record<Axis, Side[]> = {
            x: room.e >= room.w ? ['e', 'w'] : ['w', 'e'],
            y: room.s >= room.n ? ['s', 'n'] : ['n', 's']
        },
        first: Axis = axis ?? (last === 'e' || last === 'w' ? 'x' : 'y'),
        order = axis ? sides[axis] : [...sides[first], ...sides[first === 'x' ? 'y' : 'x']];

    if (last && order.includes(last)) {
        order = [last, ...order.filter((side) => side !== last)];
    }

    let fits = (candidate: Side) => room[candidate] >= (candidate === 'n' || candidate === 's' ? height : width),
        side = order.find(fits) ?? (room[order[1]] > room[order[0]] ? order[1] : order[0]),
        space = Math.max(0, room[side]);

    if (side === 'n' || side === 's') {
        let h = Math.min(height, space),
            start = align === 'start'
                ? anchor.left
                : align === 'end'
                    ? anchor.right - width
                    : anchor.left + anchor.width / 2 - width / 2;

        return {
            maxHeight: space,
            maxWidth: Math.max(0, view.width - margin * 2),
            side,
            x: fit(start, width, view.width, margin),
            y: side === 'n' ? anchor.top - gap - h : anchor.bottom + gap
        };
    }

    let w = Math.min(width, space),
        start = align === 'start'
            ? anchor.top
            : align === 'end'
                ? anchor.bottom - height
                : anchor.top + anchor.height / 2 - height / 2;

    return {
        maxHeight: Math.max(0, view.height - margin * 2),
        maxWidth: space,
        side,
        x: side === 'w' ? anchor.left - gap - w : anchor.right + gap,
        y: fit(start, height, view.height, margin)
    };
}


export { expand, margin, place };
export type { Align, Axis, Corner, Expansion, Placement, Side };
