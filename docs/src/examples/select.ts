import { select } from '@esportsplus/ui';


export default {
    name: 'select',
    variants: [
        {
            render: () => select({
                options: { apples: 'Apples', bananas: 'Bananas', cherries: 'Cherries' }
            }),
            title: 'options'
        },
        {
            render: () => select({
                options: { eur: 'EUR', gbp: 'GBP', usd: 'USD' },
                selected: 'gbp'
            }),
            title: 'pre-selected'
        }
    ]
};
