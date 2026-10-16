import { flush, onCleanup, reactive, read, root, signal, untrack } from '@esportsplus/reactivity';
import { component, html, render, type Attributes, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import type { Controller } from '~/components/tooltip/menu';
import { observe } from '~/shared/resize';
import manager, { type Active, type Point, type Target } from './dnd';
import { group, launcher, title, type Catalog, type Context, type Kind } from './group';
import state, { allGroups, bounded, findGroup, MIN_FRACTION, type Group, type Layout, type Node, type Split, type Surface } from './model';
import { resize, resized } from './resize';
import subtree from './subtree';
import './scss/index.scss';


type A = Attributes & {
    catalog: Catalog;
    onconnect?: never;
    state: ReturnType<typeof state>;
};

type Host = { dispose: VoidFunction; element: HTMLElement };

type Side = 'bottom' | 'left' | 'right' | 'top';


// A collapsed sibling of a maximized group keeps this much (px) to click back into.
const COLLAPSED = 80;

// Where a tab dropped on a group's edge goes: beside it along the axis, before or after it.
const EDGES = {
    bottom: ['column', 'after'],
    left: ['row', 'before'],
    right: ['row', 'after'],
    top: ['column', 'before']
} as const;


function contains(node: Node, id: string): boolean {
    return node.kind === 'group' ? node.id === id : node.children.some((child) => contains(child, id));
}

// The groups on one side of the dock, as their own tree: every split keeps its children there, resized to share what
// the dropped ones leave.
function filter(node: Node | null, keep: (group: Group) => boolean): Node | null {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        return keep(node) ? node : null;
    }

    let entries = node.children.flatMap((child, i) => {
        let kept = filter(child, keep);

        return kept === null ? [] : [{ node: kept, size: node.sizes[i] ?? 0 }];
    });

    if (entries.length === 0) {
        return null;
    }

    if (entries.length === 1) {
        return entries[0].node;
    }

    let total = entries.reduce((sum, entry) => sum + entry.size, 0);

    return {
        ...node,
        children: entries.map((entry) => entry.node),
        sizes: entries.map((entry) => total > 0 ? entry.size / total : 1 / entries.length)
    };
}

function find(node: Node | null, id: string): Node | null {
    if (node === null || node.id === id) {
        return node;
    }

    if (node.kind === 'group') {
        return null;
    }

    for (let i = 0, n = node.children.length; i < n; i++) {
        let found = find(node.children[i], id);

        if (found) {
            return found;
        }
    }

    return null;
}

function findSurface(node: Node | null, id: string) {
    for (let group of allGroups(node)) {
        let surface = group.surfaces.find((entry) => entry.id === id);

        if (surface) {
            return surface;
        }
    }

    return null;
}

// Every surface that should own a place on screen: the whole stack of a scrolling group, the active surface of any
// other, on whichever sides are showing.
function mounted(layout: Layout) {
    let ids = new Set<string>();

    for (let group of allGroups(layout.root)) {
        if (group.placement === 'bottom' && !layout.bottom.open) {
            continue;
        }

        if (group.scrollable) {
            for (let surface of group.surfaces) {
                ids.add(surface.id);
            }
        }
        else if (group.active !== null) {
            ids.add(group.active);
        }
    }

    return ids;
}

// Inside its group's tab strip the pointer drops a tab among the tabs; anywhere else in the group it targets the half
// toward the nearest edge, which splits the group there. Over the bottom strip, a tab docks.
function collide(_: Active, pointer: Point, targets: Target[]) {
    let inside = (target: Target) => {
            let { bottom, left, right, top } = target.rect;

            return pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;
        },
        dock = targets.find((target) => target.data.kind === 'dock' && inside(target));

    if (dock) {
        return dock.id;
    }

    let container = targets.find((target) => target.data.kind === 'group' && inside(target));

    if (!container) {
        return null;
    }

    if (pointer.y <= (container.data.strip as () => number)()) {
        return container.id;
    }

    let { height, left, top, width } = container.rect,
        x = width <= 0 ? 0.5 : (pointer.x - left) / width,
        y = height <= 0 ? 0.5 : (pointer.y - top) / height,
        side = ([['left', x], ['right', 1 - x], ['top', y], ['bottom', 1 - y]] as [Side, number][])
            .reduce((nearest, candidate) => candidate[1] < nearest[1] ? candidate : nearest)[0];

    return targets.find((target) => target.data.kind === 'edge' && target.data.group === container.data.group && target.data.side === side)?.id
        ?? container.id;
}

// The tab position under the pointer: past every tab whose middle it has crossed, the dragged tab aside.
function position(strip: HTMLElement, dragged: HTMLElement, x: number) {
    let index = 0,
        tabs = strip.querySelectorAll<HTMLElement>('.panels-tab');

    for (let i = 0, n = tabs.length; i < n; i++) {
        let tab = tabs[i];

        if (tab === dragged) {
            continue;
        }

        let { left, width } = tab.getBoundingClientRect();

        if (x > left + width / 2) {
            index++;
        }
    }

    return index;
}

// The parts of the tree a layout change rebuilds: kinds, ids and order, group membership, placement and stacking.
// Sizes, the active tab and group, maximizing and the dock's size bind in place instead.
function structure(node: Node | null): unknown {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        return [node.id, node.placement ?? '', node.scrollable === true, node.surfaces.map((surface) => surface.id)];
    }

    return [node.id, node.direction, node.children.map(structure)];
}


// Tabbed groups of surfaces in resizable splits. Tabs drag to reorder, into another group, onto a group's edge to
// split beside it, or onto the bottom strip to dock; an empty group offers the catalog. A surface's content is
// rendered once and moved, never rebuilt, so it keeps its state across every layout change until its tab closes.
const panels = component(
    function({ catalog, state, ...attributes }: A) {
        let adding: Controller | undefined,
            controller: Controller | undefined,
            heights = signal<Record<string, number>>({}),
            hosts = new Map<string, Host>(),
            parking = document.createElement('div'),
            size = reactive({ height: 0 }),
            slots = new Map<string, HTMLElement>(),
            subject = reactive({ group: '', surface: '' }),
            unobserve: VoidFunction | undefined,
            workspace: HTMLElement | undefined;

        let drag = manager({
            collide,
            end: (active, over, pointer) => {
                if (!over) {
                    return;
                }

                let data = over.data,
                    surface = active.data.surface as string;

                if (data.kind === 'dock') {
                    state.dock(surface);
                    return;
                }

                let target = data.group as string;

                if (data.kind === 'group') {
                    state.move(surface, target, position(over.node, active.node, pointer.x));
                    return;
                }

                let source = active.data.group as string,
                    [direction, side] = EDGES[data.side as Side];

                if (source === target && findGroup(state.layout.root, target)?.surfaces.length === 1) {
                    return;
                }

                if (data.scrollable) {
                    state.move(surface, target);
                }
                else {
                    state.split(surface, target, direction, side);
                }
            },
            label: (active) => {
                let surface = findSurface(state.layout.root, active.id);

                return surface ? title(context, surface) : '';
            }
        });

        let context: Context = {
            add(kind: string, group?: string) {
                let entry = catalog[kind];

                if (!entry) {
                    return;
                }

                let id = kind;

                if (entry.multiple) {
                    let taken = new Set(allGroups(state.layout.root).flatMap((group) => group.surfaces.map((surface) => surface.id))),
                        n = 1;

                    while (taken.has(id = `${kind}-${n}`)) {
                        n++;
                    }
                }

                state.open({ id, kind }, group);
            },
            catalog,
            choose(e: MouseEvent, group: string) {
                if (!adding) {
                    return;
                }

                let { bottom, left } = (e.currentTarget as HTMLElement).getBoundingClientRect();

                subject.group = group;
                flush();
                adding.open({ x: left, y: bottom });
            },
            heights,
            manager: drag,
            menu(e: MouseEvent, group: string, surface: string) {
                if (!controller) {
                    return;
                }

                e.preventDefault();
                subject.group = group;
                subject.surface = surface;
                flush();
                controller.open(e.button === 2 ? { x: e.clientX, y: e.clientY } : undefined);
            },
            slot: (surface: string) => html`
                <div
                    class='panels-slot'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            slots.set(surface, element);
                            attach(surface, element);
                        },
                        ondisconnect: () => {
                            if (slots.get(surface)?.isConnected === false) {
                                slots.delete(surface);
                            }
                        }
                    }}
                ></div>
            `,
            state
        };

        parking.className = 'panels-parking';

        function attach(surface: string, slot: HTMLElement) {
            let host = hosts.get(surface);

            if (!host) {
                return;
            }

            // A slot connects before the rebuilt tree is in the document; the host waits so it is moved, not removed.
            if (!slot.isConnected) {
                queueMicrotask(() => slot.isConnected && attach(surface, slot));
                return;
            }

            move(host.element, slot);
        }

        function ensure(surface: string) {
            if (hosts.has(surface)) {
                return;
            }

            let found = findSurface(state.layout.root, surface),
                kind = found && catalog[found.kind];

            if (!found || !kind) {
                return;
            }

            let element = document.createElement('div'),
                entry = found,
                // Owned by no effect: the host outlives whichever layout pass created it.
                release = untrack(() => root(() => render(element, () => kind.render(entry))));

            element.className = 'panels-host';
            element.dataset.surface = surface;
            hosts.set(surface, { dispose: release, element });
        }

        // Moving a connected node keeps its focus, scroll and frames; appending would reload an iframe.
        function move(element: HTMLElement, target: HTMLElement) {
            if (element.parentElement === target) {
                return;
            }

            if ('moveBefore' in target && element.isConnected && target.isConnected) {
                (target as HTMLElement & { moveBefore: (node: ChildNode, child: null) => void }).moveBefore(element, null);
                return;
            }

            let focused = document.activeElement;

            target.append(element);

            if (focused instanceof HTMLElement && element.contains(focused)) {
                focused.focus({ preventScroll: true });
            }
        }

        function park() {
            if (workspace && parking.parentElement !== workspace) {
                workspace.append(parking);
            }

            for (let host of hosts.values()) {
                move(host.element, parking);
            }
        }

        // Hiding a surface or picking another tab keeps its host parked; only closing it releases its content.
        function sync(layout: Layout, attaching: boolean) {
            let shown = mounted(layout);

            for (let [surface, host] of hosts) {
                if (findSurface(layout.root, surface)) {
                    if (!shown.has(surface)) {
                        move(host.element, parking);
                    }

                    continue;
                }

                host.dispose();
                host.element.remove();
                hosts.delete(surface);
                slots.delete(surface);
            }

            for (let surface of shown) {
                ensure(surface);

                let slot = slots.get(surface);

                if (attaching && slot) {
                    attach(surface, slot);
                }
            }
        }

        function handle(axis: 'x' | 'y', sizes: () => number[], index: number, length: () => number, apply: (sizes: number[]) => void, hidden?: () => boolean) {
            return html`
                <div
                    aria-orientation='${axis === 'x' ? 'vertical' : 'horizontal'}'
                    class='panels-handle panels-handle--${axis}'
                    role='separator'
                    ${resize(axis, () => {
                        let from = sizes(),
                            total = length();

                        return (delta) => apply(resized(from, index, delta, total, MIN_FRACTION));
                    })}
                    ${{ hidden: () => hidden?.() ?? false }}
                ></div>
            `;
        }

        function node(current: Node): Renderable<unknown> {
            if (current.kind === 'group') {
                let id = current.id;

                return group(context, () => {
                    let layout = state.layout,
                        found = find(layout.root, id);

                    return { group: found?.kind === 'group' ? found : current, layout };
                });
            }

            return split(current);
        }

        function split(current: Split) {
            let axis = current.direction === 'row' ? 'x' as const : 'y' as const,
                box = reactive({ length: 0 }),
                unobserve: VoidFunction | undefined;

            function sizes() {
                let found = find(state.layout.root, current.id);

                return found?.kind === 'split' ? [...found.sizes] : [...current.sizes];
            }

            return html`
                <div
                    class='panels-split panels-split--${current.direction}'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            unobserve = observe(element, ([entry]) => {
                                box.length = axis === 'x' ? entry.contentRect.width : entry.contentRect.height;
                            });
                        },
                        ondisconnect: () => unobserve?.()
                    }}
                >
                    ${current.children.map((child, index) => html`
                        <div
                            class='panels-pane'
                            ${{
                                style: () => {
                                    let maximized = state.layout.maximized;

                                    if (maximized === null || !contains(current, maximized)) {
                                        return `flex: 0 0 ${(sizes()[index] ?? 0) * 100}%;`;
                                    }

                                    return contains(current.children[index], maximized)
                                        ? `flex: 0 0 calc(100% - ${(current.children.length - 1) * COLLAPSED}px);`
                                        : `flex: 0 0 ${COLLAPSED}px;`;
                                }
                            }}
                        >
                            ${node(child)}
                        </div>
                        ${index < current.children.length - 1 && handle(axis, sizes, index, () => box.length, (next) => state.resize(current.id, next))}
                    `)}
                </div>
            `;
        }

        function tree(): Renderable<unknown> {
            let layout = state.layout,
                docked = layout.bottom.open ? filter(layout.root, (group) => group.placement === 'bottom') : null,
                main = filter(layout.root, (group) => group.placement !== 'bottom');

            return html`
                <div class='panels-main'>
                    ${main ? node(main) : launcher(context)}
                </div>
                ${docked && html`
                    ${handle(
                        'y',
                        () => {
                            let share = bounded(state.layout.bottom.size);

                            return [1 - share, share];
                        },
                        0,
                        () => size.height,
                        (next) => state.resizeBottom(next[1]),
                        () => state.layout.bottom.maximized
                    )}
                    <div
                        class='panels-dock'
                        ${{
                            class: () => state.layout.bottom.maximized && 'panels-dock--maximized',
                            style: () => `flex: 0 0 ${bounded(state.layout.bottom.size) * 100}%;`
                        }}
                    >
                        ${node(docked)}
                    </div>
                `}
            `;
        }

        let items = [
                { label: 'Close', onselect: () => state.close(subject.surface) },
                {
                    hidden: () => (findGroup(state.layout.root, subject.group)?.surfaces.length ?? 0) <= 1,
                    label: 'Close Others',
                    onselect: () => state.closeOthers(subject.group, subject.surface)
                },
                {
                    hidden: () => {
                        let surfaces = findGroup(state.layout.root, subject.group)?.surfaces ?? [];

                        return surfaces.findIndex((surface) => surface.id === subject.surface) >= surfaces.length - 1;
                    },
                    label: 'Close to the Right',
                    onselect: () => state.closeRight(subject.group, subject.surface)
                },
                { label: 'Close All', onselect: () => state.closeGroup(subject.group) }
            ],
            last = '',
            stop = drag.overlay();

        onCleanup(() => {
            stop();
            drag.dispose();

            for (let host of hosts.values()) {
                host.dispose();
            }

            hosts.clear();
            slots.clear();
            parking.remove();
        });

        return html`
            <div
                class='panels'
                ${attributes}
                ${{
                    class: () => read(drag.active) && 'panels--dragging',
                    onconnect: (element: HTMLElement) => {
                        workspace = element;
                        element.append(parking);
                        unobserve = observe(element, ([entry]) => {
                            size.height = entry.contentRect.height;
                        });
                    },
                    ondisconnect: () => unobserve?.()
                }}
            >
                ${subtree(
                    () => {
                        let layout = state.layout,
                            key = JSON.stringify([layout.bottom.open, structure(layout.root)]),
                            changed = key !== last;

                        if (changed) {
                            park();
                        }

                        sync(layout, !changed);
                        last = key;

                        return key;
                    },
                    tree,
                    { class: 'panels-tree' }
                )}
                <div
                    aria-hidden='true'
                    class='panels-dock-target'
                    ${drag.droppable(() => ({ data: { kind: 'dock' }, id: 'dock' }))}
                ></div>
                ${tooltip.context(
                    {
                        class: 'panels-menu',
                        controller: (value: Controller) => {
                            adding = value;
                        },
                        items: Object.entries(catalog).map(([kind, entry]) => ({
                            ...(entry.icon ? { icon: () => icon({ 'aria-hidden': 'true' }, entry.icon!) } : {}),
                            label: typeof entry.title === 'function' ? entry.title({ id: '', kind }) : entry.title,
                            onselect: () => context.add(kind, subject.group)
                        })),
                        [tooltip.context.panel]: { 'aria-label': 'Add panel' }
                    },
                    ''
                )}
                ${tooltip.context(
                    {
                        class: 'panels-menu',
                        controller: (value: Controller) => {
                            controller = value;
                        },
                        items,
                        [tooltip.context.panel]: { 'aria-label': 'Tab actions' }
                    },
                    ''
                )}
            </div>
        `;
    }
);


export default Object.assign(panels, { state });
export type { Catalog, Kind, Layout, Node, Surface };
