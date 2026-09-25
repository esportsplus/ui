import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { morphingButton } from '@esportsplus/ui';


// Long enough to see the spinner turn, short for a save.
const LATENCY = 1200;


function wait(fail: boolean) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            if (fail) {
                reject(new Error('Save failed'));
            }
            else {
                resolve();
            }
        }, LATENCY);
    });
}


export default {
    name: 'morphing-button',
    variants: [
        {
            render: () => {
                let saves = 0;

                // Every other save fails, so both endings are one click apart.
                return morphingButton({ onsave: () => wait(saves++ % 2 === 1) });
            },
            title: 'save with retry'
        },
        {
            render: () => {
                let state = reactive({ status: 'idle' as 'error' | 'idle' | 'loading' | 'success' });

                return html`
                    <div style='align-items: center; display: flex; gap: var(--size-400);'>
                        ${morphingButton({ class: 'morphing-button--blue', label: 'Publish', onsave: () => wait(false), state, successFor: 2400 })}
                        <span style='color: var(--color-text-300); font-size: 14px;'>${() => state.status}</span>
                    </div>
                `;
            },
            title: 'observed state'
        }
    ]
};
