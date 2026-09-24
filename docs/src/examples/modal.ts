import { modal } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


export default {
    name: 'modal',
    variants: [
        {
            render: () => {
                let state = reactive({ active: false });

                return html`
                    <div class='button button--primary' style='--width: auto;' onclick='${() => state.active = true}'>
                        open modal
                    </div>

                    ${modal(
                        {
                            class: 'card',
                            state,
                            style: '--max-width: 420px; --padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); --translateY: var(--size-400); background: var(--color-card-500, var(--color-grey-300));'
                        },
                        html`
                            <h3 style='margin: 0 0 var(--size-400);'>Modal title</h3>
                            <div class='text'>Click the backdrop, press Esc, or use the button below to close.</div>
                            <div
                                class='button button--tertiary'
                                style='--width: auto; margin-top: var(--size-500);'
                                onclick='${() => state.active = false}'
                            >
                                close
                            </div>
                        `
                    )}
                `;
            },
            title: 'dialog'
        }
    ]
};
