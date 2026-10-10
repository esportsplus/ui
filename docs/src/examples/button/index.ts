import { button, highlight, icon } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import toast from 'docs/components/toaster';
import code from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import page from '@esportsplus/ui/svg/document.svg';
import 'docs/examples/button/scss/index.scss';


let colors = ['primary', 'secondary', 'tertiary'],
    modifiers = ['flat', 'skeleton', 'underline'],
    row = 'display: flex; flex-wrap: wrap; gap: var(--size-400); align-items: center;';


let border = '--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);',
    round = `${border} --border-radius: 999px; --padding-horizontal: 0; --padding-vertical: 0; height: var(--size-600); width: var(--size-600);`,
    surface = 'button-demo-surface',
    trigger = `button ${surface}`;

let icons = {
    close: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M18 6 6 18' /><path d='m6 6 12 12' /></svg>`,
    link: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' /><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' /></svg>`,
    mail: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><rect height='16' rx='2' width='20' x='2' y='4' /><path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' /></svg>`,
    message: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M7.9 20A9 9 0 1 0 4 16.1L2 22Z' /></svg>`,
    plus: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d='M5 12h14' /><path d='M12 5v14' /></svg>`,
    share: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx='18' cy='5' r='3' /><circle cx='6' cy='12' r='3' /><circle cx='18' cy='19' r='3' /><path d='m8.59 13.51 6.83 3.98' /><path d='m15.41 6.51-6.82 3.98' /></svg>`
};

let options = () => [
    { 'aria-label': 'Copy link', content: icons.link(), onclick: () => toast(() => 'Link copied.') },
    { 'aria-label': 'Email', content: icons.mail(), onclick: () => toast(() => 'Email selected.') },
    { 'aria-label': 'Message', content: icons.message(), onclick: () => toast(() => 'Message selected.') }
];

let views = [
    { glyph: eye, label: 'Preview' },
    { glyph: code, label: 'Code' },
    { glyph: page, label: 'Docs' }
];

let swap = (open: Renderable<unknown>) => html`
    <span class='button-fan-swap'>
        ${open}
        ${icons.close()}
    </span>
`;


function group(glide: boolean) {
    let state = reactive({ active: 0 });

    return html`
        <div aria-label='View' class='button-demo-group ${!glide && 'button-demo-group--static'}' role='group'>
            ${glide && highlight({ class: 'button-demo-group-highlight' })}
            ${views.map(({ glyph, label }, index) => html`
                <button
                    class='button button-demo-group-button ${() => state.active === index && '--active'}'
                    onclick='${() => state.active = index}'
                    type='button'
                    ${{ 'aria-pressed': () => String(state.active === index) }}
                >
                    ${icon({ 'aria-hidden': 'true', class: 'button-demo-group-icon' }, glyph)}
                    ${label}
                </button>
            `)}
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
                    <div
                        class='button button-demo-surface'
                        style='--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color); font-weight: var(--font-weight-600);'
                    >
                        white
                    </div>

                    ${colors.map((color) => html`
                        <div class='button button--${color}' style='--width: auto;'>${color}</div>
                    `)}
                </div>
            `,
            title: 'colors'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${modifiers.map((modifier) => html`
                        <div class='button button--${modifier}'>${modifier}</div>
                    `)}
                </div>
            `,
            title: 'modifiers'
        },
        {
            render: () => {
                let state = reactive({ triggered: 0 });

                return html`
                    <div style='${row}'>
                        ${button.kbd({ keys: ['meta', 'k'], ontrigger: () => state.triggered++ })}
                        ${button.kbd({ keys: ['shift', '?'] })}
                        ${button.kbd({ keys: ['up'] })}
                        <span>triggered ${() => state.triggered}×</span>
                    </div>
                `;
            },
            title: 'kbd'
        },
        {
            render: () => button.fan(
                {
                    [button.fan.option]: { class: surface, style: round },
                    [button.fan.trigger]: { 'aria-label': 'Share', class: surface, style: round },
                    options: options()
                },
                swap(icons.share())
            ),
            title: 'fan'
        },
        {
            render: () => html`
                <div style='display: flex; gap: calc(var(--size-600) * 5); justify-content: center; padding: calc(var(--size-600) * 4) var(--size-800); width: 100%;'>
                    ${(['n', 's', 'w'] as const).map((direction) => button.fan(
                        {
                            [button.fan.option]: { class: surface, style: round },
                            [button.fan.trigger]: { 'aria-label': `Open (${direction})`, class: surface, style: round },
                            direction,
                            options: options()
                        },
                        swap(icons.plus())
                    ))}
                </div>
            `,
            title: 'fan directions'
        },
        {
            render: () => button.fan(
                {
                    [button.fan.option]: { class: surface, style: `${border} --width: auto;` },
                    [button.fan.trigger]: { class: surface, style: `${border} --width: auto;` },
                    closeOnSelect: false,
                    options: [
                        { content: 'Edit', onclick: () => toast(() => 'Edit selected.') },
                        { content: 'Duplicate', onclick: () => toast(() => 'Duplicate selected.') },
                        { content: 'Archive', onclick: () => toast(() => 'Archive selected.') }
                    ]
                },
                'actions'
            ),
            title: 'fan text'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.copy({ class: trigger, style: border, value: 'pnpm add @esportsplus/ui' })}
                    ${button.copy({ class: trigger, style: border, success: 'Copied link', value: location.href }, 'Copy link')}
                </div>
            `,
            title: 'copy'
        },
        {
            render: () => group(true),
            title: 'group'
        },
        {
            render: () => group(false),
            title: 'group without highlight'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.hold({ action: () => {}, class: trigger, style: border }, 'Hold to delete')}
                    ${button.hold({ action: () => {}, class: trigger, duration: 3000, style: border, success: 'Archived', timeout: 0 }, 'Hold to archive')}
                </div>
            `,
            title: 'hold'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.hold({ action: () => toast(() => 'Archived'), class: `${trigger} button--hold-text`, duration: 550, style: border, success: 'Archived' }, 'Hold to archive')}
                    ${button.hold({ action: () => toast(() => 'Deleted'), class: `${trigger} button--hold-text`, duration: 1500, style: `--fill-color: var(--color-red-400); ${border}`, success: 'Deleted' }, 'Hold to delete')}
                </div>
            `,
            title: 'hold text'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${button.loading({ action: () => wait(1200), class: trigger, pending: 'Saving', style: border, success: 'Saved' }, 'Save changes')}
                    ${button.loading({ action: () => wait(1200).then(() => { throw new Error('Docs: request failed'); }), class: trigger, pending: 'Sending', style: border }, 'Send request')}
                </div>
            `,
            title: 'loading'
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
                        ${button.morph({ label: 'Publish', onsave: () => wait(1200), state, style: '--morph-background: var(--color-blue-400);', successFor: 2400 })}
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
