import { select } from '@esportsplus/ui';
import { select as selectDark } from '@esportsplus/ui/themes/dark';


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
        },
        {
            render: () => selectDark({
                options: { one: 'One', three: 'Three', two: 'Two' }
            }),
            title: 'dark preset'
        }
    ]
};
