import { html, reactive, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import './scss/index.scss';


export default function (
    this: { attributes?: Attributes },
    attributes: Attributes & { state?: { active: boolean, error: string } }
) {
    let state = attributes.state || reactive({
            active: false,
            error: ''
        });

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
                type: (attributes.type || 'text') as string
            }}
        />
    `;
};