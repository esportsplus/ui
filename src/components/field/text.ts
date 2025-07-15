import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '../form';
import description from './description';
import error from './error';
import title from './title';


type Data = {
    class?: string;
    content?: unknown;
    description?: unknown;
    mask?: Record<string, unknown>;
    name?: string;
    placeholder?: string;
    required?: boolean;
    style?: string;
    tag?: Record<string, unknown>;
    textarea?: boolean;
    title?: unknown;
    type?: string;
    value?: unknown;
} & Record<string, unknown>;


const FIELD_OMIT: (keyof Data)[] = [
    'content',
    'description',
    'mask',
    'name',
    'placeholder',
    'required',
    'tag', 'textarea', 'title', 'type',
    'value'
];

const INPUT_PICK: (keyof Data)[] = ['name', 'placeholder', 'required', 'type', 'value'];

const TEXTAREA_PICK: (keyof Data)[] = ['name', 'placeholder'];


export default (data: Data) => {
    let state = reactive({
            active: false,
            error: ''
        });

    data.onfocusin = () => {
        state.active = true;
    };
    data.onfocusout = () => {
        state.active = false;
    };

    data.tag ??= {};
    data.tag.class = `field-tag --padding-400 ${data.tag.class || ''}`;
    data.tag.onrender = form.input.onrender(state);

    data.type ??= 'string';
    data.value ??= '';

    return html`
        <div
            class='
                ${() => state.active && '--active'}
                field
                --flex-column
            '
            ${omit(data, FIELD_OMIT)}
        >
            ${title(data)}

            <label class='field-mask field-mask--input --flex-row' ${data.mask}>
                ${data.textarea
                    ? html`
                        <textarea ${data.tag} ${pick(data, TEXTAREA_PICK)}>
                            ${data.value}
                        </textarea>
                    `
                    : html`
                        <input ${data.tag} ${pick(data, INPUT_PICK)}>
                    `
                }
                ${data.content || ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};
