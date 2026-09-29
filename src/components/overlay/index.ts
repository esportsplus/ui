import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    [OVERLAY_HANDLE]?: Attributes;
    drag?: boolean;
    modal?: boolean;
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    onfocusin?: never;
    onfocusout?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    onpointermove?: never;
    onpointerup?: never;
    rail?: boolean;
    state?: { active: boolean };
};

type Direction = {
    axis: 'x' | 'y';
    sign: 1 | -1;
};

type Drag = Direction & {
    captured: boolean;
    distance: number;
    origin: number;
    pointer: number;
    start: number;
};


// Edge placements dismiss by dragging back toward their edge; centered overlays don't drag.
const DIRECTIONS: Record<string, Direction> = {
    'overlay--e': { axis: 'x', sign: 1 },
    'overlay--n': { axis: 'y', sign: -1 },
    'overlay--s': { axis: 'y', sign: 1 },
    'overlay--w': { axis: 'x', sign: -1 }
};

// Otherwise the overlay must be dragged past this share of its size.
const DISMISS_DISTANCE = 0.25;

// A release faster than this (px per ms) dismisses however short the drag, so a quick flick is enough.
const FLICK_VELOCITY = 0.11;

const INTERACTIVE = 'a, button, input, select, textarea, [contenteditable]';

const OVERLAY_HANDLE = Symbol.for('@esportsplus/ui/overlay.handle');

const THRESHOLD = 4;


function direction(element: HTMLElement) {
    for (let key in DIRECTIONS) {
        if (element.classList.contains(key)) {
            return DIRECTIONS[key];
        }
    }
}

// Rails expand while a mouse or pen rests on them or keyboard focus is inside. Touch has no hover, and a tap
// would enter and leave at once; a click that leaves focus on a link shouldn't hold the rail open either.
function expandable(state: { active: boolean }): Attributes<HTMLDialogElement> {
    let hovered = false;

    return {
        onfocusin: (e: FocusEvent) => {
            if ((e.target as HTMLElement).matches(':focus-visible')) {
                state.active = true;
            }
        },
        onfocusout: function(this: HTMLDialogElement, e: FocusEvent) {
            if (!this.contains(e.relatedTarget as Node | null)) {
                state.active = hovered;
            }
        },
        onpointerenter: (e: PointerEvent) => {
            if (e.pointerType === 'touch') {
                return;
            }

            hovered = true;
            state.active = true;
        },
        onpointerleave: function(this: HTMLDialogElement, e: PointerEvent) {
            if (e.pointerType === 'touch') {
                return;
            }

            hovered = false;
            state.active = this.matches(':has(:focus-visible)');
        }
    };
}

async function finished(element: HTMLElement) {
    let animations = element.getAnimations();

    for (let i = 0, n = animations.length; i < n; i++) {
        // Reopening mid-close cancels the transition, which rejects 'finished'.
        await animations[i].finished.catch(() => {});
    }
}

function outside(element: HTMLElement, e: MouseEvent) {
    let rect = element.getBoundingClientRect();

    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
}

function size(element: HTMLElement, axis: Direction['axis']) {
    return axis === 'x' ? element.offsetWidth : element.offsetHeight;
}

function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}


export default component(
    function(this, { drag = false, modal = true, rail = false, state = reactive({ active: false }), ...attributes }: A, content) {
        let draggable = drag && !rail,
            dragging: Drag | null = null,
            stop: VoidFunction | undefined;

        function settle(element: HTMLElement, close: boolean) {
            // Released styles match what the resulting state renders, so the transition picks up from
            // wherever the finger let go.
            element.classList.remove('--dragging');
            element.style.removeProperty('--progress');
            element.style.removeProperty('translate');

            if (close) {
                state.active = false;
            }
        }

        return html`
            <dialog
                class='overlay'
                ${draggable ? { class: '--draggable', tabindex: -1 } : undefined}
                ${rail ? { class: ['--rail', () => state.active && '--active'], ...expandable(state) } : undefined}
                ${this?.attributes}
                ${attributes}
                ${{
                    oncancel: (e) => {
                        e.preventDefault();
                        state.active = false;
                    },
                    onclick: (e) => {
                        let element = e.currentTarget as HTMLDialogElement;

                        if (e.target === element && outside(element, e)) {
                            state.active = false;
                        }
                    },
                    onclose: () => {
                        state.active = false;
                    },
                    onconnect: (element: HTMLDialogElement) => {
                        // A rail never closes; hover, focus or 'state.active' only expand it, through its bound class.
                        if (rail) {
                            let previous = document.activeElement;

                            // 'show' focuses the first control, but a rail is part of the page rather than
                            // something the user opened, so focus stays where it was.
                            element.show();
                            (document.activeElement as HTMLElement | null)?.blur();

                            if (previous instanceof HTMLElement && previous !== document.body) {
                                previous.focus({ preventScroll: true });
                            }

                            return;
                        }

                        // '--active' is written here rather than bound: it has to land between 'showModal()' and the
                        // style flush that starts the transition, and closing waits on the transitions it starts.
                        stop = effect(() => {
                            if (state.active) {
                                if (!element.open) {
                                    if (modal) {
                                        element.showModal();
                                    }
                                    else {
                                        element.show();
                                    }

                                    // Draggable overlays take focus themselves; opening would land on the first
                                    // control instead, raising the on-screen keyboard for inputs.
                                    if (draggable) {
                                        element.focus({ preventScroll: true });
                                    }

                                    // Commit the closed styles first so adding '--active' transitions in.
                                    element.getBoundingClientRect();
                                }

                                element.classList.add('--active');
                                return;
                            }

                            element.classList.remove('--active');

                            if (!element.open) {
                                return;
                            }

                            void finished(element).then(() => {
                                if (!state.active) {
                                    element.close();
                                }
                            });
                        });
                    },
                    ondisconnect: () => {
                        stop?.();
                    },
                    onpointercancel: (e: PointerEvent) => {
                        if (!dragging || e.pointerId !== dragging.pointer) {
                            return;
                        }

                        let captured = dragging.captured;

                        dragging = null;

                        if (captured) {
                            settle(e.currentTarget as HTMLDialogElement, false);
                        }
                    },
                    onpointerdown: (e: PointerEvent) => {
                        if (!draggable || e.button !== 0 || !state.active) {
                            return;
                        }

                        let element = e.currentTarget as HTMLDialogElement,
                            d = direction(element);

                        if (!d || outside(element, e) || (e.target as HTMLElement).closest(INTERACTIVE)) {
                            return;
                        }

                        dragging = {
                            ...d,
                            captured: false,
                            distance: 0,
                            origin: d.axis === 'x' ? e.clientX : e.clientY,
                            pointer: e.pointerId,
                            start: performance.now()
                        };
                    },
                    onpointermove: (e: PointerEvent) => {
                        if (!dragging || e.pointerId !== dragging.pointer) {
                            return;
                        }

                        let element = e.currentTarget as HTMLDialogElement,
                            { axis, origin, sign } = dragging,
                            distance = ((axis === 'x' ? e.clientX : e.clientY) - origin) * sign;

                        // Capture only once it is clearly a drag; capturing on press would retarget the click
                        // of a plain tap to the dialog, away from the control under the finger.
                        if (!dragging.captured) {
                            if (Math.abs(distance) <= THRESHOLD) {
                                return;
                            }

                            dragging.captured = true;
                            element.setPointerCapture(e.pointerId);
                            element.classList.add('--dragging');
                        }

                        // Away from the edge it still gives, but less the further you pull, like stretching
                        // something that wants to snap back.
                        if (distance < 0) {
                            distance = -Math.pow(-distance, 0.7);
                        }

                        dragging.distance = distance;
                        element.style.setProperty('--progress', String(Math.max(distance, 0) / size(element, axis)));
                        element.style.translate = axis === 'x' ? `${distance * sign}px 0` : `0 ${distance * sign}px`;
                    },
                    onpointerup: (e: PointerEvent) => {
                        if (!dragging || e.pointerId !== dragging.pointer) {
                            return;
                        }

                        let element = e.currentTarget as HTMLDialogElement,
                            { axis, captured, distance, start } = dragging,
                            velocity = distance / (performance.now() - start);

                        dragging = null;

                        if (!captured) {
                            return;
                        }

                        // The click that follows lands on the dialog, and beyond the overlay it would read as
                        // a backdrop click.
                        addEventListener('click', swallow, true);
                        setTimeout(() => removeEventListener('click', swallow, true));

                        settle(element, distance > size(element, axis) * DISMISS_DISTANCE || velocity > FLICK_VELOCITY);
                    }
                }}
            >
                ${draggable && html`
                    <div
                        aria-hidden='true'
                        class='overlay-handle'
                        ${this?.attributes?.[OVERLAY_HANDLE]}
                        ${attributes[OVERLAY_HANDLE]}
                    ></div>
                `}
                ${content}
            </dialog>
        `;
    },
    { handle: OVERLAY_HANDLE }
);
