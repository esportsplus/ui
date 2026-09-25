import { counter } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


function animated(variant?: string) {
    return cycle([1234, 87654, 4200000], (state) => counter({ class: variant, currency: 'USD', state, value: 1234 }));
}

function cycle(values: number[], render: (state: { value: number }) => ReturnType<typeof counter>) {
    let index = 0,
        state = reactive({ value: values[0] });

    return html`
        ${render(state)}

        <div
            class='button button--tertiary'
            style='--width: auto; margin-top: var(--size-400);'
            onclick='${() => { index = (index + 1) % values.length; state.value = values[index]; }}'
        >
            change value
        </div>
    `;
}

function ticker(variant: string) {
    return cycle([48250, 91307, 12840], (state) => counter({
        class: variant,
        currency: 'IGNORE',
        decimals: 0,
        delay: 0,
        prefix: '$',
        startOnView: true,
        state,
        style: 'font-size: var(--font-size-900);',
        value: 48250
    }));
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
        },
        {
            render: () => ticker('counter--ticker'),
            title: 'ticker'
        },
        {
            render: () => ticker('counter--ticker counter--blur'),
            title: 'ticker with blur'
        }
    ]
};
