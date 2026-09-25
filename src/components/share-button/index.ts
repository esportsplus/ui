import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { write } from '~/components/clipboard';
import './scss/index.scss';


type A = Attributes & {
    [SHARE_BUTTON_TARGET]?: Attributes;
    [SHARE_BUTTON_TRIGGER]?: Attributes;
    onconnect?: never;
    ondisconnect?: never;
    ondocumentkeydown?: never;
    ondocumentpointerdown?: never;
    onkeydown?: never;
    onpointerdown?: never;
    state?: State;
    text?: string;
    title: string;
    url: string;
};

type State = { copied: boolean, open: boolean };


const COPIED_FOR = 1800;

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const SHARE_BUTTON_TARGET = Symbol.for('@esportsplus/ui/share-button.target');

const SHARE_BUTTON_TRIGGER = Symbol.for('@esportsplus/ui/share-button.trigger');

const SPRING = 'linear(0, 0.057, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.896, 0.924, 0.944, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1)';


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default Object.assign(
    function(this: { attributes?: Partial<A> } | void, { state = reactive({ copied: false, open: false }), text = 'Share', title, url, ...attributes }: A) {
        let animations: Animation[] = [],
            encodedTitle = encodeURIComponent(title),
            encodedUrl = encodeURIComponent(url),
            keys = false,
            native = typeof navigator !== 'undefined' && typeof navigator.share === 'function',
            stop: VoidFunction | undefined,
            timer: ReturnType<typeof setTimeout> | undefined;

        function copied(element: HTMLElement, value: boolean) {
            let word = element.querySelector<HTMLElement>('.share-button-copied');

            if (!word) {
                return;
            }

            let from = word.hidden ? '0px' : getComputedStyle(word).width;

            word.getAnimations().forEach((animation) => animation.cancel());
            word.hidden = false;

            let to = value ? `${word.scrollWidth}px` : '0px';

            if (reduced()) {
                word.hidden = !value;
                return;
            }

            let animation = word.animate(
                [
                    { filter: value ? 'blur(4px)' : 'blur(0px)', opacity: value ? 0 : 1, width: from },
                    { filter: value ? 'blur(0px)' : 'blur(4px)', opacity: value ? 1 : 0, width: to }
                ],
                { duration: 400, easing: SPRING }
            );

            if (!value) {
                animation.finished.then(() => {
                    word.hidden = true;
                }, () => {});
            }
        }

        async function copy() {
            if (!(await write(url))) {
                return;
            }

            clearTimeout(timer);
            state.copied = true;
            timer = setTimeout(() => {
                state.copied = false;
            }, COPIED_FOR);
        }

        function reshape(root: HTMLElement, open: boolean) {
            let enter = root.querySelector<HTMLElement>(open ? '.share-button-targets' : '.share-button-trigger'),
                from = getComputedStyle(root).width,
                leave = root.querySelector<HTMLElement>(open ? '.share-button-trigger' : '.share-button-targets');

            if (!enter || !leave) {
                return;
            }

            for (let animation of animations) {
                animation.cancel();
            }

            animations = [];
            enter.classList.remove('share-button-face--leaving');
            enter.hidden = false;
            enter.inert = false;
            leave.inert = true;

            if (reduced()) {
                leave.hidden = true;
                return;
            }

            // Pulled out of flow so the pill measures only the arriving face.
            leave.classList.add('share-button-face--leaving');

            let fade = leave.animate(
                    [{}, { filter: 'blur(4px)', opacity: 0 }],
                    { duration: 100, easing: EASE_OUT, fill: 'forwards' }
                ),
                to = getComputedStyle(root).width;

            fade.finished.then(() => {
                leave.classList.remove('share-button-face--leaving');
                leave.hidden = true;
                fade.cancel();
            }, () => {});

            animations.push(
                fade,
                enter.animate(
                    [{ filter: 'blur(4px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1 }],
                    { delay: open ? 60 : 80, duration: 200, easing: EASE_OUT, fill: 'backwards' }
                ),
                root.animate([{ width: from }, { width: to }], { duration: 400, easing: SPRING })
            );
        }

        function toggle(root: HTMLElement, open: boolean) {
            clearTimeout(timer);
            state.copied = false;
            state.open = open;

            if (!keys) {
                return;
            }

            // Focus follows the pill only for keyboard users, so a click never leaves a ring behind.
            requestAnimationFrame(() => {
                root.querySelector<HTMLElement>(open ? '.share-button-target' : '.share-button-trigger')?.focus();
            });
        }

        return html`
            <div
                class='share-button'
                ${this?.attributes}
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        let open = state.open,
                            wasCopied = state.copied;

                        stop = effect(() => {
                            if (state.open !== open) {
                                open = state.open;
                                reshape(element, open);
                            }

                            if (state.copied !== wasCopied) {
                                wasCopied = state.copied;
                                copied(element, wasCopied);
                            }
                        });
                    },
                    ondisconnect: () => {
                        clearTimeout(timer);
                        stop?.();

                        for (let animation of animations) {
                            animation.cancel();
                        }
                    },
                    ondocumentkeydown: function(this: HTMLElement, e: KeyboardEvent) {
                        if (e.key !== 'Escape' || !state.open) {
                            return;
                        }

                        keys = true;
                        toggle(this, false);
                    },
                    ondocumentpointerdown: function(this: HTMLElement, e: PointerEvent) {
                        if (!state.open || this.contains(e.target as Node | null)) {
                            return;
                        }

                        toggle(this, false);
                    },
                    onkeydown: () => {
                        keys = true;
                    },
                    onpointerdown: () => {
                        keys = false;
                    }
                }}
            >
                <button
                    aria-expanded='false'
                    class='button share-button-face share-button-trigger'
                    type='button'
                    ${{
                        hidden: state.open,
                        onclick: function(this: HTMLElement) {
                            let root = this.closest<HTMLElement>('.share-button');

                            if (root) {
                                toggle(root, true);
                            }
                        }
                    }}
                    ${this?.attributes?.[SHARE_BUTTON_TRIGGER]}
                    ${attributes[SHARE_BUTTON_TRIGGER]}
                >
                    <svg class='share-button-icon' viewBox='0 0 16 16'>
                        <path d='M8 9.5V2.5M5.25 5.25 8 2.5l2.75 2.75M3.5 8v4.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8' />
                    </svg>
                    ${text}
                </button>

                <div
                    aria-label='Share ${title}'
                    class='share-button-face share-button-targets'
                    role='group'
                    ${{ hidden: !state.open }}
                >
                    <button
                        class='button share-button-target share-button-copy ${() => state.copied && '--active'}'
                        type='button'
                        ${{
                            'aria-label': () => state.copied ? 'Link copied' : 'Copy link',
                            onclick: copy
                        }}
                        ${this?.attributes?.[SHARE_BUTTON_TARGET]}
                        ${attributes[SHARE_BUTTON_TARGET]}
                    >
                        <span class='share-button-swap'>
                            <svg class='share-button-icon share-button-icon--link' viewBox='0 0 16 16'>
                                <path d='M6.25 9.75l3.5-3.5M7 4.25l1.05-1.05a3.25 3.25 0 0 1 4.6 4.6L11.6 8.85M9 11.75l-1.05 1.05a3.25 3.25 0 0 1-4.6-4.6L4.4 7.15' />
                            </svg>
                            <svg class='share-button-icon share-button-icon--check' viewBox='0 0 16 16'>
                                <path d='M3.5 8.25l3 3 6-6.5' />
                            </svg>
                        </span>
                        <span class='share-button-copied' hidden>Copied</span>
                    </button>
                    <a
                        aria-label='Post on X'
                        class='button share-button-target'
                        href='https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}'
                        rel='noreferrer'
                        target='_blank'
                        ${this?.attributes?.[SHARE_BUTTON_TARGET]}
                        ${attributes[SHARE_BUTTON_TARGET]}
                    >
                        <svg class='share-button-icon share-button-icon--x' viewBox='0 0 24 24'>
                            <path d='M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z' />
                        </svg>
                    </a>
                    <a
                        aria-label='Email'
                        class='button share-button-target'
                        href='mailto:?subject=${encodedTitle}&body=${encodedUrl}'
                        ${this?.attributes?.[SHARE_BUTTON_TARGET]}
                        ${attributes[SHARE_BUTTON_TARGET]}
                    >
                        <svg class='share-button-icon' viewBox='0 0 16 16'>
                            <rect x='2.25' y='3.75' width='11.5' height='8.5' rx='1.75' />
                            <path d='M2.75 5.25 8 9l5.25-3.75' />
                        </svg>
                    </a>
                    ${native && html`
                        <button
                            aria-label='More ways to share'
                            class='button share-button-target'
                            type='button'
                            onclick=${() => {
                                navigator.share({ title, url }).catch(() => {});
                            }}
                            ${this?.attributes?.[SHARE_BUTTON_TARGET]}
                            ${attributes[SHARE_BUTTON_TARGET]}
                        >
                            <svg class='share-button-icon' viewBox='0 0 16 16'>
                                <path d='M3.75 8h.01M8 8h.01M12.25 8h.01' stroke-width='2.25' />
                            </svg>
                        </button>
                    `}
                    <span aria-hidden='true' class='share-button-divider'></span>
                    <button
                        aria-label='Close'
                        class='button share-button-target share-button-close'
                        type='button'
                        onclick=${function(this: HTMLElement) {
                            let root = this.closest<HTMLElement>('.share-button');

                            if (root) {
                                toggle(root, false);
                            }
                        }}
                    >
                        <svg class='share-button-icon' viewBox='0 0 16 16'>
                            <path d='M4.5 4.5l7 7M11.5 4.5l-7 7' />
                        </svg>
                    </button>
                </div>

                <span aria-live='polite' class='share-button-live'>${() => state.copied ? 'Link copied' : ''}</span>
            </div>
        `;
    },
    { target: SHARE_BUTTON_TARGET, trigger: SHARE_BUTTON_TRIGGER } as const
);
