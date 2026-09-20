import { switch as switchComponent } from '@esportsplus/ui';


let style = `
        --accent: var(--color-white-400);
        --background-active: var(--color-primary-400);
        --background-default: var(--color-border-500);
    `;


export default {
    name: 'switch',
    variants: [
        {
            render: () => switchComponent({ style, 'aria-label': 'Notifications' }),
            title: 'default'
        },
        {
            render: () => switchComponent({ style: `${style} --border-radius: var(--border-radius-300);`, 'aria-label': 'Notifications' }),
            title: 'squared'
        },
        {
            render: () => switchComponent({ checked: true, style, 'aria-label': 'Sound effects' }),
            title: 'on'
        }
    ]
};
