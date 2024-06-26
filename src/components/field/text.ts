import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import form from '~/components/form';
import description from './description';
import error from './error';
import title from './title';


type Data = {
    class?: string;
    mask?: {
        class?: string;
        content?: any;
        style?: string;
    };
    name?: string;
    placeholder?: string;
    style?: string;
    tag?: {
        class?: string;
    };
    textarea?: boolean;
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
                class='field-mask field-mask--input --flex-row ${data?.mask?.class || ''} ${(data?.title || (data?.class || '').indexOf('field--optional') !== -1) ? '--margin-top' : ''} --margin-300'
                style='${data?.mask?.style || ''}'
            >
                <${data?.textarea ? 'textarea' : 'input'}
                    class='field-tag --padding-400 ${data?.tag?.class || ''}'
                    name='${data?.name || ''}'
                    placeholder='${data?.placeholder || ''}'
                    onrender='${form.input.attributes(state)}'
                    type='${data?.type || 'string'}'
                    ${!data?.textarea && data?.value !== undefined ? html`value='${data.value}'` : ''}
                >
                ${data?.textarea ? html`${data?.value || ''}</textarea>` : ''}

                ${data?.mask?.content || ''}
            </label>

            ${description(data)}
            ${error(state)}
        </div>
    `;
};
