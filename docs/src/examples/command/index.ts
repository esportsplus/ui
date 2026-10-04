import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { command } from '@esportsplus/ui/components';
import back from '@esportsplus/ui/svg/arrow-left.svg';
import forward from '@esportsplus/ui/svg/arrow-right.svg';
import next from '@esportsplus/ui/svg/arrow-down.svg';
import previous from '@esportsplus/ui/svg/arrow-up.svg';
import contrast from '@esportsplus/ui/svg/contrast.svg';
import docs from '@esportsplus/ui/svg/document.svg';
import duplicate from '@esportsplus/ui/svg/copy.svg';
import help from '@esportsplus/ui/svg/help.svg';
import home from '@esportsplus/ui/svg/home.svg';
import inbox from '@esportsplus/ui/svg/inbox.svg';
import link from '@esportsplus/ui/svg/link.svg';
import logOut from '@esportsplus/ui/svg/log-out.svg';
import pencil from '@esportsplus/ui/svg/pencil.svg';
import plus from '@esportsplus/ui/svg/plus.svg';
import redo from '@esportsplus/ui/svg/redo.svg';
import save from '@esportsplus/ui/svg/save.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import sidebar from '@esportsplus/ui/svg/sidebar.svg';
import sliders from '@esportsplus/ui/svg/sliders.svg';
import undo from '@esportsplus/ui/svg/undo.svg';
import zoomIn from '@esportsplus/ui/svg/zoom-in.svg';
import zoomOut from '@esportsplus/ui/svg/zoom-out.svg';
import type { Command, Shortcut, Store, Tab } from '@esportsplus/ui/components/command';
import 'docs/examples/command/scss/index.scss';


let commands: Command[] = [
        { group: 'Navigation', icon: home, id: 'home', label: 'Go to Home', shortcut: ['G', 'H'] },
        { group: 'Navigation', icon: inbox, id: 'inbox', label: 'Open Inbox', shortcut: ['G', 'I'] },
        { group: 'Navigation', icon: sliders, id: 'settings', label: 'Go to Settings', shortcut: ['G', 'S'] },
        { group: 'Navigation', icon: docs, id: 'docs', label: 'Search documentation' },
        { group: 'Actions', icon: plus, id: 'new-file', label: 'New file', shortcut: ['⌘', 'N'] },
        { group: 'Actions', icon: link, id: 'copy-link', label: 'Copy link' },
        { group: 'Actions', icon: contrast, id: 'theme', label: 'Toggle theme', shortcut: ['⇧', 'T'] },
        { group: 'Actions', icon: logOut, id: 'logout', label: 'Log out' }
    ],
    shortcuts: Shortcut[] = [
        { group: 'Navigation', icon: magnifier, id: 'search', keys: ['Mod', 'K'], label: 'Search' },
        { group: 'Navigation', icon: back, id: 'back', keys: ['Mod', '['], label: 'Go back' },
        { group: 'Navigation', icon: forward, id: 'forward', keys: ['Mod', ']'], label: 'Go forward' },
        { group: 'Navigation', icon: next, id: 'next', keys: ['J'], label: 'Next item' },
        { group: 'Navigation', icon: previous, id: 'prev', keys: ['K'], label: 'Previous item' },
        { group: 'Editing', icon: undo, id: 'undo', keys: ['Mod', 'Z'], label: 'Undo' },
        { group: 'Editing', icon: redo, id: 'redo', keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
        { group: 'Editing', icon: duplicate, id: 'duplicate', keys: ['Mod', 'D'], label: 'Duplicate' },
        { group: 'Editing', icon: save, id: 'save', keys: ['Mod', 'S'], label: 'Save' },
        { group: 'Editing', icon: pencil, id: 'rename', keys: ['F2'], label: 'Rename' },
        { group: 'View', icon: sidebar, id: 'sidebar', keys: ['Mod', 'B'], label: 'Toggle sidebar' },
        { group: 'View', icon: zoomIn, id: 'zoom-in', keys: ['Mod', '='], label: 'Zoom in' },
        { group: 'View', icon: zoomOut, id: 'zoom-out', keys: ['Mod', '-'], label: 'Zoom out' },
        { group: 'View', icon: contrast, id: 'theme', keys: ['Mod', 'Shift', 'L'], label: 'Toggle theme' },
        { group: 'View', icon: help, id: 'help', keys: ['?'], label: 'Show shortcuts' }
    ];


function demo(attributes: Partial<Parameters<typeof command>[0]> = {}) {
    let ran = reactive({ label: '' });

    return html`
        <div class='command-demo'>
            ${command({
                ...attributes,
                commands,
                onrun: (entry) => {
                    ran.label = entry.label;
                }
            })}
            <p aria-live='polite' class='command-demo-status'>
                ${() => ran.label && html`Ran: <span>${ran.label}</span>`}
            </p>
        </div>
    `;
}

function hub() {
    let ran = reactive({ label: '' }),
        state = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });

    return html`
        <div class='command-demo'>
            ${command({
                commands,
                label: 'Search or run',
                onrun: (entry) => {
                    ran.label = entry.label;
                },
                shortcuts,
                state,
                store: local('docs-command'),
                tabs: true
            })}
            <button
                class='button button--tertiary'
                type='button'
                onclick='${() => {
                    state.tab = 'shortcuts';
                    state.active = true;
                }}'
            >
                Open keyboard shortcuts
            </button>
            <p aria-live='polite' class='command-demo-status'>
                ${() => ran.label && html`Ran: <span>${ran.label}</span>`}
            </p>
        </div>
    `;
}

// Any backend can sit behind the Store interface; this one keeps values in localStorage under a prefix.
function local(prefix: string): Store {
    return {
        get<T>(key: string) {
            let raw = localStorage.getItem(`${prefix}:${key}`);

            return raw === null ? undefined : JSON.parse(raw) as T;
        },
        set<T>(key: string, value: T) {
            localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
        }
    };
}


export default {
    name: 'command',
    variants: [
        {
            render: () => demo(),
            title: 'default (⌘K / Ctrl+K)'
        },
        {
            render: () => demo({ [command.dialog]: { class: 'overlay--blur' }, class: 'command--centered', label: 'Centered, blurred' }),
            title: 'centered + blur'
        },
        {
            render: () => hub(),
            title: 'tabs: recents + every command, a tab per group + keyboard shortcuts'
        }
    ]
};
