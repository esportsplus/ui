import { computed, effect, reactive, read } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import close from '@esportsplus/ui/svg/close.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


const TOAST_CLOSE = Symbol.for('@esportsplus/ui/toast.close');

const TOAST_CONTENT = Symbol.for('@esportsplus/ui/toast.content');

const TOASTER_OVERFLOW = Symbol.for('@esportsplus/ui/toaster.overflow');


type A = Attributes & {
    [TOAST_CLOSE]?: Attributes;
    [TOAST_CONTENT]?: Attributes;
    dismissible?: boolean;
    duration?: number;
    onanimationend?: never;
    onconnect?: never;
    ondisconnect?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointermove?: never;
    onpointerup?: never;
    state?: State;
};

type Content = (state: State) => Renderable<any>;

// Signs of the edges a toast may be swiped off: toward its own edge, and sideways from a corner.
type Direction = {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
};

type Drag = {
    captured: boolean;
    direction: Direction;
    originX: number;
    originY: number;
    pointer: number;
    x: number;
    y: number;
};

type Layout = {
    count: number;
    frontmost: number;
    height: number;
    hidden: number;
    slots: Map<Toast, Slot>;
};

type Slot = {
    hidden: boolean;
    index: number;
    offset: number;
};

type State = {
    active: boolean;
    duration: number;
};

type Toast = {
    attributes: Partial<A>;
    content: Content;
    context?: Partial<A>;
    dismissible: boolean;
    measured: { height: number };
    state: State;
};

type ToasterAttributes = Attributes & {
    [TOASTER_OVERFLOW]?: Attributes;
    limit?: number;
    overflow?: (count: number) => Renderable<any>;
};


const DIRECTIONS: Record<string, Direction> = {
    'toaster--e': { x: 1, y: 0 },
    'toaster--n': { x: 0, y: -1 },
    'toaster--ne': { x: 1, y: -1 },
    'toaster--nw': { x: -1, y: -1 },
    'toaster--s': { x: 0, y: 1 },
    'toaster--se': { x: 1, y: 1 },
    'toaster--sw': { x: -1, y: 1 },
    'toaster--w': { x: -1, y: 0 }
};

// Past this, a released swipe dismisses.
const DISMISS_DISTANCE = 80;

const DURATION = 4000;

// Toasts shown while the stack is collapsed; the rest wait behind a count of them.
const LIMIT = 3;

const THRESHOLD = 6;


// Only toward the edges a toast may leave by.
function clamp(delta: number, sign: Direction['x']) {
    return sign === 0 ? 0 : Math.max(0, delta * sign) * sign;
}

// Unplaced toasters sit top right.
function direction(element: HTMLElement) {
    let toaster = element.closest('.toaster');

    for (let key in DIRECTIONS) {
        if (toaster?.classList.contains(key)) {
            return DIRECTIONS[key];
        }
    }

    return DIRECTIONS['toaster--ne'];
}

function row(toast: Toast, layout: () => Layout, remove: (toast: Toast) => void) {
    let drag: Drag | null = null,
        element: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        stop: VoidFunction | undefined;

    function release(e: PointerEvent, commit: boolean) {
        if (!drag || !element || e.pointerId !== drag.pointer) {
            return;
        }

        let { captured, x, y } = drag;

        drag = null;

        if (!captured) {
            return;
        }

        element.classList.remove('toast--swiping');

        // Dismissing, the exit carries on from where the pointer let go.
        if (commit && Math.hypot(x, y) > DISMISS_DISTANCE) {
            element.dataset.swipeDirection = Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
            toast.state.active = false;
            return;
        }

        element.style.removeProperty('--toast-swipe-x');
        element.style.removeProperty('--toast-swipe-y');
    }

    return html`
        <div
            class='toast'
            ${toast.context}
            ${toast.attributes}
            ${{
                class: () => !toast.state.active && 'toast--ending',
                // The toast's own clock is a CSS animation, so it pauses and resumes wherever the stylesheet says.
                onanimationend: (e: AnimationEvent) => {
                    if (e.target !== element) {
                        return;
                    }

                    if (e.animationName === 'toast-exit' || e.animationName === 'toast-fade') {
                        remove(toast);
                    }
                    else if (e.animationName === 'toast-timer') {
                        toast.state.active = false;
                    }
                },
                onconnect: (el: HTMLElement) => {
                    element = el;

                    // Layout height, unaffected by the collapsed scale.
                    observer = new ResizeObserver(() => {
                        toast.measured.height = el.offsetHeight;
                    });
                    observer.observe(el);

                    // Written directly rather than bound, so a swipe's own properties on the element survive.
                    stop = effect(() => {
                        let duration = toast.state.duration,
                            slot = layout().slots.get(toast);

                        el.style.setProperty('--toast-duration', `${duration}ms`);
                        el.style.setProperty('--toast-height', `${toast.measured.height}px`);
                        el.style.setProperty('--toast-index', String(slot?.index ?? 0));
                        el.style.setProperty('--toast-offset-y', `${slot?.offset ?? 0}px`);
                        el.style.setProperty('--toast-seconds', String(Math.ceil(duration / 1000)));
                        el.toggleAttribute('data-behind', (slot?.index ?? 0) > 0);
                        el.toggleAttribute('data-hidden', slot?.hidden ?? false);
                        el.toggleAttribute('data-timed', duration > 0);
                    });
                },
                ondisconnect: () => {
                    observer?.disconnect();
                    stop?.();
                },
                onpointercancel: (e: PointerEvent) => release(e, false),
                onpointerdown: (e: PointerEvent) => {
                    if (e.button !== 0 || !element) {
                        return;
                    }

                    drag = {
                        captured: false,
                        direction: direction(element),
                        originX: e.clientX,
                        originY: e.clientY,
                        pointer: e.pointerId,
                        x: 0,
                        y: 0
                    };
                },
                onpointermove: (e: PointerEvent) => {
                    if (!drag || !element || e.pointerId !== drag.pointer) {
                        return;
                    }

                    let x = clamp(e.clientX - drag.originX, drag.direction.x),
                        y = clamp(e.clientY - drag.originY, drag.direction.y);

                    // Capture only once it is clearly a swipe; capturing on press would retarget the click of a plain
                    // tap away from the control under the pointer.
                    if (!drag.captured) {
                        if (Math.hypot(x, y) < THRESHOLD) {
                            return;
                        }

                        drag.captured = true;
                        element.setPointerCapture(e.pointerId);
                        element.classList.add('toast--swiping');
                    }

                    drag.x = x;
                    drag.y = y;
                    element.style.setProperty('--toast-swipe-x', `${x}px`);
                    element.style.setProperty('--toast-swipe-y', `${y}px`);
                },
                onpointerup: (e: PointerEvent) => release(e, true)
            }}
        >
            <div class='toast-content' ${toast.context?.[TOAST_CONTENT]} ${toast.attributes[TOAST_CONTENT]}>
                ${toast.content(toast.state)}
            </div>
            ${toast.dismissible && html`
                <button
                    aria-label='Dismiss'
                    class='button toast-close'
                    type='button'
                    ${toast.context?.[TOAST_CLOSE]}
                    ${toast.attributes[TOAST_CLOSE]}
                    ${{
                        onclick: () => {
                            toast.state.active = false;
                        }
                    }}
                >
                    <svg aria-hidden='true'><use href='#${close}' /></svg>
                </button>
            `}
        </div>
    `;
}


// Each toaster owns its queue: 'content' is its stack, rendered afresh wherever it is placed, and 'toast' queues
// into it. The toast renders its content lazily with its 'state'; 'state.active = false' dismisses it, and changing
// 'state.duration' keeps the time already spent.
const toaster = Object.assign(
    function({ limit = LIMIT, overflow = (count: number) => `${count} more`, ...attributes }: ToasterAttributes = {}) {
        let toasts = reactive([] as Toast[]);

        // Newest in front. Leaving toasts keep the slot they left so their exit starts where they were, while the
        // live ones already close the gap behind them.
        let stack = computed(() => {
            let count = 0,
                frontmost = 0,
                full = 0,
                fullOffset = 0,
                height = 0,
                slots = new Map<Toast, Slot>();

            for (let i = toasts.length - 1; i >= 0; i--) {
                let toast = toasts[i],
                    size = toast.measured.height;

                if (toast.state.active) {
                    if (count === 0) {
                        frontmost = size;
                    }

                    slots.set(toast, { hidden: count >= limit, index: count, offset: height });
                    count++;
                    height += size;
                }
                else {
                    slots.set(toast, { hidden: full >= limit, index: full, offset: fullOffset });
                }

                full++;
                fullOffset += size;
            }

            return { count, frontmost, height, hidden: Math.max(0, count - limit), slots };
        });

        let layout = () => read(stack);

        let remove = (toast: Toast) => {
            let index = toasts.indexOf(toast);

            if (index !== -1) {
                toasts.splice(index, 1);
            }
        };

        return {
            content: () => html`
                <div
                    class='toaster'
                    ${attributes}
                    ${{
                        style: () => {
                            let { count, frontmost, height, hidden } = layout();

                            return `--toast-count: ${count}; --toast-frontmost-height: ${frontmost}px; --toast-hidden: ${hidden}; --toast-limit: ${limit}; --toast-stack-height: ${height}px;`;
                        }
                    }}
                >
                    ${html.reactive(toasts, (toast: Toast) => row(toast, layout, remove))}
                    <div aria-hidden='true' class='toaster-overflow' ${attributes[TOASTER_OVERFLOW]}>
                        ${() => overflow(layout().hidden)}
                    </div>
                </div>
            `,
            toast: component(
                function(
                    this: { attributes?: Partial<A> } | void,
                    { dismissible = true, duration = DURATION, state = reactive({ active: true, duration }), ...attributes }: A,
                    content: Content
                ) {
                    state.active = true;
                    toasts.push({
                        attributes,
                        content,
                        context: this?.attributes,
                        dismissible,
                        measured: reactive({ height: 0 }),
                        state
                    });

                    return undefined;
                },
                {
                    close: TOAST_CLOSE,
                    content: TOAST_CONTENT,
                    dismiss: () => {
                        for (let i = 0, n = toasts.length; i < n; i++) {
                            toasts[i].state.active = false;
                        }
                    }
                }
            )
        };
    },
    { overflow: TOASTER_OVERFLOW }
);


export default toaster;
