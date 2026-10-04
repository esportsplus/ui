import { textarea } from '@esportsplus/ui/components';
import { boardTextareaVariations } from 'docs/examples/board-fields';
import { fieldVariations } from 'docs/examples/form-prototypes';
import { moreFieldVariations } from 'docs/examples/form-options';


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
