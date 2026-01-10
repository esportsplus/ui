import { html, reactive, Attributes } from '@esportsplus/frontend';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';


type A = Attributes & { state?: { active: boolean } };


const OMIT = ['state'];


export default template.factory(
    (attributes: A, content) => {
        let state = attributes.state || reactive({ active: false });

        return html`
            <div
                class='tooltip'
                ${omit(attributes, OMIT)}
                ${{
                    class: () => state.active && '--active',
                    onmouseover: () => {
                        state.active = true;
                    },
                    onmouseout: () => {
                        state.active = false;
                    }
                }}
            >
                ${content}
            </div>
        `;
    }
);
