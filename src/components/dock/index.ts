import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import '~/components/tooltip';
import './scss/index.scss';


type A = Attributes & {
    [DOCK_BUTTON]?: Attributes;
    items: Item[];
    label?: string;
    onlaunch?: (label: string) => void;
};

type Item = {
    icon: Renderable<unknown>;
    label: string;
    running?: boolean;
    state?: { running: boolean };
};

type Spring = {
    button: HTMLElement;
    size: number;
    target: number;
    velocity: number;
};


const DOCK_BUTTON = Symbol.for('@esportsplus/ui/dock.button');

const EASE_IN = 'cubic-bezier(0.42, 0, 1, 1)';

const EASE_OUT = 'cubic-bezier(0, 0, 0.58, 1)';

// Up fast and down with gravity; each landing is the quickest part. Long on purpose: it is the "starting up"
// signal itself, it plays once per app, and input is never blocked while it plays.
const HOP: Keyframe[] = [
    { easing: EASE_OUT, offset: 0, translate: '0 0' },
    { easing: EASE_IN, offset: 0.3, translate: '0 -22px' },
    { easing: EASE_OUT, offset: 0.55, translate: '0 0' },
    { easing: EASE_IN, offset: 0.78, translate: '0 -9px' },
    { offset: 1, translate: '0 0' }
];

const HOP_DURATION = 700;

// How far from the cursor, in px, an icon still feels the pull.
const REACH = 140;

// Light mass so the icons keep up with a fast cursor.
const SPRING = { damping: 12, mass: 0.1, stiffness: 170 };

// Squashes on each landing, so the icon reads as having weight.
const SQUASH: Keyframe[] = [
    { offset: 0, scale: '1 1' },
    { offset: 0.3, scale: '0.97 1.04' },
    { offset: 0.55, scale: '1.08 0.9' },
    { offset: 0.7, scale: '0.99 1.02' },
    { offset: 0.8, scale: '1.03 0.96' },
    { offset: 1, scale: '1 1' }
];

const STEP = 1 / 240;

// The first label waits so a cursor passing through doesn't flash one.
const TOOLTIP_DELAY = 300;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


const dock = ({ items, label = 'Dock', onlaunch, ...attributes }: A) => {
    let frame = 0,
        hops = new Map<HTMLElement, Animation[]>(),
        peak = 72,
        rest = 40,
        springs: Spring[] = [],
        time = 0,
        timer: ReturnType<typeof setTimeout> | undefined,
        tip = reactive({ instant: false, label: '' });

    function hide() {
        clearTimeout(timer);
        tip.label = '';
    }

    function launch(item: Item, state: { running: boolean }, button: HTMLElement) {
        // Already running: a click just brings it forward, no fanfare.
        if (state.running) {
            return;
        }

        state.running = true;
        onlaunch?.(item.label);

        if (reduced()) {
            return;
        }

        for (let animation of hops.get(button) ?? []) {
            animation.cancel();
        }

        hops.set(button, [
            button.animate(HOP, { duration: HOP_DURATION }),
            button.animate(SQUASH, { duration: HOP_DURATION, easing: 'ease-in-out' })
        ]);
    }

    function pull(x: number) {
        for (let i = 0, n = springs.length; i < n; i++) {
            let spring = springs[i],
                box = spring.button.getBoundingClientRect(),
                distance = Math.min(Math.abs(x - box.left - box.width / 2), REACH);

            spring.target = peak - (peak - rest) * (distance / REACH);
        }

        if (!frame) {
            time = 0;
            frame = requestAnimationFrame(tick);
        }
    }

    function show(label: string) {
        clearTimeout(timer);

        if (tip.label) {
            tip.instant = true;
            tip.label = label;
            return;
        }

        timer = setTimeout(() => {
            tip.instant = false;
            tip.label = label;
        }, TOOLTIP_DELAY);
    }

    function tick(now: number) {
        // Capped so a stalled tab resumes without integrating one huge step.
        let dt = time ? Math.min((now - time) / 1000, 1 / 30) : 1 / 60,
            moving = false;

        time = now;

        for (let i = 0, n = springs.length; i < n; i++) {
            let spring = springs[i];

            for (let t = 0; t < dt; t += STEP) {
                let h = Math.min(STEP, dt - t);

                spring.velocity += ((SPRING.stiffness * (spring.target - spring.size) - SPRING.damping * spring.velocity) / SPRING.mass) * h;
                spring.size += spring.velocity * h;
            }

            if (Math.abs(spring.target - spring.size) < 0.01 && Math.abs(spring.velocity) < 0.01) {
                spring.size = spring.target;
                spring.velocity = 0;
            }
            else {
                moving = true;
            }

            spring.button.style.setProperty('--size', `${spring.size}px`);
        }

        frame = moving ? requestAnimationFrame(tick) : 0;
    }

    onCleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);

        for (let animations of hops.values()) {
            for (let animation of animations) {
                animation.cancel();
            }
        }
    });

    return html`
        <nav
            class='dock'
            ${attributes}
            ${{
                'aria-label': label,
                onconnect: (element: HTMLElement) => {
                    let style = getComputedStyle(element);

                    peak = parseFloat(style.getPropertyValue('--size-peak')) || peak;
                    rest = parseFloat(style.getPropertyValue('--size-rest')) || rest;

                    for (let i = 0, n = springs.length; i < n; i++) {
                        springs[i].size = springs[i].target = rest;
                    }
                },
                onpointerleave: () => {
                    hide();
                    pull(Infinity);
                },
                onpointermove: (e: PointerEvent) => {
                    if (e.pointerType === 'touch' || reduced()) {
                        return;
                    }

                    pull(e.clientX);
                }
            }}
        >
            ${items.map((item) => {
                let button: HTMLElement | undefined,
                    state = item.state ?? reactive({ running: item.running ?? false });

                return html`
                    <span class='dock-item tooltip ${() => tip.label === item.label && '--active'}'>
                        <button
                            class='dock-button'
                            type='button'
                            ${attributes[DOCK_BUTTON]}
                            ${{
                                'aria-label': () => state.running ? `${item.label}, running` : item.label,
                                onblur: hide,
                                onclick: () => {
                                    if (button) {
                                        launch(item, state, button);
                                    }
                                },
                                onfocus: () => {
                                    clearTimeout(timer);
                                    tip.instant = false;
                                    tip.label = item.label;
                                },
                                onpointerenter: (e: PointerEvent) => {
                                    if (e.pointerType !== 'touch') {
                                        show(item.label);
                                    }
                                },
                                onrender: (element: HTMLElement) => {
                                    button = element;
                                    springs.push({ button: element, size: rest, target: rest, velocity: 0 });
                                }
                            }}
                        >
                            ${item.icon}
                        </button>
                        <span
                            aria-hidden='true'
                            class='dock-label tooltip-message tooltip-message--n ${() => tip.instant && tip.label === item.label && '--instant'}'
                        >
                            ${item.label}
                        </span>
                        <span aria-hidden='true' class='dock-light ${() => state.running && '--active'}'></span>
                    </span>
                `;
            })}
        </nav>
    `;
};


export default Object.assign(dock, { button: DOCK_BUTTON } as const);
export type { Item };
