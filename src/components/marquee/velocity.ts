type Tracker = {
    // Smoothed velocity mapped to a speed boost: signed, capped at MAX_FACTOR.
    factor: number;
    // Last raw scroll sample.
    position: number;
    release: VoidFunction;
    // Spring state: the smoothed velocity and its rate of change.
    smooth: number;
    smoothRate: number;
    // Frame the spring last advanced on, so marquees sharing a tracker step it once.
    stepped: number;
    time: number;
    users: number;
    // Raw velocity in px/s from the last two scroll events.
    velocity: number;
};


// Spring that smooths raw scroll velocity, so the marquee eases into and out of a burst instead of jumping.
const DAMPING = 50;

const MAX_FACTOR = 5;

// Scroll events stop arriving when scrolling stops, so a quiet gap this long means the velocity is zero.
const SETTLE = 50;

const STIFFNESS = 400;

// Sub-step for the spring; a stiff spring stepped once per slow frame would overshoot and blow up.
const SUBSTEP = 1 / 240;


// Every marquee on one scroller shares a tracker, so they stay in step however many there are.
let trackers = new Map<EventTarget, Tracker>();


function offset(scroller: EventTarget) {
    return scroller instanceof Element ? scroller.scrollTop : window.scrollY;
}

// The nearest ancestor that scrolls vertically, else the window.
function scroller(element: HTMLElement): EventTarget {
    let node = element.parentElement;

    while (node && node !== document.body && node !== document.documentElement) {
        let overflow = getComputedStyle(node).overflowY;

        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
            return node;
        }

        node = node.parentElement;
    }

    // Pages that scroll the body instead of the root report scroll position through the body.
    let overflow = getComputedStyle(document.body).overflowY;

    if (overflow === 'auto' || overflow === 'scroll') {
        return document.body;
    }

    return window;
}


const step = (t: Tracker, now: number, dt: number) => {
    if (t.stepped === now) {
        return;
    }

    let target = now - t.time > SETTLE ? 0 : t.velocity;

    t.stepped = now;

    for (let remaining = dt; remaining > 0; remaining -= SUBSTEP) {
        let h = Math.min(remaining, SUBSTEP);

        t.smoothRate += (STIFFNESS * (target - t.smooth) - DAMPING * t.smoothRate) * h;
        t.smooth += t.smoothRate * h;
    }

    t.factor = Math.sign(t.smooth) * Math.min(MAX_FACTOR, (Math.abs(t.smooth) / 1000) * MAX_FACTOR);
};

const track = (element: HTMLElement) => {
    let target = scroller(element),
        existing = trackers.get(target);

    if (existing) {
        existing.users++;
        return existing;
    }

    let t: Tracker = {
            factor: 0,
            position: offset(target),
            release: () => {
                if (--t.users > 0) {
                    return;
                }

                target.removeEventListener('scroll', scroll);
                trackers.delete(target);
            },
            smooth: 0,
            smoothRate: 0,
            stepped: 0,
            time: 0,
            users: 1,
            velocity: 0
        };

    function scroll() {
        let now = performance.now(),
            position = offset(target),
            dt = now - t.time;

        // A first event after a long pause has no meaningful interval, so it only records the position.
        t.velocity = dt > 0 && dt < 200 ? ((position - t.position) / dt) * 1000 : 0;
        t.position = position;
        t.time = now;
    }

    target.addEventListener('scroll', scroll, { passive: true });
    trackers.set(target, t);

    return t;
};


export { MAX_FACTOR, step, track };
export type { Tracker };
