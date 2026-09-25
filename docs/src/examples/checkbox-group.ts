import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { checkboxGroup } from '@esportsplus/ui';
import './checkbox-group.scss';


let notifications = [
        { description: 'Replies to your posts and threads', id: 'comments', label: 'Comments' },
        { description: 'When someone mentions you by name', id: 'mentions', label: 'Mentions' },
        { description: 'When someone starts following you', id: 'followers', label: 'New followers' },
        { description: 'New features, about once a month', id: 'updates', label: 'Product updates' },
        { description: 'A short summary of what you missed', id: 'digest', label: 'Weekly digest' }
    ],
    toppings = [
        { id: 'basil', label: 'Basil' },
        { id: 'mushrooms', label: 'Mushrooms' },
        { id: 'olives', label: 'Olives' },
        { id: 'onions', label: 'Onions' },
        { id: 'peppers', label: 'Peppers' },
        { id: 'pineapple', label: 'Pineapple' }
    ];


export default {
    name: 'checkbox-group',
    variants: [
        {
            render: () => checkboxGroup({ items: notifications, label: 'All notifications', value: ['comments', 'mentions'] }),
            title: 'notifications'
        },
        {
            render: () => {
                let state = reactive(Object.fromEntries(toppings.map((item) => [item.id, item.id === 'basil'])));

                return html`
                    <div class='checkbox-group-demo'>
                        ${checkboxGroup({ hint: false, items: toppings, label: 'Toppings', name: 'toppings', state })}
                        <span class='checkbox-group-demo-status'>
                            ${() => toppings.filter((item) => state[item.id]).map((item) => item.label).join(', ') || 'none'}
                        </span>
                    </div>
                `;
            },
            title: 'without descriptions'
        }
    ]
};
