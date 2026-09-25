import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import input from '~/components/input';
import modal from '~/components/modal';
import './scss/index.scss';


type A = Attributes & {
    [COMMAND_PALETTE_DIALOG]?: Dialog;
    [COMMAND_PALETTE_INPUT]?: Field;
    [COMMAND_PALETTE_OPTION]?: Attributes;
    [COMMAND_PALETTE_TRIGGER]?: Attributes;
    commands: Command[];
    label?: Renderable<unknown>;
    onrun?: (command: Command) => void;
    placeholder?: string;
    state?: State;
};

type Command = {
    group: string;
    icon?: Renderable<unknown>;
    id: string;
    label: string;
    shortcut?: string[];
};

// What 'modal' and 'input' leave open to callers; they own the rest.
type Dialog = Attributes<HTMLDialogElement> & {
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
};

type Field = Attributes & {
    onfocusin?: never;
    onfocusout?: never;
    onrender?: never;
};

type Group = {
    group: string;
    items: Match[];
};

type Match = {
    command: Command;
    index: number;
    ranges: [number, number][];
};

type State = {
    active: boolean;
    index: number;
    query: string;
};


const COMMAND_PALETTE_DIALOG = Symbol.for('@esportsplus/ui/command-palette.dialog');

const COMMAND_PALETTE_INPUT = Symbol.for('@esportsplus/ui/command-palette.input');

const COMMAND_PALETTE_OPTION = Symbol.for('@esportsplus/ui/command-palette.option');

const COMMAND_PALETTE_TRIGGER = Symbol.for('@esportsplus/ui/command-palette.trigger');


let uid = 0;


function filter(commands: Command[], query: string) {
    let groups: Group[] = [],
        index = 0,
        keys = new Map<string, Group>();

    for (let i = 0, n = commands.length; i < n; i++) {
        let command = commands[i],
            ranges = match(command.label, query);

        if (!ranges) {
            continue;
        }

        let group = keys.get(command.group);

        if (!group) {
            group = { group: command.group, items: [] };
            groups.push(group);
            keys.set(command.group, group);
        }

        group.items.push({ command, index: 0, ranges });
    }

    // Flattened in rendered order, so arrow keys and indices agree even when groups arrive interleaved.
    let flat: Match[] = [];

    for (let i = 0, n = groups.length; i < n; i++) {
        let items = groups[i].items;

        for (let j = 0, m = items.length; j < m; j++) {
            items[j].index = index++;
            flat.push(items[j]);
        }
    }

    return { flat, groups };
}

function highlight(label: string, ranges: [number, number][]) {
    if (!ranges.length) {
        return html`<span class='command-palette-label'>${label}</span>`;
    }

    let cursor = 0,
        parts: Renderable<unknown>[] = [];

    for (let i = 0, n = ranges.length; i < n; i++) {
        let [start, end] = ranges[i];

        if (start > cursor) {
            parts.push(label.slice(cursor, start));
        }

        parts.push(html`<span class='command-palette-match'>${label.slice(start, end)}</span>`);
        cursor = end;
    }

    parts.push(label.slice(cursor));

    return html`<span class='command-palette-label command-palette-label--filtered'>${parts}</span>`;
}

// The list re-renders on every keystroke and a fragment empties on first insert, so render copies.
function icon(value: Renderable<unknown>) {
    return value instanceof Node ? value.cloneNode(true) : value;
}

// Clicks anywhere in the panel keep focus in the input, so typing and arrow keys carry on after a stray click.
function keep(e: MouseEvent) {
    if (!(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
    }
}

function kbd(keys: string[]) {
    return html`
        <span aria-hidden='true' class='command-palette-keys'>
            ${keys.map((key) => html`<kbd class='command-palette-kbd'>${key}</kbd>`)}
        </span>
    `;
}

// Contiguous substring first, so "set" highlights "Settings" as one run instead of scattered letters;
// subsequence is the fallback ("gtst").
function match(label: string, query: string): [number, number][] | null {
    if (!query) {
        return [];
    }

    let hay = label.toLowerCase(),
        needle = query.toLowerCase(),
        at = hay.indexOf(needle);

    if (at !== -1) {
        return [[at, at + needle.length]];
    }

    let from = 0,
        ranges: [number, number][] = [];

    for (let char of needle) {
        let i = hay.indexOf(char, from);

        if (i === -1) {
            return null;
        }

        let last = ranges[ranges.length - 1];

        if (last && last[1] === i) {
            last[1] = i + 1;
        }
        else {
            ranges.push([i, i + 1]);
        }

        from = i + 1;
    }

    return ranges;
}


function search() {
    return html`
        <svg aria-hidden='true' class='command-palette-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
            <circle cx='7' cy='7' r='4.25' />
            <path d='m10.25 10.25 3 3' />
        </svg>
    `;
}


export default Object.assign(
    function(
        this: { attributes?: A } | void,
        {
            commands,
            label = 'Search commands',
            onrun,
            placeholder = 'Type a command or search',
            state = reactive({ active: false, index: 0, query: '' }),
            ...attributes
        }: A
    ) {
        let id = `command-palette-${++uid}`,
            mac = /Mac|iPhone|iPad/.test(navigator.platform),
            // Last pointer position, so a list scrolling under a still cursor (which browsers can report as
            // hover) never steals the active item from the keys.
            pointer: { x: number, y: number } | null = null,
            release: VoidFunction | undefined,
            results = reactive(() => filter(commands, state.query.trim())),
            trigger: HTMLElement | undefined;

        function close() {
            state.active = false;
        }

        function option(index: number) {
            let item = results.flat[index];

            return item ? `${id}-option-${item.command.id}` : undefined;
        }

        function run(command: Command) {
            close();
            onrun?.(command);
        }

        function selected() {
            return Math.min(state.index, Math.max(results.flat.length - 1, 0));
        }

        function show() {
            pointer = null;
            state.index = 0;
            state.query = '';
            state.active = true;
        }

        function shortcut(e: KeyboardEvent) {
            if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.repeat) {
                return;
            }

            // Another palette on the page already claimed it; inert copies stay quiet.
            if (e.defaultPrevented || !trigger?.isConnected || trigger.closest('[inert]')) {
                return;
            }

            // Browsers bind Ctrl+K to address bar search, and the site's own search listens later.
            e.preventDefault();
            e.stopPropagation();

            if (state.active) {
                close();
            }
            else {
                show();
            }
        }

        return html`
            <div class='command-palette' ${this?.attributes} ${attributes}>
                <button
                    aria-haspopup='dialog'
                    aria-keyshortcuts='${mac ? 'Meta+K' : 'Control+K'}'
                    class='command-palette-trigger'
                    type='button'
                    ${this?.attributes?.[COMMAND_PALETTE_TRIGGER]}
                    ${attributes[COMMAND_PALETTE_TRIGGER]}
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: show,
                        onconnect: (element: HTMLElement) => {
                            trigger = element;
                            // Capture, so it runs before the site's search, which listens later.
                            addEventListener('keydown', shortcut, true);
                        },
                        ondisconnect: () => {
                            removeEventListener('keydown', shortcut, true);
                        }
                    }}
                >
                    ${search()}
                    <span class='command-palette-trigger-label'>${label}</span>
                    ${kbd([mac ? '⌘' : 'Ctrl', 'K'])}
                </button>

                ${modal(
                    {
                        'aria-label': 'Command palette',
                        state,
                        ...this?.attributes?.[COMMAND_PALETTE_DIALOG],
                        ...attributes[COMMAND_PALETTE_DIALOG],
                        class: ['command-palette-dialog', this?.attributes?.[COMMAND_PALETTE_DIALOG]?.class, attributes[COMMAND_PALETTE_DIALOG]?.class].flat()
                    },
                    html`
                        <div
                            class='command-palette-panel'
                            ${{
                                // Delegated mousedown is passive, so bind directly.
                                onconnect: (element: HTMLElement) => {
                                    element.addEventListener('mousedown', keep);
                                    release = () => element.removeEventListener('mousedown', keep);
                                },
                                ondisconnect: () => {
                                    release?.();
                                }
                            }}
                        >
                            <div class='command-palette-search'>
                                ${search()}
                                ${input({
                                    'aria-activedescendant': () => option(selected()),
                                    'aria-autocomplete': 'list',
                                    'aria-controls': `${id}-listbox`,
                                    'aria-expanded': 'true',
                                    'aria-label': 'Search commands',
                                    autocomplete: 'off',
                                    autofocus: true,
                                    class: 'command-palette-input',
                                    oninput: (e: Event) => {
                                        state.index = 0;
                                        state.query = (e.target as HTMLInputElement).value;
                                    },
                                    onkeydown: (e: KeyboardEvent) => {
                                        if (e.isComposing) {
                                            return;
                                        }

                                        let count = results.flat.length;

                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();

                                            if (!count) {
                                                return;
                                            }

                                            state.index = (selected() + (e.key === 'ArrowDown' ? 1 : -1) + count) % count;

                                            // 'nearest' only scrolls when the item is out of view; smooth so stepping past
                                            // the edge glides the list along rather than jumping it.
                                            document.getElementById(option(state.index) ?? '')?.scrollIntoView({
                                                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                                                block: 'nearest'
                                            });
                                        }
                                        else if (e.key === 'Enter') {
                                            e.preventDefault();

                                            let item = results.flat[selected()];

                                            if (item) {
                                                run(item.command);
                                            }
                                        }
                                        else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            close();
                                        }
                                        else if (e.key === 'Tab') {
                                            // The input is the dialog's only tab stop; keep focus inside.
                                            e.preventDefault();
                                        }
                                    },
                                    placeholder,
                                    role: 'combobox',
                                    spellcheck: false,
                                    value: () => state.query,
                                    ...this?.attributes?.[COMMAND_PALETTE_INPUT],
                                    ...attributes[COMMAND_PALETTE_INPUT]
                                })}
                            </div>

                            <div
                                aria-label='Commands'
                                class='command-palette-list ${() => !results.flat.length && '--empty'}'
                                id='${id}-listbox'
                                role='listbox'
                                ${{
                                    onmouseleave: () => {
                                        pointer = null;
                                    }
                                }}
                            >
                                ${() => results.groups.map(({ group, items }, g) => html`
                                    <div aria-labelledby='${id}-group-${g}' class='command-palette-group' role='group'>
                                        <div class='command-palette-group-label' id='${id}-group-${g}'>${group}</div>
                                        ${items.map(({ command, index, ranges }) => html`
                                            <div
                                                class='command-palette-option ${() => selected() === index && '--active'}'
                                                id='${id}-option-${command.id}'
                                                role='option'
                                                ${this?.attributes?.[COMMAND_PALETTE_OPTION]}
                                                ${attributes[COMMAND_PALETTE_OPTION]}
                                                ${{
                                                    'aria-selected': () => selected() === index ? 'true' : 'false',
                                                    onclick: () => run(command),
                                                    onpointermove: (e: PointerEvent) => {
                                                        if (e.pointerType === 'touch') {
                                                            return;
                                                        }

                                                        if (pointer && pointer.x === e.clientX && pointer.y === e.clientY) {
                                                            return;
                                                        }

                                                        pointer = { x: e.clientX, y: e.clientY };

                                                        if (index !== selected()) {
                                                            state.index = index;
                                                        }
                                                    }
                                                }}
                                            >
                                                <span aria-hidden='true' class='command-palette-option-icon'>${icon(command.icon)}</span>
                                                ${highlight(command.label, ranges)}
                                                ${command.shortcut && kbd(command.shortcut)}
                                            </div>
                                        `)}
                                    </div>
                                `)}
                            </div>

                            ${() => !results.flat.length && html`
                                <p class='command-palette-empty' role='status'>No results</p>
                            `}
                        </div>
                    `
                )}
            </div>
        `;
    },
    {
        dialog: COMMAND_PALETTE_DIALOG,
        input: COMMAND_PALETTE_INPUT,
        option: COMMAND_PALETTE_OPTION,
        trigger: COMMAND_PALETTE_TRIGGER
    } as const
);
export type { Command, State };
