import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { isObject, omit, pick, toArray } from '@esportsplus/utilities';
import form from '~/components/form';
import root from '~/components/root';
import scrollbar from '~/components/scrollbar';
import template from '~/components/template';
import error from './error';


const TAG_KEYS = [
    'autocomplete',
    'autofocus',
    'disabled',
    'name',
    'required',
    'type'
];


const select = template.factory<
    Attributes & Parameters<typeof scrollbar>[0] & {
        text?: Attributes;
        'tooltip-content'?: Attributes & { direction?: string };
    }
>(
    function(
        this:  {
            options: Record<number | string, Attributes & { content: unknown }>;
            option?: Attributes;
            state: {
                active: boolean;
                error: string;
                render: boolean;
                selected: string | number;
            }
        },
        data,
        content
    ) {
        let { option, options, state } = this;

        return html`
            <label
                class='field-mask field-mask--select'
                onclick='${() => {
                    state.active = !state.active;
                    state.render = true;

                    if (state.active) {
                        root.onclick.push(() => state.active = false);
                    }
                }}'
                ${omit(data, TAG_KEYS)}
            >
                <input
                    class='field-mask-tag field-mask-tag--hidden'
                    name='${data.name}'
                    onclick='${() => { /* Prevent double click events from firing */ }}'
                    onrender='${form.input.onrender(state)}'
                    value='${() => state.selected}'
                    ${pick(data, TAG_KEYS)}
                >

                ${content || html`
                    <div class='field-mask-text' ${data.text}>
                        ${() => options[ state.selected ] || '-'}
                    </div>
                `}

                <div class='field-mask-arrow'></div>

                ${() => {
                    if (!state.render) {
                        return;
                    }

                    let attributes = {
                            ...data['tooltip-content'],
                            scrollbar: { ...data['scrollbar'] },
                            'scrollbar-container-content': { ...data['scrollbar-container-content'] }
                        },
                        keys = Object.keys(options),
                        selected = reactive(
                            Object.fromEntries( keys.map(key => [key, false]) )
                        );

                    attributes.class = toArray(attributes.class);
                    attributes.class.push(`tooltip-content tooltip-content--${attributes.direction || 's'} --flex-column --width-full`);

                    attributes.onclick = (e: Event) => {
                        let key = (e?.target as HTMLElement)?.dataset?.key;

                        if (key === undefined) {
                            return;
                        }

                        let previous = state.selected;

                        state.selected = key;
                        state.active = false;

                        selected[key] = true;
                        selected[previous] = false;
                    };

                    return scrollbar(attributes, keys.map((key) => html`
                        <div
                            class='
                                ${() => selected[key] && '--active'}
                                link
                            '
                            data-key='${key}'
                            ${omit(options[key], ['content'])}
                            ${option}
                        >
                            <span class='--text-truncate'>
                                ${options[key]}
                            </span>
                        </div>
                    `));
                }}
            </label>
        `;
    }
);


export default template.factory<
    Attributes & {
        options: Record<number | string, number | string | Attributes & { content: unknown }>;
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
                selected?: number | string;
            }
        }
    ),
    (mask: typeof select) => Renderable
>(
    (data, content) => {
        let options = data.options,
            state = data.state || reactive({
                active: false,
                error: '',
                selected: data.selected || Object.keys(options)[0]
            });

        for (let key in options) {
            if (isObject(options[key])) {
                continue;
            }

            options[key] = { content: options[key] };
        }

        return html`
            <div
                class='
                    ${() => state.active && '--active'}
                    field
                    tooltip
                '
                ${omit(data, ['options', 'state'])}
            >
                ${content(
                    (...args: any[]) => (select.call as any)(
                        {
                            option: data.option,
                            options: data.options,
                            state
                        },
                        ...args
                    )
                )}
                ${error(state)}
            </div>
        `;
    }
);