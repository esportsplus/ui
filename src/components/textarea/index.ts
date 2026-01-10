import { html, reactive, type Attributes } from '@esportsplus/frontend';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import './scss/index.scss';


const OMIT = ['state'];


export default function(
    this: { attributes?: Attributes },
    attributes: Attributes & { state?: { active: boolean, error: string } }
) {
    let state = attributes.state || reactive({
            active: false,
            error: ''
        });

    return html`
        <textarea
            class='textarea'
            ${this?.attributes && omit(this.attributes, OMIT)}
            ${omit(attributes, OMIT)}
            ${{
                class: () => state.active && '--active',
                onfocusin: () => {
                    state.active = true;
                },
                onfocusout: () => {
                    state.active = false;
                },
                onrender: form.input.onrender(state),
                value: attributes?.value || ''
            }}
        ></textarea>
    `;
};