import { range } from '@esportsplus/ui';
import { rangeVariations } from './form-prototypes';
import { moreRangeVariations } from './form-options';


let style = '--thumb-background: var(--color-primary-400);';


export default {
    name: 'range',
    variants: [
        ...rangeVariations(),
        ...moreRangeVariations(),
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
