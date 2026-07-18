import { overlay } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'overlay',
    variants: [
        {
            render: () => {
                let state = reactive({ open: false });

                return html`
                    <div class='button button--primary' style='--width: auto;' onclick='${() => state.open = true}'>
                        open overlay
                    </div>

                    ${() => state.open && overlay(
                        {
                            class: '--glass',
                            style: '--blur: 16px;',
                            onclick: () => state.open = false
                        },
                        html`
                            <div
                                class='card'
                                style='margin: auto; --padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); background: var(--color-card-500, var(--color-grey-300));'
                                onclick='${(e: MouseEvent) => e.stopPropagation()}'
                            >
                                <div class='text'>Frosted-glass overlay. Click anywhere outside to dismiss.</div>
                            </div>
                        `
                    )}
                `;
            },
            title: 'glass backdrop'
        }
    ]
};


export default entry;
