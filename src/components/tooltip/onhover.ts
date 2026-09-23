import { component, html, Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';


export default component<Attributes & { state?: { active: boolean } }>(
    ({ state = reactive({ active: false }), ...attributes }, content) => html`
        <div
            class='tooltip'
            ${attributes}
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
    `
);
