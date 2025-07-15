import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '../../components/form/index.js';
import description from './description.js';
import error from './error.js';
import title from './title.js';
const FIELD_OMIT = [
    'content',
    'description',
    'mask',
    'name',
    'placeholder',
    'required',
    'tag', 'textarea', 'title', 'type',
    'value'
];
const INPUT_PICK = ['name', 'placeholder', 'required', 'type', 'value'];
const TEXTAREA_PICK = ['name', 'placeholder'];
export default (data) => {
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
    return html `
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
        ? html `
                        <textarea ${data.tag} ${pick(data, TEXTAREA_PICK)}>
                            ${data.value}
                        </textarea>
                    `
        : html `
                        <input ${data.tag} ${pick(data, INPUT_PICK)}>
                    `}
                ${data.content || ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};
