import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { dock } from '@esportsplus/ui';
import type { Entry } from '../types';
import './dock.scss';


function demo(modifier = '') {
    return html`
        <div class='dock-demo'>
            ${dock({ class: modifier, items: items(['Home', 'Mail']) })}
        </div>
    `;
}

function items(running: string[]) {
    return [
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1H15v-5.5H9V20H4.5a1 1 0 0 1-1-1Z' /></svg>`,
            label: 'Home'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><circle cx='11' cy='11' r='6.5' /><path d='m20 20-4.35-4.35' /></svg>`,
            label: 'Search'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><rect height='13' rx='2' width='17' x='3.5' y='5.5' /><path d='m4 7 8 6 8-6' /></svg>`,
            label: 'Mail'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><rect height='15' rx='2' width='17' x='3.5' y='5' /><path d='M3.5 10h17M8 3v4M16 3v4' /></svg>`,
            label: 'Calendar'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M9 18V5l11-2v13' /><circle cx='6' cy='18' r='3' /><circle cx='17' cy='16' r='3' /></svg>`,
            label: 'Music'
        },
        {
            icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12' /><circle cx='16' cy='6' r='2' /><circle cx='10' cy='12' r='2' /><circle cx='18' cy='18' r='2' /></svg>`,
            label: 'Settings'
        }
    ].map((item) => ({ ...item, running: running.includes(item.label) }));
}


export default {
    name: 'dock',
    variants: [
        {
            render: () => demo(),
            title: 'default'
        },
        {
            render: () => {
                let list = items([]).map((item) => ({ ...item, state: reactive({ running: false }) })),
                    state = reactive({ last: 'click an icon to launch it' });

                return html`
                    <div class='dock-demo'>
                        ${dock({
                            items: list,
                            onlaunch: (label: string) => {
                                state.last = `launched ${label}`;
                            }
                        })}
                        <span class='dock-demo-status'>${() => state.last}</span>
                        <button class='button --background-blue --color-white' onclick=${() => {
                            for (let item of list) {
                                item.state.running = false;
                            }

                            state.last = 'all apps quit';
                        }} type='button'>
                            quit all
                        </button>
                    </div>
                `;
            },
            title: 'controlled running state + onlaunch'
        },
        {
            render: () => demo('dock--subtle'),
            title: 'dock--subtle'
        },
        {
            render: () => demo('dock--square'),
            title: 'dock--square'
        }
    ]
} satisfies Entry;
