import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { form, scrollbar, root } from '~/components';
import description from './description';
import error from './error';
import title from './title';


type Data = {
    class?: string;
    effect?: (selected: number | string) => void;
    mask?: {
        class?: string;
        content?: any;
        style?: string;
    };
    name?: string;
    options: Record<number | string, number | string>;
    option?: {
        class?: string;
        style?: string;
    };
    selected?: any;
    scrollbar?: {
        style?: string;
    };
    style?: string;
    text?: {
        class?: string;
    };
    tooltip?: {
        class?: string;
        direction?: any;
        style?: string;
    };
} & Parameters<typeof description>[0] & Parameters<typeof title>[0];


function options(keys: (number | string)[], selected: number | string) {
    let options: Record<string, boolean> = {};

    for (let key of keys) {
        options[key] = false;
    }

    options[selected] = true;

    return options;
}

function template(data: Data, state: { active: boolean, options: Record<number | string, boolean>, selected: number | string }) {
    let { attributes: a, html: h } = scrollbar({
            fixed: true,
            style: data?.scrollbar?.style || '--background-default: var(--color-black-400);'
        });

    return html`
        <div
            class='tooltip-content tooltip-content--${data?.tooltip?.direction || 's'} ${data?.tooltip?.class || ''} --flex-column --width-full'
            style='${data?.tooltip?.style || ''}'
        >
            <div
                class='row --flex-column'
                onclick='${(e: Event) => {
                    let key = (e?.target as HTMLElement)?.dataset?.key;

                    if (key === undefined) {
                        return;
                    }

                    // Swap active
                    state.options[key] = true;
                    state.options[state.selected] = false;

                    state.active = false;
                    state.selected = key;

                    if (data.effect) {
                        data.effect(key);
                    }
                }}'
                ${a}
            >
                ${Object.keys( data.options || {} ).map((key: number | string) => html`
                    <div
                        class='link ${data?.option?.class || ''} ${() => state.options[key] ? '--active' : ''} --flex-vertical' data-key='${key}'
                        style='${data?.option?.style || ''}'
                    >
                        <span class="--text-truncate">
                            ${data.options[key]}
                        </span>
                    </div>
                `)}
            </div>

            ${h}
        </div>
    `;
}


export default (data: Data) => {
    let state = reactive({
            active: false,
            error: '',
            options: options(Object.keys( data.options || {} ), data.selected),
            render: false,
            selected: data.selected
        });

    return html`
        <div class="field tooltip ${data?.class || ''} ${() => state.active ? '--active' : ''} --flex-column" style='${data?.style || ''}'>
            ${title(data)}

            <label
                class="field-mask field-mask--select --flex-row ${data?.mask?.class || ''} ${(data?.title || (data?.class || '').indexOf('field--optional') !== -1) && '--margin-top'} --margin-300 --padding-400"
                onclick='${() => {
                    state.render = true;
                    state.active = !state.active;

                    if (state.active) {
                        root.queue.onclick(() => state.active = false);
                    }
                }}'
                style='${data?.mask?.style || ''}'
            >
                <input
                    class='field-tag field-tag--hidden'
                    name='${data.name}'
                    onclick='${() => { /* Prevent double click events from firing */ }}'
                    onrender='${form.input.attributes(state)}'
                    value='${() => state.selected}'
                >

                <div class="field-text ${data?.text?.class || ''}" style='pointer-events: none'>
                    ${() => data.options[ state.selected ] || '-'}
                </div>

                <div class='field-mask-arrow'></div>

                ${() => state.render ? template(data, state) : ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};