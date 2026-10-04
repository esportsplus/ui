import { reactive, ReactiveArray } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { select, sortable } from '@esportsplus/ui/components';
import 'docs/examples/sortable/scss/index.scss';


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
                let state = reactive({ last: 'drag any control' }),
                    tools = new ReactiveArray([
                        { icon: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`, label: 'Back', name: 'back' },
                        { icon: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`, label: 'Fwd', name: 'forward' },
                        { icon: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`, label: 'Search', name: 'search' },
                        { icon: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`, label: 'Reload', name: 'refresh' },
                        { icon: () => html`<svg fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='16'><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`, label: 'More', name: 'more' }
                    ]),
                    list = sortable(tools, (tool, attributes) => tool.name === 'search'
                        ? html`
                            <label class='sortable-demo-tool sortable-demo-tool--search' ${attributes}>
                                ${tool.icon()}
                                <input placeholder='Search' type='text' />
                                <span class='sortable-overlay'>${tool.label}</span>
                            </label>
                        `
                        : html`
                            <button class='sortable-demo-tool' type='button' ${attributes}>
                                ${tool.icon()}
                                <span class='sortable-overlay'>${tool.label}</span>
                            </button>
                        `, {
                        onsort: (tool, from, to) => {
                            state.last = `${tool.name}: ${from} → ${to}`;
                        }
                    });

                return html`
                    <div class='sortable-demo'>
                        <div class='sortable-demo-toolbar ${modifiers}' ${list.attributes}>
                            ${list.render()}
                        </div>
                        <span class='sortable-demo-status'>${() => state.last}</span>
                    </div>
                `;
            },
            title: 'toolbar'
        },
        {
            render: () => {
                let list = sortable(new ReactiveArray(apps.map(([name, color]) => ({ color, name }))), (app, attributes) => html`
                    <div class='sortable-demo-app' ${attributes}>
                        <div class='sortable-demo-app-icon' style='background: ${app.color};'>
                            <span class='sortable-overlay'>${app.name[0]}</span>
                        </div>
                        <span>${app.name}</span>
                    </div>
                `);

                return html`
                    <div class='sortable-demo'>
                        <div class='sortable-demo-grid ${modifiers}' ${list.attributes}>
                            ${list.render()}
                        </div>
                    </div>
                `;
            },
            title: 'app grid'
        },
        {
            render: () => {
                let list = sortable(new ReactiveArray(tasks.map((label, i) => ({ label, number: i + 1 }))), (task, attributes) => html`
                    <div class='sortable-demo-row' ${attributes}>
                        <span class='sortable-demo-handle'>⋮⋮</span>
                        <span>${task.label}</span>
                        <span class='sortable-demo-row-meta'>#${task.number}</span>
                        <div class='sortable-overlay'>${task.label}</div>
                    </div>
                `, {
                    // A different look while it is carried: the row stays as the placeholder underneath.
                    drag: (task) => html`
                        <div class='sortable-demo-card'>
                            <span>⋮⋮</span>
                            <span>${task.label}</span>
                            <span class='sortable-demo-card-badge'>Moving</span>
                        </div>
                    `,
                    handle: '.sortable-demo-handle'
                });

                return html`
                    <div class='sortable-demo'>
                        <div class='sortable-demo-list ${modifiers}' ${list.attributes}>
                            ${list.render()}
                        </div>
                    </div>
                `;
            },
            title: 'list (handle, custom drag template)'
        },
        {
            render: () => {
                let backlog = new ReactiveArray(tasks.slice(0, 3).map((label) => ({ label }))),
                    sprint = new ReactiveArray(tasks.slice(3).map((label) => ({ label }))),
                    state = reactive({ last: 'drag a task into the other list' });

                function name(items: typeof backlog) {
                    return items === backlog ? 'Backlog' : 'Sprint';
                }

                return html`
                    <div class='sortable-demo'>
                        <div class='sortable-demo-lists'>
                            ${[backlog, sprint].map((items) => {
                                let list = sortable(items, (task, attributes) => html`<div class='sortable-demo-row' ${attributes}>${task.label}</div>`, {
                                    group: 'sortable-demo',
                                    onsort: (task, from, to, source, target) => {
                                        state.last = `${task.label}: ${name(source)} #${from + 1} → ${name(target)} #${to + 1}`;
                                    }
                                });

                                return html`
                                    <div class='sortable-demo-lists-column'>
                                        <span class='sortable-demo-status'>${name(items)}</span>
                                        <div class='sortable-demo-list sortable-demo-list--group ${modifiers}' ${list.attributes}>
                                            ${list.render()}
                                        </div>
                                    </div>
                                `;
                            })}
                        </div>
                        <span class='sortable-demo-status'>${() => state.last}</span>
                    </div>
                `;
            },
            title: 'groups (move between lists)'
        }
    ]
};
