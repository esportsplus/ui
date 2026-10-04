import { html } from '@esportsplus/template';
import { switch as switchComponent } from '@esportsplus/ui/components';
import 'docs/examples/switch/scss/index.scss';


let privacy = [
        { checked: true, id: 'status', label: 'Show online status' },
        { checked: true, id: 'receipts', label: 'Send read receipts' },
        { checked: false, id: 'search', label: 'Appear in search results' },
        { checked: false, id: 'analytics', label: 'Share usage analytics' }
    ],
    style = `
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
        },
        {
            render: () => switchComponent.group(
                { class: 'switch-demo', label: 'Privacy', name: 'privacy', style: '--gap-vertical: var(--size-400);' },
                ({ header, hint, switch: toggle }) => html`
                    ${header({ counter: true })}
                    ${privacy.map((item) => html`
                        <label class='switch-demo-row'>
                            ${toggle({ checked: item.checked, value: item.id })}
                            ${item.label}
                        </label>
                    `)}
                    ${hint()}
                `
            ),
            title: 'group'
        }
    ]
};
