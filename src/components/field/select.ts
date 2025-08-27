import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { isObject, omit, toArray } from '@esportsplus/utilities';
import form from '~/components/form';
import root from '~/components/root';
import scrollbar, { Attributes as Attr } from '~/components/scrollbar';
import template from '~/components/template';
import error from './error';


const OMIT_FIELD = ['options', 'state'];

const OMIT_MASK = [
    'field-mask-arrow',
    'field-mask-text',
    'field-mask-tag',
    'scrollbar',
    'scrollbar-container-content',
    'tooltip-content',
];

const OMIT_OPTION = ['content'];


type A = {
    'field-mask-arrow'?: Attributes;
    'field-mask-tag'?: Attributes;
    'field-mask-text'?: Attributes;
    'tooltip-content'?: Attributes & { direction?: string };
} & Attributes & Attr;


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


const select = function(
    this: {
        options: { content: unknown } & Attributes;
        option?: Attributes;
        state: {
            active: boolean;
            error: string;
            render: boolean;
            selected: string | number;
        }
    },
    attributes: A,
    content: Renderable<unknown>
) {
    let { option, options, state } = this;

    return html`
        <label
            class='field-mask field-mask--select'
            ${omit(attributes, OMIT_MASK)}
            ${{
                onclick: () => {
                    if (state.render) {
                        set(state, !state.active);
                    }

                    state.render = true;
                }
            }}
        >
            <input class='field-mask-tag field-mask-tag--hidden'
                ${{
                    name: attributes.name,
                    onclick: () => { /* Prevent double click events from firing */ },
                    onrender: form.input.onrender(state),
                    value: () => state.selected
                }}
                ${attributes['field-mask-tag']}
            >

            ${content || html`
                <div class='field-mask-text' ${attributes['field-mask-text']}>
                    ${() => {
                        // @ts-ignore
                        return (options[ state.selected ]?.content || '-');
                    }}
                </div>
            `}

            <div class='field-mask-arrow' ${attributes['field-mask-arrow']}></div>

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

                            let previous = state.selected;

                            set(state, false);
                            state.selected = key;

                            selected[key] = true;
                            selected[previous] = false;
                        },
                        onconnect: () => {
                            set(state, true);
                        },
                        scrollbar: attributes['scrollbar'],
                        'scrollbar-container-content': attributes['scrollbar-container-content']
                    },
                    keys.map((key) => html`
                        <div class='link'
                            ${omit(options[key] as Attributes, OMIT_OPTION)}
                            ${option}
                            ${{
                                class: () => selected[key] && '--active',
                                'data-key': key
                            }}
                        >
                            <span class='--text-truncate --pointer-none'>
                                ${(options[key] as any).content}
                            </span>
                        </div>
                    `)
                );
            }}
        </label>
    `;
};


export default template.factory<
    Attributes & {
        options: Record<number | string, (number | string | Attributes & { content: unknown })>;
        option?: Attributes;
    } & (
        {
            selected?: number | string;
            state?: never;
        } |
        {
            state: {
                active: boolean;
                error: string;
                render: boolean;
                selected?: number | string;
            }
        }
    ),
    (mask: ReturnType<typeof template.factory<A>>) => Renderable<unknown>
>((attributes, content) => {
    let options = attributes.options,
        state = attributes.state || reactive({
            active: false,
            error: '',
            render: false,
            selected: attributes.selected || Object.keys(options)[0]
        });

    for (let key in options) {
        if (isObject(options[key])) {
            continue;
        }

        options[key] = { content: options[key] };
    }

    return html`
        <div class='field tooltip'
            ${omit(attributes as any, OMIT_FIELD)}
            ${{
                class: () => state.active && '--active'
            }}
        >
            ${content(
                (...args: any[]) => (select.call as any)(
                    {
                        option: attributes.option,
                        options: attributes.options,
                        state
                    },
                    ...args
                )
            )}
            ${error(state)}
        </div>
    `;
});