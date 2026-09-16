import { checkbox } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


let style = '--accent: var(--color-white); --background-active: var(--color-primary-400); --border-color-active: var(--color-primary-400); --border-color-default: var(--color-border-500); --border-width: var(--border-width-400); --size: var(--size-500);';


const entry: Entry = {
    name: 'checkbox',
    variants: [
        {
            render: () => checkbox({ style }),
            title: 'default'
        },
        {
            render: () => checkbox({ checked: true, style }),
            title: 'checked'
        }
    ]
};


export default entry;
