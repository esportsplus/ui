import { textarea } from '@esportsplus/ui';


let area = textarea.bind({});


export default {
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
