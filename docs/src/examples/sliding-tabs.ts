import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { slidingTabs } from '@esportsplus/ui';
import type { Entry } from '../types';
import './sliding-tabs.scss';


function demo(modifier = '') {
    return html`
        <div class='sliding-tabs-demo'>
            ${slidingTabs({ class: modifier, label: 'Project', tabs: tabs() })}
        </div>
    `;
}

function tabs() {
    return [
        {
            content: html`<span class='sliding-tabs-demo-strong'>3 projects</span> are live. Build times are down 12% since last week.`,
            id: 'overview',
            label: 'Overview'
        },
        {
            content: html`<span class='sliding-tabs-demo-strong'>Mira</span> deployed main 4 minutes ago. Two previews are still building.`,
            id: 'activity',
            label: 'Activity'
        },
        {
            content: html`Deploys run on every push to <span class='sliding-tabs-demo-strong'>main</span>. Previews expire after 30 days.`,
            id: 'settings',
            label: 'Settings'
        },
        {
            content: html`You are on the <span class='sliding-tabs-demo-strong'>Pro</span> plan. The next invoice lands on October 1.`,
            id: 'billing',
            label: 'Billing'
        }
    ];
}


export default {
    name: 'sliding-tabs',
    variants: [
        {
            render: () => demo(),
            title: 'default'
        },
        {
            render: () => {
                let items = tabs(),
                    state = reactive({ selected: 'settings' });

                return html`
                    <div class='sliding-tabs-demo-controlled'>
                        <div class='sliding-tabs-demo'>
                            ${slidingTabs({ label: 'Project', state, tabs: items })}
                        </div>
                        <span class='sliding-tabs-demo-status'>selected: ${() => state.selected}</span>
                        <button class='button --background-blue --color-white' onclick=${() => {
                            let i = items.findIndex((tab) => tab.id === state.selected);

                            state.selected = items[(i + 1) % items.length].id;
                        }} type='button'>
                            next tab (external state)
                        </button>
                    </div>
                `;
            },
            title: 'controlled state'
        },
        {
            render: () => demo('sliding-tabs--accent'),
            title: 'sliding-tabs--accent'
        },
        {
            render: () => demo('sliding-tabs--snappy'),
            title: 'sliding-tabs--snappy (no stretch)'
        }
    ]
} satisfies Entry;
