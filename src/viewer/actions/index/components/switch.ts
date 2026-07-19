import { switch as switchComponent } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'switch',
    variants: [
        {
            render: () => switchComponent({}),
            title: 'default'
        },
        {
            render: () => switchComponent({ checked: true }),
            title: 'on'
        }
    ]
};


export default entry;
