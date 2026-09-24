import { tooltip } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let content = 'padding: var(--size-400) var(--size-500); --background: var(--color-black-400); color: var(--color-white-400);',
    trigger = 'button button--tertiary';


export default {
    name: 'tooltip',
    variants: [
        {
            render: () => tooltip.onhover(
                { class: trigger, style: '--width: auto;' },
                html`
                    hover me
                    <div class='tooltip-content tooltip-content--s' style='${content}'>
                        Tooltip shown on hover (direction s)
                    </div>
                `
            ),
            title: 'onhover'
        },
        {
            render: () => tooltip.onclick(
                { class: trigger, style: '--width: auto;' },
                html`
                    click me
                    <div class='tooltip-content tooltip-content--n' style='${content}'>
                        Tooltip toggled on click (direction n)
                    </div>
                `
            ),
            title: 'onclick'
        },
        {
            render: () => tooltip.menu(
                {
                    class: trigger,
                    [tooltip.menu.option]: { style: 'padding: var(--size-300) var(--size-500); --color-default: var(--color-white-400); white-space: nowrap;' },
                    options: [
                        { content: 'Profile' },
                        { content: 'Settings' },
                        { content: 'Docs ↗', href: '#' }
                    ],
                    style: '--width: auto;',
                    [tooltip.menu.tooltipContent]: { direction: 's', style: content }
                },
                html`open menu`
            ),
            title: 'menu'
        },
        ...[
            ['tooltip-content--fade', 'fade'],
            ['tooltip-content--scale', 'scale'],
            ['tooltip-content--spring', 'spring'],
            ['tooltip-content--delay', 'hover intent delay']
        ].map(([variant, title]) => ({
            render: () => tooltip.onhover(
                { class: trigger, style: '--width: auto;' },
                html`
                    hover me
                    <div class='tooltip-content tooltip-content--s ${variant}' style='${content}'>
                        ${title}
                    </div>
                `
            ),
            title
        }))
    ]
};
