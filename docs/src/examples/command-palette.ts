import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { commandPalette } from '@esportsplus/ui';
import type { Command } from '~/components/command-palette';
import './command-palette.scss';


let commands: Command[] = [
    {
        group: 'Navigation',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 7.25 8 2.75l5.25 4.5v6h-3.5v-3.5h-3.5v3.5h-3.5z' /></svg>`,
        id: 'home',
        label: 'Go to Home',
        shortcut: ['G', 'H']
    },
    {
        group: 'Navigation',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 9.25 4.5 3.25h7l1.75 6v3.5H2.75zM2.75 9.25h3l.75 1.5h3l.75-1.5h3' /></svg>`,
        id: 'inbox',
        label: 'Open Inbox',
        shortcut: ['G', 'I']
    },
    {
        group: 'Navigation',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M2.75 4.75h6.5M12.25 4.75h1M2.75 11.25h1M6.75 11.25h6.5' /><circle cx='10.75' cy='4.75' r='1.5' /><circle cx='5.25' cy='11.25' r='1.5' /></svg>`,
        id: 'settings',
        label: 'Go to Settings',
        shortcut: ['G', 'S']
    },
    {
        group: 'Navigation',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M4.25 2.75h5l2.5 2.5v8h-7.5zM9.25 2.75v2.5h2.5M6.25 8.25h3.5M6.25 10.75h2' /></svg>`,
        id: 'docs',
        label: 'Search documentation'
    },
    {
        group: 'Actions',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M8 3.25v9.5M3.25 8h9.5' /></svg>`,
        id: 'new-file',
        label: 'New file',
        shortcut: ['⌘', 'N']
    },
    {
        group: 'Actions',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.75-.75' /></svg>`,
        id: 'copy-link',
        label: 'Copy link'
    },
    {
        group: 'Actions',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><circle cx='8' cy='8' r='5.25' /><path d='M8 2.75a5.25 5.25 0 0 1 0 10.5z' fill='currentColor' /></svg>`,
        id: 'theme',
        label: 'Toggle theme',
        shortcut: ['⇧', 'T']
    },
    {
        group: 'Actions',
        icon: html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='M6.75 2.75h-3v10.5h3M10.25 5.25 13 8l-2.75 2.75M13 8H6.25' /></svg>`,
        id: 'logout',
        label: 'Log out'
    }
];


function demo(attributes: Record<string, string> = {}) {
    let ran = reactive({ label: '' });

    return html`
        <div class='command-palette-demo'>
            ${commandPalette({
                ...attributes,
                commands,
                onrun: (command) => {
                    ran.label = command.label;
                }
            })}
            <p aria-live='polite' class='command-palette-demo-status'>
                ${() => ran.label && html`Ran: <span>${ran.label}</span>`}
            </p>
        </div>
    `;
}


export default {
    name: 'command-palette',
    variants: [
        {
            render: () => demo(),
            title: 'palette (⌘K / Ctrl+K)'
        },
        {
            render: () => demo({ class: 'command-palette--centered command-palette--blur', label: 'Centered, blurred' }),
            title: 'centered + blur'
        }
    ]
};
