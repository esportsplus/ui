import { back } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


let link = back.bind({ attributes: { style: '--color: var(--color-purple-300);' } });


const entry: Entry = {
    name: 'back',
    variants: [
        {
            render: () => link({ href: '#' }, 'Back'),
            title: 'link with arrow'
        }
    ]
};


export default entry;
