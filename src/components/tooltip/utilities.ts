import { flush, reactive, root } from '@esportsplus/reactivity';
import { html, render, setProperties, type Element as Bound } from '@esportsplus/template';
import { expand, margin, place, type Axis, type Corner, type Side } from '~/shared/placement';
import { viewport } from '~/shared/viewport';


// Milliseconds the pointer rests on a trigger before it opens, and is away before it closes; either left out is instant.
type Delay = {
    close?: number,
    open?: number
};

// Where 'position()' put in-flow content, in its trigger's box: its corner, the width it measured at, the room it has,
// and the point it scales from. 'side' (it travels in from there) and an expanding one's 'corner' are where it last
// opened, which it keeps while it still fits.
type Placed = {
    corner: Corner | undefined;
    maxHeight: number | undefined;
    maxWidth: number | undefined;
    origin: string | undefined;
    placed: boolean;
    // Transitions are off while it moves, so it never slides between places.
    placing: boolean;
    side: Side | undefined;
    width: number | undefined;
    x: number;
    y: number;
};

// The shape a morph grows out of and closes onto, as insets on the tooltip's own box, and whether its transitions are
// off while that shape is put in place.
type Shape = {
    bottom: string | undefined;
    instant: boolean;
    left: string | undefined;
    radius: string | undefined;
    right: string | undefined;
    top: string | undefined;
};


// Surfaces that cover their trigger and grow out of it.
const EXPANDING = '.tooltip-content--expand, .tooltip-menu-panel--expand, .tooltip-message--expand';

// Referenced by '.tooltip.tooltip--morphing' in CSS; a missing reference is ignored until this exists.
const GOO = 'tooltip-morph-goo';

const MORPH_STATE = Symbol('tooltip.morph');

const PLACED_STATE = Symbol('tooltip.placed');

const TRAVEL: Record<Side, [number, number]> = { e: [1, 0], n: [0, -1], s: [0, 1], w: [-1, 0] };

// Just after a delayed tooltip closes, the next one skips its delay: the reader is browsing, not passing through.
const WARM_FOR = 500;


// Shared by every delayed tooltip, so the handoff works across separate triggers, groups and shared tooltips.
let closedAt = 0;


function content(element: HTMLElement) {
    let candidates = element.querySelectorAll<HTMLElement>('.tooltip-content, .tooltip-message');

    for (let i = 0, n = candidates.length; i < n; i++) {
        if (candidates[i].closest('.tooltip') === element) {
            return candidates[i];
        }
    }
}

// Called when a delayed tooltip closes while open; starts the window 'warm()' reads.
function cool() {
    closedAt = Date.now();
}

// Blur then threshold the alpha so nearby shapes melt into one blob (the neck between trigger
// and tooltip), then lay the original 'over' it: the union keeps the trigger's own border-radius
// and only adds goo where the originals don't reach ('atop' would reshape them to the goo's
// rounder outline). The threshold's midpoint is alpha 0.5 so straight goo edges sit on the
// originals instead of just outside them. The region is fixed and oversized because the
// default one is the trigger's box, which would crop the tooltip.
function goo() {
    if (document.getElementById(GOO)) {
        return;
    }

    render(document.body, () => html`
        <svg aria-hidden='true' height='0' style='position: absolute;' width='0'>
            <filter color-interpolation-filters='sRGB' filterUnits='userSpaceOnUse' height='4000' id='${GOO}' width='4000' x='-2000' y='-2000'>
                <feGaussianBlur in='SourceGraphic' result='blur' stdDeviation='8' />
                <feColorMatrix in='blur' result='goo' type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12' />
                <feComposite in='SourceGraphic' in2='goo' operator='over' />
            </filter>
        </svg>
    `);
}

// Seeds expanding surfaces and '--morph' tooltips with the trigger's box, then calls 'open' once
// that start shape has been painted; the returned function cancels a pending open.
function morph(element: HTMLElement, open: VoidFunction, tooltip = content(element), anchor = element) {
    if (!tooltip?.matches(`${EXPANDING}, .tooltip-content--morph, .tooltip-message--morph`)) {
        open();
        return;
    }

    // Expanding surfaces overlap the trigger, so only morph tooltips need the goo bridge.
    if (tooltip.matches('.tooltip-content--morph, .tooltip-message--morph')) {
        goo();
    }

    let box = tooltip.getBoundingClientRect(),
        cancelled = false,
        frame = 0,
        rect = anchor.getBoundingClientRect(),
        scale = box.width / tooltip.offsetWidth || 1,
        state = shape(tooltip);

    // Jump straight to the new start shape instead of transitioning into it. The insets place
    // the clip over the trigger; negative values reach outside the tooltip's own box.
    state.bottom = `${(box.bottom - rect.bottom) / scale}px`;
    state.instant = true;
    state.left = `${(rect.left - box.left) / scale}px`;
    state.radius = getComputedStyle(anchor).borderTopLeftRadius;
    state.right = `${(box.right - rect.right) / scale}px`;
    state.top = `${(rect.top - box.top) / scale}px`;

    // Apply the start shape once it has landed, while transitions are off; otherwise it is first styled
    // after they're restored and animates into the start shape instead of out of it. Read a microtask on,
    // after the pass that writes it, whether or not one is already running.
    queueMicrotask(() => {
        if (cancelled) {
            return;
        }

        tooltip.getBoundingClientRect();

        // Open on the next frame, restoring transitions in the same step: the read above committed
        // the start shape, so the open transitions out of it with only one frame of latency.
        frame = requestAnimationFrame(() => {
            state.instant = false;
            open();
        });
    });

    return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        state.instant = false;
    };
}

// Trigger event handler for bubbled transition/animation events. The goo filter reshapes
// everything it touches, so it's only on while the shape is moving; at rest the trigger and
// tooltip keep their exact edges. Opening is a clip-path transition, closing the
// 'tooltip-morph-close' animation. 'state.morphing' is bound to the trigger's 'tooltip--morphing' class.
function morphing(state: { morphing: boolean }, active: boolean) {
    return (e: AnimationEvent | TransitionEvent) => {
        let element = e.currentTarget as HTMLElement,
            tooltip = e.target as HTMLElement;

        if (tooltip.closest('.tooltip') !== element || !tooltip.matches('.tooltip-content--morph, .tooltip-message--morph')) {
            return;
        }

        if ('propertyName' in e ? e.propertyName === 'clip-path' : e.animationName === 'tooltip-morph-close') {
            state.morphing = active;
        }
    };
}

// Every 'morphing' handler a trigger spreads: starts turn the goo on, ends and cancels turn it off.
function morphs(state: { morphing: boolean }) {
    let start = morphing(state, true),
        stop = morphing(state, false);

    return {
        onanimationcancel: stop,
        onanimationend: stop,
        onanimationstart: start,
        ontransitioncancel: stop,
        ontransitionend: stop,
        ontransitionrun: start
    };
}

// Bound to the content's class and style once, the first time 'position()' places it.
function placed(tooltip: HTMLElement) {
    let store = tooltip as HTMLElement & { [PLACED_STATE]?: Placed };

    return store[PLACED_STATE] ??= root(() => {
        let state: Placed = reactive({
                corner: undefined as Corner | undefined,
                maxHeight: undefined as number | undefined,
                maxWidth: undefined as number | undefined,
                origin: undefined as string | undefined,
                placed: false,
                placing: false,
                side: undefined as Side | undefined,
                width: undefined as number | undefined,
                x: 0,
                y: 0
            });

        setProperties(tooltip as Bound, {
            class: () => state.placed && '--placed',
            style: () => state.placed && {
                '--place-max-height': px(state.maxHeight),
                '--place-max-width': px(state.maxWidth),
                '--place-origin': state.origin,
                '--place-travel-x': state.side ? TRAVEL[state.side][0] : 0,
                '--place-travel-y': state.side ? TRAVEL[state.side][1] : 0,
                '--place-width': px(state.width),
                '--place-x': `${state.x}px`,
                '--place-y': `${state.y}px`,
                transition: state.placing ? 'none' : undefined
            }
        });

        return state;
    });
}

// Places in-flow content beside its trigger on the side it last opened on while it still fits there, else where there's
// room; '--expand' content covers the trigger instead, growing out of it toward the corner it last grew toward, or one
// with room. Either way it is capped to the room it has and kept off the viewport's edges. Measured at its natural
// width at the trigger's corner, which it then keeps wherever it lands; nothing paints in between. 'axis' keeps it beside
// the trigger ('x') or above and below it ('y').
function position(element: HTMLElement, axis?: Axis, tooltip = content(element)) {
    if (!tooltip) {
        return;
    }

    let state = placed(tooltip);

    state.maxHeight = undefined;
    state.maxWidth = undefined;
    state.placed = true;
    state.placing = true;
    state.width = undefined;
    state.x = 0;
    state.y = 0;
    flush();

    let anchor = element.getBoundingClientRect(),
        // A transformed ancestor (a dialog scaling open) skews client rects; scale back to layout pixels.
        scale = anchor.width / element.offsetWidth || 1,
        height = tooltip.offsetHeight * scale,
        space = margin(tooltip),
        width = tooltip.offsetWidth;

    if (tooltip.matches(EXPANDING)) {
        let grown = expand({ anchor, corner: state.corner, height, margin: space, width: width * scale });

        state.corner = grown.corner;
        state.maxHeight = grown.maxHeight / scale;
        state.maxWidth = (viewport().width - space * 2) / scale;
        // Grows from the trigger's corner it covers.
        state.origin = `${grown.corner[1] === 'e' ? 'left' : 'right'} ${grown.corner[0] === 's' ? 'top' : 'bottom'}`;
        state.x = (grown.x - anchor.left) / scale - element.clientLeft;
        state.y = (grown.y - anchor.top) / scale - element.clientTop;
    }
    else {
        let { maxHeight, maxWidth, side, x, y } = place({
                anchor,
                axis,
                gap: (parseFloat(getComputedStyle(tooltip).getPropertyValue('--spacer')) || 0) * scale,
                height,
                margin: space,
                side: state.side,
                width: width * scale
            });

        x = (x - anchor.left) / scale - element.clientLeft;
        y = (y - anchor.top) / scale - element.clientTop;

        state.maxHeight = maxHeight / scale;
        state.maxWidth = maxWidth / scale;
        // Scales out of the trigger itself, even when the content is pushed sideways.
        state.origin = side === 'n' || side === 's'
            ? `${(anchor.width / 2) / scale - element.clientLeft - x}px ${side === 'n' ? '100%' : '0%'}`
            : `${side === 'e' ? '0%' : '100%'} ${(anchor.height / 2) / scale - element.clientTop - y}px`;
        state.side = side;
        state.x = x;
        state.y = y;
    }

    state.width = width;
    flush();

    // The closed state at its new place commits with transitions off, so the open travels out from the trigger rather
    // than sliding over from wherever the content last rested.
    tooltip.getBoundingClientRect();
    state.placing = false;
    flush();
}

function px(value: number | undefined) {
    return value === undefined ? undefined : `${value}px`;
}

// The tooltip's morph shape, bound to its style once, the first time anything shapes it; 'morph()' seeds it and a
// closing owner may move it.
function shape(tooltip: HTMLElement) {
    let store = tooltip as HTMLElement & { [MORPH_STATE]?: Shape };

    return store[MORPH_STATE] ??= root(() => {
        let state: Shape = reactive({
                bottom: undefined as string | undefined,
                instant: false,
                left: undefined as string | undefined,
                radius: undefined as string | undefined,
                right: undefined as string | undefined,
                top: undefined as string | undefined
            });

        setProperties(tooltip as Bound, {
            style: () => ({
                '--morph-bottom': state.bottom,
                '--morph-left': state.left,
                '--morph-radius': state.radius,
                '--morph-right': state.right,
                '--morph-top': state.top,
                transition: state.instant ? 'none' : undefined
            })
        });

        return state;
    });
}

// Runs 'open' after 'delay', or at once when there is none or while warm; returns a cancel for a pending open.
function wait(delay: number, open: VoidFunction) {
    if (!delay || warm()) {
        open();
        return;
    }

    let timer = setTimeout(open, delay);

    return () => clearTimeout(timer);
}

function warm() {
    return Date.now() - closedAt < WARM_FOR;
}


export { content, cool, morph, morphs, position, px, shape, wait, warm };
export type { Delay };
