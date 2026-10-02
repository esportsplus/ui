import { component, html, type Renderable, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import dismiss from '~/shared/dismiss';
import menu from './menu';
import './scss/index.scss';


const SELECT_ARROW = Symbol.for('@esportsplus/ui/select.arrow');

const SELECT_OPTION = Symbol.for('@esportsplus/ui/select.option');

const SELECT_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/select.tooltip-content');


type A = {
    [SELECT_ARROW]?: Attributes;
    [SELECT_OPTION]?: Attributes;
    [SELECT_TOOLTIP_CONTENT]?: Attributes & { direction?: string };
    options: Record<number | string, Renderable<unknown> | { content: Renderable<unknown>, selected: Renderable<unknown> }>;
} & (
    {
        selected?: number | string;
        state?: never;
    } | {
        selected?: never;
        state: {
            active: boolean;
            error: string;
            render: boolean;
            selected?: number | string;
        }
    }
) & Attributes;


type D = Attributes & Pick<A, typeof SELECT_ARROW | typeof SELECT_OPTION | typeof SELECT_TOOLTIP_CONTENT>;


const plain = component(
    function(
        this: { attributes?: D },
        {
            options,
            selected,
            state = reactive({
                active: false,
                error: '',
                render: false,
                selected: selected || Object.keys(options)[0]
            }),
            ...attributes
        }: A,
        content: (state: { active: boolean, selected?: string | number }) => Renderable<unknown>
    ) {
        let { direction: defaultDirection, ...defaultTooltipContent } = this?.attributes?.[SELECT_TOOLTIP_CONTENT] ?? {},
            { direction = defaultDirection || 's', ...tooltipContent } = attributes[SELECT_TOOLTIP_CONTENT] ?? {};

        return html`
            <div
                class='select tooltip ${() => state.active && '--active'}'
                ${this?.attributes}
                ${attributes}
                ${{
                    onclick: () => {
                        if (state.render) {
                            state.active = !state.active;
                        }

                        state.render = true;
                    },
                    ondocumentclick: dismiss(() => state.active, () => {
                        state.active = false;
                    })
                }}
            >
                ${content ? (() => content(state)) : (() => {
                    let selected = options[state.selected!];

                    if (!selected) {
                        return '-';
                    }

                    if (selected !== null && typeof selected === 'object' && 'content' in selected) {
                        return selected.content;
                    }

                    return selected;
                })}

                <div class='select-arrow' ${this?.attributes?.[SELECT_ARROW]} ${attributes[SELECT_ARROW]}></div>

                <input class='select-tag'
                    ${{
                        name: attributes.name,
                        onclick: () => { /* Prevent double click events from firing */ },
                        onconnect: form.input.onconnect(state),
                        value: () => state.selected
                    }}
                />

                ${() => {
                    if (!state.render) {
                        return;
                    }

                    let keys = Object.keys(options),
                        selected = reactive(
                            Object.fromEntries( keys.map(key => [key, false]) )
                        );

                    return html`
                        <div
                            class='tooltip-content tooltip-content--${direction} --flex-column --scrollbar'
                            ${defaultTooltipContent}
                            ${tooltipContent}
                            ${{
                                inert: () => !state.active,
                                // Rendered closed on the first open, then opened once that has painted, so it animates.
                                onfirstpaint: () => {
                                    state.active = true;
                                }
                            }}
                        >
                            ${keys.map((key) => {
                                let content = options[key];

                                if (content !== null && typeof content === 'object' && 'content' in content) {
                                    content = content.content;
                                }

                                return html`
                                    <div
                                        class='link select-option ${() => selected[key] && '--active'}'
                                        ${{
                                            onclick: () => {
                                                let previous = state.selected!;

                                                state.active = false;
                                                state.selected = key;

                                                selected[key] = true;
                                                selected[previous] = false;
                                            }
                                        }}
                                        ${this?.attributes?.[SELECT_OPTION]}
                                        ${attributes[SELECT_OPTION]}
                                    >
                                        ${content}
                                    </div>
                                `;
                            })}
                        </div>
                    `;
                }}
            </div>
        `;
    },
    { arrow: SELECT_ARROW, option: SELECT_OPTION, tooltipContent: SELECT_TOOLTIP_CONTENT }
);

const select: typeof plain & { menu: typeof menu } = Object.assign(plain, { menu });


export default select;
