import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    elements: Element[];
    // Folder ids open on mount; the selected item's folders open as well.
    expanded?: string[];
    icons?: {
        close?: () => Renderable<unknown>;
        file?: () => Renderable<unknown>;
        open?: () => Renderable<unknown>;
    };
    // Draws a guide line down each open folder.
    indicator?: boolean;
    select?: (id: string) => void;
    selected?: string;
    sort?: Sort;
    state?: State;
    // Adds a corner button that opens every folder, or closes them all when any are open.
    toggle?: boolean;
};

type Element = {
    children?: Element[];
    id: string;
    name: string;
    // Shown but inert, like a locked file.
    selectable?: boolean;
    type?: 'file' | 'folder';
};

type Sort = 'default' | 'none' | ((a: Element, b: Element) => number);

type State = {
    selected: string;
};


const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });


function arrange(elements: Element[], sort: Sort): Element[] {
    let compare = sort === 'none' ? undefined : sort === 'default' ? byDefault : sort,
        next = elements.map((element) => element.children ? { ...element, children: arrange(element.children, sort) } : element);

    return compare ? next.sort(compare) : next;
}

// Folders first, then names in natural order, so file2 sorts before file10.
function byDefault(a: Element, b: Element) {
    let x = folder(a),
        y = folder(b);

    if (x !== y) {
        return x ? -1 : 1;
    }

    return collator.compare(a.name, b.name);
}

function folder(element: Element) {
    return element.type ? element.type === 'folder' : Array.isArray(element.children);
}

function folders(elements: Element[], out: Element[] = []) {
    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i];

        if (folder(element)) {
            out.push(element);
            folders(element.children ?? [], out);
        }
    }

    return out;
}

// Ids of the folders leading to 'id', and 'id' itself when it can be opened.
function path(elements: Element[], id: string, trail: string[] = []): string[] | null {
    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i],
            next = [...trail, element.id];

        if (element.id === id) {
            return element.selectable === false ? trail : next;
        }

        if (element.children) {
            let found = path(element.children, id, next);

            if (found) {
                return found;
            }
        }
    }

    return null;
}


const ICONS = {
    close: () => html`
        <svg aria-hidden='true' class='file-tree-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' />
        </svg>
    `,
    file: () => html`
        <svg aria-hidden='true' class='file-tree-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' />
            <path d='M14 2v4a2 2 0 0 0 2 2h4' />
        </svg>
    `,
    open: () => html`
        <svg aria-hidden='true' class='file-tree-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2' />
        </svg>
    `
};


export default ({
    elements,
    expanded = [],
    icons = {},
    indicator = true,
    select,
    selected,
    sort = 'default',
    state = reactive({ selected: selected ?? '' }),
    toggle,
    ...attributes
}: A) => {
    let all = folders(elements),
        initial = new Set([...expanded, ...(state.selected ? path(elements, state.selected) ?? [] : [])]),
        close = icons.close ?? ICONS.close,
        file = icons.file ?? ICONS.file,
        open = reactive(
            Object.fromEntries( all.map((element) => [element.id, initial.has(element.id)]) ) as Record<string, boolean>
        ),
        opened = icons.open ?? ICONS.open,
        root: HTMLElement | undefined,
        ui = reactive({ any: initial.size > 0 });

    function choose(element: Element) {
        state.selected = element.id;
        select?.(element.id);
    }

    function flip(id: string, value: boolean) {
        open[id] = value;
        ui.any = all.some((element) => open[element.id]);
    }

    function render(elements: Element[]): Renderable<unknown> {
        return elements.map((element) => {
            let disabled = element.selectable === false,
                id = element.id;

            if (!folder(element)) {
                return html`
                    <button
                        class='file-tree-trigger file-tree-file ${() => state.selected === id && '--active'}'
                        data-id='${id}'
                        disabled='${disabled}'
                        onclick='${() => choose(element)}'
                        type='button'
                        ${{ 'aria-current': () => state.selected === id && 'true' }}
                    >
                        ${file()}
                        <span class='file-tree-name'>${element.name}</span>
                    </button>
                `;
            }

            return html`
                <div class='file-tree-folder'>
                    <button
                        class='file-tree-trigger ${() => state.selected === id && '--active'}'
                        data-id='${id}'
                        disabled='${disabled}'
                        onclick='${() => {
                            choose(element);
                            flip(id, !open[id]);
                        }}'
                        type='button'
                        ${{
                            'aria-current': () => state.selected === id && 'true',
                            'aria-expanded': () => open[id] ? 'true' : 'false'
                        }}
                    >
                        ${() => open[id] ? opened() : close()}
                        <span class='file-tree-name'>${element.name}</span>
                    </button>

                    <div class='file-tree-content ${() => open[id] && '--active'}' ${{ inert: () => !open[id] }}>
                        <div class='file-tree-clip'>
                            ${indicator && html`<div aria-hidden='true' class='file-tree-indicator'></div>`}
                            <div class='file-tree-group' role='group'>
                                ${render(element.children ?? [])}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // Every trigger a user can currently reach, in visual order.
    function reachable() {
        if (!root) {
            return [];
        }

        return Array.from(root.querySelectorAll<HTMLButtonElement>('.file-tree-trigger'))
            .filter((button) => !button.disabled && !button.closest('[inert]'));
    }

    return html`
        <div
            class='file-tree'
            ${attributes}
            ${{
                onkeydown: (event: KeyboardEvent) => {
                    let current = (event.target as HTMLElement).closest<HTMLButtonElement>('.file-tree-trigger');

                    if (!current) {
                        return;
                    }

                    let buttons = reachable(),
                        id = current.dataset.id!,
                        index = buttons.indexOf(current),
                        target: HTMLButtonElement | undefined;

                    switch (event.key) {
                        case 'ArrowDown':
                            target = buttons[index + 1];
                            break;
                        case 'ArrowUp':
                            target = buttons[index - 1];
                            break;
                        case 'End':
                            target = buttons[buttons.length - 1];
                            break;
                        case 'Home':
                            target = buttons[0];
                            break;
                        case 'ArrowLeft':
                        case 'ArrowRight': {
                            // Arrows point into and out of folders; flipped for right-to-left layouts.
                            let rtl = getComputedStyle(current).direction === 'rtl',
                                inward = (event.key === 'ArrowRight') !== rtl;

                            if (id in open && inward) {
                                if (open[id]) {
                                    target = buttons[index + 1];
                                }
                                else {
                                    flip(id, true);
                                }
                            }
                            else if (id in open && open[id]) {
                                flip(id, false);
                            }
                            else if (!inward) {
                                target = current.parentElement?.closest('.file-tree-folder')?.querySelector<HTMLButtonElement>(':scope > .file-tree-trigger') ?? undefined;
                            }
                            break;
                        }
                        default:
                            return;
                    }

                    event.preventDefault();
                    target?.focus();
                },
                onrender: (element: HTMLElement) => {
                    root = element;
                }
            }}
        >
            <div class='file-tree-viewport'>
                <div class='file-tree-group'>
                    ${render(arrange(elements, sort))}
                </div>
            </div>

            ${toggle && html`
                <button
                    class='file-tree-toggle'
                    onclick='${() => {
                        let value = !ui.any;

                        for (let i = 0, n = all.length; i < n; i++) {
                            let element = all[i];

                            // Locked folders stay shut, matching how a click on them does nothing.
                            if (element.selectable !== false && element.children?.length) {
                                open[element.id] = value;
                            }
                            else if (!value) {
                                open[element.id] = false;
                            }
                        }

                        ui.any = all.some((element) => open[element.id]);
                    }}'
                    type='button'
                >
                    ${() => ui.any ? 'Collapse all' : 'Expand all'}
                </button>
            `}
        </div>
    `;
};

export type { Element as FileTreeElement, Sort as FileTreeSort, State as FileTreeState };
