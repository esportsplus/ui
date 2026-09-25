import { reactive } from '@esportsplus/reactivity';
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

const OPTIONS = ':scope > .button-fan-options > .button-fan-option';


function close(fan: Element | null, state: { active: boolean }) {
    state.active = false;
    fan?.querySelector<HTMLElement>(':scope > .button--fan')?.focus();
}

function focus(fan: Element | null) {
    // Options stay inert until the attribute frame scheduled after the state write runs
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fan?.querySelector<HTMLElement>(OPTIONS)?.focus();
        });
    });
}


export default component(
    ({ closeOnSelect = true, direction = 'e', options, state = reactive({ active: false }), ...attributes }: A, content) => html`
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
                onkeydown: function(this, event) {
                    if (!state.active) {
                        return;
                    }

                    if (event.key === 'Escape') {
                        event.stopPropagation();
                        close(this, state);
                        return;
                    }

                    let step = KEYS[direction][event.key];

                    if (step === undefined) {
                        return;
                    }

                    let nodes = [...this.querySelectorAll<HTMLElement>(OPTIONS)],
                        i = nodes.indexOf(document.activeElement as HTMLElement),
                        n = nodes.length;

                    if (n === 0) {
                        return;
                    }

                    event.preventDefault();
                    nodes[i === -1 ? (step === 1 ? 0 : n - 1) : (i + step + n) % n].focus();
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
                    onclick: function(this) {
                        state.active = !state.active;

                        if (state.active) {
                            focus(this.parentElement);
                        }
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

                                let fan = this.closest('.button-fan');

                                setTimeout(() => close(fan, state), CLOSE_DELAY);
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
    `,
    { option: FAN_OPTION, trigger: FAN_TRIGGER }
);
