import { input } from '@esportsplus/ui';
import { input as inputDark } from '@esportsplus/ui/themes/dark';
import { fieldVariations } from './form-prototypes';
import { moreFieldVariations } from './form-options';


let field = input.bind({});


export default {
    name: 'input',
    variants: [
        ...fieldVariations('input'),
        ...moreFieldVariations('input'),
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
