import { input } from '@esportsplus/ui';
import { boardInputVariations, boardOtpVariations } from './board-fields';
import { fieldVariations } from './form-prototypes';
import { moreFieldVariations } from './form-options';
import { inputPatternVariations } from './form-patterns';


let field = input.bind({});


export default {
    name: 'input',
    variants: [
        ...fieldVariations('input'),
        ...moreFieldVariations('input'),
        ...boardInputVariations(),
        ...boardOtpVariations(),
        ...inputPatternVariations(),
        {
            render: () => field({ placeholder: 'Type here…' }),
            title: 'default'
        },
        {
            render: () => field({ placeholder: 'Password', type: 'password' }),
            title: 'password'
        }
    ]
};
