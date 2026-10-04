import { counter } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


// The counter takes the surrounding font size; these demos keep a display size.
let display = 'font-size: clamp(2rem, 4vw + 1rem, 8rem);';


function animated(variant?: string) {
    return cycle([1234, 87654, 4200000], (state) => counter({ class: variant, currency: 'USD', state, style: display, value: 1234 }));
}

function cycle(values: number[], render: (state: { value: number }) => ReturnType<typeof counter>) {
    let index = 0,
        state = reactive({ value: values[0] });

    return html`
        ${render(state)}

        <button
            class='button button--tertiary'
            style='--width: auto; margin-top: var(--size-400);'
            onclick='${() => { index = (index + 1) % values.length; state.value = values[index]; }}'
            type='button'
        >
            change value
        </button>
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
            render: () => animated('counter--shade'),
            title: 'shade'
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
            render: () => counter({ currency: 'IGNORE', style: display, value: 98765 }),
            title: 'plain number'
        },
        {
            render: () => counter({ currency: 'IGNORE', decimals: 0, style: display, suffix: 'pts', value: 4200 }),
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
