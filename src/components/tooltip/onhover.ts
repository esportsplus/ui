import { component, html, Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';


type A = Attributes & { state?: { active: boolean } };


const OMIT = ['state'];


export default component(
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
