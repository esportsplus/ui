import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import modal from '~/components/modal';
import './scss/index.scss';


const EXPANDING_CARD_CARD = Symbol.for('@esportsplus/ui/expanding-card.card');


type A = Attributes & {
    [EXPANDING_CARD_CARD]?: Attributes;
    items: Item[];
    state?: State;
};

type Item = {
    detail: string;
    id: string;
    meta: string;
    summary: string;
    title: string;
};

type State = {
    open: string | null;
};


const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Critically damped spring: a card overshooting its own slot reads as a glitch, not play.
const MORPH: KeyframeAnimationOptions = {
    duration: 350,
    easing: 'linear(0, 0.0575, 0.1803, 0.3208, 0.4551, 0.5729, 0.6711, 0.7501, 0.8122, 0.8601, 0.8966, 0.924, 0.9445, 0.9596, 0.9708, 0.9789, 0.9848, 0.9891, 0.9922, 0.9944, 0.996, 0.9972, 0.998, 0.9986, 1)'
};

const REDUCED = '(prefers-reduced-motion: reduce)';


let uid = 0;


function box(element: HTMLElement, rect: DOMRect) {
    let style = element.style;

    style.height = `${rect.height}px`;
    style.left = `${rect.left}px`;
    style.margin = '0';
    style.top = `${rect.top}px`;
    style.width = `${rect.width}px`;
}

// Text flies to its new spot by position only; scaling it with its box would squash the glyphs.
function fly(element: Element | null, from: DOMRect | undefined, fromBox: DOMRect, toBox: DOMRect) {
    if (!element || !from) {
        return;
    }

    let to = element.getBoundingClientRect(),
        x = (from.left - fromBox.left) - (to.left - toBox.left),
        y = (from.top - fromBox.top) - (to.top - toBox.top);

    element.animate([{ translate: `${x}px ${y}px` }, { translate: '0 0' }], MORPH);
}

function rect(root: ParentNode, selector: string) {
    return root.querySelector(selector)?.getBoundingClientRect();
}

function unbox(element: HTMLElement) {
    let style = element.style;

    style.height = '';
    style.left = '';
    style.margin = '';
    style.top = '';
    style.width = '';
}


function template(this: { attributes?: Partial<A> } | void, { items, state = reactive({ open: null as string | null }), ...attributes }: A) {
    let bound = this?.attributes,
        bridge = {
            get active() {
                return visible.active;
            },
            set active(value: boolean) {
                if (!value) {
                    close();
                }
            }
        },
        closing = false,
        current: string | null = null,
        dialog: HTMLDialogElement | null = null,
        id = `expanding-card-${++uid}`,
        list: HTMLElement | null = null,
        stop: VoidFunction | undefined,
        view = reactive({ shown: null as string | null }),
        visible = reactive({ active: false });

    function card(key: string) {
        return list?.querySelector<HTMLElement>(`[data-id="${CSS.escape(key)}"]`) ?? null;
    }

    // The modal owns Escape, backdrop clicks and its own close; its writes arrive through 'bridge', so the
    // card flies home before the dialog actually closes.
    function close() {
        let origin = current === null ? null : card(current),
            panel = current === null ? null : section(current);

        if (!dialog || !origin || !panel || closing) {
            return;
        }

        let element = dialog;

        closing = true;
        element.style.setProperty('--transition-duration', '0.15s');

        if (matchMedia(REDUCED).matches) {
            element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: EASE_OUT, fill: 'forwards' });
            visible.active = false;
            return;
        }

        let first = element.getBoundingClientRect(),
            meta = rect(panel, '.expanding-card-dialog-face .expanding-card-meta'),
            radius = getComputedStyle(element).borderRadius,
            target = origin.getBoundingClientRect(),
            title = rect(panel, '.expanding-card-dialog-face .expanding-card-title');

        // Closing mid-open starts from wherever the morph had reached.
        for (let animation of element.getAnimations({ subtree: true })) {
            animation.cancel();
        }

        // On the way out the dialog swaps to the card's own face at the card's size, then morphs home.
        element.classList.add('--returning', '--morphing');
        box(element, target);
        (panel.querySelector('.expanding-card-dialog-card') as HTMLElement).style.width = `${target.width}px`;

        let last = element.getBoundingClientRect();

        // Before the box starts moving, since text targets are measured against its resting place.
        fly(panel.querySelector('.expanding-card-dialog-card .expanding-card-title'), title, first, last);
        fly(panel.querySelector('.expanding-card-dialog-card .expanding-card-meta'), meta, first, last);

        element.animate([
            { borderRadius: radius, height: `${first.height}px`, translate: `${first.left - last.left}px ${first.top - last.top}px`, width: `${first.width}px` },
            { borderRadius: getComputedStyle(origin).borderRadius, height: `${last.height}px`, translate: '0 0', width: `${last.width}px` }
        ], { ...MORPH, fill: 'forwards' });

        // Not shared with the dialog, so it comes into focus once the card has nearly landed.
        panel.querySelector('.expanding-card-dialog-card .expanding-card-summary')?.animate(
            [{ filter: 'blur(4px)', opacity: 0 }, { filter: 'blur(0)', opacity: 1 }],
            { delay: 200, duration: 200, easing: EASE_OUT, fill: 'backwards' }
        );

        visible.active = false;
    }

    function face(item: Item) {
        return html`
            <span class='expanding-card-face'>
                <span class='expanding-card-row'>
                    <span class='expanding-card-title'>${item.title}</span>
                    <span class='expanding-card-meta'>${item.meta}</span>
                </span>
                <span class='expanding-card-summary'>${item.summary}</span>
            </span>
        `;
    }

    function open(key: string) {
        let origin = card(key),
            panel = section(key);

        if (!dialog || !origin || !panel || current !== null) {
            return;
        }

        let element = dialog,
            first = origin.getBoundingClientRect(),
            meta = rect(origin, '.expanding-card-meta'),
            radius = getComputedStyle(origin).borderRadius,
            title = rect(origin, '.expanding-card-title');

        current = key;
        state.open = key;
        view.shown = key;
        visible.active = true;

        for (let other of element.querySelectorAll<HTMLElement>('.expanding-card-panel')) {
            other.hidden = other !== panel;
        }

        element.setAttribute('aria-labelledby', panel.querySelector('h2')!.id);
        element.style.removeProperty('--transition-duration');

        // Opened here rather than by the modal's own deferred effect, so the dialog can be measured now.
        if (!element.open) {
            element.showModal();
        }

        panel.querySelector<HTMLElement>('.expanding-card-close')?.focus({ preventScroll: true });

        if (matchMedia(REDUCED).matches) {
            element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: EASE_OUT });
            return;
        }

        let last = element.getBoundingClientRect();

        element.classList.add('--morphing');
        box(element, last);
        (panel.querySelector('.expanding-card-dialog-face') as HTMLElement).style.width = `${last.width}px`;

        fly(panel.querySelector('.expanding-card-dialog-face .expanding-card-title'), title, first, last);
        fly(panel.querySelector('.expanding-card-dialog-face .expanding-card-meta'), meta, first, last);

        let animation = element.animate([
            { borderRadius: radius, height: `${first.height}px`, translate: `${first.left - last.left}px ${first.top - last.top}px`, width: `${first.width}px` },
            { borderRadius: getComputedStyle(element).borderRadius, height: `${last.height}px`, translate: '0 0', width: `${last.width}px` }
        ], MORPH);

        animation.onfinish = () => {
            if (closing) {
                return;
            }

            element.classList.remove('--morphing');
            unbox(element);
            (panel.querySelector('.expanding-card-dialog-face') as HTMLElement).style.width = '';
        };

        // Held until the morph has visibly settled, so nothing shows while its box is still growing; the
        // blur makes it read as arriving rather than blinking on.
        for (let delayed of panel.querySelectorAll('.expanding-card-delayed')) {
            delayed.animate(
                [{ filter: 'blur(4px)', opacity: 0, translate: '0 4px' }, { filter: 'blur(0)', opacity: 1, translate: '0 0' }],
                { delay: 250, duration: 250, easing: EASE_OUT, fill: 'backwards' }
            );
        }
    }

    function section(key: string) {
        return dialog?.querySelector<HTMLElement>(`[data-panel="${CSS.escape(key)}"]`) ?? null;
    }

    function settle() {
        let element = dialog,
            key = current;

        if (!element) {
            return;
        }

        for (let animation of element.getAnimations({ subtree: true })) {
            animation.cancel();
        }

        element.classList.remove('--morphing', '--returning');
        unbox(element);

        for (let part of element.querySelectorAll<HTMLElement>('.expanding-card-dialog-card, .expanding-card-dialog-face')) {
            part.style.width = '';
        }

        closing = false;
        current = null;
        visible.active = false;
        view.shown = null;
        state.open = null;

        if (key !== null) {
            card(key)?.focus({ preventScroll: true });
        }
    }

    return html`
        <div
            class='expanding-card'
            ${bound}
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    dialog = element.querySelector<HTMLDialogElement>('dialog');
                    list = element.querySelector<HTMLElement>('.expanding-card-list');
                    dialog?.addEventListener('close', settle);

                    // Callers may open or close a card by writing 'state.open'; clicks write it too, but
                    // by then 'current' already matches.
                    stop = effect(() => {
                        let key = state.open;

                        if (key === current) {
                            return;
                        }

                        queueMicrotask(() => {
                            if (key === null) {
                                close();
                            }
                            else {
                                open(key);
                            }
                        });
                    });
                },
                ondisconnect: () => {
                    dialog?.removeEventListener('close', settle);
                    stop?.();
                }
            }}
        >
            <ul class='expanding-card-list'>
                ${items.map((item) => html`
                    <li>
                        <button
                            aria-haspopup='dialog'
                            class='expanding-card-card ${() => view.shown === item.id && '--open'}'
                            data-id='${item.id}'
                            type='button'
                            ${bound?.[EXPANDING_CARD_CARD]}
                            ${attributes[EXPANDING_CARD_CARD]}
                            ${{
                                onclick: () => open(item.id)
                            }}
                        >
                            ${face(item)}
                        </button>
                    </li>
                `)}
            </ul>

            ${modal(
                {
                    class: 'expanding-card-dialog',
                    state: bridge
                },
                html`
                    ${items.map((item, i) => html`
                        <div class='expanding-card-panel' data-panel='${item.id}' hidden>
                            <div class='expanding-card-dialog-face'>
                                <div class='expanding-card-header'>
                                    <div class='expanding-card-heading'>
                                        <h2 class='expanding-card-title' id='${`${id}-${i}`}'>${item.title}</h2>
                                        <p class='expanding-card-meta'>${item.meta}</p>
                                    </div>
                                    <div class='expanding-card-delayed'>
                                        <button aria-label='Close' class='expanding-card-close' type='button' onclick='${close}'>
                                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                                <path d='m4.5 4.5 7 7M11.5 4.5l-7 7' />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div class='expanding-card-body expanding-card-delayed'>
                                    <p class='expanding-card-summary-full'>${item.summary}</p>
                                    <p class='expanding-card-detail'>${item.detail}</p>
                                </div>
                            </div>
                            <div aria-hidden='true' class='expanding-card-dialog-card'>
                                ${face(item)}
                            </div>
                        </div>
                    `)}
                `
            )}
        </div>
    `;
}


export default Object.assign(template, { card: EXPANDING_CARD_CARD } as const);
export type { Item as ExpandingCardItem, State as ExpandingCardState };
