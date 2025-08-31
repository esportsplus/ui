import { reactive } from '@esportsplus/reactivity';
import { html, Renderable, type Attributes } from '@esportsplus/template';
import { omit, toArray } from '@esportsplus/utilities';
import form from '~/components/form';
import root from '~/components/root';
import scrollbar, { Attributes as Attr } from '~/components/scrollbar';
import template from '~/components/template';
import './scss/index.scss';


const OMIT = [
    'options',
    'option',
    'scrollbar',
    'scrollbar-container-content',
    'tooltip-content',
];


type A = {
    options: Record<number | string, Renderable<unknown>>;
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


let field: { active: boolean } | null = null;


function set(state: { active: boolean }, value: boolean) {
    state.active = value;

    if (state.active) {
        root.onclick.push(() => state.active = false);

        if (field) {
            field.active = false;
        }

        field = state;
    }
    else if (field === state) {
        field = null;
    }
}

const select = template.factory<A>(
    function(attributes: A, content) {
        let { options, option } = attributes,
            state = attributes.state || reactive({
                active: false,
                error: '',
                render: false,
                selected: attributes.selected || Object.keys(options)[0]
            });

        return html`
            <label
                class='select'
                onclick=${() => {
                    if (state.render) {
                        set(state, !state.active);
                    }

                    state.render = true;
                }}
                ${omit(attributes, OMIT)}
            >
                ${content || html`
                    <div class='select-content text'>
                        ${() => options[ state.selected! ] || '-'}
                    </div>
                `}

                <div class='select-arrow'></div>

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

                    return scrollbar(
                        {
                            ...attributes['tooltip-content'],
                            class: [
                                ...toArray(attributes['tooltip-content']?.class),
                                `tooltip-content tooltip-content--${attributes['tooltip-content']?.direction || 's'} --flex-column --width-full`
                            ],
                            onclick: (e: Event) => {
                                let key = (e?.target as HTMLElement)?.dataset?.key;

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
                        keys.map((key) => html`
                            <div
                                class='link select-option ${() => selected[key] && '--active'}'
                                data-key='${key}'
                                ${option}
                            >
                                ${options[key]}
                            </div>
                        `)
                    );
                }}
            </label>
        `;
    }
);


export default select;