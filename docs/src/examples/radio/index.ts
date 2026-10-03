import { reactive } from '@esportsplus/reactivity';
import { highlight, radio } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import './scss/index.scss';


let instance = 0,
    plans = [
        { description: 'For side projects and trying things out.', period: '/mo', price: '$0', title: 'Hobby', value: 'hobby' },
        { badge: 'Popular', description: 'Unlimited projects and custom domains.', period: '/mo', price: '$12', title: 'Pro', value: 'pro' },
        { description: 'Shared workspaces, roles and priority support.', period: '/mo', price: '$32', title: 'Team', value: 'team' }
    ],
    shipping = [
        { description: 'Arrives in 5 to 7 business days.', title: 'Standard', value: 'standard' },
        { description: 'Arrives in 2 to 3 business days.', title: 'Priority', value: 'priority' },
        { description: 'Arrives tomorrow if ordered before 2pm.', title: 'Express', value: 'express' }
    ];
const style = `
    --background-active: var(--color-primary-400);
    --border-color-active: var(--color-primary-400);
    --border-color-default: var(--color-border-500);
    --border-width: var(--border-width-400);
`;


export default {
    name: 'radio',
    variants: [
        {
            title: 'Spring · Inset mark with matching corners',
            render: () => {
                let name = `radio-example-${++instance}`;
                return html`
                    <fieldset style='border: 0; margin: 0; padding: 0; min-width: 0;'>
                        <legend style='margin-bottom: var(--size-400);'>Choose a size</legend>
                        <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                            ${['Small', 'Medium', 'Large'].map((label, index) => html`
                                <label style='display: inline-flex; align-items: center; gap: var(--size-300); cursor: pointer;'>
                                    ${radio({ style, [radio.input]: { 'aria-label': label, checked: index === 1, name, value: label } })}
                                    <span>${label}</span>
                                </label>
                            `)}
                        </div>
                    </fieldset>
                `;
            }
        },
        {
            render: () => {
                let name = `radio-example-${++instance}`,
                    state = reactive({ value: 'standard' });

                return html`
                    <fieldset class='radio-demo'>
                        <legend class='radio-demo-legend'>Delivery</legend>
                        ${shipping.map((option) => html`
                            <label class='radio-demo-row'>
                                ${radio({
                                    [radio.input]: {
                                        checked: () => state.value === option.value,
                                        name,
                                        onchange: () => {
                                            state.value = option.value;
                                        },
                                        value: option.value
                                    }
                                })}
                                <span class='radio-demo-text'>
                                    ${option.title}
                                    <span class='radio-demo-description'>${option.description}</span>
                                </span>
                            </label>
                        `)}
                        <span class='radio-demo-status'>value: ${() => state.value}</span>
                    </fieldset>
                `;
            },
            title: 'group'
        },
        {
            render: () => {
                let name = `radio-example-${++instance}`,
                    state = reactive({ value: 'pro' });

                return html`
                    <fieldset class='radio-demo'>
                        <legend class='radio-demo-legend'>Choose a plan</legend>
                        <div class='radio-demo-cards'>
                            ${highlight({ class: 'radio-demo-ring', hover: false })}
                            ${plans.map((plan) => html`
                                <label class='card radio-demo-card' ${{ class: () => state.value === plan.value && '--active' }}>
                                    ${radio({
                                        [radio.input]: {
                                            checked: () => state.value === plan.value,
                                            name,
                                            onchange: () => {
                                                state.value = plan.value;
                                            },
                                            value: plan.value
                                        }
                                    })}
                                    <span class='radio-demo-text'>
                                        <span class='radio-demo-heading'>
                                            ${plan.title}
                                            ${plan.badge && html`<span class='radio-demo-badge'>${plan.badge}</span>`}
                                        </span>
                                        <span class='radio-demo-description'>${plan.description}</span>
                                    </span>
                                    <span class='radio-demo-price'>
                                        ${plan.price}
                                        <span class='radio-demo-period'>${plan.period}</span>
                                    </span>
                                </label>
                            `)}
                        </div>
                        <span class='radio-demo-status'>value: ${() => state.value}</span>
                    </fieldset>
                `;
            },
            title: 'cards'
        }
    ]
};
