import { notificationBell } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let trigger = 'button button--tertiary';


export default {
    name: 'notification-bell',
    variants: [
        {
            render: () => {
                let state = reactive({ count: 3 });

                return html`
                    <div style='align-items: center; display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        ${notificationBell({ state })}

                        <div class='${trigger}' style='--width: auto;' onclick='${() => state.count++}'>add</div>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => state.count += 25}'>add 25</div>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => state.count = Math.max(0, state.count - 1)}'>read one</div>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => state.count = 0}'>mark all read</div>
                    </div>
                `;
            },
            title: 'interactive'
        },
        {
            render: () => notificationBell({ count: 150 }),
            title: 'max overflow'
        },
        {
            render: () => notificationBell({ count: 12, max: 9 }),
            title: 'custom max'
        },
        {
            render: () => notificationBell({ count: 1, dot: true }),
            title: 'dot'
        },
        {
            render: () => notificationBell({ count: 4, ring: true }),
            title: 'ring on mount'
        },
        {
            render: () => html`
                <div style='align-items: center; display: flex; gap: var(--size-400);'>
                    ${notificationBell({ count: 2, style: '--size: var(--size-700);' })}
                    ${notificationBell({ count: 2 })}
                    ${notificationBell({ count: 2, style: '--size: var(--size-900);' })}
                </div>
            `,
            title: 'sizes'
        }
    ]
};
