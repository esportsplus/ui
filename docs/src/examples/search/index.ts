import { command, search } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Tab } from '@esportsplus/ui/components/command';
import type { Entry, Style } from 'docs/types';


const BUTTON_STYLES: Style[] = [
    { class: '', label: 'Default' },
    { class: 'button--surface-primary', label: 'Surface primary' },
    { class: 'button--tactile', label: 'Tactile' },
    { class: 'button--surface-primary button--tactile', label: 'Surface primary, tactile' }
];

const INPUT_STYLES: Style[] = [
    { class: '', label: 'Default' },
    { class: 'input--border', label: 'Border' },
    { class: 'input--surface', label: 'Surface' },
    { class: 'input--surface-primary', label: 'Surface primary' }
];

const WIDTH = 'width: min(100%, 320px);';


export default {
    name: 'search',
    variants: [
        {
            render: (style: string) => html`
                <div class='group group--column' style='${WIDTH} --gap-vertical: var(--size-500);'>
                    ${search.input({ class: style, kbd: ['Mod', 'K'], placeholder: 'Search documentation…' })}
                    ${search.input({ class: `${style} input--compact`.trim(), kbd: ['/'] })}
                </div>
            `,
            styles: INPUT_STYLES,
            title: 'input · shortcut'
        },
        {
            render: (style: string) => {
                let result = reactive({ query: '' });

                return html`
                    <div class='group group--column' style='${WIDTH}'>
                        ${search.input({
                            class: style,
                            oninput: (e: Event) => {
                                result.query = (e.currentTarget as HTMLInputElement).value;
                            }
                        })}
                        <small class='group-description'>${() => `Query: ${result.query || '—'}`}</small>
                    </div>
                `;
            },
            styles: INPUT_STYLES,
            title: 'input · observed query'
        },
        {
            render: (style: string) => {
                let result = reactive({ ran: '' }),
                    state = reactive({ active: false, index: -1, query: '', tab: 'all' as Tab });

                return html`
                    <div class='group group--column' style='${WIDTH}'>
                        ${search.button({
                            'aria-haspopup': 'dialog',
                            class: style,
                            kbd: ['Mod', 'J'],
                            label: 'Search commands…',
                            onclick: () => {
                                state.active = true;
                            }
                        })}
                        <small class='group-description'>${() => `Ran: ${result.ran || '—'}`}</small>
                        ${command({
                            commands: [
                                { group: 'File', id: 'new', label: 'New file' },
                                { group: 'File', id: 'open', label: 'Open file' },
                                { group: 'View', id: 'theme', label: 'Toggle theme' }
                            ],
                            // Mod+K belongs to the docs' own search.
                            hotkey: ['Mod', 'J'],
                            onrun: (entry) => {
                                result.ran = entry.label;
                            },
                            state,
                            trigger: false
                        })}
                    </div>
                `;
            },
            styles: BUTTON_STYLES,
            title: 'button · opens a dialog'
        }
    ]
} satisfies Entry;
