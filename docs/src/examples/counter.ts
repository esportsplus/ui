import { counter } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


function animated(variant?: string) {
    let index = 0,
        state = reactive({ value: 1234 }),
        values = [1234, 87654, 4200000];

    return html`
        ${counter({ class: variant, currency: 'USD', state, value: 1234 })}

        <div
            class='button button--tertiary'
            style='--width: auto; margin-top: var(--size-400);'
            onclick='${() => { index = (index + 1) % values.length; state.value = values[index]; }}'
        >
            change value
        </div>
    `;
}


export default {
    name: 'counter',
    variants: [
        {
            render: () => animated(),
            title: 'USD (animated)'
        },
        {
            render: () => animated('counter--snap'),
            title: 'snap'
        },
        {
            render: () => animated('counter--spring'),
            title: 'spring'
        },
        {
            render: () => animated('counter--linear'),
            title: 'linear'
        },
        {
            render: () => animated('counter--stagger'),
            title: 'stagger'
        },
        {
            render: () => counter({ currency: 'IGNORE', value: 98765 }),
            title: 'plain number'
        },
        {
            render: () => counter({ currency: 'IGNORE', decimals: 0, suffix: 'pts', value: 4200 }),
            title: 'suffix'
        }
    ]
};
