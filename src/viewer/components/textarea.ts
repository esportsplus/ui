import { textarea } from '@esportsplus/ui';
import type { Entry } from '../types';


let area = textarea.bind({});


const entry: Entry = {
    name: 'textarea',
    variants: [
        {
            render: () => area({ placeholder: 'Write something…' }),
            title: 'default'
        },
        {
            render: () => area({ placeholder: 'Taller', rows: 6, style: 'min-height: 120px;' }),
            title: 'tall'
        }
    ]
};


export default entry;
