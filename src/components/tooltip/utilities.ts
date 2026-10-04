import { html, render } from '@esportsplus/template';


// Milliseconds the pointer rests on a trigger before it opens, and is away before it closes; either left out is instant.
type Delay = {
    close?: number,
    open?: number
};


// Referenced by '.tooltip.tooltip--morphing' in CSS; a missing reference is ignored until this exists.
const GOO = 'tooltip-morph-goo';

// Just after a delayed tooltip closes, the next one skips its delay: the reader is browsing, not passing through.
const WARM_FOR = 500;


// Shared by every delayed tooltip, so the handoff works across separate triggers, groups and shared tooltips.
let closedAt = 0;


// Called when a delayed tooltip closes while open; starts the window 'warm()' reads.
function cool() {
    closedAt = Date.now();
}

function content(element: HTMLElement) {
    let candidates = element.querySelectorAll<HTMLElement>('.tooltip-content, .tooltip-message');

    for (let i = 0, n = candidates.length; i < n; i++) {
        if (candidates[i].closest('.tooltip') === element) {
            return candidates[i];
        }
    }
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

    render(document.body, html`
        <svg aria-hidden='true' height='0' style='position: absolute;' width='0'>
            <filter color-interpolation-filters='sRGB' filterUnits='userSpaceOnUse' height='4000' id='${GOO}' width='4000' x='-2000' y='-2000'>
                <feGaussianBlur in='SourceGraphic' result='blur' stdDeviation='8' />
                <feColorMatrix in='blur' result='goo' type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12' />
                <feComposite in='SourceGraphic' in2='goo' operator='over' />
            </filter>
        </svg>
    `);
}

// Seeds expanding menus and '--morph' tooltips with the trigger's box, then calls 'open' once
// that start shape has been painted; the returned function cancels a pending open.
function morph(element: HTMLElement, open: VoidFunction, tooltip = content(element), anchor = element) {
    if (!tooltip?.matches('.tooltip-menu-panel--expand, .tooltip-content--morph, .tooltip-message--morph')) {
        open();
        return;
    }

    // Expanding menus overlap the trigger, so only morph tooltips need the goo bridge.
    if (tooltip.matches('.tooltip-content--morph, .tooltip-message--morph')) {
        goo();
    }

    let box = tooltip.getBoundingClientRect(),
        rect = anchor.getBoundingClientRect(),
        scale = box.width / tooltip.offsetWidth || 1,
        style = tooltip.style;

    // Jump straight to the new start shape instead of transitioning into it. The insets place
    // the clip over the trigger; negative values reach outside the tooltip's own box.
    style.transition = 'none';
    style.setProperty('--morph-bottom', `${(box.bottom - rect.bottom) / scale}px`);
    style.setProperty('--morph-left', `${(rect.left - box.left) / scale}px`);
    style.setProperty('--morph-radius', getComputedStyle(anchor).borderTopLeftRadius);
    style.setProperty('--morph-right', `${(box.right - rect.right) / scale}px`);
    style.setProperty('--morph-top', `${(rect.top - box.top) / scale}px`);

    // Apply the start shape now, while transitions are off; otherwise it is first styled
    // after they're restored and animates into the start shape instead of out of it.
    tooltip.getBoundingClientRect();

    // Open on the next frame, restoring transitions in the same step: the flush above committed
    // the start shape, so the open transitions out of it with only one frame of latency.
    let frame = requestAnimationFrame(() => {
        style.removeProperty('transition');
        open();
    });

    return () => {
        cancelAnimationFrame(frame);
        style.removeProperty('transition');
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

        if (
            tooltip.closest('.tooltip') !== element ||
            !(tooltip.classList.contains('tooltip-content--morph') || tooltip.classList.contains('tooltip-message--morph'))
        ) {
            return;
        }

        if ('propertyName' in e ? e.propertyName === 'clip-path' : e.animationName === 'tooltip-morph-close') {
            state.morphing = active;
        }
    };
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


export { content, cool, morph, morphing, wait, warm };
export type { Delay };
