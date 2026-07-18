import { typewriter } from '@esportsplus/ui';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'typewriter',
    variants: [
        {
            render: () => typewriter({}, ['Build once.', 'Ship everywhere.', '@esportsplus/ui']),
            title: 'cycling text'
        }
    ]
};


export default entry;
