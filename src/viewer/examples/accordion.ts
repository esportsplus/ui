import { accordion } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


export default {
    name: 'accordion',
    variants: [
        {
            render: () => {
                let state = reactive({ active: false });

                return html`
                    <div
                        class='button button--tertiary'
                        style='--width: auto;'
                        onclick='${() => state.active = !state.active}'
                    >
                        toggle
                    </div>

                    ${accordion({ state }, html`
                        <div
                            class='card'
                            style='
                                --padding-horizontal: var(--size-500);
                                --padding-vertical: var(--size-500);
                                background: var(--color-grey-300);
                                margin-top: var(--size-400);
                            '>
                            <div class='text'>
                                Hidden content revealed when active.
                                Toggling flips state.active and the component reveals its body.
                            </div>
                        </div>
                    `)}
                `;
            },
            title: 'toggle'
        }
    ]
};
