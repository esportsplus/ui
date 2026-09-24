import { radio } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let instance = 0;
const style = `
    --background-active: var(--color-primary-400);
    --border-color-active: var(--color-primary-400);
    --border-color-default: var(--color-border-500);
    --border-width: var(--border-width-400);
`;


export default {
    name: 'radio',
    variants: [{
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
    }]
};
