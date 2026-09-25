import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    // How far through (0 to 1) before the button offers itself.
    showAfter?: number;
    state?: State;
    // The element that scrolls; the page itself when omitted.
    target?: HTMLElement | (() => HTMLElement | null | undefined);
};

type State = {
    // Changing this number sends the reader to the top, as a click would.
    jump: number;
    visible: boolean;
};


const ARRIVE: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

// A gentle start that keeps moving to the end, like something taking off.
const LIFT: KeyframeAnimationOptions = { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' };

const TRIP = { x1: 0.65, x2: 0.35, y1: 0, y2: 1 };

// Driven here rather than by the browser's smooth scroll, whose speed varies wildly.
const EASE = bezier(TRIP);


// Solves a CSS cubic-bezier for y at time x, the same curve 'cubic-bezier()' would draw.
function bezier({ x1, x2, y1, y2 }: typeof TRIP) {
    let ax = 1 - 3 * x2 + 3 * x1,
        ay = 1 - 3 * y2 + 3 * y1,
        bx = 3 * x2 - 6 * x1,
        by = 3 * y2 - 6 * y1,
        cx = 3 * x1,
        cy = 3 * y1;

    return (x: number) => {
        let high = 1,
            low = 0,
            t = x;

        for (let i = 0; i < 20; i++) {
            let current = ((ax * t + bx) * t + cx) * t;

            if (Math.abs(current - x) < 1e-5) {
                break;
            }

            if (current < x) {
                low = t;
            }
            else {
                high = t;
            }

            t = (low + high) / 2;
        }

        return ((ay * t + by) * t + cy) * t;
    };
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


function template(
    this: { attributes?: Partial<A> } | void,
    { showAfter = 0.12, state = reactive({ jump: 0, visible: false }), target, ...attributes }: A
) {
    let arrow: SVGElement | undefined,
        cleanup: VoidFunction | undefined,
        frame = 0,
        jump = state.jump,
        launched = false,
        lift: Animation | undefined,
        pending: { abort: VoidFunction; source: HTMLElement | Window } | undefined,
        ring: SVGCircleElement | undefined,
        // True while heading up: the button stays to show the ring draining, and bows out only once you've arrived.
        returning = false,
        scroller: HTMLElement | undefined,
        timeline: Animation | undefined,
        trip = 0;

    function go() {
        let from = top();

        launch();
        stop();

        if (reduced()) {
            write(0);
            return;
        }

        let duration = Math.min(900, 450 + from / 4),
            source: HTMLElement | Window = scroller ?? window,
            start = performance.now();

        // Any wheel or touch on the way hands control straight back.
        function abort() {
            stop();
            returning = false;
            land(true);
        }

        // Longer trips take a little longer, never more than 0.9s.
        function step(now: number) {
            let t = Math.min((now - start) / duration, 1);

            write(from * (1 - EASE(t)));

            if (t < 1) {
                trip = requestAnimationFrame(step);
            }
            else {
                stop();
            }
        }

        pending = { abort, source };
        returning = true;
        source.addEventListener('touchstart', abort, { once: true, passive: true });
        source.addEventListener('wheel', abort, { once: true, passive: true });
        trip = requestAnimationFrame(step);
    }

    // The arrow is gone once lifted: it stays away while the page rises and only returns if the trip is cut short.
    function land(animate: boolean) {
        if (!launched || !arrow) {
            return;
        }

        launched = false;
        lift?.cancel();
        lift = undefined;

        if (animate && !reduced()) {
            arrow.animate([
                { filter: 'blur(2px)', opacity: 0, transform: 'translateY(10px)' },
                { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0px)' }
            ], ARRIVE);
        }
    }

    function launch() {
        if (launched || !arrow) {
            return;
        }

        launched = true;
        lift = arrow.animate([
            { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0px)' },
            { filter: 'blur(2px)', opacity: 0, transform: 'translateY(-20px)' }
        ], reduced() ? { ...LIFT, duration: 0 } : LIFT);
    }

    function onscroll() {
        if (!frame) {
            frame = requestAnimationFrame(read);
        }
    }

    // One style write per frame at most; only crossing the threshold touches reactive state.
    function read() {
        frame = 0;

        let room = scroller
                ? scroller.scrollHeight - scroller.clientHeight
                : document.documentElement.scrollHeight - innerHeight,
            p = room > 0 ? Math.min(1, Math.max(0, top() / room)) : 0;

        if (!timeline) {
            ring?.style.setProperty('stroke-dashoffset', String(1 - p));
        }

        if (returning) {
            if (p > 0) {
                return;
            }

            returning = false;
        }

        state.visible = p > showAfter;

        // Hidden again: the next time it shows, it brings its arrow.
        if (p <= showAfter) {
            land(false);
        }
    }

    function stop() {
        cancelAnimationFrame(trip);
        trip = 0;

        if (!pending) {
            return;
        }

        pending.source.removeEventListener('touchstart', pending.abort);
        pending.source.removeEventListener('wheel', pending.abort);
        pending = undefined;
    }

    function top() {
        return scroller ? scroller.scrollTop : scrollY;
    }

    function write(value: number) {
        // Instant, so a 'scroll-behavior: smooth' on the scroller can't turn every frame's write into its own animation.
        (scroller ?? window).scrollTo({ behavior: 'instant', top: value });
    }

    onCleanup(effect(() => {
        if (state.jump === jump) {
            return;
        }

        jump = state.jump;
        go();
    }));

    return html`
        <button
            aria-label='Back to top'
            class='back-to-top ${() => state.visible && '--active'}'
            type='button'
            ${this?.attributes}
            ${attributes}
            ${{
                onclick: go,
                onconnect: (el: HTMLElement) => {
                    let source = typeof target === 'function' ? target() : target;

                    arrow = el.querySelector<SVGElement>('.back-to-top-arrow') ?? undefined;
                    ring = el.querySelector<SVGCircleElement>('.back-to-top-progress') ?? undefined;
                    scroller = source ?? undefined;

                    if (ring && typeof ScrollTimeline === 'function') {
                        // The ring follows the scroll on the compositor where scroll-driven animations exist.
                        timeline = ring.animate(
                            [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
                            { fill: 'both', timeline: new ScrollTimeline({ axis: 'block', source: scroller ?? document.documentElement }) }
                        );
                    }

                    (scroller ?? window).addEventListener('scroll', onscroll, { passive: true });
                    cleanup = () => (scroller ?? window).removeEventListener('scroll', onscroll);
                    read();
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    cleanup?.();
                    stop();
                    timeline?.cancel();
                }
            }}
        >
            <svg aria-hidden='true' class='back-to-top-ring' fill='none' viewBox='0 0 44 44'>
                <circle class='back-to-top-track' cx='22' cy='22' r='20.5' />
                <circle
                    class='back-to-top-progress'
                    cx='22'
                    cy='22'
                    pathLength='1'
                    r='20.5'
                />
            </svg>
            <svg
                aria-hidden='true'
                class='back-to-top-arrow'
                fill='none'
                stroke='currentColor'
                stroke-linecap='round'
                stroke-linejoin='round'
                stroke-width='1.7'
                viewBox='0 0 16 16'
            >
                <path d='M8 12.5v-9M4 7l4-4 4 4' />
            </svg>
        </button>
    `;
}


export default template;
export type { State };
