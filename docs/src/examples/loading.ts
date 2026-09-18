import { loading } from '@esportsplus/ui';


export default {
    name: 'loading',
    variants: [
        {
            render: () => loading(),
            title: 'default'
        },
        {
            render: () => loading({ style: '--size: var(--size-600); --border-width: var(--border-width-500);' }),
            title: 'small'
        }
    ]
};
