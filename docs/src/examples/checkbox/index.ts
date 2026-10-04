import { html } from '@esportsplus/template';
import { checkbox } from '@esportsplus/ui/components';
import '~/examples/checkbox/scss/index.scss';


let notifications = [
        { checked: true, description: 'Replies to your posts and threads', id: 'comments', label: 'Comments' },
        { checked: true, description: 'When someone mentions you by name', id: 'mentions', label: 'Mentions' },
        { checked: false, description: 'When someone starts following you', id: 'followers', label: 'New followers' },
        { checked: false, description: 'New features, about once a month', id: 'updates', label: 'Product updates' },
        { checked: false, description: 'A short summary of what you missed', id: 'digest', label: 'Weekly digest' }
    ],
    style = `
        --background-active: var(--color-primary-400);
        --border-color-active: var(--color-primary-400);
        --border-color-default: var(--color-border-500);
        --border-width: var(--border-width-400);
        --check-color: var(--color-white-400);
    `,
    toppings = [
        { id: 'basil', label: 'Basil' },
        { id: 'mushrooms', label: 'Mushrooms' },
        { id: 'olives', label: 'Olives' },
        { id: 'onions', label: 'Onions' },
        { id: 'peppers', label: 'Peppers' },
        { id: 'pineapple', label: 'Pineapple' }
    ];


export default {
    name: 'checkbox',
    variants: [
        {
            render: () => checkbox({ style, [checkbox.input]: { 'aria-label': 'Checkbox' } }),
            title: 'default'
        },
        {
            render: () => checkbox({ style, [checkbox.input]: { 'aria-label': 'Initially checked checkbox', checked: true } }),
            title: 'checked'
        },
        {
            render: () => checkbox.group(
                { class: 'checkbox-demo', label: 'All notifications', style: '--gap-vertical: var(--size-400);' },
                ({ checkbox, header, hint }) => html`
                    ${header({ counter: true })}
                    ${notifications.map((item) => html`
                        <label class='checkbox-demo-row checkbox-demo-row--description'>
                            ${checkbox({ checked: item.checked, value: item.id })}
                            <span class='checkbox-demo-text'>
                                ${item.label}
                                <span class='checkbox-demo-description'>${item.description}</span>
                            </span>
                        </label>
                    `)}
                    ${hint()}
                `
            ),
            title: 'group'
        },
        {
            render: () => checkbox.group(
                { class: 'checkbox-demo', label: 'Toppings', name: 'toppings', style: '--gap-vertical: var(--size-300);' },
                ({ checkbox, header, selected }) => html`
                    ${header()}
                    ${toppings.map((item) => html`
                        <label class='checkbox-demo-row'>
                            ${checkbox({ checked: item.id === 'basil', value: item.id })}
                            ${item.label}
                        </label>
                    `)}
                    <span class='checkbox-demo-status'>
                        ${() => {
                            let ids = selected();

                            return toppings.filter((item) => ids.includes(item.id)).map((item) => item.label).join(', ') || 'none';
                        }}
                    </span>
                `
            ),
            title: 'group without descriptions'
        }
    ]
};
