import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


export default component<Attributes & { state?: { active: boolean } }>(
    function(this, { state = reactive({ active: true }), ...attributes }, content) {
        let opened = false,
            returning = false;

        return html`
            <div
                class='announcement'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => {
                        if (state.active) {
                            opened = true;
                        }
                        // After a dismissal, showing again reverses it instead of sliding in.
                        else if (opened) {
                            returning = true;
                        }

                        return `${state.active ? '--active' : ''} ${returning ? 'announcement--returning' : ''}`;
                    },
                    inert: () => !state.active
                }}
            >
                <div class='announcement-content'>${content}</div>
            </div>
        `;
    }
);
