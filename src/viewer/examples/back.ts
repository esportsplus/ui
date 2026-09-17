import { back } from '@esportsplus/ui';


let link = back.bind({ attributes: { style: '--color: var(--color-purple-300);' } });


export default {
    name: 'back',
    variants: [
        {
            render: () => link({ href: '#' }, 'Back'),
            title: 'link with arrow'
        }
    ]
};
