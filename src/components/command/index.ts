import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, reactive, root } from '@esportsplus/reactivity';
import input from '~/components/input';
import modal from '~/components/modal';
import { COMMAND_INPUT, COMMAND_ITEM } from './constants';
import './scss/index.scss';


type A = Parameters<typeof modal>[0] & {
    [COMMAND_INPUT]?: Parameters<typeof input>[0];
    [COMMAND_ITEM]?: Attributes;
    groups: Group[];
    placeholder?: string;
    state?: { active: boolean, query: string };
};

type D = Parameters<typeof modal>[0] & Pick<A, typeof COMMAND_INPUT | typeof COMMAND_ITEM>;

type Group = {
    items: Item[];
    label: string;
};

type Item = Attributes & {
    icon?: Renderable<unknown>;
    label: string;
};

type Row = {
    index: number;
    item: Item;
};

type Section = {
    label: string;
    rows: Row[];
};


let dialog = modal.bind({ attributes: { class: 'card command' } }),
    uid = 0;


function filter(sections: Section[], needle: string) {
    if (!needle) {
        return sections;
    }

    let filtered: Section[] = [];

    for (let i = 0, n = sections.length; i < n; i++) {
        let rows = sections[i].rows.filter(({ item }) => item.label.toLowerCase().includes(needle));

        if (rows.length) {
            filtered.push({ label: sections[i].label, rows });
        }
    }

    return filtered;
}

function highlight(label: string, needle: string) {
    let start = needle ? label.toLowerCase().indexOf(needle) : -1;

    if (start === -1) {
        return label;
    }

    let end = start + needle.length;

    return html`${label.slice(0, start)}<mark class='command-match'>${label.slice(start, end)}</mark>${label.slice(end)}`;
}


export default Object.assign(component<A>(
    function(
        this: { attributes?: D },
        {
            groups,
            placeholder = 'Search…',
            state = reactive({ active: false, query: '' }),
            ...attributes
        }: A
    ) {
        let defaults = this?.attributes,
            id = `command-${++uid}`,
            index = 0,
            sections: Section[] = groups.map(({ items, label }) => ({
                label,
                rows: items.map((item) => ({ index: index++, item }))
            }));

        function palette() {
            let highlighted = reactive(-1),
                needle = reactive(() => state.query.trim().toLowerCase()),
                visible = reactive(() => filter(sections, needle)),
                rows = reactive(() => visible.flatMap((section) => section.rows)),
                // Highlight follows item identity; when the highlighted item is
                // filtered away it falls back to the first visible row.
                active = reactive(() => {
                    let list = rows,
                        target = highlighted;

                    for (let i = 0, n = list.length; i < n; i++) {
                        if (list[i].index === target) {
                            return target;
                        }
                    }

                    return list.length ? list[0].index : -1;
                });

            // The modal also closes itself (Esc, backdrop), so the reset lives here
            // rather than in a close handler.
            effect(() => {
                if (!state.active) {
                    state.query = '';
                    highlighted = -1;
                }
            });

            function move(step: number) {
                let current = active,
                    list = rows,
                    n = list.length;

                if (!n) {
                    return;
                }

                let next = list[(list.findIndex((row) => row.index === current) + step + n) % n].index;

                highlighted = next;
                document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: 'nearest' });
            }

            // Rows and group labels have fixed heights, so the highlight position is
            // derived from counts instead of measuring the DOM after each filter.
            function position() {
                let current = active,
                    r = 0,
                    sections = visible;

                for (let g = 0, n = sections.length; g < n; g++) {
                    let items = sections[g].rows;

                    for (let i = 0, m = items.length; i < m; i++, r++) {
                        if (items[i].index === current) {
                            return `--group: ${g + 1}; --row: ${r};`;
                        }
                    }
                }

                return '';
            }

            function row({ index, item: { icon, label, onclick, ...item } }: Row) {
                return html`
                    <a
                        class='command-item'
                        id='${id}-${index}'
                        role='option'
                        ${defaults?.[COMMAND_ITEM]}
                        ${attributes[COMMAND_ITEM]}
                        ${item}
                        ${{
                            'aria-selected': () => active === index ? 'true' : 'false',
                            class: () => active === index && '--active',
                            onclick: function(this: HTMLElement, event: PointerEvent) {
                                if (typeof onclick === 'function') {
                                    onclick.call(this, event);
                                }

                                state.active = false;
                            },
                            onmousemove: () => {
                                highlighted = index;
                            }
                        }}
                    >
                        <span class='command-item-icon'>${icon ?? '→'}</span>
                        <span class='command-item-label'>${highlight(label, needle)}</span>
                    </a>
                `;
            }

            return dialog(
                {
                    ...defaults,
                    ...attributes,
                    onkeydown: (event: KeyboardEvent) => {
                        if (event.isComposing) {
                            return;
                        }

                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            event.preventDefault();
                            move(event.key === 'ArrowDown' ? 1 : -1);
                        }
                        else if (event.key === 'Enter') {
                            event.preventDefault();
                            document.getElementById(`${id}-${active}`)?.click();
                        }
                    },
                    state
                },
                html`
                    <label class='command-search'>
                        <span class='command-search-icon' aria-hidden='true'></span>

                        ${input({
                            'aria-activedescendant': () => active === -1 ? '' : `${id}-${active}`,
                            'aria-autocomplete': 'list',
                            'aria-controls': `${id}-listbox`,
                            'aria-expanded': 'true',
                            autocomplete: 'off',
                            autofocus: true,
                            class: 'command-input',
                            oninput: (event: Event) => {
                                state.query = (event.target as HTMLInputElement).value;
                            },
                            placeholder,
                            role: 'combobox',
                            spellcheck: false,
                            type: 'text',
                            value: () => state.query,
                            ...defaults?.[COMMAND_INPUT],
                            ...attributes[COMMAND_INPUT]
                        })}
                    </label>

                    <div class='command-results' id='${id}-listbox' role='listbox'>
                        <div class='command-list' ${{ onmouseleave: () => { highlighted = -1; } }}>
                            <span
                                class='command-highlight'
                                aria-hidden='true'
                                ${{
                                    class: () => active !== -1 && '--active',
                                    style: position
                                }}
                            ></span>

                            ${() => {
                                if (!visible.length) {
                                    return html`
                                        <div class='command-empty'>
                                            No results for <b>“${state.query}”</b>
                                        </div>
                                    `;
                                }

                                return visible.map((section) => html`
                                    <div class='command-group' role='group' aria-label='${section.label}'>
                                        <div class='command-group-label' aria-hidden='true'>${section.label}</div>
                                        ${section.rows.map(row)}
                                    </div>
                                `);
                            }}
                        </div>
                    </div>

                    <div class='command-footer' aria-hidden='true'>
                        <kbd>↑</kbd>
                        <kbd>↓</kbd>
                        <span>Navigate</span>
                        <kbd>↵</kbd>
                        <span>Select</span>
                        <kbd>esc</kbd>
                        <span>Close</span>
                    </div>
                `
            );
        }

        // Declaring the dispose parameter makes root() open an owned scope, so the
        // palette's computeds and effects live and die with the caller without the
        // caller subscribing to them.
        return root((_dispose) => palette());
    }
), { input: COMMAND_INPUT, item: COMMAND_ITEM } as const);
export type { Group, Item };
