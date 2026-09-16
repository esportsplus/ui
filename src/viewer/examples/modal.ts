import { overlay } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'modal',
    variants: [
        {
            render: () => {
                let state = reactive({ open: false });

                return html`
                    <div class='button button--primary' style='--width: auto;' onclick='${() => state.open = true}'>
                        open modal
                    </div>

                    ${() => state.open && overlay(
                        { onclick: () => state.open = false },
                        html`
                            <div
                                class='modal --active card'
                                style='--max-width: 420px; --padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); background: var(--color-card-500, var(--color-grey-300));'
                                onclick='${(e: MouseEvent) => e.stopPropagation()}'
                            >
                                <h3 style='margin: 0 0 var(--size-400);'>Modal title</h3>
                                <div class='text'>Click the backdrop or the button below to close.</div>
                                <div
                                    class='button button--tertiary'
                                    style='--width: auto; margin-top: var(--size-500);'
                                    onclick='${() => state.open = false}'
                                >
                                    close
                                </div>
                            </div>
                        `
                    )}
                `;
            },
            title: 'overlay + modal'
        }
    ]
};


export default entry;
