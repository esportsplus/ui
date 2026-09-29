import { capslock } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';


export default {
    name: 'capslock',
    variants: [
        {
            render: () => capslock(),
            title: 'toggle caps lock to show'
        },
        {
            render: () => capslock({ state: reactive({ active: true }) }),
            title: 'active'
        }
    ]
};
