import { range } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


let style = '--thumb-background: var(--color-primary-400);';


const entry: Entry = {
    name: 'range',
    variants: [
        {
            render: () => range({ max: 100, min: 0, style, value: 40 }),
            title: 'min 0 / max 100'
        },
        {
            render: () => range({ max: 10, min: 0, step: 1, style, value: 3 }),
            title: 'stepped'
        }
    ]
};


export default entry;
