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
        }
    ]
};
