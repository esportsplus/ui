import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { multiStepForm } from '@esportsplus/ui';


export default {
    name: 'multi-step-form',
    variants: [
        {
            render: () => multiStepForm(),
            title: 'create a workspace'
        },
        {
            render: () => {
                let created = reactive({ value: '' }),
                    state = reactive({ name: 'Northwind', panel: 1, plan: '' });

                return html`
                    <div style='display: flex; flex-direction: column; gap: var(--size-400); align-items: center;'>
                        ${multiStepForm({
                            oncreate: ({ name, plan }) => {
                                created.value = `oncreate → { name: '${name}', plan: '${plan}' }`;
                            },
                            plans: [
                                { id: 'starter', name: 'Starter', note: 'Up to 3 seats', price: '$8/mo' },
                                { id: 'scale', name: 'Scale', note: 'Unlimited seats, SSO', price: '$64/mo' }
                            ],
                            state,
                            style: '--accent: var(--color-purple-400);'
                        })}
                        <small style='color: var(--color-text-300); font-variant-numeric: tabular-nums;'>
                            ${() => created.value || `state.panel = ${state.panel}, state.plan = '${state.plan}'`}
                        </small>
                    </div>
                `;
            },
            title: 'custom plans, controlled state'
        }
    ]
};
