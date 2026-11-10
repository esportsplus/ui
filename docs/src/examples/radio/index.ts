import { reactive } from '@esportsplus/reactivity';
import { radio } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import 'docs/examples/radio/scss/index.scss';


let instance = 0,
    shipping = [
        { description: 'Arrives in 5 to 7 business days.', title: 'Standard', value: 'standard' },
        { description: 'Arrives in 2 to 3 business days.', title: 'Priority', value: 'priority' },
        { description: 'Arrives tomorrow if ordered before 2pm.', title: 'Express', value: 'express' }
    ],
    sizes = ['Small', 'Medium', 'Large'],
    style = `
        --background-active: var(--color-accent-400);
        --border-color-active: var(--color-accent-400);
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
                        <legend class='field field--header radio-demo-legend'><span class='field-label'>Choose a size</span></legend>
                        <div class='radio-demo-inline'>
                            ${sizes.map((size, index) => html`
                                <label class='field field--row'>
                                    ${radio({ style, [radio.input]: { checked: index === 1, name, value: size } })}
                                    <span class='field-label'>${size}</span>
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
                        <legend class='field field--header radio-demo-legend'><span class='field-label'>Delivery</span></legend>
                        ${shipping.map((option) => html`
                            <label class='field field--row'>
                                ${choice(name, state, option.value)}
                                <span class='field-label'>${option.title}</span>
                                <small class='field-description'>${option.description}</small>
                            </label>
                        `)}
                        <small class='field-description'>value: ${() => state.value}</small>
                    </fieldset>
                `;
            },
            title: 'group'
        }
    ]
};
