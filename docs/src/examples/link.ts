import { html } from '@esportsplus/template';


let color = '--color: var(--color-purple-300);';


export default {
    name: 'link',
    variants: [
        {
            render: () => html`<div class='link' style='${color}'>Basic link</div>`,
            title: 'default'
        }
    ]
};
