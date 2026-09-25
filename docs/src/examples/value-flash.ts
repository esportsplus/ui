import { valueFlash } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let price = new Intl.NumberFormat('en-US', { currency: 'USD', style: 'currency' });


function controls(state: { value: number }, step: number, render: ReturnType<typeof valueFlash>) {
    return html`
        ${render}

        <div style='display: flex; gap: var(--size-200); margin-top: var(--size-400);'>
            <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.value -= step}'>
                decrease
            </div>
            <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.value += step}'>
                increase
            </div>
            <div
                class='button button--tertiary'
                style='--width: auto;'
                onclick='${() => state.value += Math.round((Math.random() - 0.5) * step * 400) / 100}'
            >
                random
            </div>
        </div>
    `;
}


export default {
    name: 'value-flash',
    variants: [
        {
            render: () => {
                let state = reactive({ value: 184.32 });

                return controls(state, 1.25, valueFlash({ format: (value) => price.format(value), label: 'Price', state }));
            },
            title: 'price'
        },
        {
            render: () => {
                let state = reactive({ value: 1240 });

                return controls(state, 1, valueFlash({ format: (value) => `${Math.round(value).toLocaleString()} req/s`, label: 'Requests', state }));
            },
            title: 'request rate'
        },
        {
            render: () => {
                let state = reactive({ value: 42 });

                return controls(state, 1, valueFlash({ hold: 2000, state, style: '--font-size: var(--font-size-600);' }));
            },
            title: 'large, long hold'
        }
    ]
};
