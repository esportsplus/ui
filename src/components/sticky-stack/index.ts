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


export default Object.assign(component<A, Renderable<unknown>>(
    function(
        this: { attributes?: Partial<A> },
        { items, label, state = reactive({ active: 0 }), ...attributes }: A,
        heading
    ) {
        let animations: Animation[] = [],
            cards: HTMLElement[] = [],
            dots: HTMLElement[] = [],
            fills: HTMLElement[] = [],
            frame = 0,
            last = items.length - 1,
            layout: Layout | undefined,
            scroller: HTMLElement | undefined,
            shades: HTMLElement[] = [];

        function goTo(i: number) {
            if (!layout || !scroller) {
                return;
            }

            scroller.scrollTo({
                behavior: reduced() ? 'auto' : 'smooth',
                top: i === 0 ? 0 : natural(layout, i) - top(layout, i)
            });
        }

        function onscroll() {
            if (!frame) {
                frame = requestAnimationFrame(update);
            }
        }

        function scrollDriven() {
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

        // One read and a batch of transform and opacity writes per frame, nothing that triggers layout.
        function update() {
            frame = 0;

            if (!layout || !scroller) {
                return;
            }

            let front = 0,
                s = scroller.scrollTop;

            for (let i = 0; i < last; i++) {
                if (covered(layout, i, s) >= 0.5) {
                    front++;
                }
            }

            if (front !== state.active) {
                dots[state.active]?.removeAttribute('aria-current');
                state.active = front;
            }

            dots[front]?.setAttribute('aria-current', 'step');

            if (animations.length) {
                return;
            }

            let motion = !reduced();

            for (let i = 0; i <= last; i++) {
                let d = depth(layout, i, last, s);

                cards[i].style.transform = motion ? `scale(${1 - d * layout.scale})` : '';
                fills[i].style.transform = `scaleY(${i === 0 ? 1 : covered(layout, i - 1, s)})`;
                shades[i].style.opacity = motion ? String(Math.min(d * layout.dim, layout.max)) : '0';
            }
        }

        return html`
            <div
                class='sticky-stack'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (root: HTMLElement) => {
                        cards = [...root.querySelectorAll<HTMLElement>('.sticky-stack-card')];
                        dots = [...root.querySelectorAll<HTMLElement>('.sticky-stack-dot')];
                        fills = [...root.querySelectorAll<HTMLElement>('.sticky-stack-fill')];
                        layout = measure(root);
                        shades = [...root.querySelectorAll<HTMLElement>('.sticky-stack-shade')];

                        scrollDriven();
                        update();
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);

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
                        onscroll
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
                            >
                                <span class='sticky-stack-number'>${String(i + 1).padStart(2, '0')}</span>
                                <div class='sticky-stack-body'>
                                    <h3 class='sticky-stack-title'>${item.title}</h3>
                                    <p class='sticky-stack-text'>${item.text}</p>
                                </div>
                                <div aria-hidden='true' class='sticky-stack-shade'></div>
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
                        >
                            <span class='sticky-stack-bar'>
                                <span class='sticky-stack-fill' style='${`transform: scaleY(${i === 0 ? 1 : 0});`}'></span>
                            </span>
                        </button>
                    `)}
                </nav>
            </div>
        `;
    }
), { card: STICKY_STACK_CARD, dot: STICKY_STACK_DOT } as const);

export type { Item, State };
