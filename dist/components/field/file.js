import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '../../components/form/index.js';
import description from './description.js';
import error from './error.js';
import title from './title.js';
const FIELD_OMIT = ['accept', 'mask', 'name', 'placeholder', 'value'];
const MASK_OMIT = ['content'];
const TAG_PICK = ['accept', 'name', 'required', 'value'];
export default (data) => {
    let state = reactive({
        active: false,
        error: ''
    });
    data.mask ??= {};
    data.tag ??= {};
    data.tag.type = 'file';
    data.tag.onrender = form.input.onrender(state);
    return html `
        <div
            class='${() => state.active && '--active'} field --flex-column'
            onfocusin='${() => {
        state.active = true;
    }}'
            onfocusout='${() => {
        state.active = false;
    }}'
            ${omit(data, FIELD_OMIT)}
        >
            ${title(data)}

            <label
                class='field-mask field-mask--input --flex-row'
                style='cursor:pointer;'
                ${omit(data.mask, MASK_OMIT)}
            >
                <input
                    class='field-tag field-tag--hidden'
                    ${pick(data, TAG_PICK)}
                    ${data.tag}
                >

                ${data.mask?.content || ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};
