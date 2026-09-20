import { checkbox } from '@esportsplus/ui';


let style = `
        --background-active: var(--color-primary-400);
        --border-color-active: var(--color-primary-400);
        --border-color-default: var(--color-border-500);
        --border-width: var(--border-width-400);
        --check-color: var(--color-white-400);
    `;


export default {
    name: 'checkbox',
    variants: [
        {
            render: () => checkbox({ style, 'aria-label': 'Checkbox' }),
            title: 'default'
        },
        {
            render: () => checkbox({ checked: true, style, 'aria-label': 'Initially checked checkbox' }),
            title: 'checked'
        }
    ]
};
