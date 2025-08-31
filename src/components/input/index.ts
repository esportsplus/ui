import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { state?: { active: boolean, error: string } };


export default template.factory<A, never>(
    function(attributes) {
        let state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <input
                class='input'
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
                ${attributes}
            />
        `;
    }
);