import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    onconnect?: never;
    ondisconnect?: never;
    ondocumentkeydown?: never;
    sheets: (Attributes & { content: Renderable<unknown> })[];
    state?: { depth: number };
};

type Pointer = {
    active: boolean;
    from: number;
    height: number;
    id: number;
    index: number;
    limit: number;
    start: number;
    time: number;
    velocity: number;
    y: number;
};


// Fraction of the sheet's height, or downward px/s, past which a release dismisses instead of settling.
const DISMISS_DISTANCE = 0.3;

const DISMISS_VELOCITY = 500;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Upward drags approach the overscroll limit asymptotically; this is the distance to reach half of it.
const RESISTANCE = 120;

// A release this long after the last move is a hold, not a flick.
const STALE = 100;

// Movement before a press becomes a drag, so taps still reach the sheet's buttons.
const THRESHOLD = 4;


function rubberband(y: number, limit: number) {
    return y < 0 ? -(limit * (1 - 1 / (1 + -y / RESISTANCE))) : y;
}


export default component<A>(
    function(this, { sheets, state = reactive({ depth: 0 }), ...attributes }, content) {
        let drag = reactive({ index: -1, progress: 1, y: 0 }),
            elements: HTMLElement[] = [],
            frame = 0,
            openers: (HTMLElement | null)[] = [],
            pointer: Pointer | undefined,
            stop: VoidFunction | undefined;

        function covered(index: number) {
            return drag.index === index ? drag.progress : Number(index < state.depth);
        }

        function release(e: PointerEvent) {
            if (!pointer || e.pointerId !== pointer.id) {
                return;
            }

            let { active, height, index, time, velocity } = pointer;

            pointer = undefined;

            if (!active) {
                return;
            }

            if (e.timeStamp - time > STALE) {
                velocity = 0;
            }

            if (drag.y > height * DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
                state.depth = index;
            }

            drag.index = -1;
            drag.progress = 1;
            drag.y = 0;
        }

        return html`
            <div
                class='stacked-drawer'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => drag.index !== -1 && '--dragging',
                    onconnect: (element: HTMLElement) => {
                        let previous = state.depth;

                        stop = effect(() => {
                            let depth = state.depth;

                            if (depth === previous) {
                                return;
                            }

                            let opening = depth > previous;

                            if (opening) {
                                for (let i = previous; i < depth; i++) {
                                    openers[i] = document.activeElement as HTMLElement | null;
                                }
                            }

                            previous = depth;

                            // The 'inert' bindings settle in the same batch as this effect, and an inert target refuses focus.
                            cancelAnimationFrame(frame);
                            frame = requestAnimationFrame(() => {
                                if (opening) {
                                    elements[depth - 1]?.focus({ preventScroll: true });
                                    return;
                                }

                                let active = document.activeElement;

                                if (!active || active === document.body || element.contains(active)) {
                                    openers[depth]?.focus({ preventScroll: true });
                                }
                            });
                        });
                    },
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        stop?.();
                    },
                    ondocumentkeydown: function(e) {
                        if (!state.depth || !this.contains(document.activeElement)) {
                            return;
                        }

                        if (e.key === 'Escape') {
                            e.preventDefault();
                            state.depth--;
                            return;
                        }

                        if (e.key !== 'Tab') {
                            return;
                        }

                        let sheet = elements[state.depth - 1],
                            focusable = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);

                        if (!focusable.length) {
                            e.preventDefault();
                            sheet.focus();
                            return;
                        }

                        let active = document.activeElement,
                            first = focusable[0],
                            last = focusable[focusable.length - 1];

                        if (e.shiftKey && (active === first || active === sheet)) {
                            e.preventDefault();
                            last.focus();
                        }
                        else if (!e.shiftKey && active === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }}
            >
                <div
                    class='stacked-drawer-page'
                    ${{
                        class: () => state.depth > 0 && '--covered',
                        inert: () => state.depth > 0,
                        style: () => `--covered: ${covered(0)};`
                    }}
                >
                    ${content}
                </div>

                ${sheets.map(({ content, ...sheet }, index) => html`
                    <div
                        aria-modal='true'
                        class='stacked-drawer-sheet'
                        role='dialog'
                        tabindex='-1'
                        ${sheet}
                        ${{
                            class: [
                                () => index < state.depth && '--active',
                                () => index + 1 < state.depth && '--covered'
                            ],
                            inert: () => index !== state.depth - 1,
                            onconnect: (element: HTMLElement) => {
                                elements[index] = element;
                            },
                            onpointercancel: release,
                            onpointerdown: (e) => {
                                if (pointer || index !== state.depth - 1 || (e.pointerType === 'mouse' && e.button !== 0)) {
                                    return;
                                }

                                pointer = {
                                    active: false,
                                    from: 0,
                                    height: 0,
                                    id: e.pointerId,
                                    index,
                                    limit: 0,
                                    start: e.clientY,
                                    time: e.timeStamp,
                                    velocity: 0,
                                    y: 0
                                };
                            },
                            onpointermove: (e) => {
                                if (!pointer || e.pointerId !== pointer.id) {
                                    return;
                                }

                                let element = e.currentTarget as HTMLElement;

                                if (!pointer.active) {
                                    if (Math.abs(e.clientY - pointer.start) < THRESHOLD) {
                                        return;
                                    }

                                    let limit = parseFloat(getComputedStyle(element).paddingBottom) || 0,
                                        parent = element.offsetParent;

                                    // Grabbing a sheet mid-transition continues from where it is drawn, not from its target.
                                    pointer.active = true;
                                    pointer.from = parent ? element.getBoundingClientRect().top - parent.getBoundingClientRect().top - element.offsetTop : 0;
                                    pointer.height = element.offsetHeight - limit;
                                    pointer.limit = limit;
                                    pointer.start = e.clientY;
                                    pointer.y = pointer.from;

                                    element.setPointerCapture(e.pointerId);
                                    drag.index = index;
                                }

                                let y = rubberband(pointer.from + e.clientY - pointer.start, pointer.limit),
                                    elapsed = e.timeStamp - pointer.time;

                                if (elapsed > 0) {
                                    pointer.velocity = (y - pointer.y) / elapsed * 1000;
                                }

                                pointer.time = e.timeStamp;
                                pointer.y = y;

                                drag.progress = Math.min(Math.max(1 - y / pointer.height, 0), 1);
                                drag.y = y;
                            },
                            onpointerup: release,
                            style: () => `--covered: ${covered(index + 1)}; --index: ${index}; --offset: ${drag.index === index ? drag.y : 0}px;`
                        }}
                    >
                        <div aria-hidden='true' class='stacked-drawer-handle'></div>
                        ${content}
                    </div>
                `)}
            </div>
        `;
    }
);
