import { button, group, icon } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import toast from 'docs/components/toaster';
import check from '@esportsplus/ui/svg/check.svg';
import code from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import page from '@esportsplus/ui/svg/document.svg';
import 'docs/examples/button/scss/index.scss';


let row = 'display: flex; flex-wrap: wrap; gap: var(--size-400); align-items: center;';


let border = '', //'--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);',
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


function segmented(glide: boolean, track = false) {
    let state = reactive({ active: 0 });

    return group(
        {
            [group.highlight]: glide ? { class: 'button-demo-group-highlight' } : undefined,
            'aria-label': 'View',
            class: ['button-demo-group', !glide && 'button-demo-group--static', track && 'button-demo-group--track'],
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

function split(highlight: boolean) {
    return html`
        <div style='${row}'>
            ${(['primary', 'surface', 'surface-primary'] as const).map((modifier) => button.split(
                {
                    [button.split.action]: { class: `button--${modifier}`, onclick: () => toast(() => 'Deployed to production.'), style: border },
                    [button.split.trigger]: { 'aria-label': 'Choose environment', class: `button--${modifier}`, style: border },
                    class: `tooltip-menu--${modifier}`,
                    highlight,
                    items: [
                        { label: 'Production', onselect: () => toast(() => 'Production selected.') },
                        { label: 'Staging', onselect: () => toast(() => 'Staging selected.') },
                        { disabled: true, label: 'Preview' }
                    ]
                },
                'Deploy'
            ))}
        </div>
    `;
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
            render: () => {
                let follows = 0,
                    state = reactive({ status: 'idle' as 'error' | 'idle' | 'success' });

                // Every other follow fails, so both tones are one click apart.
                return html`
                    <button
                        class='button button--feedback button--primary'
                        onclick='${() => {
                            state.status = state.status !== 'idle' ? 'idle' : follows++ % 2 === 1 ? 'error' : 'success';
                        }}'
                        type='button'
                    >
                        ${button.faces(() => state.status, [
                            { content: 'Follow', key: 'idle' },
                            { content: html`${icon({ 'aria-hidden': 'true', class: 'button-icon button-icon--draw' }, check)}Following`, key: 'success', tone: 'success' },
                            { content: 'Couldn\'t follow', key: 'error', tone: 'error' }
                        ])}
                        <span aria-live='polite' class='button-status' role='status'>
                            ${() => state.status === 'success' ? 'Following' : state.status === 'error' ? 'Couldn\'t follow' : ''}
                        </span>
                    </button>
                `;
            },
            title: 'faces'
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
            render: () => segmented(true, true),
            title: 'group with background'
        },
        {
            render: () => {
                let saves = 0;

                // Every other save fails, so both endings are one click apart.
                return button.morph.save({ onsave: () => wait(1200).then(() => {
                    if (saves++ % 2 === 1) {
                        throw new Error('Docs: save failed');
                    }
                }) });
            },
            title: 'morph.save'
        },
        {
            render: () => {
                let state = reactive({ status: 'idle' as 'error' | 'idle' | 'loading' | 'success' });

                return html`
                    <div style='${row}'>
                        ${button.morph.save({ class: 'button-demo-morph', label: 'Publish', onsave: () => wait(1200), state, successFor: 2400 })}
                        <span style='color: var(--color-text-300); font-size: 14px;'>${() => state.status}</span>
                    </div>
                `;
            },
            title: 'morph.save, observed state'
        },
        {
            render: () => {
                let deploys = 0,
                    state = reactive({ status: 'idle' as 'error' | 'idle' | 'loading' | 'success' }),
                    text = (status: typeof state.status, label: string) => html`
                        <span class='button-morph-text ${() => state.status === status && '--active'}'>${label}</span>
                    `;

                // Every other deploy fails. The text swaps in place and the width never collapses to a circle.
                return button.morph(
                    {
                        announce: { error: 'Deploy failed', loading: 'Deploying', success: 'Deployed' },
                        compact: () => false,
                        onaction: () => wait(1200).then(() => {
                            if (deploys++ % 2 === 1) {
                                throw new Error('Docs: deploy failed');
                            }
                        }),
                        state,
                        [button.morph.content]: { 'aria-hidden': 'true' },
                        'aria-label': () => state.status === 'error' ? 'Retry deploy' : 'Deploy'
                    },
                    html`
                        ${text('idle', 'Deploy')}
                        ${text('loading', 'Deploying…')}
                        ${text('success', 'Deployed')}
                        ${text('error', 'Retry deploy')}
                    `
                );
            },
            title: 'morph, custom content'
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
            render: () => split(true),
            title: 'split with highlight'
        },
        {
            render: () => split(false),
            title: 'split'
        }
    ]
};
