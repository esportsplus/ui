import { tooltip } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let content = 'padding: var(--size-400) var(--size-500); --background: var(--color-black-400); color: var(--color-white-400);',
    trigger = 'button --background-blue --color-white';


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
        {
            render: () => tooltip.context(
                {
                    class: '--flex-center',
                    [tooltip.context.option]: { style: 'padding: var(--size-300) var(--size-500); --color-default: var(--color-white-400); white-space: nowrap;' },
                    options: [
                        { content: 'Back' },
                        { content: 'Reload' },
                        { content: 'Docs ↗', href: '#' }
                    ],
                    style: 'border: 1px dashed currentColor; height: 160px; width: 320px;',
                    [tooltip.context.tooltipContent]: { style: content }
                },
                html`right click here`
            ),
            title: 'context'
        },
        ...[
            ['tooltip-content--scale', 'scale'],
            ['tooltip-content--scale-spring', 'scale + spring'],
            ['tooltip-content--spring', 'spring']
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
        })),
        // Dropdown / select menu animations
        ...[
            ['tooltip-content--zoom', 'menu: zoom (Radix / shadcn / Headless UI)'],
            ['tooltip-content--corner', 'menu: corner (beUI)'],
            ['tooltip-content--grow', 'menu: grow (Material)'],
            ['tooltip-content--stagger', 'menu: stagger']
        ].map(([variant, title]) => ({
            render: () => tooltip.menu(
                {
                    class: trigger,
                    [tooltip.menu.option]: { style: 'padding: var(--size-300) var(--size-500); --color-default: var(--color-white-400); white-space: nowrap;' },
                    options: [
                        { content: 'Profile' },
                        { content: 'Settings' },
                        { content: 'Billing' },
                        { content: 'Sign out' }
                    ],
                    style: '--width: auto;',
                    [tooltip.menu.tooltipContent]: { class: variant, direction: 's', style: content }
                },
                html`open menu`
            ),
            title
        })),
        // Temp: morph review. Content must be wrapped in an element so it can deblur separately from the shape.
        {
            render: () => tooltip.onhover(
                { class: trigger, style: '--width: auto;' },
                html`
                    hover me
                    <div class='tooltip-content tooltip-content--s tooltip-content--morph' style='${content}'>
                        <span>Morphs out of the button, then deblurs</span>
                    </div>
                `
            ),
            title: 'morph (onhover, s)'
        },
        {
            render: () => tooltip.onclick(
                { class: trigger, style: '--width: auto;' },
                html`
                    click me
                    <div class='tooltip-content tooltip-content--n tooltip-content--morph' style='${content} --width: 280px; white-space: normal;'>
                        <div class='--flex-column' style='gap: var(--size-200);'>
                            <strong style='--color: var(--color-white-400);'>Liquid tooltip</strong>
                            <span>Grows out from behind the button, springs open, and shrinks back on close.</span>
                        </div>
                    </div>
                `
            ),
            title: 'morph (onclick, n)'
        },
        {
            render: () => tooltip.onhover(
                { class: trigger, style: '--width: auto;' },
                html`
                    hover me
                    <div class='tooltip-message tooltip-message--e tooltip-message--morph'>Plain text message, no wrapper</div>
                `
            ),
            title: 'morph message (onhover, e)'
        },
        // Group: one shared tooltip glides between items while its content slides the other way.
        ...([
            ['n', 'group (toolbar, n)'],
            ['s', 'group (toolbar, s)']
        ] as const).map(([direction, title]) => ({
            render: () => tooltip.group({
                [tooltip.group.item]: { class: trigger, tabindex: 0 },
                items: [
                    { content: 'B', tooltip: 'Bold' },
                    { content: 'I', tooltip: 'Italic' },
                    { content: 'U', tooltip: 'Underline' },
                    { content: 'Link', tooltip: 'Insert link' },
                    { content: 'Clear', tooltip: 'Clear all formatting' }
                ],
                style: 'gap: var(--size-200);',
                [tooltip.group.tooltipContent]: { direction }
            }),
            title
        })),
        {
            render: () => tooltip.group({
                [tooltip.group.item]: { class: trigger, tabindex: 0 },
                items: [
                    { content: 'Home', tooltip: 'Dashboard' },
                    { content: 'Inbox', tooltip: '3 unread messages' },
                    { content: 'Teams', tooltip: 'Teams' },
                    { content: 'Settings', tooltip: 'Account & preferences' }
                ],
                style: 'flex-direction: column; gap: var(--size-200);',
                [tooltip.group.tooltipContent]: { direction: 'e' }
            }),
            title: 'group (vertical, e)'
        }
    ]
};
