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
    onpointercancel?: never;
    onpointerdown?: never;
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
function expandable(element: HTMLElement, state: { active: boolean }) {
    let hovered = false;

    function enter(e: PointerEvent) {
        if (e.pointerType === 'touch') {
            return;
        }

        hovered = true;
        state.active = true;
    }

    function focusin(e: FocusEvent) {
        if ((e.target as HTMLElement).matches(':focus-visible')) {
            state.active = true;
        }
    }

    function focusout(e: FocusEvent) {
        if (!element.contains(e.relatedTarget as Node | null)) {
            state.active = hovered;
        }
    }

    function leave(e: PointerEvent) {
        if (e.pointerType === 'touch') {
            return;
        }

        hovered = false;
        state.active = element.matches(':has(:focus-visible)');
    }

    element.addEventListener('focusin', focusin);
    element.addEventListener('focusout', focusout);
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerleave', leave);

    return () => {
        element.removeEventListener('focusin', focusin);
        element.removeEventListener('focusout', focusout);
        element.removeEventListener('pointerenter', enter);
        element.removeEventListener('pointerleave', leave);
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
            release: VoidFunction | undefined,
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
                ${rail ? { class: '--rail' } : undefined}
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
                        if (rail) {
                            let previous = document.activeElement;

                            // 'show' focuses the first control, but a rail is part of the page rather than
                            // something the user opened, so focus stays where it was.
                            element.show();
                            (document.activeElement as HTMLElement | null)?.blur();

                            if (previous instanceof HTMLElement && previous !== document.body) {
                                previous.focus({ preventScroll: true });
                            }

                            release = expandable(element, state);
                        }

                        stop = effect(() => {
                            // A rail never closes; hover, focus or 'state.active' only expand it.
                            if (rail) {
                                element.classList.toggle('--active', state.active);
                                return;
                            }

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
                        release?.();
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
