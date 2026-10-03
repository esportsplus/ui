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
import ava from '~/examples/tooltip/ava.svg?url';
import ben from '~/examples/tooltip/ben.svg?url';
import cara from '~/examples/tooltip/cara.svg?url';
import '~/examples/tooltip/scss/index.scss';


type Profile = {
    avatar: string;
    bio: string;
    followers: number;
    following: number;
    handle: string;
    name: string;
};


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
    // 'nestedMenu' levels; a branch's 'items' drill into a panel of their own.
    nested = [
        { hint: '⌘N', label: 'New file' },
        {
            items: [
                { label: 'Rename' },
                { label: 'Duplicate' },
                {
                    items: [
                        { label: 'Markdown' },
                        { label: 'PDF' },
                        {
                            items: [
                                { label: 'Letter' },
                                { label: 'A4' },
                                { disabled: true, label: 'Tabloid' }
                            ],
                            label: 'Paper size'
                        }
                    ],
                    label: 'Export as'
                }
            ],
            label: 'File actions'
        },
        {
            items: [
                { label: 'Invite members' },
                { items: [{ label: 'Viewer' }, { label: 'Editor' }, { label: 'Owner' }], label: 'Default role' }
            ],
            label: 'Share'
        },
        { disabled: true, label: 'Archive' },
        { danger: true, hint: '⌫', label: 'Delete' }
    ],
    people: Record<'ava' | 'ben' | 'cara', Profile> = {
        ava: {
            avatar: ava,
            bio: 'Design engineer. Writes about springs, gestures and the details nobody notices.',
            followers: 12840,
            following: 312,
            handle: '@ava',
            name: 'Ava Chen'
        },
        ben: {
            avatar: ben,
            bio: 'Builds input systems. Currently teaching trackpads to feel like glass.',
            followers: 4096,
            following: 188,
            handle: '@ben',
            name: 'Ben Ortiz'
        },
        cara: {
            avatar: cara,
            bio: 'Docs and developer experience. If it needs a paragraph, it needs a better API.',
            followers: 2731,
            following: 540,
            handle: '@cara',
            name: 'Cara Nwosu'
        }
    },
    // Each panel of the navigation bar, as its label and links.
    sections: [string, [string, string][]][] = [
        ['Products', [
            ['Hosting', 'Deploy any framework to a global edge network in seconds.'],
            ['SQL Database', 'A fully managed Postgres database that scales with you.'],
            ['CDN', 'Cache and serve assets from hundreds of locations worldwide.'],
            ['Storage', 'Store files and media close to your users.']
        ]],
        ['Solutions', [
            ['Startups', 'Everything you need to ship fast and scale when it matters.'],
            ['AI features', 'Add search, chat and recommendations powered by AI.'],
            ['Enterprise', 'Advanced security, SSO and SLAs for larger organizations.'],
            ['Security', 'Block threats early with built-in WAF and bot protection.'],
            ['Agencies', 'Manage unlimited client projects from a single dashboard.'],
            ['Performance', 'Speed up every page with smart caching and compression.']
        ]],
        ['Resources', [
            ['Documentation', 'Guides, references and examples for every feature.'],
            ['Blog', 'Product news, engineering deep dives and best practices.']
        ]]
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
                            class='link tooltip-demo-item ${item.id === 'logout' && 'tooltip-demo-logout'} ${() => selected.id === item.id && '--active'}'
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

// The card is rendered afresh on every open; the follow state lives here so it outlasts each render.
function mention(profile: Profile, tip: ReturnType<typeof tooltip.shared>) {
    let state = reactive({ following: false });

    return html`
        <button
            class='tooltip-card-demo-trigger'
            type='button'
            ${tip.bind(() => html`
                <span aria-label='${profile.name}, ${profile.handle}' class='tooltip-card-demo-profile' role='group'>
                    <span class='tooltip-card-demo-top'>
                        <span class='tooltip-card-demo-avatar'>
                            <img alt='' src='${profile.avatar}' />
                        </span>
                        <button
                            aria-label='Follow ${profile.name}'
                            class='tooltip-card-demo-follow ${() => state.following && '--active'}'
                            type='button'
                            ${{
                                'aria-pressed': () => state.following ? 'true' : 'false',
                                onclick: () => {
                                    state.following = !state.following;
                                }
                            }}
                        >
                            <span>Follow</span>
                            <span aria-hidden='true'>Following</span>
                        </button>
                    </span>
                    <span class='tooltip-card-demo-name'>${profile.name}</span>
                    <span class='tooltip-card-demo-handle'>${profile.handle}</span>
                    <span class='tooltip-card-demo-bio'>${profile.bio}</span>
                    <span class='tooltip-card-demo-stats'>
                        <span>
                            <strong>${() => (profile.followers + (state.following ? 1 : 0)).toLocaleString('en-US')}</strong>
                            followers
                        </span>
                        <span>
                            <strong>${profile.following.toLocaleString('en-US')}</strong>
                            following
                        </span>
                    </span>
                </span>
            `)}
        >
            ${profile.handle}
        </button>
    `;
}

// 'keep' renders each panel once, on its first open, 'dismiss' closes the panel as a link is followed,
// and 'state.index' rests the highlight on the open section.
function navigation() {
    let state = reactive({ active: false, index: -1 }),
        stop: VoidFunction | undefined,
        tip = tooltip.shared({ delay: { close: 150, open: 50 }, direction: 's', dismiss: 'a[href]', interactive: true, keep: true, state });

    return html`
        <nav
            aria-label='Main'
            class='tooltip-nav-demo'
            ${{
                // The docs router would follow the placeholder links.
                onconnect: (element: HTMLElement) => {
                    let prevent = (e: Event) => e.preventDefault();

                    element.addEventListener('click', prevent);
                    stop = () => element.removeEventListener('click', prevent);
                },
                ondisconnect: () => {
                    stop?.();
                }
            }}
        >
            ${highlight({ class: 'tooltip-nav-demo-highlight', target: '.tooltip-nav-demo-trigger' })}
            ${sections.map(([label, links], index) => html`
                <button
                    class='tooltip-nav-demo-trigger ${() => state.index === index && '--active'}'
                    type='button'
                    ${tip.bind(() => html`
                        <span class='tooltip-nav-demo-panel'>
                            ${links.map(([title, description]) => html`
                                <a class='tooltip-nav-demo-link' href='#'>
                                    <span class='tooltip-nav-demo-title'>${title}</span>
                                    <span class='tooltip-nav-demo-description'>${description}</span>
                                </a>
                            `)}
                        </span>
                    `)}
                >
                    ${label}
                </button>
            `)}
            <a class='tooltip-nav-demo-trigger' href='#'>Pricing</a>
            ${tip.render({ class: 'tooltip-nav-demo-surface' })}
        </nav>
    `;
}

function toolbar(direction: 'e' | 'n' | 's' | 'w', buttons: [string, string][], column = false) {
    let tip = tooltip.shared({ direction });

    return html`
        <div
            class='tooltip-toolbar-demo ${column && 'tooltip-toolbar-demo--column'}'
            ${tip.delegate({ edge: true })}
        >
            ${buttons.map(([label, hint]) => html`
                <button class='${trigger}' data-tooltip='${hint}' type='button'>${label}</button>
            `)}
            ${tip.render()}
        </div>
    `;
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
        ...([
            [true, 'nestedMenu (drill down)'],
            [false, 'nestedMenu (instant)']
        ] as const).map(([animate, title]) => ({
            render: () => tooltip.nestedMenu(
                { animate, items: nested, [tooltip.nestedMenu.trigger]: { class: trigger, style: '--width: auto;' } },
                'open menu'
            ),
            title
        })),
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
        // Delegate: every '[data-tooltip]' in the container is a trigger. 'edge' lines the tooltip up past the
        // container's edge, and the content slides the way the tooltip travels.
        ...([
            ['n', 'shared.delegate (toolbar, edge, n)'],
            ['s', 'shared.delegate (toolbar, edge, s)']
        ] as const).map(([direction, title]) => ({
            render: () => toolbar(direction, [
                ['B', 'Bold'],
                ['I', 'Italic'],
                ['U', 'Underline'],
                ['Link', 'Insert link'],
                ['Clear', 'Clear all formatting']
            ]),
            title
        })),
        {
            render: () => toolbar('e', [
                ['Home', 'Dashboard'],
                ['Inbox', '3 unread messages'],
                ['Teams', 'Teams'],
                ['Settings', 'Account & preferences']
            ], true),
            title: 'shared.delegate (vertical, edge, e)'
        },
        // Anchored on each item, with a template per item; moving diagonally slides the content diagonally.
        {
            render: () => {
                let swatches = [300, 400, 500].flatMap((shade) =>
                        ['black', 'blue', 'green', 'purple', 'red', 'yellow'].map((color) => `${color}-${shade}`)
                    ),
                    tip = tooltip.shared({ direction: 's' });

                return html`
                    <div
                        style='display: grid; gap: var(--size-200); grid-template-columns: repeat(6, 28px);'
                        ${tip.delegate({
                            content: (swatch) => html`--color-<strong>${swatch.dataset.swatch}</strong>`,
                            selector: '[data-swatch]'
                        })}
                    >
                        ${swatches.map((swatch) => html`
                            <div
                                aria-label='${swatch}'
                                data-swatch='${swatch}'
                                style='aspect-ratio: 1; background: var(--color-${swatch}); border-radius: var(--border-radius-300);'
                                tabindex='0'
                            ></div>
                        `)}
                        ${tip.render()}
                    </div>
                `;
            },
            title: 'shared.delegate (grid, template)'
        },
        // Shared: one tooltip for any triggers bound to it, wherever they sit; it renders where 'render()' is placed.
        {
            render: () => {
                let tip = tooltip.shared({ delay: { open: 300 } });

                return html`
                    <div class='tooltip-shared-demo'>
                        ${[
                            ['Copy', 'Copy the link'],
                            ['Duplicate', 'Make a copy of this draft'],
                            ['Share', 'Share with your team'],
                            ['Archive', 'Hide it from the list'],
                            ['Delete', 'Delete for everyone']
                        ].map(([label, hint]) => html`
                            <button class='${trigger}' type='button' ${tip.bind(hint)}>${label}</button>
                        `)}
                        ${tip.render()}
                    </div>
                `;
            },
            title: 'shared (labels, open delay)'
        },
        {
            render: () => {
                let tip = tooltip.shared({ delay: { close: 150, open: 500 }, direction: 's', interactive: true });

                return html`
                    <div>
                        <p class='tooltip-card-demo'>
                            Last week ${mention(people.ava, tip)} shipped the new motion guidelines,
                            ${mention(people.ben, tip)} rebuilt the gesture system on top of them, and
                            ${mention(people.cara, tip)} is already writing the docs.
                            <span class='tooltip-card-demo-hint'>Hover a name to meet them.</span>
                        </p>
                        ${tip.render({ class: 'tooltip-card-demo-card' })}
                    </div>
                `;
            },
            title: 'shared (interactive cards, open + close delay)'
        },
        {
            render: () => navigation(),
            title: 'shared (navigation: keep, dismiss, state.index)'
        }
    ]
};
