import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import './scss/index.scss';


export default function (
    this: { attributes?: Attributes } | void,
    {
        state = reactive({
            active: false,
            error: ''
        }),
        ...attributes
    }: Attributes & { state?: { active: boolean, error: string } }
) {
    attributes.type ??= 'text';

    return html`
        <input
            class='input'
            ${this?.attributes}
            ${attributes}
            ${{
                class: () => state.active && '--active',
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                },
                onrender: form.input.onrender(state),
            }}
        />
    `;
};