import { loading } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'loading',
    variants: [
        {
            render: () => loading(),
            title: 'default'
        },
        {
            render: () => loading({ style: '--size: var(--size-600); --border-width: var(--border-width-500);' }),
            title: 'small'
        }
    ]
};


export default entry;
