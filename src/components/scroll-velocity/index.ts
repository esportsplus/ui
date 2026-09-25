import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type Row = Attributes & {
    // Called once per copy since a node can only be mounted in one place.
    content: string | (() => Renderable<unknown>);
    direction?: 1 | -1;
    // Scrolling speeds the row up and flips it with the scroll direction; off keeps a steady drift.
    reactivity?: boolean;
    // Percent of one copy's width travelled per second.
    velocity?: number;
};

type Tracker = {
    // Smoothed velocity mapped to a speed boost: signed, capped at MAX_FACTOR.
    factor: number;
    // Last raw scroll sample.
    position: number;
    release: VoidFunction;
    // Spring state: the smoothed velocity and its rate of change.
    smooth: number;
    smoothRate: number;
    // Frame the spring last advanced on, so rows sharing a tracker step it once.
    stepped: number;
    time: number;
    users: number;
    // Raw velocity in px/s from the last two scroll events.
    velocity: number;
};


// Spring that smooths raw scroll velocity, so the rows ease into and out of a burst instead of jumping.
const DAMPING = 50;

const MAX_FACTOR = 5;

const MIN_COPIES = 3;

// Scroll events stop arriving when scrolling stops, so a quiet gap this long means the velocity is zero.
const SETTLE = 50;

const STIFFNESS = 400;

// Sub-step for the spring; a stiff spring stepped once per slow frame would overshoot and blow up.
const SUBSTEP = 1 / 240;


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

function step(t: Tracker, now: number, dt: number) {
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
}

// Every row on one scroller shares a tracker, so rows stay in step however many there are.
function track(target: EventTarget) {
    let existing = trackers.get(target);

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
}

function wrap(max: number, value: number) {
    return ((value % max) + max) % max;
}


function row({ content, direction = 1, reactivity = true, velocity = 5, ...attributes }: Row) {
    let base = direction >= 0 ? 1 : -1,
        copies = reactive([0]),
        current = base,
        frame = 0,
        intersection: IntersectionObserver | undefined,
        media: MediaQueryList | undefined,
        resize: ResizeObserver | undefined,
        tracker: Tracker | undefined,
        visible = true,
        width = 0,
        x = 0;

    function render() {
        return typeof content === 'function' ? content() : content;
    }

    return html`
        <div
            class='scroll-velocity-row'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    let strip = element.firstElementChild as HTMLElement,
                        time = performance.now();

                    media = matchMedia('(prefers-reduced-motion: reduce)');
                    tracker = track(scroller(element));

                    function measure() {
                        let block = strip.firstElementChild as HTMLElement | null;

                        width = block ? block.getBoundingClientRect().width : 0;

                        let next = width > 0 ? Math.max(MIN_COPIES, Math.ceil(element.offsetWidth / width) + 2) : 1;

                        while (copies.length < next) {
                            copies.push(copies.length);
                        }

                        if (copies.length > next) {
                            copies.splice(next);
                        }
                    }

                    function tick(now: number) {
                        let dt = Math.min(0.1, (now - time) / 1000);

                        time = now;
                        frame = requestAnimationFrame(tick);

                        if (!visible || document.hidden || media!.matches || width <= 0 || !tracker) {
                            return;
                        }

                        let factor = 0;

                        if (reactivity) {
                            step(tracker, now, dt);
                            factor = tracker.factor;
                        }

                        let magnitude = Math.min(MAX_FACTOR, Math.abs(factor));

                        if (magnitude > 0.1) {
                            current = base * (factor >= 0 ? 1 : -1);
                        }

                        x += current * ((width * velocity) / 100) * (1 + magnitude) * dt;
                        strip.style.transform = `translate3d(${-wrap(width, x)}px, 0, 0)`;
                    }

                    intersection = new IntersectionObserver((entries) => {
                        visible = entries[entries.length - 1].isIntersecting;
                    });
                    resize = new ResizeObserver(measure);

                    intersection.observe(element);
                    resize.observe(element);

                    // The first copy is never removed, so its size (fonts loading, content changing) drives the loop.
                    if (strip.firstElementChild) {
                        resize.observe(strip.firstElementChild);
                    }

                    measure();
                    frame = requestAnimationFrame(tick);
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);

                    intersection?.disconnect();
                    resize?.disconnect();
                    tracker?.release();
                    tracker = undefined;
                }
            }}
        >
            <div class='scroll-velocity-strip'>
                ${html.reactive(copies, (copy) => html`
                    <div aria-hidden='${copy !== 0 && 'true'}' class='scroll-velocity-block'>${render()}</div>
                `)}
            </div>
        </div>
    `;
}


export default Object.assign(
    component<Attributes>(
        function(this, attributes, content) {
            return html`
                <div class='scroll-velocity' ${this?.attributes} ${attributes}>
                    ${content}
                </div>
            `;
        }
    ),
    { row }
);
