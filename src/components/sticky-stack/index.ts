import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [STICKY_STACK_CARD]?: Attributes;
    [STICKY_STACK_DOT]?: Attributes;
    items: Item[];
    label: string;
    state?: State;
};

type Item = {
    text: Renderable<unknown>;
    title: string;
};

type Layout = {
    card: number;
    dim: number;
    first: number;
    gap: number;
    header: number;
    max: number;
    scale: number;
    step: number;
};

type State = {
    // Index of the card currently on top of the stack.
    active: number;
};


const STICKY_STACK_CARD = Symbol.for('@esportsplus/ui/sticky-stack.card');

const STICKY_STACK_DOT = Symbol.for('@esportsplus/ui/sticky-stack.dot');


// How far card i + 1 has slid over card i, 0 to 1: from its top edge meeting card i's bottom edge until it sticks.
function covered(layout: Layout, i: number, s: number) {
    let [start, end] = cover(layout, i);

    return Math.min(Math.max((s - start) / (end - start), 0), 1);
}

function cover(layout: Layout, i: number) {
    return [
        natural(layout, i + 1) - top(layout, i) - layout.card,
        natural(layout, i + 1) - top(layout, i + 1)
    ];
}

function depth(layout: Layout, i: number, last: number, s: number) {
    let value = 0;

    for (let j = i; j < last; j++) {
        value += covered(layout, j, s);
    }

    return value;
}

// Layout is fixed in px so every scroll position can be computed instead of measured: sticky elements report their
// stuck position, not their natural one, so measuring them mid-scroll would be wrong anyway.
function measure(root: HTMLElement): Layout {
    let computed = getComputedStyle(root),
        read = (name: string) => parseFloat(computed.getPropertyValue(name));

    return {
        card: read('--card-height'),
        dim: read('--dim-per-card'),
        first: read('--first-top'),
        gap: read('--card-gap'),
        header: read('--header-height'),
        max: read('--max-dim'),
        scale: read('--scale-per-card'),
        step: read('--step')
    };
}

function natural(layout: Layout, i: number) {
    return layout.header + i * (layout.card + layout.gap);
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Everything between two breakpoints is linear in scroll position, so keyframes at the breakpoints reproduce the
// scroll-listener math exactly on the compositor.
function timeline(
    element: Element,
    points: number[],
    range: number,
    source: ScrollTimeline,
    frame: (s: number) => Keyframe
) {
    let offsets = [...new Set([0, range, ...points].map((s) => Math.min(Math.max(s, 0), range)))].sort((a, b) => a - b);

    return element.animate(
        offsets.map((s) => ({ ...frame(s), offset: s / range })),
        { fill: 'both', timeline: source }
    );
}

function top(layout: Layout, i: number) {
    return layout.first + i * layout.step;
}


export default component(
    function(
        this: { attributes?: Partial<A> },
        { items, label, state = reactive({ active: 0 }), ...attributes }: A,
        heading: Renderable<unknown>
    ) {
        let animations: Animation[] = [],
            cards: HTMLElement[] = [],
            fills: HTMLElement[] = [],
            last = items.length - 1,
            scroller: HTMLElement | undefined,
            shades: HTMLElement[] = [],
            view = reactive({ layout: null as Layout | null, scroll: 0 });

        // Scroll-driven timelines move the cards on the compositor when available; otherwise the scroll position does.
        function card(i: number) {
            let l = view.layout;

            if (!l || animations.length || reduced()) {
                return '';
            }

            return `transform: scale(${1 - depth(l, i, last, view.scroll) * l.scale})`;
        }

        function fill(i: number) {
            let l = view.layout;

            return `transform: scaleY(${i === 0 ? 1 : l && !animations.length ? covered(l, i - 1, view.scroll) : 0})`;
        }

        function goTo(i: number) {
            let l = view.layout;

            if (!l || !scroller) {
                return;
            }

            scroller.scrollTo({
                behavior: reduced() ? 'auto' : 'smooth',
                top: i === 0 ? 0 : natural(l, i) - top(l, i)
            });
        }

        function scrollDriven() {
            let layout = view.layout;

            if (!layout || !scroller || typeof ScrollTimeline !== 'function') {
                return;
            }

            let range = scroller.scrollHeight - scroller.clientHeight;

            if (range <= 0) {
                return;
            }

            let l = layout,
                motion = !reduced(),
                source = new ScrollTimeline({ axis: 'block', source: scroller });

            for (let i = 0; i <= last; i++) {
                if (i > 0) {
                    animations.push(
                        timeline(fills[i], cover(l, i - 1), range, source, (s) => ({ transform: `scaleY(${covered(l, i - 1, s)})` }))
                    );
                }

                if (!motion) {
                    continue;
                }

                let cap = l.max / l.dim,
                    points: number[] = [];

                for (let j = i; j < last; j++) {
                    points.push(...cover(l, j));
                }

                // The shade stops darkening partway through a cover; that kink needs its own keyframe.
                let j = i + Math.floor(cap);

                if (j < last) {
                    let [start, end] = cover(l, j);

                    points.push(start + (cap % 1) * (end - start));
                }

                animations.push(
                    timeline(cards[i], points, range, source, (s) => ({ transform: `scale(${1 - depth(l, i, last, s) * l.scale})` })),
                    timeline(shades[i], points, range, source, (s) => ({ opacity: Math.min(depth(l, i, last, s) * l.dim, l.max) }))
                );
            }
        }

        function shade(i: number) {
            let l = view.layout;

            if (!l || animations.length || reduced()) {
                return '';
            }

            return `opacity: ${Math.min(depth(l, i, last, view.scroll) * l.dim, l.max)}`;
        }

        // Called straight from the scroll event rather than a frame callback: scroll events already fire once per frame,
        // ahead of the frame callbacks the template flushes in, so the bindings still land in this frame.
        function update() {
            let l = view.layout;

            if (!l || !scroller) {
                return;
            }

            let front = 0,
                s = scroller.scrollTop;

            for (let i = 0; i < last; i++) {
                if (covered(l, i, s) >= 0.5) {
                    front++;
                }
            }

            if (front !== state.active) {
                state.active = front;
            }

            view.scroll = s;
        }

        return html`
            <div
                class='sticky-stack'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (root: HTMLElement) => {
                        view.layout = measure(root);
                        scrollDriven();
                        update();
                    },
                    ondisconnect: () => {
                        for (let i = 0, n = animations.length; i < n; i++) {
                            animations[i].cancel();
                        }

                        animations = [];
                    }
                }}
            >
                <div
                    aria-label='${label}'
                    class='sticky-stack-scroller'
                    role='region'
                    tabindex='0'
                    ${{
                        onrender: (el: HTMLElement) => {
                            scroller = el;
                        },
                        onscroll: update
                    }}
                >
                    <div class='sticky-stack-track' style='${`--last: ${last};`}'>
                        <div class='sticky-stack-header'>${heading}</div>
                        ${items.map((item, i) => html`
                            <article
                                class='sticky-stack-card'
                                style='${`--index: ${i};`}'
                                ${this?.attributes?.[STICKY_STACK_CARD]}
                                ${attributes[STICKY_STACK_CARD]}
                                ${{
                                    onrender: (element: HTMLElement) => {
                                        cards[i] = element;
                                    },
                                    style: () => card(i)
                                }}
                            >
                                <span class='sticky-stack-number'>${String(i + 1).padStart(2, '0')}</span>
                                <div class='sticky-stack-body'>
                                    <h3 class='sticky-stack-title'>${item.title}</h3>
                                    <p class='sticky-stack-text'>${item.text}</p>
                                </div>
                                <div
                                    aria-hidden='true'
                                    class='sticky-stack-shade'
                                    ${{
                                        onrender: (element: HTMLElement) => {
                                            shades[i] = element;
                                        },
                                        style: () => shade(i)
                                    }}
                                ></div>
                            </article>
                        `)}
                    </div>
                </div>
                <nav aria-label='Jump to card' class='sticky-stack-nav'>
                    ${items.map((item, i) => html`
                        <button
                            aria-label='${`${i + 1}. ${item.title}`}'
                            class='sticky-stack-dot'
                            onclick='${() => goTo(i)}'
                            type='button'
                            ${this?.attributes?.[STICKY_STACK_DOT]}
                            ${attributes[STICKY_STACK_DOT]}
                            ${{
                                'aria-current': () => state.active === i && 'step'
                            }}
                        >
                            <span class='sticky-stack-bar'>
                                <span
                                    class='sticky-stack-fill'
                                    style='${() => fill(i)}'
                                    ${{
                                        onrender: (element: HTMLElement) => {
                                            fills[i] = element;
                                        }
                                    }}
                                ></span>
                            </span>
                        </button>
                    `)}
                </nav>
            </div>
        `;
    },
    { card: STICKY_STACK_CARD, dot: STICKY_STACK_DOT }
);

export type { Item, State };
