import { reactive, read, signal, write } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { command } from '@esportsplus/ui/components';
import { mac } from '@esportsplus/ui/shared/platform';
import fuzzy from '@esportsplus/ui/shared/fuzzy';
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
import type { Entry } from 'docs/types';
import 'docs/examples/command/scss/index.scss';


let commands: Command[] = [
        { group: 'Navigation', icon: home, id: 'home', label: 'Go to Home', shortcut: ['G', 'H'] },
        { group: 'Navigation', icon: inbox, id: 'inbox', label: 'Open Inbox', shortcut: ['G', 'I'] },
        { group: 'Navigation', icon: sliders, id: 'settings', label: 'Go to Settings', shortcut: ['G', 'S'] },
        { group: 'Navigation', icon: docs, id: 'docs', label: 'Search documentation' },
        { group: 'Actions', icon: plus, id: 'new-file', label: 'New file', shortcut: ['Mod', 'N'] },
        { group: 'Actions', icon: link, id: 'copy-link', label: 'Copy link' },
        { group: 'Actions', icon: contrast, id: 'theme', label: 'Toggle theme', shortcut: ['Shift', 'T'] },
        { group: 'Actions', icon: logOut, id: 'logout', label: 'Log out' }
    ],
    files = [
        'docs/src/examples/command/index.ts',
        'package.json',
        'src/components/command/index.ts',
        'src/components/command/scss/index.scss',
        'src/components/command/scss/variables.scss',
        'src/components/file-tree/index.ts',
        'src/components/overlay/index.ts',
        'src/components/overlay/popup.ts',
        'src/shared/fuzzy.ts',
        'src/shared/platform.ts',
        'tsconfig.json'
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


function demo(attributes: Partial<Parameters<typeof command>[0]> = {}, actions?: Renderable<unknown>) {
    let ran = reactive({ label: '' });

    return html`
        <div class='command-demo'>
            ${command({
                commands,
                ...attributes,
                onrun: (entry) => {
                    ran.label = entry.label;
                }
            })}
            ${actions}
            <p aria-live='polite' class='command-demo-status'>
                ${() => ran.label && html`Ran: <span class='command-demo-status-label'>${ran.label}</span>`}
            </p>
        </div>
    `;
}

function hub() {
    let state = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });

    return demo(
        { label: 'Search or run', shortcuts, state, store: local('docs-command'), tabs: true },
        html`
            <button
                class='button'
                type='button'
                onclick='${() => {
                    state.tab = 'shortcuts';
                    state.active = true;
                }}'
            >
                Open keyboard shortcuts
            </button>
        `
    );
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

// No trigger of its own: the page opens it through 'state', from a button or Mod+P, like an editor's quick open.
function palette() {
    let paths = signal(files),
        state = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab });

    return demo(
        {
            commands: () => read(paths).map((path) => ({ group: 'Files', icon: docs, id: path, label: path })),
            hotkey: ['Mod', 'P'],
            limit: 8,
            match: fuzzy,
            placeholder: 'Go to file',
            state,
            trigger: false
        },
        html`
            <div class='command-demo-actions'>
                <button
                    class='button'
                    type='button'
                    onclick='${() => {
                        state.active = true;
                    }}'
                >
                    Go to file
                    <kbd class='button button--kbd'>${mac() ? '⌘' : 'Ctrl'}</kbd>
                    <kbd class='button button--kbd'>P</kbd>
                </button>
                <button
                    class='button'
                    type='button'
                    onclick='${() => {
                        let list = read(paths);

                        write(paths, [...list, `src/untitled-${list.length - files.length + 1}.ts`]);
                    }}'
                >
                    Add file
                </button>
            </div>
        `
    );
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
        },
        {
            render: () => palette(),
            title: 'trigger-less palette: opened by state from a button or ⌘P / Ctrl+P, fuzzy matched, live list'
        }
    ]
} satisfies Entry;
