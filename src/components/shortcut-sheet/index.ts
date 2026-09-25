import { effect, reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import input from '~/components/input';
import modal from '~/components/modal';
import './scss/index.scss';


type A = Attributes & {
    [SHORTCUT_SHEET_DIALOG]?: Dialog;
    [SHORTCUT_SHEET_INPUT]?: Field;
    [SHORTCUT_SHEET_ROW]?: Attributes;
    [SHORTCUT_SHEET_TRIGGER]?: Attributes;
    label?: string;
    shortcuts: Shortcut[];
    state?: State;
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
    items: Shortcut[];
};

type Shortcut = {
    group: string;
    id: string;
    // 'Mod' is ⌘ on Apple platforms and Ctrl elsewhere; the last key is the trigger.
    keys: string[];
    label: string;
};

type State = {
    active: boolean;
    flash: string;
    query: string;
};


// Long enough to register the row lighting up, short enough to be gone before the next press.
const FLASH = 600;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const GLYPHS: Record<string, string> = {
    Alt: '⌥',
    Mod: '⌘',
    Shift: '⇧'
};

const SHORTCUT_SHEET_DIALOG = Symbol.for('@esportsplus/ui/shortcut-sheet.dialog');

const SHORTCUT_SHEET_INPUT = Symbol.for('@esportsplus/ui/shortcut-sheet.input');

const SHORTCUT_SHEET_ROW = Symbol.for('@esportsplus/ui/shortcut-sheet.row');

const SHORTCUT_SHEET_TRIGGER = Symbol.for('@esportsplus/ui/shortcut-sheet.trigger');

const SPOKEN: Record<string, string> = {
    '-': 'minus',
    '=': 'equals',
    '?': 'question mark',
    '[': 'left bracket',
    ']': 'right bracket'
};


let uid = 0;


function editable(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]') !== null);
}

function filter(shortcuts: Shortcut[], query: string) {
    let count = 0,
        groups: Group[] = [],
        keys = new Map<string, Group>(),
        q = query.trim().toLowerCase();

    for (let i = 0, n = shortcuts.length; i < n; i++) {
        let shortcut = shortcuts[i];

        if (q && !shortcut.label.toLowerCase().includes(q) && !shortcut.group.toLowerCase().includes(q)) {
            continue;
        }

        let group = keys.get(shortcut.group);

        if (!group) {
            group = { group: shortcut.group, items: [] };
            groups.push(group);
            keys.set(shortcut.group, group);
        }

        group.items.push(shortcut);
        count++;
    }

    return { count, groups };
}

function glyph(key: string, mac: boolean) {
    if (key === 'Mod') {
        return mac ? '⌘' : 'Ctrl';
    }

    return (mac && GLYPHS[key]) || key;
}

function matches(e: KeyboardEvent, keys: string[], mac: boolean) {
    let key = keys[keys.length - 1],
        mod = mac ? e.metaKey : e.ctrlKey,
        other = mac ? e.ctrlKey : e.metaKey;

    if (other || mod !== keys.includes('Mod') || e.altKey !== keys.includes('Alt')) {
        return false;
    }

    // '?' is itself a shifted key, so Shift isn't listed for it.
    if (key === '?') {
        return e.key === '?';
    }

    if (e.shiftKey !== keys.includes('Shift')) {
        return false;
    }

    return e.key.toLowerCase() === key.toLowerCase();
}

function restore(e: Event) {
    (e.currentTarget as HTMLElement).classList.remove('--leaving');
}

function search() {
    return html`
        <svg aria-hidden='true' class='shortcut-sheet-search-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 16 16'>
            <circle cx='7' cy='7' r='4.25' />
            <path d='m10.25 10.25 3 3' />
        </svg>
    `;
}

function spoken(keys: string[], mac: boolean) {
    let words: string[] = [];

    for (let i = 0, n = keys.length; i < n; i++) {
        let key = keys[i];

        words.push(key === 'Mod' ? (mac ? 'Command' : 'Control') : (SPOKEN[key] ?? key));
    }

    return words.join(' ');
}


export default Object.assign(
    function(
        this: { attributes?: A } | void,
        {
            label = 'Keyboard shortcuts',
            shortcuts,
            state = reactive({ active: false, flash: '', query: '' }),
            ...attributes
        }: A
    ) {
        let id = `shortcut-sheet-${++uid}`,
            mac = /Mac|iPhone|iPad/.test(navigator.platform),
            overflow = '',
            padding = '',
            release: VoidFunction | undefined,
            results = reactive(() => filter(shortcuts, state.query)),
            stop: VoidFunction | undefined,
            timer: ReturnType<typeof setTimeout> | undefined,
            trigger: HTMLElement | undefined;

        function lock() {
            let body = document.body,
                // Padding by the scrollbar's width keeps the page from shifting sideways.
                gap = innerWidth - document.documentElement.clientWidth;

            overflow = body.style.overflow;
            padding = body.style.paddingRight;

            if (gap > 0) {
                body.style.paddingRight = `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + gap}px`;
            }

            body.style.overflow = 'hidden';
        }

        function onkeydown(e: KeyboardEvent) {
            if (e.defaultPrevented) {
                return;
            }

            let typing = editable(e.target);

            if (!state.active) {
                // Closed: '?' anywhere opens it, unless it's being typed into a field. Inert copies stay quiet.
                if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || typing || !trigger?.isConnected || trigger.closest('[inert]')) {
                    return;
                }

                e.preventDefault();
                show();
                return;
            }

            if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                state.active = false;
                return;
            }

            let hit: Shortcut | undefined,
                groups = results.groups;

            for (let i = 0, n = groups.length; i < n && !hit; i++) {
                hit = groups[i].items.find((s) => matches(e, s.keys, mac));
            }

            // Plain keys belong to the search field while it has focus; only modifier shortcuts can be
            // demonstrated from there.
            if (!hit || (typing && !hit.keys.includes('Mod'))) {
                return;
            }

            // Undo and redo inside the field keep working natively.
            if (!(typing && /^[zZ]$/.test(e.key))) {
                e.preventDefault();
            }

            // Demonstrated, not run: the page's own handlers for the same keys stand aside while the sheet is open.
            e.stopPropagation();

            clearTimeout(timer);
            state.flash = hit.id;
            timer = setTimeout(() => {
                state.flash = '';
            }, FLASH);

            document.getElementById(`${id}-${hit.id}`)?.scrollIntoView({ block: 'nearest' });
        }

        function show() {
            state.flash = '';
            state.query = '';
            state.active = true;
        }

        function unlock() {
            document.body.style.overflow = overflow;
            document.body.style.paddingRight = padding;
        }

        return html`
            <div class='shortcut-sheet' ${this?.attributes} ${attributes}>
                <button
                    aria-haspopup='dialog'
                    aria-keyshortcuts='?'
                    class='shortcut-sheet-trigger'
                    type='button'
                    ${this?.attributes?.[SHORTCUT_SHEET_TRIGGER]}
                    ${attributes[SHORTCUT_SHEET_TRIGGER]}
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: show,
                        onconnect: (element: HTMLElement) => {
                            let locked = false;

                            trigger = element;
                            // Capture, so a shortcut being demonstrated never reaches the page's own handlers.
                            addEventListener('keydown', onkeydown, true);

                            stop = effect(() => {
                                if (state.active === locked) {
                                    return;
                                }

                                locked = state.active;

                                if (locked) {
                                    lock();
                                }
                                else {
                                    clearTimeout(timer);
                                    unlock();
                                }
                            });
                        },
                        ondisconnect: () => {
                            clearTimeout(timer);
                            removeEventListener('keydown', onkeydown, true);
                            stop?.();

                            if (state.active) {
                                unlock();
                            }
                        }
                    }}
                >
                    ${label}
                    <kbd class='shortcut-sheet-kbd'>?</kbd>
                </button>

                ${modal(
                    {
                        'aria-labelledby': `${id}-title`,
                        state,
                        ...this?.attributes?.[SHORTCUT_SHEET_DIALOG],
                        ...attributes[SHORTCUT_SHEET_DIALOG],
                        class: ['shortcut-sheet-dialog', this?.attributes?.[SHORTCUT_SHEET_DIALOG]?.class, attributes[SHORTCUT_SHEET_DIALOG]?.class].flat()
                    },
                    html`
                        <div
                            class='shortcut-sheet-panel'
                            ${{
                                onconnect: (element: HTMLElement) => {
                                    let dialog = element.parentElement!,
                                        stop = effect(() => {
                                            if (!state.active && dialog.hasAttribute('open')) {
                                                dialog.classList.add('--leaving');
                                            }
                                        });

                                    // Closing only fades; the entrance scale is restored once the dialog has shut.
                                    dialog.addEventListener('close', restore);
                                    release = () => {
                                        dialog.removeEventListener('close', restore);
                                        stop();
                                    };
                                },
                                ondisconnect: () => {
                                    release?.();
                                },
                                onkeydown: (e: KeyboardEvent) => {
                                    if (e.key !== 'Tab') {
                                        return;
                                    }

                                    let items = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(FOCUSABLE))
                                        .filter((element) => element.getClientRects().length > 0);

                                    if (!items.length) {
                                        return;
                                    }

                                    let first = items[0],
                                        last = items[items.length - 1];

                                    if (e.shiftKey && document.activeElement === first) {
                                        e.preventDefault();
                                        last.focus();
                                    }
                                    else if (!e.shiftKey && document.activeElement === last) {
                                        e.preventDefault();
                                        first.focus();
                                    }
                                }
                            }}
                        >
                            <div class='shortcut-sheet-header'>
                                <h2 class='shortcut-sheet-title' id='${id}-title'>${label}</h2>
                                <button
                                    aria-label='Close'
                                    class='shortcut-sheet-close'
                                    type='button'
                                    onclick='${() => state.active = false}'
                                >
                                    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                        <path d='m4.5 4.5 7 7M11.5 4.5l-7 7' />
                                    </svg>
                                </button>
                            </div>

                            <div class='shortcut-sheet-search'>
                                ${search()}
                                ${input({
                                    'aria-controls': `${id}-list`,
                                    'aria-label': 'Search shortcuts',
                                    autocomplete: 'off',
                                    autofocus: true,
                                    class: 'shortcut-sheet-input',
                                    oninput: (e: Event) => {
                                        state.query = (e.target as HTMLInputElement).value;
                                    },
                                    placeholder: 'Search shortcuts',
                                    spellcheck: false,
                                    type: 'search',
                                    value: () => state.query,
                                    ...this?.attributes?.[SHORTCUT_SHEET_INPUT],
                                    ...attributes[SHORTCUT_SHEET_INPUT]
                                })}
                            </div>

                            <p aria-live='polite' class='shortcut-sheet-sr'>
                                ${() => state.query ? `${results.count} ${results.count === 1 ? 'shortcut' : 'shortcuts'}` : ''}
                            </p>

                            <div aria-label='Shortcuts' class='shortcut-sheet-list' id='${id}-list' role='region' tabindex='0'>
                                ${() => results.groups.map(({ group, items }, g) => html`
                                    <section aria-labelledby='${id}-group-${g}' class='shortcut-sheet-group'>
                                        <h3 class='shortcut-sheet-group-label' id='${id}-group-${g}'>${group}</h3>
                                        <ul class='shortcut-sheet-rows'>
                                            ${items.map((shortcut) => html`
                                                <li
                                                    class='shortcut-sheet-row ${() => state.flash === shortcut.id && '--active'}'
                                                    id='${id}-${shortcut.id}'
                                                    ${this?.attributes?.[SHORTCUT_SHEET_ROW]}
                                                    ${attributes[SHORTCUT_SHEET_ROW]}
                                                >
                                                    <span class='shortcut-sheet-label'>${shortcut.label}</span>
                                                    <span class='shortcut-sheet-sr'>${spoken(shortcut.keys, mac)}</span>
                                                    <span aria-hidden='true' class='shortcut-sheet-keys'>
                                                        ${shortcut.keys.map((key) => html`<kbd class='shortcut-sheet-kbd'>${glyph(key, mac)}</kbd>`)}
                                                    </span>
                                                </li>
                                            `)}
                                        </ul>
                                    </section>
                                `)}
                                ${() => !results.count && html`
                                    <p class='shortcut-sheet-empty'>No shortcuts match “${state.query.trim()}”</p>
                                `}
                            </div>
                        </div>
                    `
                )}
            </div>
        `;
    },
    {
        dialog: SHORTCUT_SHEET_DIALOG,
        input: SHORTCUT_SHEET_INPUT,
        row: SHORTCUT_SHEET_ROW,
        trigger: SHORTCUT_SHEET_TRIGGER
    } as const
);
export type { Shortcut, State };
