import { textarea } from '@esportsplus/ui';
import { boardTextareaVariations } from '~/examples/board-fields';
import { fieldVariations } from '~/examples/form-prototypes';
import { moreFieldVariations } from '~/examples/form-options';


export default {
    name: 'textarea',
    variants: [
        ...fieldVariations('textarea'),
        ...moreFieldVariations('textarea'),
        ...boardTextareaVariations(),
        {
            render: () => textarea({
                autoresize: { height: { max: '240px', min: '60px' } },
                placeholder: 'Grows as you type…'
            }),
            title: 'autoresize'
        },
        {
            render: () => textarea({ placeholder: 'Write something…' }),
            title: 'default'
        },
        {
            render: () => textarea({ placeholder: 'Taller', rows: 6, style: 'min-height: 120px;' }),
            title: 'tall'
        }
    ]
};
