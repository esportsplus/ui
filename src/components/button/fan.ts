import { flush, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


const FAN_OPTION = Symbol.for('@esportsplus/ui/button.fan.option');

const FAN_TRIGGER = Symbol.for('@esportsplus/ui/button.fan.trigger');


type A = Attributes & {
    [FAN_OPTION]?: Attributes,
    [FAN_TRIGGER]?: Attributes,
    closeOnSelect?: boolean,
    direction?: Direction,
    ondocumentclick?: never,
    onkeydown?: never,
    options: (Attributes & { content: Renderable<unknown> })[],
    state?: { active: boolean }
};

type Direction = 'e' | 'n' | 's' | 'w';


const CLOSE_DELAY = 150;

const KEYS: Record<Direction, Record<string, number>> = {
    e: { ArrowLeft: -1, ArrowRight: 1 },
    n: { ArrowDown: -1, ArrowUp: 1 },
    s: { ArrowDown: 1, ArrowUp: -1 },
    w: { ArrowLeft: 1, ArrowRight: -1 }
};


export default component(
    ({ closeOnSelect = true, direction = 'e', options, state = reactive({ active: false }), ...attributes }: A, content) => {
        let items: HTMLElement[] = [],
            trigger: HTMLElement | undefined;

        function close() {
            state.active = false;
            trigger?.focus();
        }

        // The options stay inert until the state write lands.
        function focus() {
            flush();
            items[0]?.focus();
        }

        return html`
            <div
                class='button-fan ${`button-fan--${direction}`}'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    ondocumentclick: function(this, event) {
                        if (!this?.isConnected || !state.active) {
                            return;
                        }

                        if (!this.contains(event.target as Node | null)) {
                            state.active = false;
                        }
                    },
                    onkeydown: (event) => {
                        if (!state.active) {
                            return;
                        }

                        if (event.key === 'Escape') {
                            event.stopPropagation();
                            close();
                            return;
                        }

                        let step = KEYS[direction][event.key];

                        if (step === undefined) {
                            return;
                        }

                        let i = items.indexOf(document.activeElement as HTMLElement),
                            n = items.length;

                        if (n === 0) {
                            return;
                        }

                        event.preventDefault();
                        items[i === -1 ? (step === 1 ? 0 : n - 1) : (i + step + n) % n].focus();
                    }
                }}
            >
                <button
                    aria-haspopup='menu'
                    class='button button--fan'
                    type='button'
                    ${attributes[FAN_TRIGGER]}
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: () => {
                            state.active = !state.active;

                            if (state.active) {
                                focus();
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            trigger = element;
                        }
                    }}
                >
                    ${content}
                </button>

                <div
                    class='button-fan-options'
                    role='menu'
                    style='${`--n: ${options.length};`}'
                    ${{
                        inert: () => !state.active
                    }}
                >
                    ${options.map(({ content, onclick, ...o }, i) => {
                        let select = {
                                onclick: function(this: HTMLElement, event: PointerEvent) {
                                    onclick?.call(this, event);

                                    if (!closeOnSelect) {
                                        return;
                                    }

                                    setTimeout(close, CLOSE_DELAY);
                                },
                                onrender: (element: HTMLElement) => {
                                    items[i] = element;
                                }
                            },
                            style = `--i: ${i};`;

                        if (o.href) {
                            return html`
                                <a
                                    class='button button-fan-option'
                                    role='menuitem'
                                    style='${style}'
                                    ${o}
                                    ${attributes[FAN_OPTION]}
                                    ${select}
                                >
                                    ${content}
                                </a>
                            `;
                        }

                        return html`
                            <button
                                class='button button-fan-option'
                                role='menuitem'
                                style='${style}'
                                type='button'
                                ${o}
                                ${attributes[FAN_OPTION]}
                                ${select}
                            >
                                ${content}
                            </button>
                        `;
                    })}
                </div>
            </div>
        `;
    },
    { option: FAN_OPTION, trigger: FAN_TRIGGER }
);
