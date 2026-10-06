import { notification } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let trigger = 'button';


function controls(state: { count: number }) {
    return html`
        <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => state.count++}'>add</button>
        <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => state.count += 25}'>add 25</button>
        <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => state.count = Math.max(0, state.count - 1)}'>read one</button>
        <button class='${trigger}' style='--width: auto;' type='button' onclick='${() => state.count = 0}'>mark all read</button>
    `;
}


export default {
    name: 'notification',
    variants: [
        {
            render: () => {
                let state = reactive({ count: 3 });

                return html`
                    <div style='align-items: center; display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        ${notification({ state })}
                        ${controls(state)}
                    </div>
                `;
            },
            title: 'interactive'
        },
        {
            render: () => notification({ count: 150 }),
            title: 'max overflow'
        },
        {
            render: () => notification({ count: 12, max: 9 }),
            title: 'custom max'
        },
        {
            render: () => notification({ count: 1, counter: false }),
            title: 'without counter'
        },
        {
            render: () => html`
                <div style='align-items: center; display: flex; gap: var(--size-400);'>
                    ${notification({ count: 2, style: '--size: var(--size-400);' })}
                    ${notification({ count: 2 })}
                    ${notification({ count: 2, style: '--size: var(--size-600);' })}
                </div>
            `,
            title: 'sizes'
        },
        {
            render: () => {
                let state = reactive({ count: 3 });

                return html`
                    <div style='align-items: center; display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        ${notification({ bell: true, state })}
                        ${controls(state)}
                    </div>
                `;
            },
            title: 'bell, interactive'
        },
        {
            render: () => notification({ bell: true, count: 150 }),
            title: 'bell, max overflow'
        },
        {
            render: () => notification({ bell: true, count: 1, counter: false }),
            title: 'bell, without counter'
        },
        {
            render: () => notification({ bell: true, count: 4, ring: true }),
            title: 'bell, ring on mount'
        },
        {
            render: () => html`
                <div style='align-items: center; display: flex; gap: var(--size-400);'>
                    ${notification({ bell: true, count: 2, style: '--size: var(--size-700);' })}
                    ${notification({ bell: true, count: 2 })}
                    ${notification({ bell: true, count: 2, style: '--size: var(--size-900);' })}
                </div>
            `,
            title: 'bell, sizes'
        }
    ]
};
