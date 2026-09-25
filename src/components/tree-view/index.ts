import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    nodes: Node[];
    open?: string[];
    selected?: string;
    state?: { selected: string };
};

type Item = {
    folder: boolean;
    id: string;
    name: string;
    parent: string | null;
};

type Node = {
    children?: Node[];
    name: string;
};


// Long enough to type "pa" at a normal pace, short enough that a fresh
// letter a moment later starts a new search.
const TYPEAHEAD_RESET = 500;


function folders(nodes: Node[], parent: string | null, out: string[]) {
    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        if (node.children) {
            let id = join(parent, node.name);

            out.push(id);
            folders(node.children, id, out);
        }
    }

    return out;
}

function join(parent: string | null, name: string) {
    return parent ? `${parent}/${name}` : name;
}

function parentOf(id: string) {
    let i = id.lastIndexOf('/');

    return i === -1 ? null : id.slice(0, i);
}

// The rows a keyboard user can reach: everything not inside a closed folder.
function visible(nodes: Node[], open: Record<string, boolean>, parent: string | null, out: Item[]) {
    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i],
            id = join(parent, node.name);

        out.push({ folder: !!node.children, id, name: node.name, parent });

        if (node.children && open[id]) {
            visible(node.children, open, id, out);
        }
    }

    return out;
}


export default component<A>(
    function({ nodes, open: initial = [], selected, state = reactive({ selected: selected ?? '' }), ...attributes }: A) {
        let highlights = new Map<string, HTMLElement>(),
            ids = folders(nodes, null, []),
            items = new Map<string, HTMLElement>(),
            open = reactive(
                Object.fromEntries( ids.map((id) => [id, initial.includes(id)]) )
            ),
            // A folder clips its rows only while they move; once open it stops
            // clipping so the highlight can glide in from a row outside it.
            settled = reactive(
                Object.fromEntries( ids.map((id) => [id, initial.includes(id)]) )
            ),
            reachable = visible(nodes, open, null, []),
            typed = '',
            typedAt = 0,
            ui = reactive({
                focused: reachable.some((item) => item.id === state.selected) ? state.selected : (reachable[0]?.id ?? '')
            });

        function activate(item: Item) {
            if (item.folder) {
                toggle(item.id, !open[item.id]);
                return;
            }

            glide(state.selected, item.id);
            state.selected = item.id;
        }

        function focus(id: string) {
            ui.focused = id;
            items.get(id)?.focus();
        }

        // FLIP: start the new highlight where the old one sits, then let it
        // transition home. Rows share one width, so it is a pure translate.
        function glide(from: string, to: string) {
            let a = highlights.get(from),
                b = highlights.get(to);

            if (!a || !b || a === b) {
                return;
            }

            b.style.transition = 'none';
            b.style.translate = `0 ${a.getBoundingClientRect().top - b.getBoundingClientRect().top}px`;
            b.getBoundingClientRect();
            b.style.transition = '';
            b.style.translate = '';
        }

        function render(nodes: Node[], depth: number, parent: string | null): Renderable<unknown> {
            return nodes.map((node) => {
                let id = join(parent, node.name),
                    item: Item = { folder: !!node.children, id, name: node.name, parent };

                return html`
                    <li
                        class='tree-view-item'
                        role='treeitem'
                        style='--tree-view-depth: ${depth}'
                        ${item.folder
                            ? { 'aria-expanded': () => open[id] ? 'true' : 'false' }
                            : { 'aria-selected': () => state.selected === id ? 'true' : 'false' }}
                        ${{
                            onfocus: () => {
                                ui.focused = id;
                            },
                            onrender: (element: HTMLElement) => {
                                items.set(id, element);
                            },
                            tabindex: () => ui.focused === id ? 0 : -1
                        }}
                    >
                        <div
                            class='tree-view-row ${item.folder ? 'tree-view-row--folder' : ''} ${() => state.selected === id && '--active'}'
                            onclick='${() => activate(item)}'
                        >
                            <span class='tree-view-highlight' ${{ onrender: (element: HTMLElement) => { highlights.set(id, element); } }}></span>
                            <span class='tree-view-chevron ${() => item.folder && open[id] && '--active'}'>
                                ${item.folder && html`
                                    <svg viewBox='0 0 16 16' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'>
                                        <path d='m6 4 4 4-4 4' />
                                    </svg>
                                `}
                            </span>
                            <svg class='tree-view-icon' viewBox='0 0 16 16' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'>
                                <path d='${item.folder
                                    ? 'M2.25 4.5A1.25 1.25 0 0 1 3.5 3.25h2.6l1.4 1.5h5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-9A1.25 1.25 0 0 1 2.25 11.5z'
                                    : 'M4.25 2.25h4.5l3 3v7.25a1.25 1.25 0 0 1-1.25 1.25h-6.25A1.25 1.25 0 0 1 3 12.5v-9a1.25 1.25 0 0 1 1.25-1.25zM8.5 2.5v3h3'}' />
                            </svg>
                            <span class='tree-view-name'>${node.name}</span>
                        </div>

                        ${node.children && html`
                            <div
                                class='tree-view-group ${() => open[id] && '--active'} ${() => settled[id] && '--settled'}'
                                ${{
                                    inert: () => !open[id],
                                    ontransitionend: function(this: HTMLElement, event: TransitionEvent) {
                                        if (event.target === this && event.propertyName === 'grid-template-rows' && open[id]) {
                                            settled[id] = true;
                                        }
                                    }
                                }}
                            >
                                <ul class='tree-view-group-content ${() => parentOf(state.selected) === id && '--active'}' role='group'>
                                    ${render(node.children, depth + 1, id)}
                                </ul>
                            </div>
                        `}
                    </li>
                `;
            });
        }

        function toggle(id: string, value: boolean) {
            open[id] = value;
            settled[id] = false;
        }

        function typeahead(key: string, from: number, reachable: Item[]) {
            let now = performance.now(),
                next = (now - typedAt > TYPEAHEAD_RESET ? '' : typed) + key.toLowerCase(),
                // Repeating one letter cycles through the items that start with it.
                repeat = [...next].every((c) => c === next[0]),
                start = repeat ? from + 1 : from;

            typed = repeat ? next[0] : next;
            typedAt = now;

            for (let i = 0, n = reachable.length; i < n; i++) {
                let item = reachable[(start + i) % n];

                if (item.name.toLowerCase().startsWith(typed)) {
                    focus(item.id);
                    return;
                }
            }
        }

        return html`
            <ul
                class='tree-view'
                role='tree'
                ${attributes}
                ${{
                    onkeydown: (event: KeyboardEvent) => {
                        let reachable = visible(nodes, open, null, []),
                            index = reachable.findIndex((item) => item.id === ui.focused),
                            item = reachable[index];

                        if (!item) {
                            return;
                        }

                        let target: Item | undefined;

                        switch (event.key) {
                            case 'ArrowDown':
                                target = reachable[index + 1];
                                break;
                            case 'ArrowUp':
                                target = reachable[index - 1];
                                break;
                            case 'Home':
                                target = reachable[0];
                                break;
                            case 'End':
                                target = reachable[reachable.length - 1];
                                break;
                            case 'ArrowRight':
                                if (item.folder && open[item.id]) {
                                    target = reachable[index + 1];
                                }
                                else if (item.folder) {
                                    toggle(item.id, true);
                                }
                                break;
                            case 'ArrowLeft':
                                if (item.folder && open[item.id]) {
                                    toggle(item.id, false);
                                }
                                else if (item.parent) {
                                    focus(item.parent);
                                }
                                break;
                            case 'Enter':
                            case ' ':
                                activate(item);
                                break;
                            default:
                                if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
                                    return;
                                }

                                typeahead(event.key, index, reachable);
                        }

                        if (target) {
                            focus(target.id);
                        }

                        event.preventDefault();
                    }
                }}
            >
                ${render(nodes, 0, null)}
            </ul>
        `;
    }
);
