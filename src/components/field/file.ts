import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { form } from '~/components';
import description from './description';
import error from './error';
import title from './title';


type Data = {
    accept?: string;
    class?: string;
    mask?: {
        class?: string;
        content?: any;
        style?: string;
    };
    name?: string;
    placeholder?: string;
    style?: string;
    type?: string;
    value?: unknown;
} & Parameters<typeof description>[0] & Parameters<typeof title>[0];


export default (data: Data) => {
    let state = reactive({
            active: false,
            error: ''
        });

    return html`
        <div
            class="field ${data?.class || ''} ${() => state.active ? '--active' : ''} --flex-column"
            onfocusin='${() => {
                state.active = true;
            }}'
            onfocusout='${() => {
                state.active = false;
            }}'
            style='${data?.style || ''}'
        >
            ${title(data)}

            <label
                class='field-mask field-mask--input --flex-row ${data?.mask?.class || ''} ${(data?.title || (data?.class || '').indexOf('field--optional') !== -1) && '--margin-top'} --margin-300'
                style='${data?.mask?.style || ''} cursor:pointer;'
            >
                <input
                    ${data?.accept ? `accept='${data.accept}'` : ''}
                    class='field-tag field-tag--hidden'
                    name='${data.name}'
                    onrender='${form.input.attributes(state)}'
                    type='file'
                    ${data?.value !== undefined ? `value='${data.value}'` : ''}
                >

                ${data?.mask?.content || ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};
