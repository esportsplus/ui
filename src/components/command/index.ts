import { computed, effect, reactive, read, signal, write } from '@esportsplus/reactivity';
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
    // A getter re-lists whenever the reactive state it reads changes; group tabs come from the first list.
    commands: Command[] | (() => Command[]);
    // Toggles the palette from anywhere on the page, written like a shortcut's keys. Mod+K with the trigger, none
    // without; an empty list turns it off.
    hotkey?: string[];
    label?: Renderable<unknown>;
    // Caps each view's results, after ranking, so thousands of entries never render at once.
    limit?: number;
    // Replaces the built-in substring-then-subsequence matcher; results rank by score, highest first.
    match?: Matcher;
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
    // False renders the palette alone, opened and closed through 'state' by its host.
    trigger?: boolean;
};

type Command = {
    group: string;
    // Sprite id, as imported from '@esportsplus/ui/svg/*.svg'.
    icon?: string;
    id: string;
    label: string;
    // 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere.
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
    // 'label' lowercased once, for the built-in matcher.
    lower: string;
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
    score: number;
};

// Positions of the matched characters in 'text', ascending, as '~/shared/fuzzy' returns them.
type Matcher = (query: string, text: string) => { indices: number[]; score: number } | null;

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
    entries: (query: string) => Entry[];
    id: Tab;
    // Element id prefix; group names can hold characters an id can't.
    key: string;
    label: string;
    placeholder: string;
    results: ReturnType<typeof computed<ReturnType<typeof filter>>>;
    search: string;
};


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


// A hotkey as 'aria-keyshortcuts' writes it, with 'Mod' spelled for one platform.
function aria(keys: string[], mod: 'Control' | 'Meta') {
    return keys.map((key) => key === 'Mod' ? mod : key).join('+');
}

function filter(entries: Entry[], query: string, matcher?: Matcher, limit = Infinity) {
    let flat: Match[] = [],
        groups: Group[] = [],
        lookup = new Map<string, Group>(),
        matches: Match[] = [],
        needle = query.toLowerCase();

    for (let i = 0, n = entries.length; i < n; i++) {
        let entry = entries[i];

        if (matcher) {
            let found = matcher(query, entry.label);

            if (found) {
                matches.push({ entry, index: 0, ranges: spans(found.indices), score: found.score });
            }

            continue;
        }

        let ranges = match(entry.lower, needle);

        if (ranges) {
            matches.push({ entry, index: 0, ranges, score: 0 });
        }
    }

    // Stable, so equal scores (every entry, before anything is typed) keep the caller's order.
    if (matcher) {
        matches.sort((a, b) => b.score - a.score);
    }

    if (matches.length > limit) {
        matches.length = limit;
    }

    for (let i = 0, n = matches.length; i < n; i++) {
        let item = matches[i],
            group = lookup.get(item.entry.group);

        if (!group) {
            group = { group: item.entry.group, items: [] };
            groups.push(group);
            lookup.set(item.entry.group, group);
        }

        group.items.push(item);
    }

    // Flattened in rendered order, so arrow keys and indices agree even when groups arrive interleaved.
    for (let i = 0, n = groups.length; i < n; i++) {
        let items = groups[i].items;

        for (let j = 0, m = items.length; j < m; j++) {
            items[j].index = flat.length;
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
// Both sides arrive lowercased.
function match(hay: string, needle: string): [number, number][] | null {
    if (!needle) {
        return [];
    }

    let at = hay.indexOf(needle);

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

function spans(indices: number[]) {
    let ranges: [number, number][] = [];

    for (let i = 0, n = indices.length; i < n; i++) {
        let last = ranges[ranges.length - 1];

        if (last && last[1] === indices[i]) {
            last[1]++;
        }
        else {
            ranges.push([indices[i], indices[i] + 1]);
        }
    }

    return ranges;
}

function sprite(href: string, name: Attributes['class'] = '') {
    return icon({ 'aria-hidden': 'true', class: name }, href);
}


export default component(
    function(
        this: { attributes?: A } | void,
        {
            commands,
            hotkey,
            label = 'Search commands',
            limit,
            match: matcher,
            onrun,
            placeholder = 'Type a command or search',
            render,
            shortcuts,
            state = reactive({ active: false, index: 0, query: '', tab: 'all' as Tab }),
            store,
            tabs = false,
            trigger = true,
            ...attributes
        }: A
    ) {
        let apple = mac(),
            id = `command-${++uid}`,
            keys = hotkey ?? (trigger ? ['Mod', 'K'] : []),
            optionAttributes = this?.attributes?.[COMMAND_OPTION],
            // The active option's id; options select on it, so moving it restyles two rows rather than every one.
            active = signal<string | undefined>(undefined),
            bindings = (shortcuts ?? []).map((shortcut): Entry => ({
                group: shortcut.group,
                icon: shortcut.icon,
                id: shortcut.id,
                keys: shortcut.keys.map((key) => glyph(key, apple)),
                label: shortcut.label,
                lower: shortcut.label.toLowerCase()
            })),
            entries = computed(() => (typeof commands === 'function' ? commands() : commands).map((command): Entry => ({
                command,
                group: command.group,
                icon: command.icon,
                id: command.id,
                keys: command.shortcut?.map((key) => glyph(key, apple)),
                label: command.label,
                lower: command.label.toLowerCase()
            }))),
            // The trigger, or the panel without one; the hotkey stays quiet while it is gone or inert.
            host: HTMLElement | undefined,
            // Ends the hotkey listener with its host.
            listening: AbortController | undefined,
            lookup = computed(() => new Map(read(entries).map((entry) => [entry.id, entry]))),
            // Last pointer position, so a list scrolling under a still cursor (which browsers can report as
            // hover) never steals the active item from the keys.
            pointer: { x: number, y: number } | null = null,
            // A Set keeps insertion order, most recent first, and replacing it is what re-runs the list.
            ui = reactive({ moving: false, recent: new Set<string>() }),
            views: View[] = ([
                { empty: 'No commands', entries: everything, id: 'all', label: 'All', placeholder, search: 'Search commands' },
                ...(tabs ? groups() : []),
                ...(tabs && bindings.length ? [{ empty: 'No shortcuts', entries: () => bindings, id: 'shortcuts', label: 'Shortcuts', placeholder: 'Search shortcuts', search: 'Search shortcuts' }] : [])
            ] satisfies Omit<View, 'key' | 'results'>[])
                .map((view, i) => ({ ...view, key: `${id}-${i}` }) as View);

        // Hidden views are inert and start a fresh search when shown, so only the current one follows the typing.
        for (let i = 0, n = views.length; i < n; i++) {
            let view = views[i];

            view.results = computed(() => {
                let query = current() === view ? state.query.trim() : '';

                return filter(view.entries(query), query, matcher, limit);
            });
        }

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
        effect(() => state.active && state.tab, (open) => {
            if (open) {
                reset();
            }
        });

        effect(() => option(current(), selected()), (value) => {
            write(active, value);
        });

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
        function everything(query: string) {
            if (!tabs || query) {
                return read(entries);
            }

            let list: Entry[] = [],
                known = read(lookup);

            for (let key of ui.recent) {
                let found = known.get(key);

                if (found) {
                    list.push({ ...found, group: 'Recents' });
                }
            }

            return list.concat(read(entries));
        }

        function groups() {
            return [...new Set(read(entries).map((entry) => entry.group))].map((group) => ({
                empty: 'No commands',
                entries: () => read(entries).filter((entry) => entry.group === group),
                id: group,
                label: group,
                placeholder,
                search: `Search ${group}`
            }));
        }

        function listen(element: HTMLElement) {
            if (!keys.length) {
                return;
            }

            listening = new AbortController();
            host = element;

            // Capture, so it runs before the site's search, which listens later.
            addEventListener('keydown', shortcut, { capture: true, signal: listening.signal });
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
                items: items.map(({ entry, index, ranges }) => {
                    let key = `${view.key}-${index}`;

                    return {
                        attributes: {
                            ...optionAttributes,
                            ...attributes[COMMAND_OPTION],
                            id: key,
                            role: 'option',
                            'aria-selected': () => signal.selector(active, key) ? 'true' : 'false',
                            class: [
                                optionAttributes?.class,
                                attributes[COMMAND_OPTION]?.class,
                                !entry.command && 'command-option--inert',
                                () => signal.selector(active, key) && '--active'
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
                            ${entry.icon && sprite(entry.icon, ['command-option-icon', () => signal.selector(active, key) && '--active'])}
                            ${mark(entry.label, ranges)}
                            ${entry.keys && kbd(entry.keys)}
                        `,
                        id: entry.id,
                        label: entry.label
                    };
                })
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
            if (
                e.repeat ||
                e.key.toLowerCase() !== keys[keys.length - 1].toLowerCase() ||
                (e.metaKey || e.ctrlKey) !== keys.includes('Mod') ||
                e.altKey !== keys.includes('Alt') ||
                e.shiftKey !== keys.includes('Shift')
            ) {
                return;
            }

            // Another palette on the page already claimed it; inert copies stay quiet.
            if (e.defaultPrevented || !host?.isConnected || host.closest('[inert]')) {
                return;
            }

            let declared = (e.target as Element | null)?.closest?.('[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts')?.toLowerCase().split(/\s+/) ?? [];

            // A focused element that declares the hotkey as its own (an editor's link shortcut) keeps it.
            if (declared.includes(aria(keys, 'Control').toLowerCase()) || declared.includes(aria(keys, 'Meta').toLowerCase())) {
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

        // The incoming view's own translate spans the swap; transitions inside the views bubble up here too.
        function swap(moving: boolean) {
            return function(this: HTMLElement, e: TransitionEvent) {
                let target = e.target as HTMLElement;

                if (e.propertyName === 'translate' && target.parentElement === this && target.classList.contains('--active')) {
                    ui.moving = moving;
                }
            };
        }

        function unlisten() {
            listening?.abort();
        }

        return html`
            <div class='command' ${this?.attributes} ${attributes}>
                ${trigger && html`
                    <button
                        aria-haspopup='dialog'
                        class='button command-trigger'
                        type='button'
                        ${keys.length > 0 && { 'aria-keyshortcuts': aria(keys, apple ? 'Meta' : 'Control') }}
                        ${this?.attributes?.[COMMAND_TRIGGER]}
                        ${attributes[COMMAND_TRIGGER]}
                        ${{
                            'aria-expanded': () => state.active ? 'true' : 'false',
                            onclick: show,
                            onconnect: listen,
                            ondisconnect: unlisten
                        }}
                    >
                        ${sprite(magnifier)}
                        <span class='command-trigger-label'>${label}</span>
                        ${keys.length > 0 && kbd(keys.map((key) => glyph(key, apple)))}
                    </button>
                `}

                ${overlay(
                    {
                        'aria-label': 'Command palette',
                        state,
                        ...this?.attributes?.[COMMAND_DIALOG],
                        ...attributes[COMMAND_DIALOG],
                        class: ['command-dialog', this?.attributes?.[COMMAND_DIALOG]?.class, attributes[COMMAND_DIALOG]?.class].flat()
                    },
                    html`
                        <div
                            class='command-panel'
                            ${{ onmousedown: keep }}
                            ${!trigger && { onconnect: listen, ondisconnect: unlisten }}
                        >
                            <div class='command-search'>
                                ${sprite(magnifier)}
                                ${input({
                                    'aria-activedescendant': () => read(active),
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
                                    ontransitioncancel: swap(false),
                                    ontransitionend: swap(false),
                                    ontransitionrun: swap(true),
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
                                            class='command-list --scrollbar'
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
export type { Command, Matcher, Result, ResultGroup, Shortcut, State, Store, Tab };
