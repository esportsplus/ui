import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    expanded?: string[];
    label: string;
    nodes: Node[];
    select?: (id: string) => void;
    selected?: string;
    toggle?: (id: string, expanded: boolean) => void;
};

type Node = {
    children?: Node[];
    id: string;
    label: string;
    meta?: Renderable<unknown>;
};


function flatten(nodes: Node[], parent: Node | null, index: Map<string, { node: Node, parent: Node | null }>) {
    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        index.set(node.id, { node, parent });

        if (node.children) {
            flatten(node.children, node, index);
        }
    }

    return index;
}

function visible(nodes: Node[], expanded: Record<string, boolean>, out: Node[] = []) {
    for (let i = 0, n = nodes.length; i < n; i++) {
        let node = nodes[i];

        out.push(node);

        if (node.children?.length && expanded[node.id]) {
            visible(node.children, expanded, out);
        }
    }

    return out;
}


export default component<A>(
    function({ expanded: open = [], label, nodes, select, selected: initial, toggle, ...attributes }) {
        let index = flatten(nodes, null, new Map()),
            ids = [...index.keys()],
            expanded = reactive(
                Object.fromEntries( ids.map((id) => [id, open.includes(id)]) )
            ),
            selected = reactive(
                Object.fromEntries( ids.map((id) => [id, id === initial]) )
            ),
            state = {
                focused: visible(nodes, expanded).some((node) => node.id === initial) ? initial! : (nodes[0]?.id ?? ''),
                selected: initial ?? ''
            },
            tabbable = reactive(
                Object.fromEntries( ids.map((id) => [id, id === state.focused]) )
            );

        function activate(id: string) {
            let entry = index.get(id)!;

            if (state.selected !== id) {
                if (state.selected) {
                    selected[state.selected] = false;
                }

                selected[id] = true;
                state.selected = id;
                select?.(id);
            }

            if (entry.node.children?.length) {
                set(id, !expanded[id]);
            }
        }

        function focus(root: HTMLElement, id: string) {
            root.querySelector<HTMLElement>(`.tree-row[data-id="${CSS.escape(id)}"]`)?.focus();
        }

        function set(id: string, value: boolean) {
            if (expanded[id] === value) {
                return;
            }

            expanded[id] = value;
            toggle?.(id, value);
        }

        function render(nodes: Node[], depth: number): Renderable<unknown> {
            return nodes.map((node, i) => {
                let branch = !!node.children?.length,
                    id = node.id;

                return html`
                    <div class='tree-item' role='none'>
                        <div
                            class='tree-row ${() => selected[id] && '--active'}'
                            role='treeitem'
                            aria-level='${depth}'
                            aria-posinset='${i + 1}'
                            aria-setsize='${nodes.length}'
                            data-id='${id}'
                            ${branch ? { 'aria-expanded': () => expanded[id] ? 'true' : 'false' } : undefined}
                            ${{
                                'aria-selected': () => selected[id] ? 'true' : 'false',
                                tabindex: () => tabbable[id] ? 0 : -1
                            }}
                        >
                            ${branch
                                ? html`
                                    <span class='tree-caret ${() => expanded[id] && '--active'}' aria-hidden='true'>
                                        <svg viewBox='0 0 10 10'><path d='M3.5 2 6.5 5 3.5 8' /></svg>
                                    </span>
                                `
                                : html`<span class='tree-caret' aria-hidden='true'></span>`}
                            <span class='tree-label'>${node.label}</span>
                            ${node.meta !== undefined && html`<span class='tree-meta'>${node.meta}</span>`}
                        </div>

                        ${branch && html`
                            <div
                                class='tree-group ${() => expanded[id] && '--active'}'
                                role='group'
                                ${{ inert: () => !expanded[id] }}
                            >
                                <div class='tree-group-content'>
                                    ${render(node.children!, depth + 1)}
                                </div>
                            </div>
                        `}
                    </div>
                `;
            });
        }

        return html`
            <div
                class='tree'
                role='tree'
                aria-label='${label}'
                ${attributes}
                ${{
                    onclick: (event: MouseEvent) => {
                        let row = (event.target as HTMLElement).closest<HTMLElement>('.tree-row'),
                            root = row?.closest<HTMLElement>('.tree');

                        if (!row || !root) {
                            return;
                        }

                        focus(root, row.dataset.id!);
                        activate(row.dataset.id!);
                    },
                    onfocusin: (event: FocusEvent) => {
                        let id = (event.target as HTMLElement).closest<HTMLElement>('.tree-row')?.dataset.id;

                        if (id === undefined || id === state.focused) {
                            return;
                        }

                        tabbable[state.focused] = false;
                        tabbable[id] = true;
                        state.focused = id;
                    },
                    onkeydown: (event: KeyboardEvent) => {
                        let root = (event.target as HTMLElement).closest<HTMLElement>('.tree');

                        if (!root || !index.has(state.focused)) {
                            return;
                        }

                        let entry = index.get(state.focused)!,
                            id = state.focused,
                            rows = visible(nodes, expanded),
                            position = rows.indexOf(entry.node),
                            target: string | undefined;

                        switch (event.key) {
                            case 'ArrowDown':
                                target = rows[position + 1]?.id;
                                break;
                            case 'ArrowUp':
                                target = rows[position - 1]?.id;
                                break;
                            case 'ArrowRight':
                                if (!entry.node.children?.length) {
                                    break;
                                }

                                if (expanded[id]) {
                                    target = entry.node.children[0].id;
                                }
                                else {
                                    set(id, true);
                                }
                                break;
                            case 'ArrowLeft':
                                if (entry.node.children?.length && expanded[id]) {
                                    set(id, false);
                                }
                                else {
                                    target = entry.parent?.id;
                                }
                                break;
                            case 'End':
                                target = rows[rows.length - 1]?.id;
                                break;
                            case 'Enter':
                            case ' ':
                                activate(id);
                                break;
                            case 'Home':
                                target = rows[0]?.id;
                                break;
                            default: {
                                if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
                                    return;
                                }

                                let key = event.key.toLowerCase();

                                for (let i = 1, n = rows.length; i < n; i++) {
                                    let row = rows[(position + i) % n];

                                    if (row.label.toLowerCase().startsWith(key)) {
                                        target = row.id;
                                        break;
                                    }
                                }
                            }
                        }

                        event.preventDefault();

                        if (target !== undefined) {
                            focus(root, target);
                        }
                    }
                }}
            >
                ${render(nodes, 1)}
            </div>
        `;
    }
);

export type { Node };
