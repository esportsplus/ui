import { computed, reactive, read } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { edge, type Edge } from '~/shared/anchor';
import { drag, fling, toward, type Fling } from '~/shared/drag';
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

type Layout = {
    anchor: number;
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


const DURATION = 4000;

// Toasts shown while the stack is collapsed; the rest wait behind a count of them.
const LIMIT = 3;

// Where a toaster sits without a placement: top right.
const UNPLACED: Edge = { x: 1, y: -1 };


function row(toast: Toast, layout: () => Layout, remove: (toast: Toast) => void) {
    let element: HTMLElement | undefined,
        frontmost = 0,
        // 'swipe' is where a swipe holds it, 'thrown' the way a dismissing swipe flings it on.
        local = reactive({ swipe: null as { x: number, y: number } | null, swiping: false, thrown: null as Fling | null }),
        observer: ResizeObserver | undefined;

    let gesture = drag({
        // Swiped back toward the edges the stack is pinned to.
        begin: (e, element) => e.button === 0 ? toward(edge(element.closest('.toaster') ?? element, 'toaster') ?? UNPLACED) : null,
        capture: () => {
            local.swiping = true;
        },
        move: (_, { x, y }) => {
            local.swipe = { x, y };
        },
        // Dismissing, it is thrown on from where the pointer let go until it has left the screen; under reduced
        // motion it fades there like any other exit.
        release: (element, drag, dismiss) => {
            local.swiping = false;
            local.thrown = dismiss ? fling(element, drag) : null;

            if (dismiss) {
                toast.state.active = false;
                return;
            }

            local.swipe = null;
        }
    });

    return html`
        <div
            class='toast'
            ${toast.context}
            ${toast.attributes}
            ${{
                ...gesture,
                class: [
                    () => !toast.state.active && 'toast--ending',
                    () => (layout().slots.get(toast)?.index ?? 0) > 0 && 'toast--behind',
                    () => layout().slots.get(toast)?.hidden && 'toast--hidden',
                    () => toast.state.duration > 0 && 'toast--timed',
                    () => local.swiping && 'toast--swiping',
                    () => local.thrown && 'toast--flung'
                ],
                // The toast's own clock is a CSS animation, so it pauses and resumes wherever the stylesheet says.
                onanimationend: (e: AnimationEvent) => {
                    if (e.target !== element) {
                        return;
                    }

                    if (e.animationName === 'toast-exit' || e.animationName === 'toast-fade' || e.animationName === 'toast-fling') {
                        remove(toast);
                    }
                    else if (e.animationName === 'toast-timer') {
                        toast.state.active = false;
                    }
                },
                onconnect: (el: HTMLElement) => {
                    // Layout height, unaffected by the collapsed scale.
                    observer = new ResizeObserver(() => {
                        toast.measured.height = el.offsetHeight;
                    });
                    observer.observe(el);
                },
                ondisconnect: () => {
                    observer?.disconnect();
                },
                onrender: (el: HTMLElement) => {
                    element = el;
                },
                style: () => {
                    let { active, duration } = toast.state,
                        { swipe, thrown } = local,
                        stack = layout(),
                        slot = stack.slots.get(toast),
                        style = `--toast-duration: ${duration}ms; --toast-height: ${toast.measured.height}px; --toast-index: ${slot?.index ?? 0}; --toast-offset-y: ${slot?.offset ?? 0}px; --toast-seconds: ${Math.ceil(duration / 1000)};`;

                    // Leaving, it keeps the front height it stood against: the stack closing up behind it would
                    // otherwise move its slot, bending its exit off the line it was thrown along.
                    if (active) {
                        frontmost = stack.frontmost;
                    }
                    else {
                        style += ` --toast-frontmost-height: ${frontmost}px;`;
                    }

                    if (swipe) {
                        style += ` --toast-swipe-x: ${swipe.x}px; --toast-swipe-y: ${swipe.y}px;`;
                    }

                    if (thrown) {
                        style += ` --toast-exit-duration: ${thrown.duration}ms; --toast-exit-timing-function: ${thrown.easing}; --translate-x: ${thrown.x}px; --translate-y: ${thrown.y}px;`;
                    }

                    return style;
                }
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
        // live ones already close the gap behind them. Side toasters center on the newest toast, leaving or not, so
        // they only recenter once it has gone rather than under it on its way out; with none live, it is the front.
        let stack = computed(() => {
            let anchor = 0,
                count = 0,
                frontmost = 0,
                full = 0,
                fullOffset = 0,
                height = 0,
                slots = new Map<Toast, Slot>();

            for (let i = toasts.length - 1; i >= 0; i--) {
                let toast = toasts[i],
                    size = toast.measured.height;

                if (i === toasts.length - 1) {
                    anchor = size;
                    frontmost = size;
                }

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

            return { anchor, count, frontmost, height, hidden: Math.max(0, count - limit), slots };
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
                            let { anchor, count, frontmost, height, hidden } = layout();

                            return `--toast-anchor-height: ${anchor}px; --toast-count: ${count}; --toast-frontmost-height: ${frontmost}px; --toast-hidden: ${hidden}; --toast-limit: ${limit}; --toast-stack-height: ${height}px;`;
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
