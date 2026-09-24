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
            render: () => switchComponent({ style, [switchComponent.input]: { 'aria-label': 'Notifications' } }),
            title: 'default'
        },
        {
            render: () => switchComponent({ style: `${style} --border-radius: var(--border-radius-300);`, [switchComponent.input]: { 'aria-label': 'Notifications' } }),
            title: 'squared'
        },
        {
            render: () => switchComponent({ style, [switchComponent.input]: { 'aria-label': 'Sound effects', checked: true } }),
            title: 'on'
        }
    ]
};
