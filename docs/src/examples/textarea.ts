import { textarea } from '@esportsplus/ui';
import { fieldVariations } from './form-prototypes';
import { moreFieldVariations } from './form-options';


let area = textarea.bind({});


export default {
    name: 'textarea',
    variants: [
        ...fieldVariations('textarea'),
        ...moreFieldVariations('textarea'),
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
