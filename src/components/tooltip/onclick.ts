import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';


const OMIT = ['state', 'toggle'];


export default component<Attributes & { state?: { active: boolean }, toggle?: boolean }>(
    (attributes, content) => {
        let ref: HTMLElement,
            state = attributes.state || reactive({ active: false }),
            toggle = attributes.toggle || false;

        return html`
            <div
                class='tooltip'
                ${omit(attributes, OMIT)}
                ${{
                    class: () => state.active && '--active',
                    ondocumentclick: (event) => {
                        if (!state.active || !ref?.isConnected) {
                            return;
                        }

                        if (!ref.contains(event.target as Node | null)) {
                            state.active = false;
                        }
                    },
                    onclick: function(e) {
                        state.active = this === e.target || toggle ? !state.active : true;
                    },
                    onrender: (element) => ref = element
                }}
            >
                ${content}
            </div>
        `;
    }
);
