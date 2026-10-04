import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { clamp } from '~/shared/clamp';
import * as scroll from './velocity';
import './scss/index.scss';


type Item = {
    href?: string;
    id?: string;
    label: string;
    // Called once per copy since a node can only be mounted in one place.
    mark?: () => Renderable<unknown>;
};


// Seconds to ramp speed up/down when pausing and resuming.
const RAMP = 0.19;

// Seconds to settle a focus nudge that brings an item into view.
const SETTLE = 0.16;

const MAX_COPIES = 14;

const MIN_COPIES = 4;


// Wraps the offset into (-loop, 0] so the track never runs out of copies.
function fold(x: number, loop: number) {
    let m = x % loop;

    return m > 0 ? m - loop : m;
}


export default ({ direction = 'left', gap = 40, items, label = 'Logos', select, speed = 44, state = reactive({ paused: false }), velocity = false, ...attributes }: Attributes & {
    direction?: 'left' | 'right';
    gap?: number;
    items: Item[];
    label?: string;
    onfocusin?: never;
    onfocusout?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    onpointerup?: never;
    onwindowblur?: never;
    select?: (item: Item) => void;
    speed?: number;
    state?: { paused: boolean };
    // Scrolling the page speeds the marquee up and turns it with the scroll direction.
    velocity?: boolean;
}) => {
    let cleanup: VoidFunction[] = [],
        copies = reactive(Array.from({ length: MIN_COPIES }, (_, i) => i)),
        // The share of 'speed' it drifts at, from the CSS; none holds it still, to scroll by hand.
        drift = 0,
        frame = 0,
        group: HTMLElement | undefined,
        held = false,
        near = false,
        nudge = 0,
        offset = 0,
        rate = 0,
        sign = direction === 'right' ? 1 : -1,
        span = 0,
        stage = reactive({ still: false, x: 0 }),
        track: HTMLElement | undefined,
        tracker: scroll.Tracker | undefined,
        viewport: HTMLElement | undefined;

    function face(item: Item) {
        if (!item.mark) {
            return item.label;
        }

        return html`
            <span aria-hidden='true' class='marquee-mark'>${item.mark()}</span>
            <span class='marquee-label'>${item.label}</span>
        `;
    }

    function link(item: Item) {
        if (item.href) {
            return html`<a class='marquee-item marquee-item--link' href='${item.href}'>${face(item)}</a>`;
        }

        if (select) {
            return html`<button class='marquee-item marquee-item--link' onclick='${() => select(item)}' type='button'>${face(item)}</button>`;
        }

        return html`<span class='marquee-item'>${face(item)}</span>`;
    }

    function measure() {
        if (!group || !track || !viewport) {
            return;
        }

        // Read back the rendered gap so a CSS override of --item-gap still loops seamlessly.
        let width = group.getBoundingClientRect().width,
            loop = width > 0 ? width + parseFloat(getComputedStyle(track).columnGap) : 0,
            room = viewport.getBoundingClientRect().width;

        span = loop;
        offset = loop > 0 ? clamp(offset, -loop, loop) : 0;
        paint();
        wake();

        let next = stage.still || loop <= 0
            ? MIN_COPIES
            : clamp(Math.ceil(room / loop) + 3, MIN_COPIES, MAX_COPIES);

        while (copies.length < next) {
            copies.push(copies.length);
        }

        if (copies.length > next) {
            copies.splice(next);
        }
    }

    function motion() {
        if (!track) {
            return;
        }

        drift = parseFloat(getComputedStyle(track).getPropertyValue('--drift')) || 0;
        stage.still = drift <= 0;
        measure();
        run();
    }

    function paint() {
        stage.x = stage.still ? 0 : offset - span;
    }

    // Nudges a focused item fully into view, keeping the track within one loop of rest.
    function reveal(node: HTMLElement) {
        let loop = span;

        if (stage.still || loop <= 0 || !viewport || node === viewport) {
            return;
        }

        let box = node.getBoundingClientRect(),
            delta = 0,
            pad = 12,
            view = viewport.getBoundingClientRect();

        if (box.left < view.left + pad) {
            delta = view.left + pad - box.left;
        }
        else if (box.right > view.right - pad) {
            delta = view.right - pad - box.right;
        }

        if (delta !== 0) {
            nudge = clamp(offset + nudge + delta, -loop, loop) - offset;
            wake();
        }
    }

    function run() {
        sleep();

        if (stage.still || !near) {
            return;
        }

        let last = 0;

        function tick(now: number) {
            frame = requestAnimationFrame(tick);

            let dt = last ? Math.min((now - last) / 1000, 0.05) : 0,
                goal = held || state.paused ? 0 : 1,
                loop = span;

            last = now;

            if (loop <= 0) {
                sleep();
                return;
            }

            rate += (goal - rate) * (1 - Math.exp(-dt / RAMP));

            let pull = nudge * (1 - Math.exp(-dt / SETTLE));

            nudge -= pull;

            let boost = 0;

            if (tracker) {
                scroll.step(tracker, now, dt);
                boost = Math.min(scroll.MAX_FACTOR, Math.abs(tracker.factor));

                // A burst turns the marquee with the scroll; it keeps that heading once the scroll stops.
                if (boost > 0.1) {
                    sign = (direction === 'right' ? 1 : -1) * Math.sign(tracker.factor);
                }
            }

            let x = offset + sign * speed * drift * rate * (1 + boost) * dt + pull;

            // Only wrap once a nudge has settled, otherwise the item being revealed would jump.
            if (rate > 0.002 && Math.abs(nudge) < 0.25) {
                nudge = 0;
                x = fold(x, loop);
            }
            else {
                x = clamp(x, -loop, loop);
            }

            offset = x;
            paint();

            // Stopped with nothing left to settle: no frames until a resume, a nudge, a resize or a scroll wakes it.
            if (!goal && rate < 0.002 && Math.abs(nudge) < 0.25 && (!tracker || scroll.settled(tracker, now))) {
                sleep();
            }
        }

        frame = requestAnimationFrame(tick);
    }

    function sleep() {
        cancelAnimationFrame(frame);
        frame = 0;
    }

    function unhold() {
        held = false;
        wake();
    }

    function wake() {
        if (!frame) {
            run();
        }
    }

    effect(() => {
        if (!state.paused) {
            untrack(wake);
        }
    });

    return html`
        <section
            aria-label='${label}'
            class='marquee'
            style='--item-gap: ${gap}px'
            ${attributes}
            ${{
                class: () => stage.still && 'marquee--still',
                onconnect: (element: HTMLElement) => {
                    if (!group || !viewport) {
                        return;
                    }

                    let resize = new ResizeObserver(measure);

                    resize.observe(viewport);
                    resize.observe(group);
                    cleanup.push(() => resize.disconnect());

                    if (velocity) {
                        let t = scroll.track(element, wake);

                        tracker = t;
                        cleanup.push(() => {
                            t.release(wake);
                            tracker = undefined;
                        });
                    }

                    let intersection = new IntersectionObserver((entries) => {
                        let entry = entries[entries.length - 1];

                        if (entry && entry.isIntersecting !== near) {
                            near = entry.isIntersecting;
                            run();
                        }
                    }, { rootMargin: '96px' });

                    intersection.observe(viewport);
                    cleanup.push(() => intersection.disconnect());

                    motion();
                },
                ondisconnect: () => {
                    near = false;
                    sleep();

                    for (let i = 0, n = cleanup.length; i < n; i++) {
                        cleanup[i]();
                    }

                    cleanup.length = 0;
                },
                onfocusin: (e: FocusEvent) => {
                    held = true;
                    reveal(e.target as HTMLElement);
                },
                onfocusout: unhold,
                onpointercancel: unhold,
                onpointerdown: () => {
                    held = true;
                },
                onpointerenter: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') {
                        held = true;
                    }
                },
                onpointerleave: unhold,
                onpointerup: (e: PointerEvent) => {
                    if (e.pointerType === 'touch') {
                        unhold();
                    }
                },
                onwindowblur: unhold
            }}
        >
            <div
                class='marquee-viewport'
                ${{
                    onconnect: (element: HTMLElement) => {
                        viewport = element;
                    },
                    // Focus can scroll the clipped viewport natively; pin it so only the transform moves.
                    onscroll: () => {
                        if (stage.still || !viewport) {
                            return;
                        }

                        viewport.scrollLeft = 0;
                        viewport.scrollTop = 0;
                    },
                    tabindex: () => stage.still && '0'
                }}
            >
                <div
                    class='marquee-track'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            track = element;
                        },
                        // Its CSS transitions '--drift' alone, so a change to it (reduced motion, say) is heard here.
                        ontransitionend: (e: TransitionEvent) => {
                            if (e.target === e.currentTarget && e.propertyName === '--drift') {
                                motion();
                            }
                        },
                        style: () => `transform: translate3d(${stage.x.toFixed(2)}px, 0, 0)`
                    }}
                >
                    ${html.reactive(copies, (copy) => {
                        // Copy 1 is the live group; copies are only ever trimmed from the end so it survives resizes.
                        if (copy === 1) {
                            return html`
                                <ul
                                    class='marquee-group'
                                    ${{
                                        onconnect: (element: HTMLElement) => {
                                            group = element;
                                        }
                                    }}
                                >
                                    ${items.map((item) => html`<li class='marquee-entry'>${link(item)}</li>`)}
                                </ul>
                            `;
                        }

                        return html`
                            <ul aria-hidden='true' class='marquee-group marquee-group--copy'>
                                ${items.map((item) => html`<li class='marquee-entry'><span class='marquee-item'>${item.mark ? item.mark() : item.label}</span></li>`)}
                            </ul>
                        `;
                    })}
                </div>
            </div>
        </section>
    `;
};
