import { reactive } from '@esportsplus/reactivity';
import { highlight, radio } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import 'docs/examples/radio/scss/index.scss';


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
    ],
    sizes = ['Small', 'Medium', 'Large'],
    style = `
        --background-active: var(--color-accent-400);
        --border-color-active: var(--color-accent-400);
        --border-color-default: var(--surface-secondary-pressed);
        --border-width: var(--border-width-400);
    `;


// A radio bound to shared state, so the group's chosen value is readable outside the inputs.
function choice(name: string, state: { value: string }, value: string) {
    return radio({
        style,
        [radio.input]: {
            checked: () => state.value === value,
            name,
            onchange: () => {
                state.value = value;
            },
            value
        }
    });
}


export default {
    name: 'radio',
    variants: [
        {
            render: () => {
                let name = `radio-example-${++instance}`;

                return html`
                    <fieldset class='radio-demo'>
                        <legend class='radio-demo-legend'>Choose a size</legend>
                        <div class='radio-demo-inline'>
                            ${sizes.map((size, index) => html`
                                <label class='radio-demo-row radio-demo-row--inline'>
                                    ${radio({ style, [radio.input]: { checked: index === 1, name, value: size } })}
                                    ${size}
                                </label>
                            `)}
                        </div>
                    </fieldset>
                `;
            },
            title: 'default'
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
                                ${choice(name, state, option.value)}
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
                                    ${choice(name, state, plan.value)}
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
