import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { omit, pick } from '@esportsplus/utilities';
import form from '~/components/form';
import description from './description';
import error from './error';
import title from './title';


type Data = {
    accept?: string;
    class?: string;
    description?: unknown;
    mask?: {
        content?: unknown;
    } & Record<string, unknown>;
    name?: string;
    placeholder?: string;
    required?: boolean;
    style?: string;
    tag?: Record<string, unknown>;
    title?: unknown;
    value?: unknown;
} & Record<string, unknown>;


const FIELD_OMIT: (keyof Data)[] = ['accept', 'mask', 'name', 'placeholder', 'value'];

const MASK_OMIT: (keyof NonNullable<Data['mask']>)[] = ['content'];

const TAG_PICK: (keyof Data)[] = ['accept', 'name', 'required', 'value'];


export default (data: Data) => {
    let state = reactive({
            active: false,
            error: ''
        });

    data.mask ??= {};

    data.tag ??= {};
    data.tag.type = 'file';
    data.tag.onrender = form.input.onrender(state);

    return html`
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
