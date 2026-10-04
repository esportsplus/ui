import { icon, overlay } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import bell from '@esportsplus/ui/svg/bell.svg';
import gear from '@esportsplus/ui/svg/gear.svg';
import home from '@esportsplus/ui/svg/home.svg';
import inbox from '@esportsplus/ui/svg/inbox.svg';


type Sheet = {
    description: string;
    title: string;
};


// Padding, icon and gap add up to '--width-closed', so a collapsed rail clips each label at its first letter.
const ICON = '--size: 20px;';

const BUTTON = '--width: auto; margin-top: var(--size-500);';

const ROWS = [
    { icon: home, label: 'Home' },
    { icon: inbox, label: 'Inbox' },
    { icon: bell, label: 'Notifications' },
    { icon: gear, label: 'Settings' }
];

const ROW = 'all: unset; align-items: center; box-sizing: border-box; cursor: pointer; display: flex; gap: 22px; padding: var(--size-300) 22px; width: 100%;';

const STAGE = 'border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400); height: 280px; overflow: hidden; position: relative; width: 100%;';

const SHEETS: Sheet[] = [
    { description: 'Anyone with the link can view. Invite people to let them edit.', title: 'Share draft' },
    { description: "They'll get an email and can edit right away.", title: 'Invite people' },
    { description: 'Links stop working after the date you choose. Drag down or press Esc to go back.', title: 'Expiry' }
];

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
                        class='button'
                        style='${BUTTON}'
                        onclick='${() => state.active = false}'
                    >
                        close
                    </div>
                `
            )}
            <div
                class='button'
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

function demo(variant: string, description: string, style = '') {
    let state = reactive({ active: false });

    return html`
        <div class='button' style='--width: auto;' onclick='${() => state.active = true}'>
            open overlay
        </div>

        ${overlay(
            {
                class: `card ${variant}`,
                state,
                style: `--padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); ${SURFACE} ${style}`
            },
            html`
                <h3 style='margin: 0 0 var(--size-400);'>Overlay title</h3>
                <div class='text'>${description}</div>
                <div
                    class='button'
                    style='${BUTTON}'
                    onclick='${() => state.active = false}'
                >
                    close
                </div>
            `
        )}
    `;
}


// Each sheet opens the next over itself; 'modal: false' keeps them, and the page they push back, inside the stage.
function stacked(modal: boolean) {
    let states = SHEETS.map(() => reactive({ active: false })),
        sheets = SHEETS.map(({ description, title }, i) => overlay(
            {
                'aria-label': title,
                class: 'card overlay--s',
                modal,
                state: states[i],
                style: `--padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); ${SURFACE}`
            },
            html`
                <h3 style='margin: var(--size-300) 0 var(--size-400);'>${title}</h3>
                <div class='text'>${description}</div>
                <div style='display: flex; gap: var(--size-300); margin-top: var(--size-500);'>
                    ${i + 1 < SHEETS.length && html`
                        <div class='button' style='--width: auto;' onclick='${() => states[i + 1].active = true}'>
                            ${SHEETS[i + 1].title}
                        </div>
                    `}
                    <div class='button' style='--width: auto;' onclick='${() => states[i].active = false}'>
                        done
                    </div>
                </div>
            `
        ));

    if (modal) {
        return html`
            <div class='button' style='--width: auto;' onclick='${() => states[0].active = true}'>
                share
            </div>
            ${sheets}
        `;
    }

    return html`
        <div style='${STAGE} background: var(--color-border-400); height: 480px; max-width: 360px;'>
            <div class='overlay-page card' style='${SURFACE} inset: 0; padding: var(--size-600); position: absolute;'>
                <div class='text' style='color: var(--color-text-300);'>Drafts</div>
                <h3 style='margin: var(--size-200) 0 var(--size-400);'>Launch notes</h3>
                <div class='text'>Three fixes, one new component, and a faster index. Ship Thursday after review.</div>
                <div class='button' style='${BUTTON}' onclick='${() => states[0].active = true}'>
                    share
                </div>
            </div>
            ${sheets}
        </div>
    `;
}


export default {
    name: 'overlay',
    variants: [
        {
            render: () => demo('overlay--c', 'Centered. Drag it down, click the backdrop, press Esc, or use the button below to close.'),
            title: 'center'
        },
        {
            render: () => demo('overlay--n', 'Slides down from the top edge. Drag it back up to close.'),
            title: 'north'
        },
        {
            render: () => demo('overlay--s', 'Slides up from the bottom edge. Drag it back down to close; a quick flick works too, and dragging it up pushes back.'),
            title: 'south'
        },
        {
            render: () => demo('overlay--w', 'Slides in from the left edge. Drag it back to the left to close.'),
            title: 'west'
        },
        {
            render: () => demo('overlay--e', 'Slides in from the right edge. Drag it back to the right to close.'),
            title: 'east'
        },
        {
            render: () => demo('overlay--ne overlay--floating', 'Pinned to the top right corner. Drag it back up to close.'),
            title: 'north-east'
        },
        {
            render: () => demo('overlay--sw', 'Flush in the bottom left corner, squared where it meets both edges. Drag it back down to close.'),
            title: 'south-west'
        },
        {
            render: () => stacked(true),
            title: 'stacked'
        },
        {
            render: () => stacked(false),
            title: 'stacked, pushing back the page'
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
            render: () => demo('overlay--c', 'Slides a short distance while fading.', '--translate: 0 var(--size-400);'),
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
