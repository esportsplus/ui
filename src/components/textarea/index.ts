import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { state?: { active: boolean, error: string } };


const OMIT = ['state'];


export default template.factory<A, never>(
    function(attributes) {
        let state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <textarea
                class='textarea'
                ${{
                    class: () => state.active && '--active',
                    onfocusin: () => {
                        state.active = true;
                    },
                    onfocusout: () => {
                        state.active = false;
                    },
                    onrender: form.input.onrender(state)
                }}
                ${omit(attributes, OMIT)}
            >
                ${attributes?.value as string}
            </textarea>
        `;
    }
);