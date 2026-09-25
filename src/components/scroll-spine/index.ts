import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [SCROLL_SPINE_BUTTON]?: Attributes;
    height?: number;
    items: Item[];
    label?: string;
    state?: State;
    // The element that scrolls; the window when omitted. Headings are found by id either way.
    target?: HTMLElement | (() => HTMLElement | null | undefined);
};

type Band = {
    height: number;
    top: number;
};

type Edge = {
    omega: number;
    target: number;
    value: number;
    velocity: number;
};

type Item = {
    id: string;
    label: string;
};

type State = {
    active: number;
};


// Scroll positions land a few pixels short of the end on some trackpads.
const END_SLACK = 4;

// Room between bands so neighbouring sections read as separate pieces.
const GAP = 8;

// Below this width there is no room for headings beside the bands.
const INLINE_MIN = 120;

// Space left above a heading after jumping to it, so it isn't flush.
const JUMP_OFFSET = 16;

// Leading edge: quick, so the marker answers the scroll at once (critically damped, 0.24s visual duration).
const LEAD = (2 * Math.PI) / (1.2 * 0.24);

// The current-section block reaches a little past its band.
const MARK_PAD = 4;

// A one-paragraph section still gets a band big enough to hover and click, and, with labels, tall enough for its heading.
const MIN_BAND = 14;

const MIN_BAND_LABELLED = 24;

// Where on screen the "reading line" sits: a third of the way down is where eyes rest while reading, so a section counts
// as current once its heading passes that line, not only when it hits the very top.
const READ_LINE = 0.3;

const SCROLL_SPINE_BUTTON = Symbol.for('@esportsplus/ui/scroll-spine.button');

// Trailing edge: slower on purpose, that lag is the stretch; 0.42s is the shortest lag where it still reads on a one-band move.
const TRAIL = (2 * Math.PI) / (1.2 * 0.42);


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Exact critically damped step for any dt, so a retarget mid-flight keeps the edge's velocity and fast scrolling bends
// the marker instead of restarting it.
function step(edge: Edge, dt: number) {
    let decay = Math.exp(-edge.omega * dt),
        offset = edge.value - edge.target,
        slope = edge.velocity + edge.omega * offset;

    edge.value = edge.target + (offset + slope * dt) * decay;
    edge.velocity = (edge.velocity - edge.omega * slope * dt) * decay;

    if (Math.abs(edge.value - edge.target) < 0.05 && Math.abs(edge.velocity) < 1) {
        edge.value = edge.target;
        edge.velocity = 0;
        return false;
    }

    return true;
}


function template(
    this: { attributes?: Partial<A> } | void,
    { height = 320, items, label = 'On this page', state = reactive({ active: 0 }), target, ...attributes }: A
) {
    let bands: Band[] = [],
        bottom: Edge = { omega: LEAD, target: 0, value: 0, velocity: 0 },
        cleanup: VoidFunction | undefined,
        end = 0,
        fills: HTMLElement[] = [],
        frame = 0,
        inline = true,
        marker: HTMLElement | undefined,
        motion = 0,
        nav: HTMLElement | undefined,
        notch: HTMLElement | undefined,
        offsets: number[] = [],
        placed = false,
        rows: HTMLElement[] = [],
        scroller: HTMLElement | undefined,
        time = 0,
        upper: Edge = { omega: TRAIL, target: 0, value: 0, velocity: 0 };

    function animate(now: number) {
        let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 1 / 60,
            moving = step(upper, dt);

        moving = step(bottom, dt) || moving;
        time = now;
        paint();
        motion = moving ? requestAnimationFrame(animate) : 0;
    }

    function jump(i: number) {
        let behavior: ScrollBehavior = reduced() ? 'auto' : 'smooth',
            top = Math.max(0, offsets[i] - JUMP_OFFSET);

        (scroller ?? window).scrollTo({ behavior, top });
    }

    // Measures section lengths and lays the bands out in proportion, so the spine is a scale drawing of the article.
    function measure() {
        let m = metrics(),
            minBand = inline ? MIN_BAND_LABELLED : MIN_BAND,
            free = height - GAP * (items.length - 1) - minBand * items.length,
            tops = items.map((item) => {
                let el = document.getElementById(item.id);

                return el ? m.offsetOf(el) : 0;
            }),
            lengths = tops.map((top, i) => Math.max(1, (tops[i + 1] ?? m.height) - top)),
            total = lengths.reduce((a, b) => a + b, 0),
            y = 0;

        end = m.height;
        offsets = tops;
        bands = lengths.map((length) => {
            let band = { height: minBand + (free * length) / total, top: y };

            y += band.height + GAP;

            return band;
        });

        for (let i = 0, n = rows.length; i < n; i++) {
            rows[i].style.height = `${bands[i].height}px`;
            rows[i].style.top = `${bands[i].top}px`;
        }

        notch?.classList.add('--active');
        move(true);
        update();
    }

    function metrics() {
        if (!scroller) {
            return {
                height: document.documentElement.scrollHeight,
                offsetOf: (el: HTMLElement) => el.getBoundingClientRect().top + scrollY,
                scrollTop: scrollY,
                viewport: innerHeight
            };
        }

        let box = scroller,
            top = box.getBoundingClientRect().top;

        return {
            height: box.scrollHeight,
            offsetOf: (el: HTMLElement) => el.getBoundingClientRect().top - top + box.scrollTop,
            scrollTop: box.scrollTop,
            viewport: box.clientHeight
        };
    }

    // Moves the marker; the edge in the direction of travel leads.
    function move(snap = false) {
        let band = bands[state.active];

        if (!band) {
            return;
        }

        let from = upper.target,
            to = band.top - MARK_PAD;

        upper.target = to;
        bottom.target = band.top + band.height + MARK_PAD;

        if (!placed || snap || reduced()) {
            placed = true;
            bottom.value = bottom.target;
            bottom.velocity = 0;
            upper.value = upper.target;
            upper.velocity = 0;
            paint();
            return;
        }

        let down = to >= from;

        bottom.omega = down ? LEAD : TRAIL;
        upper.omega = down ? TRAIL : LEAD;

        if (!motion) {
            time = 0;
            motion = requestAnimationFrame(animate);
        }
    }

    function onscroll() {
        if (!frame) {
            frame = requestAnimationFrame(update);
        }
    }

    function paint() {
        if (!marker) {
            return;
        }

        marker.style.height = `${Math.max(0, bottom.value - upper.value)}px`;
        marker.style.top = `${upper.value}px`;
    }

    // Follows the scroll: the reading dot and the read part of each band are written straight to the DOM every frame;
    // reactive state only hears about it when the current section changes.
    function update() {
        frame = 0;

        if (!bands.length) {
            return;
        }

        let m = metrics(),
            atEnd = m.scrollTop >= m.height - m.viewport - END_SLACK,
            i = 0,
            line = m.scrollTop + m.viewport * READ_LINE;

        while (i < offsets.length - 1 && offsets[i + 1] <= line) {
            i++;
        }

        if (atEnd) {
            i = offsets.length - 1;
        }

        let band = bands[i],
            finish = offsets[i + 1] ?? end,
            start = offsets[i],
            within = atEnd ? 1 : Math.min(1, Math.max(0, (line - start) / (finish - start)));

        if (band && notch) {
            notch.style.transform = `translateY(${band.top + within * band.height}px)`;
        }

        for (let k = 0, n = fills.length; k < n; k++) {
            fills[k].style.transform = `scaleY(${k < i ? 1 : k === i ? within : 0})`;
        }

        if (i !== state.active) {
            state.active = i;
            move();
        }
    }

    return html`
        <nav
            aria-label='${label}'
            class='scroll-spine'
            style='${`height: ${height}px;`}'
            ${this?.attributes}
            ${attributes}
            ${{
                onconnect: (el: HTMLElement) => {
                    let source = typeof target === 'function' ? target() : target;

                    fills = [...el.querySelectorAll<HTMLElement>('.scroll-spine-fill')];
                    marker = el.querySelector<HTMLElement>('.scroll-spine-marker') ?? undefined;
                    nav = el;
                    notch = el.querySelector<HTMLElement>('.scroll-spine-notch') ?? undefined;
                    rows = [...el.querySelectorAll<HTMLElement>('.scroll-spine-item')];
                    scroller = source ?? undefined;

                    // Wide enough for words: every band carries its heading. Narrow: bands only, and the heading shows on hover or focus.
                    let width = new ResizeObserver(([entry]) => {
                            let next = entry.contentRect.width >= INLINE_MIN;

                            nav?.classList.toggle('--inline', next);

                            if (next !== inline || !bands.length) {
                                inline = next;
                                measure();
                            }
                        }),
                        content = new ResizeObserver(() => measure());

                    width.observe(el);
                    content.observe(scroller ? (scroller.firstElementChild ?? scroller) : document.body);
                    (scroller ?? window).addEventListener('scroll', onscroll, { passive: true });
                    cleanup = () => {
                        content.disconnect();
                        width.disconnect();
                        (scroller ?? window).removeEventListener('scroll', onscroll);
                    };
                },
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    cancelAnimationFrame(motion);
                    cleanup?.();
                }
            }}
        >
            <div aria-hidden='true' class='scroll-spine-marker'></div>
            <ol class='scroll-spine-list'>
                ${items.map((item, i) => html`
                    <li class='scroll-spine-item'>
                        <span aria-hidden='true' class='scroll-spine-band'>
                            <span class='scroll-spine-fill'></span>
                        </span>
                        <button
                            aria-current='${() => state.active === i && 'location'}'
                            class='scroll-spine-button ${() => state.active === i && '--active'}'
                            onclick='${() => jump(i)}'
                            type='button'
                            ${this?.attributes?.[SCROLL_SPINE_BUTTON]}
                            ${attributes[SCROLL_SPINE_BUTTON]}
                        >
                            <span class='scroll-spine-label'>${item.label}</span>
                        </button>
                        <span aria-hidden='true' class='scroll-spine-preview'>${item.label}</span>
                    </li>
                `)}
            </ol>
            <div aria-hidden='true' class='scroll-spine-notch'></div>
        </nav>
    `;
}


export default Object.assign(template, { button: SCROLL_SPINE_BUTTON } as const);
export type { Item, State };
