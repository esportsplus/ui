import { reactive } from '@esportsplus/reactivity';
import { html, component, type Attributes } from '@esportsplus/template';
import more from './more';
import './scss/index.scss';


const base = component<Attributes & { state?: { active: boolean | number } }>(
    function({ state = reactive({ active: false }), ...attributes }, content) {
        return html`
            <div
                class='accordion'
                ${attributes}
                ${{
                    class: () => state.active && '--active',
                    inert: () => !state.active
                }}
            >
                <div class='accordion-content'>${content}</div>
            </div>
        `;
    }
);

const accordion: typeof base & { more: typeof more } = Object.assign(base, { more });


export default accordion;
