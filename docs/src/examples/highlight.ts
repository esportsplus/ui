import { highlight } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let column = 'display: flex; flex-direction: column; gap: var(--size-100); width: 240px;',
    labels = ['Overview', 'Matches', 'Teams', 'Players', 'Settings'],
    radii = ['var(--border-radius-300)', '999px', '0px', 'var(--border-radius-500)', '999px', 'var(--border-radius-300)'],
    row = 'display: flex; flex-wrap: wrap; gap: var(--size-200); align-items: center;';


export default {
    name: 'highlight',
    variants: [
        {
            render: () => html`
                <div style='${row}'>
                    ${highlight()}
                    ${labels.map((label) => html`
                        <div class='button' tabindex='0'>${label}</div>
                    `)}
                </div>
            `,
            title: 'horizontal button group'
        },
        {
            render: () => html`
                <div style='${column}'>
                    ${highlight()}
                    ${labels.map((label) => html`
                        <div
                            class='link'
                            style='--padding-horizontal: var(--size-400); border-radius: var(--border-radius-300);'
                            tabindex='0'
                        >
                            ${label}
                        </div>
                    `)}
                </div>
            `,
            title: 'vertical link list'
        },
        {
            render: () => {
                let state = reactive({ active: 0 });

                return html`
                    <div style='${row}'>
                        ${highlight()}
                        ${labels.map((label, index) => html`
                            <div
                                class='button ${() => state.active === index ? '--active' : ''}'
                                onclick='${() => state.active = index}'
                                style='border-radius: 999px;'
                                tabindex='0'
                            >
                                ${label}
                            </div>
                        `)}
                    </div>
                `;
            },
            title: 'rests on --active'
        },
        {
            render: () => {
                let state = reactive({ active: 1 });

                return html`
                    <div
                        class='card'
                        style='
                            --padding-horizontal: var(--size-300);
                            --padding-vertical: var(--size-300);
                            background: var(--color-black-400);
                            color: var(--color-white-400);
                        '
                    >
                        <div style='${row}'>
                            ${highlight({ class: '--background-blue' })}
                            ${labels.map((label, index) => html`
                                <div
                                    class='button ${() => state.active === index ? '--active' : ''}'
                                    onclick='${() => state.active = index}'
                                    style='--color: var(--color-white-400);'
                                    tabindex='0'
                                >
                                    ${label}
                                </div>
                            `)}
                        </div>
                    </div>
                `;
            },
            title: '--background-blue utility'
        },
        {
            render: () => html`
                <div style='display: grid; gap: var(--size-200); grid-template-columns: repeat(3, 96px);'>
                    ${highlight()}
                    ${radii.map((radius, index) => html`
                        <div
                            class='button'
                            style='border-radius: ${radius}; height: 64px;'
                            tabindex='0'
                        >
                            ${index + 1}
                        </div>
                    `)}
                </div>
            `,
            title: 'wrapping grid · per-item radius'
        }
    ]
} satisfies Entry;
