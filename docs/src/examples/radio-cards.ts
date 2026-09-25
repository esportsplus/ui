import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { radioCards } from '@esportsplus/ui';
import './radio-cards.scss';


let plans = [
        { description: 'For side projects and trying things out.', period: '/mo', price: '$0', title: 'Hobby', value: 'hobby' },
        { badge: 'Popular', description: 'Unlimited projects and custom domains.', period: '/mo', price: '$12', title: 'Pro', value: 'pro' },
        { description: 'Shared workspaces, roles and priority support.', period: '/mo', price: '$32', title: 'Team', value: 'team' }
    ],
    shipping = [
        { description: 'Arrives in 5 to 7 business days.', price: 'Free', title: 'Standard', value: 'standard' },
        { badge: 'Fastest', description: 'Arrives tomorrow if ordered before 2pm.', price: '$9', title: 'Express', value: 'express' }
    ];


export default {
    name: 'radio-cards',
    variants: [
        {
            render: () => radioCards({ label: 'Choose a plan', options: plans, value: 'pro' }),
            title: 'plans'
        },
        {
            render: () => {
                let state = reactive({ error: '', value: 'standard' });

                return html`
                    <div class='radio-cards-demo'>
                        ${radioCards({ label: 'Delivery', name: 'delivery', options: shipping, state })}
                        <span class='radio-cards-demo-status'>value: ${() => state.value}</span>
                    </div>
                `;
            },
            title: 'controlled state'
        },
        {
            render: () => radioCards({
                label: 'Choose a plan',
                options: plans,
                style: '--card-border-radius: var(--border-radius-500); --card-gap: var(--size-200); --ring-color: var(--color-blue-400);',
                value: 'team'
            }),
            title: 'custom ring and radius'
        }
    ]
};
