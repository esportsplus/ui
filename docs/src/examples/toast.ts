import { reactive } from '@esportsplus/reactivity';
import { toaster } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import notify, { notifications, placement } from 'docs/components/notify';


const PLACEMENTS = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];


// A second toaster, independent of the docs' own: its own queue, placement, limit and look.
let alerts = toaster({ [toaster.overflow]: { class: 'notify-overflow notify-overflow--dark' }, class: 'toaster--n', limit: 2 }),
    burst = 0,
    timer: { active: boolean, duration: number } | undefined,
    trigger = 'button button--tertiary';

let alert = alerts.toast.bind({ attributes: { class: 'notify notify--dark' } });


// The action is part of the content, so it closes its own toast through the state it is given.
let action = () => notify((state) => html`
    <div class='notify-text'>
        <span class='notify-title'>Message archived.</span>
        <span class='notify-description'>Undo closes this toast through its own state.</span>
    </div>
    <button
        class='button notify-action'
        type='button'
        onclick='${() => {
            state.active = false;
            notify(() => 'Message restored.');
        }}'
    >
        Undo
    </button>
`);

let detail = () => notify(() => html`
    <div class='notify-text'>
        <span class='notify-title'>Saved successfully.</span>
        <span class='notify-description'>Your changes are live.</span>
    </div>
`);


export default {
    name: 'toast',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => notify(() => 'A plain message.')}'>message</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${detail}'>title + description</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${action}'>with action</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => notify({ duration: 0 }, () => 'Stays until dismissed.')}'>persistent</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => notify({ dismissible: false }, () => 'No close button.')}'>not dismissible</div>
                    <div
                        class='${trigger}'
                        style='--width: auto;'
                        onclick='${() => {
                            for (let i = 0; i < 6; i++) {
                                notify(() => `Notification ${++burst}`);
                            }
                        }}'
                    >
                        burst of 6
                    </div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => notifications.toast.dismiss()}'>dismiss all</div>
                </div>
            `,
            title: 'content'
        },
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400);'>
                    <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        <div
                            class='${trigger}'
                            style='--width: auto;'
                            onclick='${() => {
                                timer = reactive({ active: true, duration: 8000 });
                                notify({ state: timer }, () => html`
                                    <svg aria-hidden='true' class='notify-ring' viewBox='0 0 20 20'>
                                        <circle cx='10' cy='10' r='8' />
                                        <circle cx='10' cy='10' r='8' />
                                    </svg>
                                    <span>Closing in <span class='notify-seconds'></span>s.</span>
                                `);
                            }}'
                        >
                            show
                        </div>
                        <div
                            class='${trigger}'
                            style='--width: auto;'
                            onclick='${() => {
                                if (timer?.active) {
                                    timer.duration += 4000;
                                }
                            }}'
                        >
                            +4 seconds
                        </div>
                    </div>
                    <span style='color: var(--color-text-300); font-size: 14px;'>
                        The toast exposes its clock as '--toast-progress' (0 to 1) and '--toast-seconds'; this ring and
                        count are the content's own CSS. Only the front toast counts down, and it stops while the stack
                        is hovered. Adding to 'state.duration' keeps the time already spent.
                    </span>
                </div>
            `,
            title: 'countdown'
        },
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    ${PLACEMENTS.map((value) => html`
                        <div
                            class='${trigger} ${() => placement.value === value && '--active'}'
                            style='--width: auto;'
                            onclick='${() => {
                                placement.value = value;
                                notify(() => `toaster--${value}`);
                            }}'
                        >
                            ${value}
                        </div>
                    `)}
                </div>
            `,
            title: 'placement'
        },
        {
            render: () => html`
                ${alerts.content}
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => alert(() => `Alert ${++burst}`)}'>alert</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => alerts.toast.dismiss()}'>dismiss alerts</div>
                </div>
            `,
            title: 'separate toaster (top center, limit 2)'
        }
    ]
};
