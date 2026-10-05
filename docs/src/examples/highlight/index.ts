import { highlight } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from 'docs/types';
import 'docs/examples/highlight/scss/index.scss';


let column = '--gap-vertical: var(--size-100); width: 240px;',
    labels = ['Overview', 'Matches', 'Teams', 'Players', 'Settings'],
    radii = ['var(--border-radius-300)', '999px', '0px', 'var(--border-radius-500)', '999px', 'var(--border-radius-300)'],
    row = '--gap-horizontal: var(--size-200); --gap-vertical: var(--size-200);';


function tabs(line: 'bottom' | 'left', fill: boolean) {
    let state = reactive({ active: 0 });

    return html`
        <div
            aria-orientation='${line === 'left' ? 'vertical' : 'horizontal'}'
            class='highlight-demo-tabs ${line === 'left' && 'highlight-demo-tabs--vertical'}'
            role='tablist'
        >
            ${highlight({ class: 'highlight-demo-highlight', fill, line })}
            ${labels.map((label, index) => html`
                <button
                    class='highlight-demo-tab ${() => state.active === index && '--active'}'
                    onclick='${() => state.active = index}'
                    role='tab'
                    type='button'
                    ${{ 'aria-selected': () => String(state.active === index) }}
                >
                    ${label}
                </button>
            `)}
        </div>
    `;
}


export default {
    name: 'highlight',
    variants: [
        {
            render: () => html`
                <div class='--flex-vertical' style='${row}'>
                    ${highlight()}
                    ${labels.map((label) => html`
                        <button class='button' type='button'>${label}</button>
                    `)}
                </div>
            `,
            title: 'horizontal button group'
        },
        {
            render: () => html`
                <div class='--flex-column' style='${column}'>
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
                    <div class='--flex-vertical' style='${row}'>
                        ${highlight()}
                        ${labels.map((label, index) => html`
                            <button
                                class='button ${() => state.active === index && '--active'}'
                                onclick='${() => state.active = index}'
                                style='border-radius: 999px;'
                                type='button'
                            >
                                ${label}
                            </button>
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
                        <div class='--flex-vertical' style='${row}'>
                            ${highlight({ class: '--background-blue' })}
                            ${labels.map((label, index) => html`
                                <button
                                    class='button ${() => state.active === index && '--active'}'
                                    onclick='${() => state.active = index}'
                                    style='--color: var(--color-white-400);'
                                    type='button'
                                >
                                    ${label}
                                </button>
                            `)}
                        </div>
                    </div>
                `;
            },
            title: '--background-blue utility'
        },
        {
            render: () => tabs('bottom', true),
            title: 'tabs · background + line'
        },
        {
            render: () => tabs('bottom', false),
            title: 'tabs · line only'
        },
        {
            render: () => tabs('left', true),
            title: 'vertical tabs · background + line'
        },
        {
            render: () => html`
                <div style='display: grid; gap: var(--size-200); grid-template-columns: repeat(3, 96px);'>
                    ${highlight()}
                    ${radii.map((radius, index) => html`
                        <button
                            class='button'
                            style='border-radius: ${radius}; height: 64px;'
                            type='button'
                        >
                            ${index + 1}
                        </button>
                    `)}
                </div>
            `,
            title: 'wrapping grid · per-item radius'
        }
    ]
} satisfies Entry;
