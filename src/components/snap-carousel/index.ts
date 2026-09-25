import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


const SNAP_CAROUSEL_ARROW = Symbol.for('@esportsplus/ui/snap-carousel.arrow');

const SNAP_CAROUSEL_CARD = Symbol.for('@esportsplus/ui/snap-carousel.card');


type A = Attributes & {
    [SNAP_CAROUSEL_ARROW]?: Attributes;
    [SNAP_CAROUSEL_CARD]?: Attributes;
    label?: string;
    slides: Slide[];
    state?: State;
};

type Drag = {
    id: number;
    samples: { t: number; x: number }[];
    startScroll: number;
    startX: number;
};

type Slide = {
    text: Renderable<unknown>;
    title: Renderable<unknown>;
    visual?: Renderable<unknown>;
};

type State = {
    active: number;
    end: boolean;
    start: boolean;
};


// How long a release coasts at its own speed (ms) before picking a card.
const COAST = 280;

// px/ms; a flick faster than this always moves at least one card, however short it was.
const FLICK = 0.3;

const NEXT = 'M6 3.5 10.5 8 6 12.5';

const PREVIOUS = 'M10 3.5 5.5 8l4.5 4.5';

// Only the last stretch of a drag says how fast the hand was moving at release.
const SAMPLES = 80;

// For browsers without 'scrollend'; a smooth scroll is done well within it.
const SETTLE = 700;

const SLOP = 4;


function behavior(): ScrollBehavior {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

function nearest(targets: number[], position: number) {
    let best = 0;

    for (let i = 1, n = targets.length; i < n; i++) {
        if (Math.abs(targets[i] - position) < Math.abs(targets[best] - position)) {
            best = i;
        }
    }

    return best;
}

// The scrollLeft that centers each slide, read from layout so it holds for any card size or padding.
function targets(track: HTMLElement) {
    let max = track.scrollWidth - track.clientWidth;

    return Array.from(track.children as HTMLCollectionOf<HTMLElement>, (slide) =>
        Math.min(max, Math.max(0, slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2))
    );
}


function template(this: { attributes?: Partial<A> } | void, { label = 'Carousel', slides, state = reactive({ active: 0, end: false, start: true }), ...attributes }: A) {
    let bound = this?.attributes,
        centered: IntersectionObserver | undefined,
        drag: Drag | null = null,
        onscreen: IntersectionObserver | undefined,
        resize: ResizeObserver | undefined,
        settle: VoidFunction | null = null,
        suppress = false,
        track: HTMLElement | null = null,
        view = reactive({ visible: false });

    function arrow(direction: -1 | 1) {
        let disabled = () => direction === -1 ? state.start : state.end;

        // 'aria-disabled' rather than 'disabled': a disabled button throws focus back to the page the
        // moment the last card arrives.
        return html`
            <button
                aria-disabled='${() => String(disabled())}'
                aria-label='${direction === -1 ? 'Previous card' : 'Next card'}'
                class='snap-carousel-arrow ${() => disabled() && '--disabled'}'
                type='button'
                ${bound?.[SNAP_CAROUSEL_ARROW]}
                ${attributes[SNAP_CAROUSEL_ARROW]}
                ${{
                    onclick: () => {
                        if (!disabled()) {
                            step(direction);
                        }
                    }
                }}
            >
                <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                    <path d='${direction === -1 ? PREVIOUS : NEXT}' />
                </svg>
            </button>
        `;
    }

    function release(e: PointerEvent) {
        if (!drag || drag.id !== e.pointerId || !track) {
            return;
        }

        let { samples, startScroll } = drag,
            element = track,
            first = samples[0],
            last = samples[samples.length - 1],
            velocity = e.type === 'pointerup' && e.timeStamp - last.t < SAMPLES && last.t > first.t
                ? -(last.x - first.x) / (last.t - first.t)
                : 0;

        drag = null;
        element.classList.remove('--dragging');

        let points = targets(element),
            from = nearest(points, startScroll),
            index = nearest(points, element.scrollLeft + velocity * COAST);

        if (index === from && Math.abs(velocity) > FLICK) {
            index = Math.min(points.length - 1, Math.max(0, from + Math.sign(velocity)));
        }

        element.scrollTo({ behavior: behavior(), left: points[index] });

        // Snap comes back only once the smooth scroll has arrived; turning it on mid-flight makes the
        // browser jump straight to the nearest card.
        let fallback = setTimeout(restore, SETTLE);

        function restore() {
            settle = null;
            clearTimeout(fallback);
            element.removeEventListener('scrollend', restore);
            element.style.scrollBehavior = '';
            element.style.scrollSnapType = '';
        }

        element.addEventListener('scrollend', restore);
        settle = restore;
    }

    function step(direction: -1 | 1) {
        if (!track || !track.firstElementChild) {
            return;
        }

        // Mandatory snapping lands this on the neighbouring card's center, even mid smooth scroll.
        track.scrollBy({
            behavior: behavior(),
            left: direction * ((track.firstElementChild as HTMLElement).offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0'))
        });
    }

    function sync() {
        if (!track) {
            return;
        }

        // 1px of slack absorbs fractional scroll positions on scaled displays.
        state.end = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
        state.start = track.scrollLeft <= 1;
    }

    return html`
        <div
            class='snap-carousel ${() => view.visible && '--visible'}'
            ${bound}
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    centered = new IntersectionObserver((entries) => {
                        for (let entry of entries) {
                            let index = Array.prototype.indexOf.call(track!.children, entry.target);

                            if (entry.intersectionRatio >= 0.9) {
                                state.active = index;
                            }
                            else if (state.active === index) {
                                state.active = -1;
                            }
                        }
                    }, { root: track, threshold: [0, 0.9] });
                    onscreen = new IntersectionObserver((entries) => {
                        view.visible = entries[entries.length - 1].isIntersecting;
                    });
                    resize = new ResizeObserver(sync);

                    for (let slide of track!.children) {
                        centered.observe(slide);
                    }

                    onscreen.observe(element);
                    resize.observe(track!);
                },
                ondisconnect: () => {
                    centered?.disconnect();
                    onscreen?.disconnect();
                    resize?.disconnect();
                    settle?.();
                }
            }}
        >
            <div class='snap-carousel-viewport'>
                <div
                    aria-label='${label}'
                    aria-roledescription='carousel'
                    class='snap-carousel-track'
                    role='region'
                    tabindex='0'
                    ${{
                        // A drag that moved is not a click on whatever sits under the pointer.
                        onclick: (e: MouseEvent) => {
                            if (!suppress) {
                                return;
                            }

                            suppress = false;
                            e.preventDefault();
                        },
                        ondragstart: (e: DragEvent) => {
                            e.preventDefault();
                        },
                        onpointercancel: release,
                        onpointerdown: (e: PointerEvent) => {
                            // Mouse only: touch, pen and trackpads already scroll natively with their own momentum.
                            if (e.pointerType !== 'mouse' || e.button !== 0 || !track) {
                                return;
                            }

                            settle?.();
                            track.setPointerCapture(e.pointerId);

                            // Snap would yank the content to the nearest card on every scrollLeft write.
                            track.style.scrollBehavior = 'auto';
                            track.style.scrollSnapType = 'none';
                            track.classList.add('--dragging');

                            drag = {
                                id: e.pointerId,
                                samples: [{ t: e.timeStamp, x: e.clientX }],
                                startScroll: track.scrollLeft,
                                startX: e.clientX
                            };
                            suppress = false;
                        },
                        onpointermove: (e: PointerEvent) => {
                            if (!drag || drag.id !== e.pointerId || !track) {
                                return;
                            }

                            let dx = e.clientX - drag.startX;

                            if (Math.abs(dx) > SLOP) {
                                suppress = true;
                            }

                            track.scrollLeft = drag.startScroll - dx;
                            drag.samples.push({ t: e.timeStamp, x: e.clientX });

                            while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > SAMPLES) {
                                drag.samples.shift();
                            }
                        },
                        onpointerup: release,
                        onrender: (element: HTMLElement) => {
                            track = element;
                        },
                        onscroll: sync
                    }}
                >
                    ${slides.map((slide, i) => html`
                        <div
                            aria-label='${`${i + 1} of ${slides.length}`}'
                            aria-roledescription='slide'
                            class='snap-carousel-slide ${() => state.active === i && '--active'}'
                            role='group'
                        >
                            <div
                                class='snap-carousel-card'
                                ${bound?.[SNAP_CAROUSEL_CARD]}
                                ${attributes[SNAP_CAROUSEL_CARD]}
                            >
                                ${slide.visual ? html`<div aria-hidden='true' class='snap-carousel-visual'>${slide.visual}</div>` : ''}
                                <p class='snap-carousel-title'>${slide.title}</p>
                                <p class='snap-carousel-text'>${slide.text}</p>
                            </div>
                        </div>
                    `)}
                </div>
            </div>
            <div class='snap-carousel-controls'>
                ${arrow(-1)}
                ${arrow(1)}
            </div>
        </div>
    `;
}


export default Object.assign(template, { arrow: SNAP_CAROUSEL_ARROW, card: SNAP_CAROUSEL_CARD } as const);
export type { Slide as SnapCarouselSlide, State as SnapCarouselState };
