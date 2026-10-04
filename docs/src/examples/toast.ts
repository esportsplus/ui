import { reactive } from '@esportsplus/reactivity';
import { toaster as createToaster } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import toast, { toaster, placement } from 'docs/components/toaster';


const PLACEMENTS = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];


// A second toaster, independent of the docs' own: its own queue, placement, limit and look.
let alerts = createToaster({ [createToaster.overflow]: { class: 'docs-toast-overflow docs-toast-overflow--dark' }, class: 'toaster--n', limit: 2 }),
    burst = 0,
    timer: { active: boolean, duration: number } | undefined,
    trigger = 'button button--tertiary';

let alert = alerts.toast.bind({ attributes: { class: 'docs-toast docs-toast--dark' } });


// The action is part of the content, so it closes its own toast through the state it is given.
let action = () => toast((state) => html`
    <div class='docs-toast-text'>
        <span class='docs-toast-title'>Message archived.</span>
        <span class='docs-toast-description'>Undo closes this toast through its own state.</span>
    </div>
    <button
        class='button docs-toast-action'
        type='button'
        onclick='${() => {
            state.active = false;
            toast(() => 'Message restored.');
        }}'
    >
        Undo
    </button>
`);

let detail = () => toast(() => html`
    <div class='docs-toast-text'>
        <span class='docs-toast-title'>Saved successfully.</span>
        <span class='docs-toast-description'>Your changes are live.</span>
    </div>
`);


export default {
    name: 'toast',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => toast(() => 'A plain message.')}'>message</button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${detail}'>title + description</button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${action}'>with action</button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => toast({ duration: 0 }, () => 'Stays until dismissed.')}'>persistent</button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => toast({ dismissible: false }, () => 'No close button.')}'>not dismissible</button>
                    <button
                        class='${trigger}'
                        style='--width: auto;'
                        type='button'
                        onclick='${() => {
                            for (let i = 0; i < 6; i++) {
                                toast(() => `Notification ${++burst}`);
                            }
                        }}'
                    >
                        burst of 6
                    </button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => toaster.toast.dismiss()}'>dismiss all</button>
                </div>
            `,
            title: 'content'
        },
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400);'>
                    <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        <button
                            class='${trigger}'
                            style='--width: auto;'
                            type='button'
                            onclick='${() => {
                                timer = reactive({ active: true, duration: 8000 });
                                toast({ state: timer }, () => html`
                                    <svg aria-hidden='true' class='docs-toast-ring' viewBox='0 0 20 20'>
                                        <circle cx='10' cy='10' r='8' />
                                        <circle cx='10' cy='10' r='8' />
                                    </svg>
                                    <span>Closing in <span class='docs-toast-seconds'></span>s.</span>
                                `);
                            }}'
                        >
                            show
                        </button>
                        <button
                            class='${trigger}'
                            style='--width: auto;'
                            type='button'
                            onclick='${() => {
                                if (timer?.active) {
                                    timer.duration += 4000;
                                }
                            }}'
                        >
                            +4 seconds
                        </button>
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
                        <button
                            class='${trigger} ${() => placement.value === value && '--active'}'
                            style='--width: auto;'
                            type='button'
                            onclick='${() => {
                                placement.value = value;
                                toast(() => `toaster--${value}`);
                            }}'
                        >
                            ${value}
                        </button>
                    `)}
                </div>
            `,
            title: 'placement'
        },
        {
            render: () => html`
                ${alerts.content}
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => alert(() => `Alert ${++burst}`)}'>alert</button>
                    <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => alerts.toast.dismiss()}'>dismiss alerts</button>
                </div>
            `,
            title: 'separate toaster (top center, limit 2)'
        }
    ]
};
