import { computed, effect, reactive, read, signal, untrack, write } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Command as PaletteCommand } from '~/components/command';
import input from '~/components/input';
import overlay from '~/components/overlay';
import shortcutRecorder from '~/components/shortcut-recorder';
import type { Command } from '../code';
import {
    bind,
    conflict,
    fromChord,
    fromRecorder,
    label,
    matches,
    reset,
    rows,
    unassign,
    type KeybindingRow,
    type Keybindings
} from './keybindings';
import keyboard from '@esportsplus/ui/svg/keyboard.svg';
import '~/components/button/scss/index.scss';
import './scss/keybindings.scss';


type A = {
    apple: boolean;
    // Element id prefix.
    id: string;
    keybindings: () => Keybindings;
    onchange: (keybindings: Keybindings) => void;
    state: { active: boolean };
};

// A recorded chord another command holds, waiting for the user to take it or not.
type Pending = { command: Command; keys: string; owner: Command };


// The chords that open the keybinding editor, as 'combo' writes them; the code editor keymap has no sequences, so
// the workspace runs this one itself.
const OPEN = ['Mod+k', 'Mod+s'] as const;

const PALETTE: PaletteCommand = {
    group: 'Preferences',
    icon: keyboard,
    id: 'workspace.keybindings',
    label: 'Open Keyboard Shortcuts'
};


const shortcuts = ({ apple, id, keybindings, onchange, state }: A) => {
    let current = computed(() => rows(keybindings(), apple)),
        initial = untrack(() => read(current)),
        names = new Map(initial.map((row) => [row.id, row.label])),
        pending = signal<Pending | undefined>(undefined),
        ui = reactive({ query: '' });

    function apply(next: Keybindings) {
        write(pending, undefined);
        onchange(next);
    }

    function confirm() {
        let held = read(pending);

        if (held) {
            onchange(bind(keybindings(), apple, held.command, held.keys));
        }

        write(pending, undefined);
    }

    // A recorder's value as it ought to read for the row, so values written back from the table are told apart
    // from ones the user recorded.
    function shown(row: KeybindingRow) {
        return row.chords.length ? fromChord(row.chords[0], apple) : '';
    }

    function record(index: number, value: string) {
        let row = read(current)[index];

        if (value === shown(row)) {
            return;
        }

        if (!value) {
            apply(unassign(keybindings(), apple, row.id));
            return;
        }

        let keys = fromRecorder(value, apple);

        if (!keys) {
            write(pending, undefined);
            return;
        }

        let owner = conflict(keybindings(), apple, row.id, keys);

        if (owner) {
            write(pending, { command: row.id, keys, owner });
            return;
        }

        apply(bind(keybindings(), apple, row.id, keys));
    }

    function row(info: KeybindingRow, index: number) {
        let recorder = reactive({ error: '', value: shown(info) }),
            entry = () => read(current)[index],
            // Built-in keys alone: the recorder only adds a chord, so it shows none of its own.
            adding = () => !entry().chords.length && entry().builtin.length > 0;

        // A chord waiting on a conflict stays shown; anything else follows the table.
        effect(() => {
            let held = read(pending)?.command === info.id,
                value = shown(entry());

            if (!held) {
                untrack(() => {
                    recorder.value = value;
                });
            }
        });

        effect(() => {
            let value = recorder.value;

            untrack(() => record(index, value));
        });

        return html`
            <div class='code-workspace-keybindings-row' role='row' ${{ hidden: () => !matches(entry(), ui.query, apple) }}>
                <div class='code-workspace-keybindings-command' role='cell'>
                    <span class='code-workspace-keybindings-label'>${info.label}</span>
                    <span class='code-workspace-keybindings-id'>${info.id}</span>
                </div>
                <div class='code-workspace-keybindings-keys' role='cell'>
                    ${() => entry().builtin.map((keys) => html`
                        <kbd
                            class='button button--kbd code-workspace-keybindings-key code-workspace-keybindings-key--builtin'
                            title='Built into the editor and not removable here; a chord bound to another command takes it over'
                        >
                            ${label(keys, apple)}
                        </kbd>
                    `)}
                    ${shortcutRecorder({
                        'aria-label': `Keybinding for ${info.label}`,
                        class: ['code-workspace-keybindings-recorder', () => adding() && 'code-workspace-keybindings-recorder--add'],
                        state: recorder,
                        taken: (shortcut) => (fromRecorder(shortcut, apple) === OPEN[0] ? 'the keyboard shortcuts chord' : null),
                        title: () => (adding() ? `Add a keybinding for ${info.label}` : undefined)
                    })}
                    ${() => entry().chords.slice(1).map((keys) => html`
                        <kbd class='button button--kbd code-workspace-keybindings-key'>${label(keys, apple)}</kbd>
                    `)}
                    ${() => {
                        let held = read(pending);

                        if (held?.command !== info.id) {
                            return '';
                        }

                        return html`
                            <div class='code-workspace-keybindings-conflict' role='alert'>
                                <span class='code-workspace-keybindings-conflict-text'>
                                    ${label(held.keys, apple)} is bound to ${names.get(held.owner)}.
                                </span>
                                <button class='button code-workspace-keybindings-button code-workspace-keybindings-button--primary' type='button' onclick='${confirm}'>
                                    Replace
                                </button>
                                <button class='button code-workspace-keybindings-button' type='button' onclick='${() => write(pending, undefined)}'>
                                    Cancel
                                </button>
                            </div>
                        `;
                    }}
                </div>
                <div class='code-workspace-keybindings-source' role='cell'>${() => (entry().user ? 'User' : 'Default')}</div>
                <div class='code-workspace-keybindings-actions' role='cell'>
                    <button
                        class='button code-workspace-keybindings-button'
                        type='button'
                        ${{
                            'aria-label': `Reset ${info.label}`,
                            disabled: () => !entry().user,
                            onclick: () => apply(reset(keybindings(), apple, info.id))
                        }}
                    >
                        Reset
                    </button>
                </div>
            </div>
        `;
    }

    effect(() => {
        if (!state.active) {
            untrack(() => write(pending, undefined));
        }
    });

    return overlay(
        {
            'aria-labelledby': `${id}-keybindings`,
            class: 'card code-workspace-keybindings',
            state
        },
        html`
            <div class='code-workspace-keybindings-header'>
                <h2 class='code-workspace-keybindings-title' id='${id}-keybindings'>Keyboard Shortcuts</h2>
                <button
                    class='button code-workspace-keybindings-button'
                    type='button'
                    ${{
                        disabled: () => !Object.keys(keybindings()).length,
                        onclick: () => apply({})
                    }}
                >
                    Reset all
                </button>
            </div>
            ${input({
                'aria-label': 'Search keybindings',
                autocomplete: 'off',
                autofocus: true,
                class: 'code-workspace-keybindings-search',
                oninput: (event: Event) => {
                    ui.query = (event.target as HTMLInputElement).value;
                },
                placeholder: 'Search by command, id or key',
                spellcheck: false,
                type: 'search',
                value: () => ui.query
            })}
            <div aria-label='Keybindings' class='code-workspace-keybindings-table --scrollbar' role='table'>
                <div class='code-workspace-keybindings-row code-workspace-keybindings-row--head' role='row'>
                    <span role='columnheader'>Command</span>
                    <span role='columnheader'>Keybinding</span>
                    <span role='columnheader'>Source</span>
                    <span role='columnheader'><span class='code-workspace-keybindings-hidden'>Reset</span></span>
                </div>
                ${initial.map(row)}
                ${() => read(current).every((entry) => !matches(entry, ui.query, apple)) && html`
                    <div class='code-workspace-keybindings-empty' role='status'>No commands match</div>
                `}
            </div>
        `
    );
};


export default shortcuts;
export { OPEN, PALETTE };
