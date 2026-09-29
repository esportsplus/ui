import { effect, flush, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import overlay from '~/components/overlay';
import close from '@esportsplus/ui/svg/close.svg';
import '~/components/button/scss/index.scss';


const EXPAND_TRIGGER = Symbol.for('@esportsplus/ui/card.expand.trigger');


type A = Attributes & {
    [EXPAND_TRIGGER]?: Attributes;
    items: Item[];
    state?: { open: string | null };
};

type Item = {
    detail: string;
    id: string;
    meta: string;
    summary: string;
    title: string;
};


let uid = 0;


export default component(
    function(this: { attributes?: Partial<A> } | void, { items, state = reactive({ open: null as string | null }), ...attributes }: A) {
        let id = `card-expand-${++uid}`,
            view = reactive({ morph: null as string | null, open: state.open });

        // Clicks, the overlay's own dismissals and callers all write 'state.open'; only this effect moves the view.
        effect(() => state.open, (next) => {
            if (next === view.open) {
                return;
            }

            let key = next ?? view.open;

            if (typeof document.startViewTransition !== 'function') {
                view.open = next;
                return;
            }

            let settle = () => {
                if (view.morph === key) {
                    view.morph = null;
                }
            };

            // '--morphing' names the moving card; it lands on the next frame, just before the old state is captured.
            view.morph = key;

            // Rendering is paused until the update resolves, so the template's frame-batched writes can't be
            // awaited; the overlay's effect opens or dims its dialog synchronously on flush instead.
            void document.startViewTransition(() => {
                view.open = next;
                flush();
            }).finished.then(settle, settle);
        });

        return html`
            <ul class='card-expand' ${this?.attributes} ${attributes}>
                ${items.map((item, i) => html`
                    <li class='card-expand-item'>
                        <button
                            aria-haspopup='dialog'
                            class='card card--expand'
                            type='button'
                            ${this?.attributes?.[EXPAND_TRIGGER]}
                            ${attributes[EXPAND_TRIGGER]}
                            ${{
                                class: () => view.morph === item.id && '--morphing',
                                onclick: () => {
                                    state.open = item.id;
                                }
                            }}
                        >
                            <span class='card-expand-row'>
                                <span class='card-expand-title'>${item.title}</span>
                                <span class='card-expand-meta'>${item.meta}</span>
                            </span>
                            <span class='card-expand-summary'>${item.summary}</span>
                        </button>

                        ${overlay(
                            {
                                'aria-labelledby': `${id}-${i}`,
                                class: 'card card-expand-dialog',
                                state: {
                                    get active() {
                                        return view.open === item.id;
                                    },
                                    set active(value: boolean) {
                                        if (!value && state.open === item.id) {
                                            state.open = null;
                                        }
                                    }
                                }
                            },
                            html`
                                <div class='card-expand-panel'>
                                    <div class='card-expand-header'>
                                        <div class='card-expand-heading'>
                                            <h2 class='card-expand-title' id='${id}-${i}'>${item.title}</h2>
                                            <p class='card-expand-meta'>${item.meta}</p>
                                        </div>
                                        <button
                                            aria-label='Close'
                                            class='button card-expand-close card-expand-delayed'
                                            type='button'
                                            ${{
                                                onclick: () => {
                                                    state.open = null;
                                                }
                                            }}
                                        >
                                            <svg aria-hidden='true'><use href='#${close}' /></svg>
                                        </button>
                                    </div>
                                    <p class='card-expand-summary'>${item.summary}</p>
                                    <p class='card-expand-detail card-expand-delayed'>${item.detail}</p>
                                </div>
                            `
                        )}
                    </li>
                `)}
            </ul>
        `;
    },
    { trigger: EXPAND_TRIGGER }
);
