import { checkbox } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'checkbox',
    variants: [
        {
            render: () => checkbox({}),
            title: 'default'
        },
        {
            render: () => checkbox({ checked: true }),
            title: 'checked'
        }
    ]
};


export default entry;
