import { ellipsis } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'ellipsis',
    variants: [
        {
            render: () => ellipsis(),
            title: 'loading dots'
        }
    ]
};


export default entry;
