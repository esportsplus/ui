import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import form from '~/components/form';
import './scss/index.scss';


type A = Attributes & {
    onfocusin?: never;
    onfocusout?: never;
    onrender?: never;
};


export default function (
    this: { attributes?: A } | void,
    {
        state = reactive({
            active: false,
            error: ''
        }),
        ...attributes
    }: A & { state?: { active: boolean, error: string } }
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