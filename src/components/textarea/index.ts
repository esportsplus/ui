import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import form from '~/components/form';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & {
    'textarea-tag'?: Attributes;
    state?: { active: boolean, error: string };
};


const OMIT = ['textarea-tag'];


export default template.factory(
    function(attributes: A, content) {
        let a = attributes['textarea-tag'],
            state = attributes.state || reactive({
                active: false,
                error: ''
            });

        return html`
            <label
                class='textarea'
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
                <textarea
                    class='textarea-tag'
                    onrender=${form.input.onrender(state)}
                    ${a}
                >
                    ${a?.value as string}
                </textarea>
                ${content}
            </label>
        `;
    }
);