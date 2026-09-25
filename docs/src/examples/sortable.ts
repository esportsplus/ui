import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { select, sortable } from '@esportsplus/ui';
import './sortable.scss';


let apps = [
        ['Mail', 'oklch(62% 0.19 255)'],
        ['Music', 'oklch(64% 0.23 15)'],
        ['Maps', 'oklch(72% 0.17 150)'],
        ['Notes', 'oklch(85% 0.16 90)'],
        ['Photos', 'oklch(70% 0.2 320)'],
        ['Camera', 'oklch(45% 0.02 260)'],
        ['Clock', 'oklch(30% 0.02 260)'],
        ['Weather', 'oklch(70% 0.14 230)'],
        ['Wallet', 'oklch(40% 0.08 160)'],
        ['Health', 'oklch(66% 0.22 25)'],
        ['Books', 'oklch(74% 0.17 60)'],
        ['Files', 'oklch(60% 0.15 250)']
    ],
    tasks = ['Design review', 'Ship tooltip morph', 'Write sortable docs', 'Triage issues', 'Plan sprint'],
    // Shared by every demo on the page; each picks one modifier of either kind.
    animation = reactive({ active: false, error: '', render: false, selected: 'none' as number | string }),
    animations = {
        breathe: 'Breathe (scale pulse)',
        drift: 'Drift (sway + bob, out of phase)',
        float: 'Float (vertical bob)',
        heartbeat: 'Heartbeat (double pulse)',
        jelly: 'Jelly (squash & stretch)',
        jiggle: 'Jiggle (iOS home screen)',
        none: 'None',
        orbit: 'Orbit (tiny circle)',
        pop: 'Pop (bounce on pickup)',
        settle: 'Settle (damped swing on pickup)',
        shimmy: 'Shimmy (fast buzz)',
        sway: 'Sway (slow pendulum)',
        tremble: 'Tremble (irregular jitter)',
        wiggle: 'Wiggle (±0.6° alternate)'
    },
    swing = reactive({ active: false, error: '', render: false, selected: 'default' as number | string }),
    swings = {
        bouncy: 'Bouncy (loose spring, several wobbles)',
        damped: 'Damped (follows motion, no overshoot)',
        default: 'Default',
        floppy: 'Floppy (big, slow, barely damped)',
        heavy: 'Heavy (slow pendulum swing)',
        rigid: 'Rigid (no swing)',
        snappy: 'Snappy (quick response, one small overshoot)',
        subtle: 'Subtle (small lean, settles quickly)',
        wobbly: 'Wobbly (fast, tight wobble)'
    };


function modifiers() {
    let value = '';

    if (swing.selected !== 'default') {
        value += `sortable--${swing.selected}`;
    }

    if (animation.selected !== 'none') {
        value += ` sortable--${animation.selected}`;
    }

    return value;
}

function picker(label: string, options: Record<string, string>, state: typeof swing) {
    return html`
        <div class='sortable-demo-picker'>
            <span>${label}</span>
            ${select({
                class: '--border-state --border-border',
                options,
                [select.option]: { style: 'padding: var(--size-300) var(--size-400); white-space: nowrap;' },
                state,
                style: '--border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color); --padding-vertical: var(--size-300); width: 360px;',
                [select.tooltipContent]: { style: '--background: var(--color-white-300); --max-width: none; min-width: 100%;' }
            })}
        </div>
    `;
}


export default {
    name: 'sortable',
    variants: [
        {
            render: () => html`
                <div class='sortable-demo'>
                    ${picker('Swing', swings, swing)}
                    ${picker('Animation', animations, animation)}
                </div>
            `,
            title: 'effects'
        },
        {
            render: () => {
                let state = reactive({ last: 'drag any control' });

                return html`
                    <div class='sortable-demo'>
                        <div
                            class='sortable-demo-toolbar ${modifiers}'
                            ${sortable({
                                onsort: (item, from, to) => {
                                    state.last = `${item.dataset.name}: ${from} → ${to}`;
                                }
                            })}
                        >
                            <button class='sortable-demo-tool' data-name='back' type='button'>
                                <svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                                <span class='sortable-overlay'>Back</span>
                            </button>
                            <button class='sortable-demo-tool' data-name='forward' type='button'>
                                <svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                <span class='sortable-overlay'>Fwd</span>
                            </button>
                            <label class='sortable-demo-tool sortable-demo-tool--search' data-name='search'>
                                <svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                <input placeholder='Search' type='text' />
                                <span class='sortable-overlay'>Search</span>
                            </label>
                            <button class='sortable-demo-tool' data-name='refresh' type='button'>
                                <svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                                <span class='sortable-overlay'>Reload</span>
                            </button>
                            <button class='sortable-demo-tool' data-name='more' type='button'>
                                <svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                                <span class='sortable-overlay'>More</span>
                            </button>
                        </div>
                        <span class='sortable-demo-status'>${() => state.last}</span>
                    </div>
                `;
            },
            title: 'toolbar'
        },
        {
            render: () => html`
                <div class='sortable-demo'>
                    <div class='sortable-demo-grid ${modifiers}' ${sortable()}>
                        ${apps.map(([name, color]) => html`
                            <div class='sortable-demo-app'>
                                <div class='sortable-demo-app-icon' style='background: ${color};'>
                                    <span class='sortable-overlay'>${name[0]}</span>
                                </div>
                                <span>${name}</span>
                            </div>
                        `)}
                    </div>
                </div>
            `,
            title: 'app grid'
        },
        {
            render: () => html`
                <div class='sortable-demo'>
                    <div class='sortable-demo-list ${modifiers}' ${sortable({ handle: '.sortable-demo-handle' })}>
                        ${tasks.map((task, i) => html`
                            <div class='sortable-demo-row'>
                                <span class='sortable-demo-handle'>⋮⋮</span>
                                <span>${task}</span>
                                <span class='sortable-demo-row-meta'>#${i + 1}</span>
                                <div class='sortable-overlay'>${task}</div>
                            </div>
                        `)}
                    </div>
                </div>
            `,
            title: 'list (handle)'
        },
        {
            render: () => {
                let state = reactive({ last: 'drag a task into the other list' });

                return html`
                    <div class='sortable-demo'>
                        <div class='sortable-demo-lists'>
                            ${[['Backlog', tasks.slice(0, 3)], ['Sprint', tasks.slice(3)]].map(([title, items]) => html`
                                <div class='sortable-demo-lists-column'>
                                    <span class='sortable-demo-status'>${title}</span>
                                    <div
                                        class='sortable-demo-list sortable-demo-list--group ${modifiers}'
                                        data-name='${title}'
                                        ${sortable({
                                            group: 'sortable-demo',
                                            onsort: (item, from, to, source, target) => {
                                                state.last = `${item.textContent?.trim()}: ${source.dataset.name} #${from + 1} → ${target.dataset.name} #${to + 1}`;
                                            }
                                        })}
                                    >
                                        ${(items as string[]).map((task) => html`<div class='sortable-demo-row'>${task}</div>`)}
                                    </div>
                                </div>
                            `)}
                        </div>
                        <span class='sortable-demo-status'>${() => state.last}</span>
                    </div>
                `;
            },
            title: 'groups (move between lists)'
        }
    ]
};
