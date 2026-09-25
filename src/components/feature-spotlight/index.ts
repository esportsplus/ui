import { effect, reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    [FEATURE_SPOTLIGHT_ITEM]?: Attributes;
    [FEATURE_SPOTLIGHT_STAGE]?: Attributes;
    features: Feature[];
    screenshot: Renderable<unknown>;
    size: { height: number, width: number };
    state?: { active: number };
};

type Feature = {
    body: string;
    // Given in the screenshot's own design pixels; for an <img>, where there is nothing to measure.
    region?: Region;
    // The 'data-spot' value of an element inside the screenshot, measured from the real layout so the
    // spotlight can't drift from what it frames.
    spot?: string;
    title: string;
};

type Region = {
    h: number;
    w: number;
    x: number;
    y: number;
};

type Spring = {
    target: number;
    value: number;
    velocity: number;
};


// Critically damped, settling in about 0.8s: camera moves are explanatory, not UI feedback, so slow enough
// for the eye to follow the pan and see where on the product it lands.
const CAMERA = 11.5;

// How far above the first feature, or below the last, the reading line may wander before the camera pulls
// back to the whole screenshot.
const CATCH = 28;

const FEATURE_SPOTLIGHT_ITEM = Symbol.for('@esportsplus/ui/feature-spotlight.item');

const FEATURE_SPOTLIGHT_STAGE = Symbol.for('@esportsplus/ui/feature-spotlight.stage');

// Past this the screenshot turns into a blurry blow-up of a few words.
const MAX_ZOOM = 2.2;

// Room kept around a region when the camera frames it, in design pixels.
const PAD = 18;

const REST = 0.01;


// Offsets ignore transforms, so this reads design pixels however far the screenshot is scaled or zoomed.
function measure(root: HTMLElement, spot: string): Region | null {
    let element = root.querySelector<HTMLElement>(`[data-spot="${CSS.escape(spot)}"]`);

    if (!element) {
        return null;
    }

    let node: HTMLElement | null = element,
        x = 0,
        y = 0;

    while (node && node !== root) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    }

    return { h: element.offsetHeight, w: element.offsetWidth, x, y };
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scroller(element: HTMLElement) {
    let node = element.parentElement;

    while (node) {
        let overflow = getComputedStyle(node).overflowY;

        if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }

        node = node.parentElement;
    }

    return null;
}

function spring(value: number): Spring {
    return { target: value, value, velocity: 0 };
}

function viewport(root: HTMLElement | null) {
    if (!root || root === document.body || root === document.documentElement) {
        return { bottom: innerHeight, top: 0 };
    }

    return root.getBoundingClientRect();
}


export default Object.assign(
    function(
        this: { attributes?: A } | void,
        { features, screenshot, size, state = reactive({ active: -1 }), ...attributes }: A
    ) {
        let camera: HTMLElement | undefined,
            fit = reactive({ value: 0.5 }),
            frame = 0,
            hole: HTMLElement | undefined,
            list: HTMLElement | undefined,
            // A click scrolls the feature into place; until that scroll settles the passing features shouldn't
            // steal the camera.
            lockedUntil = 0,
            observer: ResizeObserver | undefined,
            root: HTMLElement | undefined,
            shot: HTMLElement | undefined,
            springs = {
                h: spring(size.height),
                holeX: spring(0),
                holeY: spring(0),
                scale: spring(1),
                w: spring(size.width),
                x: spring(0),
                y: spring(0)
            },
            stage: HTMLElement | undefined,
            stop: VoidFunction | undefined,
            texts: HTMLElement[] = [],
            tick = 0,
            time = 0,
            view: HTMLElement | undefined;

        function apply() {
            if (!camera || !hole) {
                return;
            }

            camera.style.transform = `translate(${springs.x.value}px, ${springs.y.value}px) scale(${springs.scale.value})`;
            hole.style.height = `${springs.h.value}px`;
            hole.style.translate = `${springs.holeX.value}px ${springs.holeY.value}px`;
            hole.style.width = `${springs.w.value}px`;
        }

        function aim(feature: Feature | null) {
            let region = feature && shot && feature.spot ? measure(shot, feature.spot) : (feature?.region ?? null),
                { height: H, width: W } = size,
                box: Region = { h: H, w: W, x: 0, y: 0 },
                x = 0,
                y = 0,
                zoom = 1;

            if (region) {
                box = { h: region.h + 12, w: region.w + 12, x: region.x - 6, y: region.y - 6 };
                zoom = Math.min(W / (region.w + PAD * 2), H / (region.h + PAD * 2), MAX_ZOOM);

                // Centre the region, but never pan past the screenshot's edges.
                x = Math.min(0, Math.max(W - W * zoom, W / 2 - (region.x + region.w / 2) * zoom));
                y = Math.min(0, Math.max(H - H * zoom, H / 2 - (region.y + region.h / 2) * zoom));
            }

            hole?.classList.toggle('--active', region !== null);

            springs.h.target = box.h;
            springs.holeX.target = box.x;
            springs.holeY.target = box.y;
            springs.w.target = box.w;

            // No camera travel under reduced motion: the spotlight alone points at the region.
            if (reduced()) {
                springs.scale.target = 1;
                springs.x.target = 0;
                springs.y.target = 0;

                for (let key in springs) {
                    let s = springs[key as keyof typeof springs];

                    s.value = s.target;
                    s.velocity = 0;
                }

                apply();
                return;
            }

            springs.scale.target = zoom;
            springs.x.target = x * fit.value;
            springs.y.target = y * fit.value;

            if (!tick) {
                time = 0;
                tick = requestAnimationFrame(step);
            }
        }

        function detect() {
            frame = 0;

            if (performance.now() < lockedUntil || !list || !stage || !root) {
                return;
            }

            let bounds = viewport(scroller(root)),
                l = list.getBoundingClientRect(),
                s = stage.getBoundingClientRect(),
                // Side by side, the reading line is the middle of the view. Stacked, the screenshot pins to the
                // top, so it's the middle of what's left.
                top = s.left < l.right - 1 ? Math.max(bounds.top, s.bottom) : bounds.top,
                line = (top + bounds.bottom) / 2,
                best = Infinity,
                found = -1;

            // Inside the list the nearest feature always holds the camera, so the gaps between features never
            // drop back to the overview; only before the first and after the last does it pull back.
            for (let i = 0, n = texts.length; i < n; i++) {
                let r = texts[i].getBoundingClientRect(),
                    d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0,
                    outside = (i === 0 && line < r.top - CATCH) || (i === n - 1 && line > r.bottom + CATCH);

                if (!outside && d < best) {
                    best = d;
                    found = i;
                }
            }

            state.active = found;
        }

        function layout() {
            if (!root || !stage) {
                return;
            }

            let bounds = viewport(scroller(root));

            // Centres the pinned screenshot in the view when side by side.
            root.style.setProperty('--sticky-top', `${Math.max(16, (bounds.bottom - bounds.top - stage.offsetHeight) / 2)}px`);
            onscroll();
        }

        function onscroll() {
            if (!frame) {
                frame = requestAnimationFrame(detect);
            }
        }

        function select(i: number, now: number) {
            let text = texts[i];

            if (!text || !list || !stage || !root) {
                return;
            }

            state.active = i;

            let element = scroller(root),
                bounds = viewport(element),
                l = list.getBoundingClientRect(),
                s = stage.getBoundingClientRect(),
                // Where the pinned screenshot will sit once scrolled, not where it is now.
                top = s.left < l.right - 1 ? bounds.top + s.height : bounds.top,
                r = text.getBoundingClientRect(),
                delta = r.top + r.height / 2 - (top + bounds.bottom) / 2,
                still = reduced();

            lockedUntil = now + (still ? 50 : 900);
            (element ?? document.scrollingElement ?? document.documentElement).scrollBy({ behavior: still ? 'auto' : 'smooth', top: delta });
        }

        function step(now: number) {
            // Fixed substeps keep the spring on wall-clock time at any frame rate; a stalled tab resumes from a
            // capped gap instead of integrating one huge, unstable step.
            let elapsed = time ? Math.min((now - time) / 1000, 0.25) : 1 / 60,
                moving = false,
                steps = Math.max(1, Math.ceil(elapsed * 60)),
                dt = elapsed / steps;

            time = now;

            for (let key in springs) {
                let s = springs[key as keyof typeof springs],
                    tolerance = key === 'scale' ? REST / 100 : REST;

                for (let i = 0; i < steps; i++) {
                    s.velocity += (CAMERA * CAMERA * (s.target - s.value) - 2 * CAMERA * s.velocity) * dt;
                    s.value += s.velocity * dt;
                }

                if (Math.abs(s.target - s.value) < tolerance && Math.abs(s.velocity) < tolerance) {
                    s.value = s.target;
                    s.velocity = 0;
                }
                else {
                    moving = true;
                }
            }

            apply();
            tick = moving ? requestAnimationFrame(step) : 0;
        }

        return html`
            <section
                class='feature-spotlight'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        root = element;
                        // Scroll doesn't bubble, but capture sees whichever ancestor scrolls the section.
                        addEventListener('scroll', onscroll, true);
                        addEventListener('resize', layout);

                        observer = new ResizeObserver(() => {
                            if (view) {
                                fit.value = view.offsetWidth / size.width;
                            }

                            layout();
                        });

                        if (view) {
                            observer.observe(view);
                        }

                        let parent = scroller(element);

                        if (parent) {
                            observer.observe(parent);
                        }

                        stop = effect(() => {
                            aim(features[state.active] ?? null);
                        });
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        cancelAnimationFrame(tick);
                        removeEventListener('scroll', onscroll, true);
                        removeEventListener('resize', layout);
                        observer?.disconnect();
                        stop?.();
                    }
                }}
            >
                <div class='feature-spotlight-layout'>
                    <div class='feature-spotlight-pin'>
                        <figure
                            aria-hidden='true'
                            class='feature-spotlight-stage'
                            ${this?.attributes?.[FEATURE_SPOTLIGHT_STAGE]}
                            ${attributes[FEATURE_SPOTLIGHT_STAGE]}
                            ${{ onrender: (element: HTMLElement) => { stage = element; } }}
                        >
                            <div class='feature-spotlight-chrome'>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <div
                                class='feature-spotlight-view'
                                style='aspect-ratio: ${size.width} / ${size.height};'
                                ${{ onrender: (element: HTMLElement) => { view = element; } }}
                            >
                                <div class='feature-spotlight-camera' ${{ onrender: (element: HTMLElement) => { camera = element; } }}>
                                    <div
                                        class='feature-spotlight-shot'
                                        ${{
                                            onrender: (element: HTMLElement) => {
                                                shot = element;
                                            },
                                            style: () => `height: ${size.height}px; scale: ${fit.value}; width: ${size.width}px;`
                                        }}
                                    >
                                        ${screenshot}
                                        <div
                                            class='feature-spotlight-hole'
                                            style='height: ${size.height}px; width: ${size.width}px;'
                                            ${{ onrender: (element: HTMLElement) => { hole = element; } }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </figure>
                    </div>

                    <ol class='feature-spotlight-list' ${{ onrender: (element: HTMLElement) => { list = element; } }}>
                        ${features.map((feature, i) => html`
                            <li
                                class='feature-spotlight-item ${() => state.active === i && '--active'}'
                                ${this?.attributes?.[FEATURE_SPOTLIGHT_ITEM]}
                                ${attributes[FEATURE_SPOTLIGHT_ITEM]}
                            >
                                <div ${{ onrender: (element: HTMLElement) => { texts[i] = element; } }}>
                                    <button
                                        class='feature-spotlight-button'
                                        type='button'
                                        ${{
                                            'aria-pressed': () => state.active === i ? 'true' : 'false',
                                            // Event time shares performance.now()'s clock.
                                            onclick: (e: MouseEvent) => select(i, e.timeStamp)
                                        }}
                                    >
                                        <span aria-hidden='true' class='feature-spotlight-rail'>
                                            <span></span>
                                        </span>
                                        <span class='feature-spotlight-number'>${String(i + 1).padStart(2, '0')}</span>
                                        <span class='feature-spotlight-title'>${feature.title}</span>
                                        <span class='feature-spotlight-body'>${feature.body}</span>
                                    </button>
                                </div>
                            </li>
                        `)}
                    </ol>
                </div>

                <p aria-live='polite' class='feature-spotlight-sr'>
                    ${() => state.active >= 0 && features[state.active] ? `Showing: ${features[state.active].title}` : ''}
                </p>
            </section>
        `;
    },
    { item: FEATURE_SPOTLIGHT_ITEM, stage: FEATURE_SPOTLIGHT_STAGE } as const
);
export type { Feature, Region };
