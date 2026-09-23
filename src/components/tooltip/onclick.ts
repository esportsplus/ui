import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';


export default component<Attributes & { state?: { active: boolean }, toggle?: boolean }>(
    ({ state = reactive({ active: false }), toggle = false, ...attributes }, content) => html`
        <div
            class='tooltip'
            ${attributes}
            ${{
                class: () => state.active && '--active',
                onclick: function(e) {
                    state.active = this === e.target || toggle ? !state.active : true;
                },
                ondocumentclick: function(this, event) {
                    if (!this?.isConnected || !state.active) {
                        return;
                    }

                    if (!this.contains(event.target as Node | null)) {
                        state.active = false;
                    }
                }
            }}
        >
            ${content}
        </div>
    `
);
