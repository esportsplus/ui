import { copy } from '@esportsplus/ui/components';


export default {
    name: 'copy',
    variants: [
        {
            render: () => copy({ value: 'Copied from the viewer!' }),
            title: 'default'
        },
        {
            render: () => copy({ timeout: 800, value: 'Copied from the viewer!' }),
            title: 'timeout: 800'
        }
    ]
};
