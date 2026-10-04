import { computed, effect, onCleanup, reactive, read } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import highlight from '~/components/highlight';
import icon from '~/components/icon';
import input from '~/components/input';
import overlay from '~/components/overlay';
import { mac } from '~/shared/platform';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import enter from '@esportsplus/ui/svg/enter.svg';
import magnifier from '@esportsplus/ui/svg/search.svg';
import '~/components/frame/scss/index.scss';
import '~/css-utilities/scrollbar/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [COMMAND_DIALOG]?: Dialog;
    [COMMAND_INPUT]?: Field;
    [COMMAND_OPTION]?: Attributes;
    [COMMAND_TRIGGER]?: Attributes;
    commands: Command[];
    label?: Renderable<unknown>;
    onrun?: (command: Command) => void;
    placeholder?: string;
    // Replaces the grouped result markup; apply each item's attributes to its option element.
    render?: (groups: ResultGroup[]) => Renderable<unknown>;
    // Listed under their own tab.
    shortcuts?: Shortcut[];
    state?: State;
    // Persists recent commands; without one they last until the page unloads.
    store?: Store;
    // Adds the tab row under the search: All leads with recently run commands, then a tab per command group.
    tabs?: boolean;
};

type Command = {
    group: string;
    // Sprite id, as imported from '@esportsplus/ui/svg/*.svg'.
    icon?: string;
    id: string;
    label: string;
    shortcut?: string[];
};

// What 'overlay' and 'input' leave open to callers; they own the rest.
type Dialog = Attributes<HTMLDialogElement> & {
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    onfocusin?: never;
    onfocusout?: never;
    onpointercancel?: never;
    onpointerdown?: never;
    onpointerenter?: never;
    onpointerleave?: never;
    onpointermove?: never;
    onpointerup?: never;
};

// Commands and shortcuts share one row shape, so both render through the same list.
type Entry = {
    command?: Command;
    group: string;
    icon?: string;
    id: string;
    keys?: string[];
    label: string;
};

type Field = Attributes & {
    onfocusin?: never;
    onfocusout?: never;
};

type Group = {
    group: string;
    items: Match[];
};

type Match = {
    entry: Entry;
    index: number;
    ranges: [number, number][];
};

type Result = {
    attributes: Attributes;
    command?: Command;
    content: Renderable<unknown>;
    id: string;
    label: string;
};

type ResultGroup = {
    id: string;
    items: Result[];
    label: string;
};

type Shortcut = {
    group: string;
    // Sprite id, as imported from '@esportsplus/ui/svg/*.svg'.
    icon?: string;
    id: string;
    // 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere.
    keys: string[];
    label: string;
};

type State = {
    active: boolean;
    index: number;
    query: string;
    tab: Tab;
};

// Where the palette keeps what it remembers; implement it over localStorage, IndexedDB, a server, anything.
type Store = {
    get<T>(key: string): Promise<T | undefined> | T | undefined;
    set<T>(key: string, value: T): Promise<void> | void;
};

// A command group's name opens that group's tab.
type Tab = 'all' | 'shortcuts' | (string & {});

type View = {
    empty: string;
    entries: () => Entry[];
    id: Tab;
    // Element id prefix; group names can hold characters an id can't.
    key: string;
    label: string;
    placeholder: string;
    results: ReturnType<typeof computed<ReturnType<typeof filter>>>;
    search: string;
};


const SEARCH_SHORTCUT = /\b(Control|Meta)\+K\b/i;


const COMMAND_DIALOG = Symbol.for('@esportsplus/ui/command.dialog');

const COMMAND_INPUT = Symbol.for('@esportsplus/ui/command.input');

const COMMAND_OPTION = Symbol.for('@esportsplus/ui/command.option');

const COMMAND_TRIGGER = Symbol.for('@esportsplus/ui/command.trigger');

const GLYPHS: Record<string, string> = {
    Alt: '⌥',
    Mod: '⌘',
    Shift: '⇧'
};

const RECENT_KEY = 'recent';

const RECENT_LIMIT = 8;


let uid = 0;


function filter(entries: Entry[], query: string) {
    let groups: Group[] = [],
        index = 0,
        keys = new Map<string, Group>();

    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i],
            ranges = match(entry.label, query);

        if (!ranges) {
            continue;
        }

        let group = keys.get(entry.group);

        if (!group) {
            group = { group: entry.group, items: [] };
            groups.push(group);
            keys.set(entry.group, group);
        }

        group.items.push({ entry, index: 0, ranges });
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

// 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere; other modifiers only get symbols on Apple keyboards.
function glyph(key: string, apple: boolean) {
    if (key === 'Mod') {
        return apple ? '⌘' : 'Ctrl';
    }

    return (apple && GLYPHS[key]) || key;
}

function hint(keys: Renderable<unknown>[], label: string) {
    return html`
        <span class='command-footer-hint'>
            ${kbd(keys)}
            ${label}
        </span>
    `;
}

// Clicks anywhere in the panel keep focus in the input, so typing and arrow keys carry on after a stray click.
function keep(e: MouseEvent) {
    if (!(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
    }
}

function kbd(keys: Renderable<unknown>[]) {
    return html`
        <span aria-hidden='true' class='command-keys'>
            ${keys.map((key) => html`<kbd class='button button--kbd'>${key}</kbd>`)}
        </span>
    `;
}

function mark(label: string, ranges: [number, number][]) {
    if (!ranges.length) {
        return html`<span class='command-label'>${label}</span>`;
    }

    let cursor = 0,
        parts: Renderable<unknown>[] = [];

    for (let i = 0, n = ranges.length; i < n; i++) {
        let [start, end] = ranges[i];

        if (start > cursor) {
            parts.push(label.slice(cursor, start));
        }

        parts.push(html`<span class='command-match'>${label.slice(start, end)}</span>`);
        cursor = end;
    }

    parts.push(label.slice(cursor));

    return html`<span class='command-label command-label--filtered'>${parts}</span>`;
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

function sprite(href: string, name = '') {
    return icon({ 'aria-hidden': 'true', class: name }, href);
}


export default component(
    function(
        this: { attributes?: A } | void,
        {
            commands,
            label = 'Search commands',
            onrun,
            placeholder = 'Type a command or search',
            render,
            shortcuts,
            state = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab }),
            store,
            tabs = false,
            ...attributes
        }: A
    ) {
        let apple = mac(),
            id = `command-${++uid}`,
            optionAttributes = this?.attributes?.[COMMAND_OPTION],
            bindings = (shortcuts ?? []).map((shortcut): Entry => ({
                group: shortcut.group,
                icon: shortcut.icon,
                id: shortcut.id,
                keys: shortcut.keys.map((key) => glyph(key, apple)),
                label: shortcut.label
            })),
            entries = commands.map((command): Entry => ({
                command,
                group: command.group,
                icon: command.icon,
                id: command.id,
                keys: command.shortcut,
                label: command.label
            })),
            // Ends the Mod+K listener with the trigger.
            listening: AbortController | undefined,
            lookup = new Map(entries.map((entry) => [entry.id, entry])),
            // Last pointer position, so a list scrolling under a still cursor (which browsers can report as
            // hover) never steals the active item from the keys.
            pointer: { x: number, y: number } | null = null,
            trigger: HTMLElement | undefined,
            // A Set keeps insertion order, most recent first, and replacing it is what re-runs the list.
            ui = reactive({ moving: false, recent: new Set<string>() }),
            views: View[] = ([
                { empty: 'No commands', entries: everything, id: 'all', label: 'All', placeholder, search: 'Search commands' },
                ...(tabs ? groups() : []),
                ...(tabs && bindings.length ? [{ empty: 'No shortcuts', entries: () => bindings, id: 'shortcuts', label: 'Shortcuts', placeholder: 'Search shortcuts', search: 'Search shortcuts' }] : [])
            ] satisfies Omit<View, 'key' | 'results'>[])
                .map((view, i) => ({ ...view, key: `${id}-${i}`, results: computed(() => filter(view.entries(), state.query.trim())) }));

        if (store) {
            void Promise.resolve(store.get<string[]>(RECENT_KEY)).then((ids) => {
                if (Array.isArray(ids)) {
                    // Merged behind anything run before the store answered.
                    ui.recent = new Set([...ui.recent, ...ids].slice(0, RECENT_LIMIT));
                }
            });
        }

        // Opening or switching views starts a fresh search, whether the trigger, a tab, the Tab key or the
        // caller's state moved it.
        onCleanup(effect(() => state.active && state.tab, (open) => {
            if (open) {
                reset();
            }
        }));

        function close() {
            state.active = false;
        }

        // A tab the palette doesn't show (no shortcuts given, or no tabs) falls back to All.
        function current() {
            return views.find((view) => view.id === state.tab) ?? views[0];
        }

        function empty(view: View) {
            return state.query.trim() ? 'No results' : view.empty;
        }

        // All leads with what was run last; typing there searches every command once.
        function everything() {
            if (!tabs || state.query.trim()) {
                return entries;
            }

            let list: Entry[] = [];

            for (let key of ui.recent) {
                let found = lookup.get(key);

                if (found) {
                    list.push({ ...found, group: 'Recents' });
                }
            }

            return list.concat(entries);
        }

        function groups() {
            let lists = new Map<string, Entry[]>();

            for (let i = 0, n = entries.length; i < n; i++) {
                let entry = entries[i],
                    list = lists.get(entry.group);

                if (!list) {
                    list = [];
                    lists.set(entry.group, list);
                }

                list.push(entry);
            }

            return [...lists].map(([group, list]) => ({
                empty: 'No commands',
                entries: () => list,
                id: group,
                label: group,
                placeholder,
                search: `Search ${group}`
            }));
        }

        // The incoming view's own translate spans the swap; transitions inside the views bubble up here too.
        function incoming(e: TransitionEvent, parent: HTMLElement) {
            let target = e.target as HTMLElement;

            return e.propertyName === 'translate' && target.parentElement === parent && target.classList.contains('--active');
        }

        // All lists a recent command twice, so rows go by position rather than command id.
        function option(view: View, index: number) {
            return read(view.results).flat[index] ? `${view.key}-${index}` : undefined;
        }

        function remember(command: Command) {
            ui.recent = new Set([command.id, ...ui.recent].slice(0, RECENT_LIMIT));
            void store?.set(RECENT_KEY, [...ui.recent]);
        }

        function reset() {
            pointer = null;
            state.index = 0;
            state.query = '';
            // A swap cut short by closing may never report its end.
            ui.moving = false;
        }

        function results(view: View) {
            let groups = read(view.results).groups.map(({ group, items }, g): ResultGroup => ({
                id: `${view.key}-group-${g}`,
                label: group,
                items: items.map(({ entry, index, ranges }) => ({
                    attributes: {
                        ...optionAttributes,
                        ...attributes[COMMAND_OPTION],
                        id: `${view.key}-${index}`,
                        role: 'option',
                        'aria-selected': () => current() === view && selected() === index ? 'true' : 'false',
                        class: [
                            optionAttributes?.class,
                            attributes[COMMAND_OPTION]?.class,
                            !entry.command && 'command-option--inert',
                            () => current() === view && selected() === index && '--active'
                        ].flat(),
                        onclick: (event: Event) => {
                            event.preventDefault();
                            run(entry);
                        },
                        onpointermove: (event: PointerEvent) => {
                            if (event.pointerType === 'touch' || (pointer && pointer.x === event.clientX && pointer.y === event.clientY)) {
                                return;
                            }

                            pointer = { x: event.clientX, y: event.clientY };

                            if (index !== selected()) {
                                state.index = index;
                            }
                        }
                    },
                    command: entry.command,
                    content: html`
                        ${entry.icon && sprite(entry.icon, 'command-option-icon')}
                        ${mark(entry.label, ranges)}
                        ${entry.keys && kbd(entry.keys)}
                    `,
                    id: entry.id,
                    label: entry.label
                }))
            }));

            return render ? render(groups) : html`
                ${highlight({ class: 'command-highlight', hover: false, target: '.command-option' })}
                ${groups.map((group) => html`
                    <div aria-labelledby='${group.id}' class='command-group' role='group'>
                        <div class='command-group-label' id='${group.id}'>${group.label}</div>
                        ${group.items.map((item) => html`
                            <div class='command-option' ${item.attributes}>${item.content}</div>
                        `)}
                    </div>
                `)}
            `;
        }

        // Shortcut rows are a reference list; only commands run.
        function run(entry: Entry) {
            if (!entry.command) {
                return;
            }

            close();
            remember(entry.command);
            onrun?.(entry.command);
        }

        function selected() {
            return Math.min(state.index, Math.max(read(current().results).flat.length - 1, 0));
        }

        function show() {
            state.tab = views[0].id;
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

            // A focused element that declares Mod+K as its own (an editor's link shortcut) keeps it.
            if (SEARCH_SHORTCUT.test((e.target as Element | null)?.closest?.('[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts') ?? '')) {
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

        function step(direction: number) {
            let n = views.length;

            state.tab = views[(views.indexOf(current()) + direction + n) % n].id;
        }

        return html`
            <div class='command' ${this?.attributes} ${attributes}>
                <button
                    aria-haspopup='dialog'
                    aria-keyshortcuts='${apple ? 'Meta+K' : 'Control+K'}'
                    class='button command-trigger'
                    type='button'
                    ${this?.attributes?.[COMMAND_TRIGGER]}
                    ${attributes[COMMAND_TRIGGER]}
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: show,
                        onconnect: (element: HTMLElement) => {
                            listening = new AbortController();
                            trigger = element;

                            // Capture, so it runs before the site's search, which listens later.
                            addEventListener('keydown', shortcut, { capture: true, signal: listening.signal });
                        },
                        ondisconnect: () => {
                            listening?.abort();
                        }
                    }}
                >
                    ${sprite(magnifier)}
                    <span class='command-trigger-label'>${label}</span>
                    ${kbd([glyph('Mod', apple), 'K'])}
                </button>

                ${overlay(
                    {
                        'aria-label': 'Command palette',
                        state,
                        ...this?.attributes?.[COMMAND_DIALOG],
                        ...attributes[COMMAND_DIALOG],
                        class: ['command-dialog', this?.attributes?.[COMMAND_DIALOG]?.class, attributes[COMMAND_DIALOG]?.class].flat()
                    },
                    html`
                        <div class='command-panel' ${{ onmousedown: keep }}>
                            <div class='command-search'>
                                ${sprite(magnifier)}
                                ${input({
                                    'aria-activedescendant': () => option(current(), selected()),
                                    'aria-autocomplete': 'list',
                                    'aria-controls': () => `${current().key}-listbox`,
                                    'aria-expanded': 'true',
                                    'aria-label': () => current().search,
                                    autocomplete: 'off',
                                    autofocus: true,
                                    class: 'command-input',
                                    oninput: (e: Event) => {
                                        state.index = 0;
                                        state.query = (e.target as HTMLInputElement).value;
                                    },
                                    onkeydown: (e: KeyboardEvent) => {
                                        if (e.isComposing) {
                                            return;
                                        }

                                        let view = current(),
                                            items = read(view.results).flat;

                                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                            e.preventDefault();

                                            if (!items.length) {
                                                return;
                                            }

                                            state.index = (selected() + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

                                            // 'nearest' only scrolls when the item is out of view.
                                            document.getElementById(option(view, state.index) ?? '')?.scrollIntoView({ block: 'nearest' });
                                        }
                                        else if (e.key === 'Enter') {
                                            e.preventDefault();

                                            let item = items[selected()];

                                            if (item) {
                                                run(item.entry);
                                            }
                                        }
                                        else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            close();
                                        }
                                        else if (e.key === 'Tab') {
                                            // The input is the dialog's only tab stop, so Tab moves between views instead.
                                            e.preventDefault();
                                            step(e.shiftKey ? -1 : 1);
                                        }
                                    },
                                    placeholder: () => current().placeholder,
                                    role: 'combobox',
                                    spellcheck: false,
                                    value: () => state.query,
                                    ...this?.attributes?.[COMMAND_INPUT],
                                    ...attributes[COMMAND_INPUT]
                                })}
                                ${() => state.query.trim() && html`
                                    <span aria-hidden='true' class='command-count'>
                                        ${() => {
                                            let count = read(current().results).flat.length;

                                            return `${count} ${count === 1 ? 'result' : 'results'}`;
                                        }}
                                    </span>
                                `}
                            </div>

                            ${views.length > 1 && html`
                                <div aria-label='Views' class='command-tabs' role='tablist'>
                                    ${highlight({ class: 'command-tabs-highlight' })}
                                    ${views.map((view) => html`
                                        <button
                                            aria-controls='${view.key}'
                                            class='button command-tab'
                                            id='${view.key}-tab'
                                            role='tab'
                                            tabindex='-1'
                                            type='button'
                                            ${{
                                                'aria-selected': () => current() === view ? 'true' : 'false',
                                                class: () => current() === view && '--active',
                                                onclick: () => {
                                                    state.tab = view.id;
                                                }
                                            }}
                                        >
                                            ${view.label}
                                        </button>
                                    `)}
                                </div>
                            `}

                            <div
                                class='command-views'
                                ${{
                                    ontransitioncancel: function(this: HTMLElement, e: TransitionEvent) {
                                        if (incoming(e, this)) {
                                            ui.moving = false;
                                        }
                                    },
                                    ontransitionend: function(this: HTMLElement, e: TransitionEvent) {
                                        if (incoming(e, this)) {
                                            ui.moving = false;
                                        }
                                    },
                                    ontransitionrun: function(this: HTMLElement, e: TransitionEvent) {
                                        if (incoming(e, this)) {
                                            ui.moving = true;
                                        }
                                    },
                                    style: () => `--i: ${views.indexOf(current())}`
                                }}
                            >
                                ${views.map((view, i) => html`
                                    <div
                                        class='command-view frame ${views.length > 1 && 'frame--swap'}'
                                        id='${view.key}'
                                        style='--n: ${i}'
                                        ${views.length > 1 && { 'aria-labelledby': `${view.key}-tab`, role: 'tabpanel' }}
                                        ${{
                                            class: () => current() === view && (ui.moving ? '--active frame--moving' : '--active'),
                                            inert: () => current() !== view
                                        }}
                                    >
                                        <div
                                            aria-label='${view.label}'
                                            class='command-list --scrollbar --scrollbar-no-arrows'
                                            id='${view.key}-listbox'
                                            role='listbox'
                                            ${{
                                                class: () => !read(view.results).flat.length && 'command-list--empty',
                                                onmouseleave: () => {
                                                    pointer = null;
                                                }
                                            }}
                                        >
                                            ${() => results(view)}
                                        </div>

                                        ${() => !read(view.results).flat.length && html`
                                            <p class='command-empty' role='status'>${empty(view)}</p>
                                        `}
                                    </div>
                                `)}
                            </div>

                            <div aria-hidden='true' class='command-footer'>
                                ${hint(['esc'], 'Close')}
                                ${views.length > 1 && hint(['tab'], 'Switch')}
                                ${hint([sprite(up, 'command-kbd-icon'), sprite(down, 'command-kbd-icon')], 'Navigate')}
                                ${hint([sprite(enter, 'command-kbd-icon')], 'Select')}
                            </div>
                        </div>
                    `
                )}
            </div>
        `;
    },
    {
        dialog: COMMAND_DIALOG,
        input: COMMAND_INPUT,
        option: COMMAND_OPTION,
        trigger: COMMAND_TRIGGER
    }
);
export type { Command, Result, ResultGroup, Shortcut, State, Store, Tab };
