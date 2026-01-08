import { reactive } from '@esportsplus/reactivity';
import { html, Renderable, type Attributes } from '@esportsplus/template';
import { EMPTY_ARRAY, omit, toArray } from '@esportsplus/utilities';
import form from '~/components/form';
import root from '~/components/root';
import scrollbar, { Attributes as Attr } from '~/components/scrollbar';
import template from '~/components/template';
import './scss/index.scss';


const OMIT = [
    'arrow',
    'options',
    'option',
    'scrollbar',
    'scrollbar-container-content',
    'tooltip-content',
];


type A = {
    arrow?: Attributes;
    options: Record<number | string, Renderable<unknown> | { content: Renderable<unknown>, selected: Renderable<unknown> }>;
    option?: Attributes;
    scrollbar?: Attributes;
    'scrollbar-container-content'?: Attributes;
    'tooltip-content'?: Attributes & { direction?: string };
} & (
    {
        selected?: number | string;
        state?: never;
    } | {
        state: {
            active: boolean;
            error: string;
            render: boolean;
            selected?: number | string;
        }
    }
) & Attributes & Attr;


let previous: { active: boolean } | null = null,
    sb = scrollbar.bind({
        attributes: {
            class: 'tooltip-content',
            'scrollbar-container-content': {
                class: '--flex-column'
            }
        }
    });

function set(current: { active: boolean }, value: boolean) {
    current.active = value;

    if (value) {
        if (previous) {
            previous.active = false;
        }

        previous = current;
        root.onclick.push(() => {
            if (previous !== current) {
                return;
            }

            previous = null;
            current.active = false;
        });
    }
    else if (previous === current) {
        previous = null;
    }
}

const select = template.factory<A, (state: { active: boolean, selected?: string | number }) => Renderable<unknown>>(
    function(this: { attributes?: Exclude<A, 'options' | 'selected' | 'state'> }, attributes: A, content) {
        let { options, option } = attributes,
            state = attributes.state || reactive({
                active: false,
                error: '',
                render: false,
                selected: attributes.selected || Object.keys(options)[0]
            });

        return html`
            <div
                class='select tooltip ${() => state.active && '--active'}'
                ${this?.attributes && omit(this.attributes, OMIT)}
                ${omit(attributes, OMIT)}
                onclick=${() => {
                    if (state.render) {
                        set(state, !state.active);
                    }

                    state.render = true;
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

                <div class='select-arrow' ${this?.attributes?.arrow} ${attributes.arrow}></div>

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

                    return sb(
                        {
                            ...this?.attributes?.['tooltip-content'] || EMPTY_ARRAY,
                            ...attributes['tooltip-content'],
                            class: [
                                ...toArray(attributes['tooltip-content']?.class),
                                `tooltip-content--${attributes['tooltip-content']?.direction || 's'}`
                            ],
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

                                set(state, false);
                                state.selected = key;

                                selected[key] = true;
                                selected[previous] = false;
                            },
                            onconnect: () => {
                                set(state, true);
                            },
                            scrollbar: attributes.scrollbar,
                            'scrollbar-container-content': attributes['scrollbar-container-content']
                        },
                        keys.map((key) => {
                            let content = options[key];

                            if (content !== null && typeof content === 'object' && 'content' in content) {
                                content = content.content;
                            }

                            return html`
                                <div
                                    class='link select-option ${() => selected[key] && '--active'}'
                                    ${this?.attributes?.option}
                                    ${option}
                                    data-key='${key}'
                                >
                                    ${content}
                                </div>
                            `;
                        })
                    );
                }}
            </div>
        `;
    }
);


export default select;