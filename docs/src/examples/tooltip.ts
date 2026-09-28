import { highlight, icon, tooltip } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import creditCardSvg from '@esportsplus/ui/svg/credit-card.svg';
import documentSvg from '@esportsplus/ui/svg/document.svg';
import dotsSvg from '@esportsplus/ui/svg/dots.svg';
import folderSvg from '@esportsplus/ui/svg/folder.svg';
import gearSvg from '@esportsplus/ui/svg/gear.svg';
import helpSvg from '@esportsplus/ui/svg/help.svg';
import logOutSvg from '@esportsplus/ui/svg/log-out.svg';
import userSvg from '@esportsplus/ui/svg/user.svg';
import './tooltip.scss';


let content = 'padding: var(--size-400) var(--size-500); --background: var(--color-black-400); color: var(--color-white-400);',
    // 'null' draws a divider.
    items = [
        { icon: userSvg, id: 'profile', label: 'Profile' },
        { icon: creditCardSvg, id: 'upgrade', label: 'Upgrade' },
        { icon: folderSvg, id: 'projects', label: 'Projects' },
        { icon: documentSvg, id: 'documentation', label: 'Documentation' },
        null,
        { icon: gearSvg, id: 'settings', label: 'Settings' },
        { icon: helpSvg, id: 'help', label: 'Get Help' },
        { icon: logOutSvg, id: 'logout', label: 'Logout' }
    ],
    trigger = 'button --background-black --color-white';


function dropdown(direction: string) {
    let selected = reactive({ id: 'profile' }),
        state = reactive({ active: false });

    return tooltip.onclick(
        { class: 'tooltip-demo', state },
        html`
            ${icon({ 'aria-hidden': 'true' }, dotsSvg)}
            <div class='tooltip-content tooltip-content--${direction} tooltip-content--expand tooltip-demo-menu'>
                ${items.map((item) => item
                    ? html`
                        <div
                            class='link tooltip-demo-item ${item.id === 'logout' ? 'tooltip-demo-logout' : ''} ${() => selected.id === item.id && '--active'}'
                            onclick='${() => {
                                selected.id = item.id;

                                if (item.id === 'logout') {
                                    state.active = false;
                                }
                            }}'
                        >
                            ${icon({ 'aria-hidden': 'true' }, item.icon)}
                            <span>${item.label}</span>
                        </div>
                    `
                    : html`<hr class='tooltip-demo-divider' />`
                )}
                ${highlight({ class: 'tooltip-demo-highlight', target: '.tooltip-demo-item' })}
            </div>
        `
    );
}


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
        // Expand: opens over the trigger, growing away from the edge or corner the direction anchors it to.
        ...['se', 'sw', 'ne', 'es'].map((direction) => ({
            render: () => dropdown(direction),
            title: `expand: smooth dropdown (${direction})`
        })),
        {
            render: () => tooltip.onhover(
                { class: trigger, style: '--width: auto;' },
                html`
                    hover me
                    <div class='tooltip-message tooltip-message--c tooltip-message--expand'>Opens over the button from its center</div>
                `
            ),
            title: 'expand message (onhover, c)'
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
