import { range } from '@esportsplus/ui';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'range',
    variants: [
        {
            render: () => range({ max: 100, min: 0, value: 40 }),
            title: 'min 0 / max 100'
        },
        {
            render: () => range({ max: 10, min: 0, step: 1, value: 3 }),
            title: 'stepped'
        }
    ]
};


export default entry;
