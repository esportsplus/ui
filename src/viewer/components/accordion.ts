import { accordion } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'accordion',
    variants: [
        {
            render: () => {
                let state = reactive({ active: false });

                return html`
                    <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.active = !state.active}'>
                        toggle
                    </div>

                    ${accordion({ class: 'accordion', state }, html`
                        <div class='card' style='margin-top: var(--size-400); --padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); background: var(--color-grey-300);'>
                            <div class='text'>Hidden content revealed when active. Toggling flips state.active and the component reveals its body.</div>
                        </div>
                    `)}
                `;
            },
            title: 'toggle'
        }
    ]
};


export default entry;
