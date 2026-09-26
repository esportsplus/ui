import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { morphingNav } from '@esportsplus/ui';
import type { Entry } from '../types';
import { navigationMenuVariants } from './navigation-menu';
import './morphing-nav.scss';


function demo({ modifier = '', status }: { modifier?: string; status?: { last: string } } = {}) {
    return html`
        <div class='morphing-nav-demo'>
            ${morphingNav({
                action: html`<button class='morphing-nav-demo-action' type='button'>Sign in</button>`,
                brand: html`
                    <svg aria-label='Home' class='morphing-nav-demo-brand' role='img' viewBox='0 0 20 20'>
                        <circle cx='10' cy='10' fill='none' r='7.25' stroke='currentColor' stroke-width='1.5' />
                        <circle cx='10' cy='10' fill='currentColor' r='2.5' />
                    </svg>
                `,
                class: modifier,
                onnavigate: (link, section) => {
                    if (status) {
                        status.last = `navigate → ${section.label} / ${link.title}`;
                    }
                },
                sections: sections()
            })}
            ${status && html`<span class='morphing-nav-demo-status'>${() => status.last}</span>`}
        </div>
    `;
}

function sections() {
    return [
        {
            columns: 2 as const,
            label: 'Products',
            links: [
                { description: 'Live dashboards for every metric', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M4.5 19.5v-6M9.5 19.5v-10M14.5 19.5v-7M19.5 19.5V5.5' /></svg>`, title: 'Analytics' },
                { description: 'Run workflows on any event', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M13 3.5 5.5 13.5H12l-1 7 7.5-10H12Z' /></svg>`, title: 'Automations' },
                { description: 'Files and backups in one place', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><ellipse cx='12' cy='6.5' rx='7' ry='3' /><path d='M5 6.5v11c0 1.66 3.13 3 7 3s7-1.34 7-3v-11M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3' /></svg>`, title: 'Storage' },
                { description: 'Access control and audit logs', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6Z' /></svg>`, title: 'Security' }
            ]
        },
        {
            label: 'Solutions',
            links: [
                { description: 'Launch fast with sensible defaults', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M12 20.5v-4M8 16.5l4-13 4 13ZM9.5 12.5h5' /></svg>`, title: 'Startups' },
                { description: 'Scale with SSO and dedicated support', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M4.5 20.5v-15h9v15M13.5 9.5h6v11M3 20.5h18' /><path d='M7.5 9h3M7.5 12.5h3M7.5 16h3M16.5 13h.01M16.5 16.5h.01' /></svg>`, title: 'Enterprise' },
                { description: 'Manage every client from one account', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><circle cx='9' cy='8.5' r='3' /><path d='M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.5a3 3 0 0 1 0 6M17.5 14.5a5.5 5.5 0 0 1 3 5' /></svg>`, title: 'Agencies' }
            ]
        },
        {
            columns: 2 as const,
            label: 'Resources',
            links: [
                { description: 'Guides and API reference', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M5.5 4.5h9l4 4v11h-13Z' /><path d='M14.5 4.5v4h4M8.5 12.5h7M8.5 16h5' /></svg>`, title: 'Docs' },
                { description: 'What shipped this week', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><circle cx='12' cy='12' r='8.5' /><path d='M12 7.5V12l3 2' /></svg>`, title: 'Changelog' },
                { description: 'Ask questions, share builds', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><path d='M4.5 18.5v-11a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-9Z' /></svg>`, title: 'Community' },
                { description: 'Starter projects to fork', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><rect height='7' rx='1.5' width='7' x='3.5' y='3.5' /><rect height='7' rx='1.5' width='7' x='13.5' y='3.5' /><rect height='7' rx='1.5' width='7' x='3.5' y='13.5' /><rect height='7' rx='1.5' width='7' x='13.5' y='13.5' /></svg>`, title: 'Templates' }
            ]
        },
        {
            label: 'Pricing',
            links: [
                { description: 'Compare every tier side by side', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><rect height='13' rx='2' width='17' x='3.5' y='5.5' /><path d='M3.5 9.5h17M7 14.5h3' /></svg>`, title: 'Plans' },
                { description: 'Estimate your monthly bill', icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 24 24'><rect height='17' rx='2' width='13' x='5.5' y='3.5' /><path d='M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01' /></svg>`, title: 'Calculator' }
            ]
        }
    ];
}


export default {
    name: 'morphing-nav',
    variants: [
        {
            render: () => demo(),
            title: 'default'
        },
        {
            render: () => demo({ status: reactive({ last: 'pick a link' }) }),
            title: 'onnavigate'
        },
        {
            render: () => demo({ modifier: 'morphing-nav--flat' }),
            title: 'morphing-nav--flat'
        },
        ...navigationMenuVariants()
    ]
} satisfies Entry;
