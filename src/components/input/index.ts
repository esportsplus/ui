import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & {
    'input-tag'?: Attributes,
    state?: { active: boolean, error: string }
};


const OMIT = ['input-tag'];


export default template.factory(
    function(attributes: A, content) {
        let a = attributes['input-tag'],
            state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <label
                class='input'
                ${{
                    class: () => state.active && '--active',
                    onfocusin: () => {
                        state.active = true;
                    },
                    onfocusout: () => {
                        state.active = false;
                    }
                }}
                ${a ? omit(attributes, OMIT) : attributes}
            >
                <input
                    class='input-tag'
                    ${{
                        onrender: form.input.onrender(state),
                        type: (attributes.type || 'text') as string
                    }}
                    ${a}
                >
                ${content}
            </label>
        `;
    }
);