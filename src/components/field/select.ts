import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '../form';
import scrollbar from '../scrollbar';
import root from '../root';
import description from './description';
import error from './error';
import title from './title';


type Data<T extends Record<number | string, number | string>> = {
    class?: string;
    content?: unknown;
    description?: unknown;
    effect?: (selected: number | string) => void;
    mask?: Record<string, unknown>;
    name?: string;
    options: T;
    option?: Record<string, unknown>;
    required?: boolean;
    selected: T[keyof T];
    scrollbar?: Record<string, unknown>;
    style?: string;
    tag?: Record<string, unknown>;
    text?: Record<string, unknown>;
    title?: unknown;
    tooltip?: {
        direction?: unknown;
    } & Record<string, unknown>;
} & Record<string, unknown>;


const FIELD_OMIT: (keyof Data<any>)[] = [
    'content',
    'description',
    'effect',
    'mask',
    'name',
    'options', 'option',
    'required',
    'selected', 'scrollbar',
    'tag', 'text', 'title', 'tooltip'
];

const TOOLTIP_OMIT: (keyof NonNullable<Data<any>['tooltip']>)[] = ['direction'];


function parse(keys: (number | string)[], selected: number | string) {
    let options: Record<string, boolean> = {};

    for (let key of keys) {
        options[key] = false;
    }

    options[selected] = true;

    return {
        options,
        selected: selected || keys[0]
    };
}

function template<T extends Record<number | string, number | string>>(data: Data<T>, state: { active: boolean, options: Record<number | string, boolean>, selected: number | string }) {
    data.scrollbar ??= {};
    data.scrollbar.style = data.scrollbar.style || '--background-default: var(--color-black-400);';

    data.tooltip ??= {};
    data.tooltip.class = `tooltip-content--${data.tooltip?.direction || 's'} ${data.tooltip?.class || ''}`;
    data.tooltip.direction ??= 's';

    let { html: h, parent: { attributes: a } } = scrollbar({
            attributes: data.scrollbar,
            fixed: true
        });

    return html`
        <div
            class='tooltip-content --flex-column --width-full'
            ${omit(data.tooltip, TOOLTIP_OMIT)}
        >
            <div
                class='row --flex-column'
                onclick='${(e: Event) => {
                    let key = (e?.target as HTMLElement)?.dataset?.key;

                    if (key === undefined) {
                        return;
                    }

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
                        class='
                            ${() => state.options[key] && '--active'}
                            link
                            --flex-vertical
                        '
                        data-key='${key}'
                        ${data.option}
                    >
                        <span class='--text-truncate'>
                            ${data.options[key]}
                        </span>
                    </div>
                `)}
            </div>

            ${h}
        </div>
    `;
}


export default <T extends Record<number | string, number | string>>(data: Data<T>) => {
    let state = reactive(
            Object.assign({
                active: false,
                error: '',
                render: false,
            },
            parse(Object.keys( data.options || {} ), data.selected))
    );

    data.mask ??= {};
    data.mask.onclick = () => {
        state.render = true;
        state.active = !state.active;

        if (state.active) {
            root.onclick.push(() => state.active = false);
        }
    };

    data.tag ??= {};
    data.tag.name = data.name;
    data.tag.onclick = () => { /* Prevent double click events from firing */ };
    data.tag.onrender = form.input.onrender(state);
    data.tag.value = () => state.selected;

    return html`
        <div class='
                ${() => state.active ? '--active' : ''}
                field
                tooltip
                --flex-column
            '
            ${omit(data, FIELD_OMIT)}
        >
            ${title(data)}

            <label
                class='field-mask field-mask--select --flex-row --padding-400'
                ${data.mask}
            >
                <input class='field-tag field-tag--hidden' ${data.tag}>

                <div class='field-text' style='pointer-events: none' ${data.text}>
                    ${() => data.options[ state.selected ] || '-'}
                </div>

                <div class='field-mask-arrow'></div>

                ${() => state.render && template(data, state)}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};