import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { collapsibleSidebar } from '@esportsplus/ui';
import type { Entry } from '../types';
import './collapsible-sidebar.scss';


let content: Record<string, { blurb: string; rows: [string, string][] }> = {
    home: {
        blurb: 'Everything that moved since you last checked in.',
        rows: [
            ['Q3 planning notes', 'Edited 2h ago'],
            ['Onboarding checklist', 'Edited yesterday'],
            ['Design review', 'Edited Monday']
        ]
    },
    inbox: {
        blurb: 'Three threads are waiting on a reply from you.',
        rows: [
            ['Launch timeline', 'Maya, 10m ago'],
            ['Invoice #2048', 'Billing, 1h ago'],
            ['Welcome aboard', 'Team, 3h ago']
        ]
    },
    projects: {
        blurb: 'Active work across the team, sorted by last update.',
        rows: [
            ['Mobile redesign', '12 open tasks'],
            ['Billing migration', '4 open tasks'],
            ['Docs refresh', '7 open tasks']
        ]
    },
    reports: {
        blurb: 'Weekly numbers, refreshed every Monday morning.',
        rows: [
            ['Active users', '+8% this week'],
            ['Retention', 'Flat since June'],
            ['Revenue', '+3% this week']
        ]
    },
    settings: {
        blurb: 'Workspace preferences shared by everyone.',
        rows: [
            ['Members', '14 people'],
            ['Notifications', 'Daily digest'],
            ['Billing', 'Pro plan']
        ]
    }
};


function demo(options: { class?: string; expanded?: boolean }) {
    let list = items(),
        state = reactive({ expanded: options.expanded ?? true, selected: 'home' });

    return collapsibleSidebar(
        { class: `collapsible-sidebar-demo ${options.class ?? ''}`, items: list, state },
        html`
            <div class='collapsible-sidebar-demo-content'>
                <p class='collapsible-sidebar-demo-title'>
                    ${() => list.find((item) => item.id === state.selected)?.label}
                </p>
                <p class='collapsible-sidebar-demo-blurb'>${() => content[state.selected].blurb}</p>
                <ul class='collapsible-sidebar-demo-rows'>
                    ${() => content[state.selected].rows.map(([title, meta]) => html`
                        <li>
                            <span>${title}</span>
                            <span>${meta}</span>
                        </li>
                    `)}
                </ul>
            </div>
        `
    );
}

function items() {
    return [
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 7 8 2.75 13.25 7v5.25a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1Z' /><path d='M6.25 13.25V9.75h3.5v3.5' /></svg>`,
            id: 'home',
            label: 'Home'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 9.25 4.5 3.5a1 1 0 0 1 1-.75h5a1 1 0 0 1 1 .75l1.75 5.75v3a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1Z' /><path d='M2.75 9.25h3l.75 1.5h3l.75-1.5h3' /></svg>`,
            id: 'inbox',
            label: 'Inbox'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 4.25a1 1 0 0 1 1-1h2.5l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1Z' /></svg>`,
            id: 'projects',
            label: 'Projects'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M3.25 13.25V8.75M8 13.25v-10.5M12.75 13.25v-6.5' /></svg>`,
            id: 'reports',
            label: 'Reports'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><circle cx='8' cy='8' r='2' /><path d='M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05' /></svg>`,
            id: 'settings',
            label: 'Settings'
        }
    ];
}


export default {
    name: 'collapsible-sidebar',
    variants: [
        {
            render: () => demo({}),
            title: 'default'
        },
        {
            render: () => demo({ expanded: false }),
            title: 'starts collapsed (hover or tab for tips)'
        },
        {
            render: () => demo({ class: 'collapsible-sidebar--dense' }),
            title: 'collapsible-sidebar--dense'
        }
    ]
} satisfies Entry;
