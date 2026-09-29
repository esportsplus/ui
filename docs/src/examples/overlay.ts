import { icon, overlay } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import bell from '@esportsplus/ui/svg/bell.svg';
import gear from '@esportsplus/ui/svg/gear.svg';
import home from '@esportsplus/ui/svg/home.svg';
import inbox from '@esportsplus/ui/svg/inbox.svg';


type Options = {
    drag?: boolean;
    style?: string;
};


// Padding, icon and gap add up to '--width-closed', so a collapsed rail clips each label at its first letter.
const ICON = '--size: 20px;';

const ROWS = [
    { icon: home, label: 'Home' },
    { icon: inbox, label: 'Inbox' },
    { icon: bell, label: 'Notifications' },
    { icon: gear, label: 'Settings' }
];

const ROW = 'all: unset; align-items: center; box-sizing: border-box; cursor: pointer; display: flex; gap: 22px; padding: var(--size-300) 22px; width: 100%;';

const STAGE = 'border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400); height: 280px; overflow: hidden; position: relative; width: 100%;';

const SURFACE = 'background: var(--color-card-500, var(--color-grey-300)); box-shadow: var(--box-shadow-400);';


function contained(description: string) {
    let state = reactive({ active: true });

    return html`
        <div style='${STAGE}'>
            ${overlay(
                {
                    class: 'card overlay--w',
                    modal: false,
                    state,
                    style: `--max-width: 220px; --padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); ${SURFACE}`
                },
                html`
                    <div class='text'>${description}</div>
                    <div
                        class='button button--tertiary'
                        style='--width: auto; margin-top: var(--size-500);'
                        onclick='${() => state.active = false}'
                    >
                        close
                    </div>
                `
            )}
            <div
                class='button button--primary'
                style='--width: auto; left: 50%; position: absolute; top: 50%; translate: -50% -50%;'
                onclick='${() => state.active = !state.active}'
            >
                toggle overlay
            </div>
        </div>
    `;
}

function rail() {
    return html`
        <div style='${STAGE}'>
            ${overlay(
                {
                    'aria-label': 'Navigation',
                    class: 'card overlay--w',
                    rail: true,
                    style: `--max-width: 220px; --padding-horizontal: 0px; --padding-vertical: var(--size-300); ${SURFACE}`
                },
                html`
                    <nav>
                        ${ROWS.map(({ icon: href, label }) => html`
                            <a href='#' style='${ROW}' onclick='${(e: MouseEvent) => e.preventDefault()}'>
                                ${icon({ style: ICON }, href)}
                                <span>${label}</span>
                            </a>
                        `)}
                    </nav>
                `
            )}
        </div>
    `;
}

function demo(variant: string, description: string, { drag, style = '' }: Options = {}) {
    let state = reactive({ active: false });

    return html`
        <div class='button button--primary' style='--width: auto;' onclick='${() => state.active = true}'>
            open overlay
        </div>

        ${overlay(
            {
                class: `card ${variant}`,
                drag,
                state,
                style: `--padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); ${SURFACE} ${style}`
            },
            html`
                <h3 style='margin: 0 0 var(--size-400);'>Overlay title</h3>
                <div class='text'>${description}</div>
                <div
                    class='button button--tertiary'
                    style='--width: auto; margin-top: var(--size-500);'
                    onclick='${() => state.active = false}'
                >
                    close
                </div>
            `
        )}
    `;
}


export default {
    name: 'overlay',
    variants: [
        {
            render: () => demo('overlay--c', 'Centered. Click the backdrop, press Esc, or use the button below to close.'),
            title: 'center'
        },
        {
            render: () => demo('overlay--n', 'Slides down from the top edge.'),
            title: 'north'
        },
        {
            render: () => demo('overlay--s', 'Slides up from the bottom edge.'),
            title: 'south'
        },
        {
            render: () => demo('overlay--w', 'Slides in from the left edge.'),
            title: 'west'
        },
        {
            render: () => demo('overlay--e', 'Slides in from the right edge.'),
            title: 'east'
        },
        {
            render: () => demo('overlay--s', 'Drag it back down to close. A quick flick works too, and dragging it up pushes back.', { drag: true }),
            title: 'drag to dismiss'
        },
        {
            render: () => demo('overlay--e', 'Drag it back to the right to close.', { drag: true }),
            title: 'drag to dismiss, east'
        },
        {
            render: () => demo('overlay--w overlay--floating', 'Inset from the edges, with every corner rounded.'),
            title: 'floating'
        },
        {
            render: () => contained('No backdrop, the page behind stays interactive, and it sits inside its positioned container.'),
            title: 'non-modal'
        },
        {
            render: rail,
            title: 'rail'
        },
        {
            render: () => demo('overlay--c', 'Slides a short distance while fading.', { style: '--translate: 0 var(--size-400);' }),
            title: 'slide'
        },
        {
            render: () => demo('overlay--scale', 'Zooms in from slightly smaller.'),
            title: 'scale'
        },
        {
            render: () => demo('overlay--spring', 'Overshoots and settles.'),
            title: 'spring'
        },
        {
            render: () => demo('overlay--scale overlay--blur', 'Blurs the page behind the backdrop.'),
            title: 'blur backdrop'
        },
        {
            render: () => demo('overlay--alert', 'Quick fade and scale over a light blurred backdrop.'),
            title: 'alert'
        }
    ]
};
