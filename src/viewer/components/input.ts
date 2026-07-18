import { input } from '@esportsplus/ui';
import { input as inputDark } from '@esportsplus/ui/themes/dark';
import type { Entry } from '../types';


let field = input.bind({});


const entry: Entry = {
    name: 'input',
    variants: [
        {
            render: () => field({ placeholder: 'Type here…' }),
            title: 'default'
        },
        {
            render: () => field({ placeholder: 'Password', type: 'password' }),
            title: 'password'
        },
        {
            render: () => inputDark({ placeholder: 'Dark preset' }),
            title: 'dark preset'
        }
    ]
};


export default entry;
