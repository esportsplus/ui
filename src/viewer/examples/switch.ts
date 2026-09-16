import { switch as switchComponent } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


let style = '--accent: var(--color-white); --background-active: var(--color-primary-400); --background-default: var(--color-border-500);';


const entry: Entry = {
    name: 'switch',
    variants: [
        {
            render: () => switchComponent({ style }),
            title: 'default'
        },
        {
            render: () => switchComponent({ checked: true, style }),
            title: 'on'
        }
    ]
};


export default entry;
