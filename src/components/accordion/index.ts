import { html, Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { state: { active: boolean | number } };


const OMIT = ['state'];


export default template.factory<A>(
    function(attributes: A, content) {
        let state = attributes.state;

        return html`
            <div
                class='accordion'
                ${omit(attributes, OMIT)}
                ${{
                    inert: () => !state.active
                }}
            >
                <div class='accordion-content'>${content}</div>
            </div>
        `;
    }
);