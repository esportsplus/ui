import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
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


function clamp(x: number, min: number, max: number) {
    return x < min ? min : x > max ? max : x;
}

// Wraps the offset into (-loop, 0] so the track never runs out of copies.
function fold(x: number, loop: number) {
    let m = x % loop;

    return m > 0 ? m - loop : m;
}


export default ({ direction = 'left', gap = 40, items, label = 'Logos', select, speed = 44, state = reactive({ paused: false }), ...attributes }: Attributes & {
    direction?: 'left' | 'right';
    gap?: number;
    items: Item[];
    label?: string;
    select?: (item: Item) => void;
    speed?: number;
    state?: { paused: boolean };
}) => {
    let cleanup: VoidFunction[] = [],
        copies = reactive(Array.from({ length: MIN_COPIES }, (_, i) => i)),
        frame = 0,
        held = false,
        near = false,
        nudge = 0,
        offset = 0,
        rate = 0,
        reduced = false,
        sign = direction === 'right' ? 1 : -1,
        span = 0;

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

    function listen<T extends EventTarget>(target: T, type: string, listener: (e: any) => void, options?: boolean | AddEventListenerOptions) {
        target.addEventListener(type, listener, options);
        cleanup.push(() => target.removeEventListener(type, listener, options));
    }

    return html`
        <section
            aria-label='${label}'
            class='marquee'
            style='--item-gap: ${gap}px'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    let group = element.querySelector('.marquee-group:not(.marquee-group--copy)') as HTMLElement,
                        media = matchMedia('(prefers-reduced-motion: reduce)'),
                        track = element.querySelector('.marquee-track') as HTMLElement,
                        viewport = element.querySelector('.marquee-viewport') as HTMLElement;

                    function measure() {
                        // Read back the rendered gap so a CSS override of --item-gap still loops seamlessly.
                        let width = group.getBoundingClientRect().width,
                            loop = width > 0 ? width + parseFloat(getComputedStyle(track).columnGap) : 0,
                            room = viewport.getBoundingClientRect().width;

                        span = loop;
                        offset = loop > 0 ? clamp(offset, -loop, loop) : 0;
                        paint();

                        let next = reduced || loop <= 0
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
                        reduced = media.matches;

                        if (reduced) {
                            viewport.setAttribute('tabindex', '0');
                        }
                        else {
                            viewport.removeAttribute('tabindex');
                        }

                        measure();
                        run();
                    }

                    function paint() {
                        track.style.transform = `translate3d(${(reduced ? 0 : offset - span).toFixed(2)}px, 0, 0)`;
                    }

                    // Nudges a focused item fully into view, keeping the track within one loop of rest.
                    function reveal(node: HTMLElement) {
                        let loop = span;

                        if (reduced || loop <= 0 || node === viewport) {
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
                        }
                    }

                    function run() {
                        cancelAnimationFrame(frame);
                        frame = 0;

                        if (reduced || !near) {
                            return;
                        }

                        let last = 0;

                        function tick(now: number) {
                            frame = requestAnimationFrame(tick);

                            let dt = last ? Math.min((now - last) / 1000, 0.05) : 0,
                                loop = span;

                            last = now;

                            if (loop <= 0) {
                                return;
                            }

                            rate += ((held || state.paused ? 0 : 1) - rate) * (1 - Math.exp(-dt / RAMP));

                            let pull = nudge * (1 - Math.exp(-dt / SETTLE));

                            nudge -= pull;

                            let x = offset + sign * speed * rate * dt + pull;

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
                        }

                        frame = requestAnimationFrame(tick);
                    }

                    let resize = new ResizeObserver(measure);

                    resize.observe(viewport);
                    resize.observe(group);
                    cleanup.push(() => resize.disconnect());

                    if (typeof IntersectionObserver === 'undefined') {
                        near = true;
                    }
                    else {
                        let intersection = new IntersectionObserver((entries) => {
                            let entry = entries[entries.length - 1];

                            if (entry && entry.isIntersecting !== near) {
                                near = entry.isIntersecting;
                                run();
                            }
                        }, { rootMargin: '96px' });

                        intersection.observe(viewport);
                        cleanup.push(() => intersection.disconnect());
                    }

                    listen(element, 'blur', () => held = false, true);
                    listen(element, 'focus', (e: FocusEvent) => {
                        held = true;
                        reveal(e.target as HTMLElement);
                    }, true);
                    listen(element, 'pointercancel', () => held = false);
                    listen(element, 'pointerdown', () => held = true);
                    listen(element, 'pointerenter', (e: PointerEvent) => {
                        if (e.pointerType !== 'touch') {
                            held = true;
                        }
                    });
                    listen(element, 'pointerleave', () => held = false);
                    listen(element, 'pointerup', (e: PointerEvent) => {
                        if (e.pointerType === 'touch') {
                            held = false;
                        }
                    });
                    listen(media, 'change', motion);
                    // Focus can scroll the clipped viewport natively; pin it so only the transform moves.
                    listen(viewport, 'scroll', () => {
                        if (reduced) {
                            return;
                        }

                        viewport.scrollLeft = 0;
                        viewport.scrollTop = 0;
                    }, { passive: true });
                    listen(window, 'blur', () => held = false);

                    motion();
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);

                    for (let i = 0, n = cleanup.length; i < n; i++) {
                        cleanup[i]();
                    }

                    cleanup.length = 0;
                }
            }}
        >
            <div class='marquee-viewport'>
                <div class='marquee-track'>
                    ${html.reactive(copies, (copy) => {
                        // Copy 1 is the live group; copies are only ever trimmed from the end so it survives resizes.
                        if (copy === 1) {
                            return html`
                                <ul class='marquee-group'>
                                    ${items.map((item) => html`<li>${link(item)}</li>`)}
                                </ul>
                            `;
                        }

                        return html`
                            <ul aria-hidden='true' class='marquee-group marquee-group--copy'>
                                ${items.map((item) => html`<li><span class='marquee-item'>${item.mark ? item.mark() : item.label}</span></li>`)}
                            </ul>
                        `;
                    })}
                </div>
            </div>
        </section>
    `;
};
