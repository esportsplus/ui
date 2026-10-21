import { button, group, icon } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import toast from 'docs/components/toaster';
import code from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import page from '@esportsplus/ui/svg/document.svg';
import 'docs/examples/button/scss/index.scss';


let row = 'display: flex; flex-wrap: wrap; gap: var(--size-400); align-items: center;';


let border = '--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);',
    icons = {
        link: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' /><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' /></svg>`,
        message: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M7.9 20A9 9 0 1 0 4 16.1L2 22Z' /></svg>`,
        plus: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M5 12h14' /><path d='M12 5v14' /></svg>`,
        share: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx='18' cy='5' r='3' /><circle cx='6' cy='12' r='3' /><circle cx='18' cy='19' r='3' /><path d='m8.59 13.51 6.83 3.98' /><path d='m15.41 6.51-6.82 3.98' /></svg>`
    },
    modifiers = [
        ['black', 'Black'],
        ['primary', 'Primary'],
        ['surface', 'Surface'],
        ['surface-primary', 'Surface primary'],
        ['white', 'White']
    ],
    round = `${border} --border-radius: 999px; --padding-horizontal: 0; --padding-vertical: 0; height: var(--size-600); width: var(--size-600);`,
    surface = 'button--surface',
    trigger = `button ${surface}`,
    views = [
        { glyph: eye, label: 'Preview' },
        { glyph: code, label: 'Code' },
        { glyph: page, label: 'Docs' }
    ];


function segmented(glide: boolean) {
    let state = reactive({ active: 0 });

    return group(
        {
            [group.highlight]: glide ? { class: 'button-demo-group-highlight' } : undefined,
            'aria-label': 'View',
            class: ['button-demo-group', !glide && 'button-demo-group--static'],
            role: 'group'
        },
        views.map(({ glyph, label }, index) => html`
            <button
                class='button button--group button-demo-group-button ${() => state.active === index && '--active'}'
                onclick='${() => state.active = index}'
                type='button'
                ${{ 'aria-pressed': () => String(state.active === index) }}
            >
                ${icon({ 'aria-hidden': 'true', class: 'button-demo-group-icon' }, glyph)}
                ${label}
            </button>
        `)
    );
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


export default {
    name: 'button',
    variants: [
        {
            render: () => html`
                <div style='${row}'>
                    ${modifiers.map(([modifier, label]) => html`
                        <button class='button button--${modifier}' style='${border}' type='button'>
                            ${label}
                        </button>
                    `)}
                    ${button.kbd({ key: 'meta' })}
                    ${button.kbd({ key: 'k' })}
                </div>
            `,
            title: 'modifiers'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.copy({ value: 'pnpm add @esportsplus/ui' })}
                    ${button.copy({ label: 'Copy link', success: 'Link copied', timeout: 800, value: () => location.href })}
                </div>
            `,
            title: 'copy'
        },
        {
            render: () => segmented(true),
            title: 'group'
        },
        {
            render: () => segmented(false),
            title: 'group without highlight'
        },
        {
            render: () => {
                let saves = 0;

                // Every other save fails, so both endings are one click apart.
                return button.morph({ onsave: () => wait(1200).then(() => {
                    if (saves++ % 2 === 1) {
                        throw new Error('Docs: save failed');
                    }
                }) });
            },
            title: 'morph'
        },
        {
            render: () => {
                let state = reactive({ status: 'idle' as 'error' | 'idle' | 'loading' | 'success' });

                return html`
                    <div style='${row}'>
                        ${button.morph({ class: 'button-demo-morph', label: 'Publish', onsave: () => wait(1200), state, successFor: 2400 })}
                        <span style='color: var(--color-text-300); font-size: 14px;'>${() => state.status}</span>
                    </div>
                `;
            },
            title: 'morph, observed state'
        },
        {
            render: () => {
                let state = reactive({ left: true, right: false });

                return html`
                    <div style='${row}'>
                        ${(['left', 'right'] as const).map((side) => button.sidebar({
                            'aria-label': () => `${state[side] ? 'Hide' : 'Show'} ${side} panel`,
                            class: trigger,
                            onclick: () => state[side] = !state[side],
                            open: () => state[side],
                            side,
                            style: round
                        }))}
                    </div>
                `;
            },
            title: 'sidebar'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.split(
                        {
                            [button.split.action]: { class: surface, onclick: () => toast(() => 'Pushed and created PR.'), style: border },
                            [button.split.trigger]: { 'aria-label': 'More git actions', class: surface, style: border },
                            items: [
                                { label: 'Commit', onselect: () => toast(() => 'Commit selected.') },
                                { label: 'Push', onselect: () => toast(() => 'Push selected.') },
                                { label: 'Create PR', onselect: () => toast(() => 'Create PR selected.') }
                            ]
                        },
                        html`${icons.share()} Push & create PR`
                    )}
                    ${button.split(
                        {
                            [button.split.action]: { 'aria-label': 'Open in editor', class: surface, onclick: () => toast(() => 'Opened in editor.'), style: border },
                            [button.split.trigger]: { 'aria-label': 'Choose editor', class: surface, style: border },
                            items: [
                                { icon: icons.link, label: 'Cursor', onselect: () => toast(() => 'Cursor selected.') },
                                { icon: icons.message, label: 'VS Code', onselect: () => toast(() => 'VS Code selected.') }
                            ],
                            trigger: icons.plus()
                        },
                        icon({ 'aria-hidden': 'true' }, code)
                    )}
                </div>
            `,
            title: 'split'
        }
    ]
};
