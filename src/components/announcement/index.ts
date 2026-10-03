import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import overlay from '../overlay';
import './scss/index.scss';


export default component<Attributes & { state?: { active: boolean } }>(
    function(this, { state = reactive({ active: true }), ...attributes }, content) {
        return html`
            <div
                class='announcement'
                ${this?.attributes}
                ${attributes}
                ${{ class: () => state.active && '--active', inert: () => !state.active }}
            >
                ${overlay({
                    class: 'announcement-content overlay--n',
                    flow: true,
                    role: 'presentation',
                    state,
                    [overlay.handle]: { hidden: true }
                }, content)}
            </div>
        `;
    }
);
