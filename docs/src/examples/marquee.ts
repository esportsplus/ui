import { marquee } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let customers = [
    { href: '#atlas', label: 'Atlas' },
    { href: '#meridian', label: 'Meridian' },
    { href: '#kelvin', label: 'Kelvin' },
    { href: '#northbeam', label: 'Northbeam' },
    { href: '#orbit', label: 'Orbit' }
];

let marks = customers.map(({ label }) => ({
    label,
    mark: () => html`
        <svg fill='currentColor' height='16' viewBox='0 0 16 16' width='16'>
            <circle cx='8' cy='8' r='7' />
        </svg>
        ${label}
    `
}));


function toggle() {
    let state = reactive({ paused: false });

    return html`
        ${marquee({ items: customers, label: 'Customers', state })}

        <div
            class='button button--tertiary'
            style='--width: auto; margin-top: var(--size-400);'
            onclick='${() => state.paused = !state.paused}'
        >
            ${() => state.paused ? 'resume' : 'pause'}
        </div>
    `;
}


export default {
    name: 'marquee',
    variants: [
        {
            render: () => marquee({ gap: 44, items: customers, label: 'Customers', speed: 38 }),
            title: 'default'
        },
        {
            render: () => marquee({ direction: 'right', items: customers, label: 'Customers' }),
            title: 'right'
        },
        {
            render: () => marquee({ items: marks, label: 'Customers' }),
            title: 'marks'
        },
        {
            render: () => marquee({ items: customers.map(({ label }) => ({ label })), label: 'Customers', select: (item) => console.log(item.label) }),
            title: 'select'
        },
        {
            render: () => toggle(),
            title: 'paused state'
        }
    ]
};
