import { component, html, type Renderable, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import './scss/index.scss';


type A = {
    arrow?: Attributes;
    options: Record<number | string, Renderable<unknown> | { content: Renderable<unknown>, selected: Renderable<unknown> }>;
    option?: Attributes;
    'tooltip-content'?: Attributes & { direction?: string };
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


type D = Attributes & Pick<A, 'arrow' | 'option' | 'tooltip-content'>;


export default component<A, (state: { active: boolean, selected?: string | number }) => Renderable<unknown>>(
    function(
        this: { attributes?: D },
        {
            arrow,
            option,
            options,
            selected,
            state = reactive({
                active: false,
                error: '',
                render: false,
                selected: selected || Object.keys(options)[0]
            }),
            'tooltip-content': tooltipContent,
            ...attributes
        }: A,
        content
    ) {
        let { arrow: defaultArrow, option: defaultOption, 'tooltip-content': defaultTooltipContent, ...defaults }: D = this?.attributes ?? {},
            { direction: defaultDirection, ...defaultTooltipContentAttributes } = defaultTooltipContent ?? {},
            { direction = defaultDirection || 's', ...tooltipContentAttributes } = tooltipContent ?? {},
            element: HTMLElement;

        return html`
            <div
                class='select tooltip ${() => state.active && '--active'}'
                ${defaults}
                ${attributes}
                ondocumentclick=${(event: MouseEvent) => {
                    if (!state.active || !element?.isConnected) {
                        return;
                    }

                    if (!element.contains(event.target as Node | null)) {
                        state.active = false;
                    }
                }}
                onclick=${() => {
                    if (state.render) {
                        state.active = !state.active;
                    }

                    state.render = true;
                }}
                onrender=${(node: HTMLElement) => element = node}
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

                <div class='select-arrow' ${defaultArrow} ${arrow}></div>

                <input class='select-tag'
                    ${{
                        name: attributes.name,
                        onclick: () => { /* Prevent double click events from firing */ },
                        onrender: form.input.onrender(state),
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
                            ${defaultTooltipContentAttributes}
                            ${tooltipContentAttributes}
                            ${{
                                inert: () => !state.active,
                                onclick: (e: Event) => {
                                    let element = e.target as HTMLElement,
                                        key = element.dataset?.key;

                                    if (key === undefined) {
                                        let parent;

                                        while (parent = element.parentElement) {
                                            key = parent.dataset?.key;

                                            if (key !== undefined) {
                                                break;
                                            }
                                        }
                                    }

                                    if (key === undefined) {
                                        return;
                                    }

                                    let previous = state.selected!;

                                    state.active = false;
                                    state.selected = key;

                                    selected[key] = true;
                                    selected[previous] = false;
                                },
                                onconnect: () => {
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
                                        ${defaultOption}
                                        ${option}
                                        data-key='${key}'
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
    }
);
