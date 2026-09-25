import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import modal from '~/components/modal';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    [SHEET_HANDLE]?: Attributes;
    label?: string;
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointermove?: never;
    onpointerup?: never;
    state?: { active: boolean };
};

type Drag = {
    dy: number;
    pointer: number;
    start: number;
    y: number;
};


// Otherwise the sheet must be dragged past this share of its height.
const DISMISS_DISTANCE = 0.25;

// A release faster than this (px per ms) dismisses however short the drag, so a quick flick is enough.
const FLICK_VELOCITY = 0.11;

const SHEET_HANDLE = Symbol.for('@esportsplus/ui/sheet.handle');

const base = modal.bind({ attributes: { class: 'sheet modal--sheet', tabindex: -1 } });

const THRESHOLD = 4;


function inside(element: HTMLElement, e: PointerEvent) {
    let rect = element.getBoundingClientRect();

    return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
}

function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}


export default Object.assign(
    component<A>(
        function(this, { label, state = reactive({ active: false }), ...attributes }, content) {
            let drag: Drag | null = null,
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

            return base(
                {
                    'aria-label': label,
                    state,
                    ...this?.attributes,
                    ...attributes,
                    class: [this?.attributes?.class, attributes.class].flat(),
                    onpointercancel: (e: PointerEvent) => {
                        if (!drag || e.pointerId !== drag.pointer) {
                            return;
                        }

                        drag = null;
                        settle(e.currentTarget as HTMLDialogElement, false);
                    },
                    onpointerdown: (e: PointerEvent) => {
                        let element = e.currentTarget as HTMLDialogElement;

                        if (e.button !== 0 || !state.active || !inside(element, e)) {
                            return;
                        }

                        if ((e.target as HTMLElement).closest('a, button, input, select, textarea, [contenteditable]')) {
                            return;
                        }

                        drag = { dy: 0, pointer: e.pointerId, start: performance.now(), y: e.clientY };
                        element.setPointerCapture(e.pointerId);
                        element.classList.add('--dragging');
                    },
                    onpointermove: (e: PointerEvent) => {
                        if (!drag || e.pointerId !== drag.pointer) {
                            return;
                        }

                        let element = e.currentTarget as HTMLDialogElement,
                            dy = e.clientY - drag.y;

                        // Past the top it still gives, but less the further you pull, like stretching something
                        // that wants to snap back.
                        if (dy < 0) {
                            dy = -Math.pow(-dy, 0.7);
                        }

                        drag.dy = dy;
                        element.style.setProperty('--progress', String(Math.max(dy, 0) / element.offsetHeight));
                        element.style.translate = `0 ${dy}px`;
                    },
                    onpointerup: (e: PointerEvent) => {
                        if (!drag || e.pointerId !== drag.pointer) {
                            return;
                        }

                        let element = e.currentTarget as HTMLDialogElement,
                            { dy, start } = drag,
                            velocity = dy / (performance.now() - start);

                        drag = null;

                        // The click that follows lands on the dialog, and above the sheet it would read as a
                        // backdrop click.
                        if (Math.abs(dy) > THRESHOLD) {
                            addEventListener('click', swallow, true);
                            setTimeout(() => removeEventListener('click', swallow, true));
                        }

                        settle(element, dy > element.offsetHeight * DISMISS_DISTANCE || velocity > FLICK_VELOCITY);
                    }
                },
                html`
                    <div
                        aria-hidden='true'
                        class='sheet-handle'
                        ${this?.attributes?.[SHEET_HANDLE]}
                        ${attributes[SHEET_HANDLE]}
                        ${{
                            onconnect: (element: HTMLElement) => {
                                let dialog = element.parentElement!;

                                // The sheet itself takes focus; showModal would land on its first control instead.
                                stop = effect(() => {
                                    if (state.active) {
                                        queueMicrotask(() => dialog.focus({ preventScroll: true }));
                                    }
                                });
                            },
                            ondisconnect: () => {
                                stop?.();
                            }
                        }}
                    ></div>
                    ${content}
                `
            );
        }
    ),
    { handle: SHEET_HANDLE } as const
);
