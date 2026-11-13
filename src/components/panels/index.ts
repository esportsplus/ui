import { flush, onCleanup, reactive, read, root, signal, untrack, write } from '@esportsplus/reactivity';
import { component, html, render, setProperties, type Attributes, type Element as Bound, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import type { Controller } from '~/components/tooltip/menu';
import { mac } from '~/shared/platform';
import { observe } from '~/shared/resize';
import manager, { type Active, type Point, type Target } from './dnd';
import { group, launcher, title, type Catalog, type Context, type Kind } from './group';
import state, { allGroups, bounded, contains, docked, findGroup, MIN_FRACTION, stationary, type Group, type Layout, type Node, type Placement, type Saved, type Split, type Store, type Surface } from './model';
import { resize, resized } from './resize';
import { frame, grip, NARROW, resizer, sidebar, toggle, type Edge, type Options, type Sidebars } from './sidebar';
import subtree from './subtree';
import './scss/index.scss';


type A = Attributes & {
    catalog: Catalog;
    // Tabs show their kind's icon alone, closing from their menu.
    icons?: boolean;
    onconnect?: never;
    // Each sidebar's label, whether it peeks while the pointer rests on its edge, and whether it resizes.
    sidebars?: Partial<Record<Edge, Options>>;
    state: ReturnType<typeof state>;
};

type Host = { dispose: VoidFunction; element: HTMLElement };

type Shown = Record<Placement | 'main', Node | null>;

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


// The groups of one dock or the main area, as their own tree: every split keeps its children there, resized to share what
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

// Every surface that should own a place on screen: the active surface of each group showing. A closed sidebar's
// groups stay mounted, so it slides out with its content in place.
function mounted(layout: Layout) {
    let ids = new Set<string>(),
        trees = shown(layout);

    for (let group of [trees.bottom, trees.left, trees.main, trees.right].flatMap(allGroups)) {
        if (group.active !== null) {
            ids.add(group.active);
        }
    }

    return ids;
}

// Inside its group's tab strip the pointer drops a tab among the tabs; anywhere else in the group it targets the half
// toward the nearest edge, which splits the group there. Over a strip along the layout's edge, a tab docks. A static
// group only splits.
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

    if (!container.data.fixed && pointer.y <= (container.data.strip as () => number)()) {
        return container.id;
    }

    let { height, left, top, width } = container.rect,
        x = width <= 0 ? 0.5 : (pointer.x - left) / width,
        y = height <= 0 ? 0.5 : (pointer.y - top) / height,
        side = ([['left', x], ['right', 1 - x], ['top', y], ['bottom', 1 - y]] as [Side, number][])
            .reduce((nearest, candidate) => candidate[1] < nearest[1] ? candidate : nearest)[0];

    return targets.find((target) => target.data.kind === 'edge' && target.data.group === container.data.group && target.data.side === side)?.id
        ?? (container.data.fixed ? null : container.id);
}

// The group at a tree's top corner on 'edge': the first child down each split, but a row's last toward the right.
function corner(node: Node | null, edge: Edge): Group | null {
    if (node === null || node.kind === 'group') {
        return node;
    }

    return corner((edge === 'right' && node.direction === 'row' ? node.children.at(-1) : node.children[0]) ?? null, edge);
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

// What the layout shows: under a zoom, its groups fill the main area together, docked or not; otherwise the main
// groups, the bottom dock's below them while it is open, and each sidebar's on its edge, open or not.
function shown(layout: Layout): Shown {
    let zoom = layout.zoom.at(-1);

    if (zoom) {
        let ids = new Set(zoom);

        return { bottom: null, left: null, main: filter(layout.root, (group) => ids.has(group.id)), right: null };
    }

    return {
        bottom: layout.bottom.open ? filter(layout.root, (group) => docked(group, 'bottom')) : null,
        left: filter(layout.root, (group) => docked(group, 'left')),
        main: filter(layout.root, (group) => group.placement === undefined),
        right: filter(layout.root, (group) => docked(group, 'right'))
    };
}

// The parts of the tree a layout change rebuilds: kinds, ids and order, group membership and placement.
// Sizes, the active tab and group, maximizing and the dock's size bind in place instead.
function structure(node: Node | null): unknown {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        return [node.id, node.placement ?? '', node.surfaces.map((surface) => surface.id)];
    }

    return [node.id, node.direction, node.children.map(structure)];
}


// The app frame: tabbed groups of surfaces in resizable splits, in a main area between a sidebar on either edge, above
// a bottom dock. Tabs drag to reorder, into another group, onto a group's edge to split beside it, or onto a strip
// along the layout's left, right or bottom edge to dock there; groups clicked with ⌘ (Ctrl elsewhere) held fill the
// main area together once it is let go. An empty group offers the catalog. A surface's content is rendered once and
// moved, never rebuilt, so it keeps its state across every layout change until its tab closes.
//
// A sidebar slides over the main area's edge and makes room as it opens; below 1024px it pushes the main area aside,
// one at a time, and the main area shows one group, switched from its header. Its toggle sits in its top corner, and a
// closed sidebar's edge holds a handle to drag it out by. A sidebar holding a single unsortable surface is static: it
// shows the surface without tabs, takes no drops, and swipes closed toward its edge.
const panels = component(
    function({ catalog, icons = false, sidebars: options = {}, state, ...attributes }: A) {
        let adding: Controller | undefined,
            apple = mac(),
            controller: Controller | undefined,
            frames = { left: frame(), right: frame() },
            hosts = new Map<string, Host>(),
            parking: HTMLElement = document.createElement('div'),
            picks = signal<string[]>([]),
            size = reactive({ height: 0 }),
            slots = new Map<string, HTMLElement>(),
            subject = reactive({ group: '', surface: '' }),
            switching: Controller | undefined,
            unobserve: VoidFunction | undefined,
            workspace: HTMLElement | undefined;

        let edges: Sidebars = {
            frames,
            id: `panels-${crypto.randomUUID().slice(0, 8)}`,
            options,
            stationary: (edge) => stationary(state.layout.root, edge),
            state
        };

        let drag = manager({
            collide,
            end: (active, over, pointer) => {
                if (!over) {
                    return;
                }

                let data = over.data,
                    surface = active.data.surface as string;

                if (data.kind === 'dock') {
                    state.dock(surface, data.placement as Placement);
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

                state.split(surface, target, direction, side);
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
            held: (e: MouseEvent) => apple ? e.metaKey : e.ctrlKey,
            icons,
            inset: () => false,
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
            pick(group: string) {
                let current = read(picks);

                write(picks, current.includes(group) ? current.filter((id) => id !== group) : [...current, group]);
            },
            picked: (group: string) => read(picks).includes(group),
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
            state,
            switcher: null
        };

        setProperties(parking as Bound, { class: 'panels-parking' });

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
                release = untrack(() => root(() => render(element, { class: 'panels-host', 'data-surface': surface }, () => kind.render(entry))));

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

        // A sidebar makes room while it is open and has groups to show, outside a zoom.
        function open(edge: Edge) {
            let layout = state.layout;

            return layout.zoom.length === 0 && layout[edge].open && allGroups(layout.root).some((group) => docked(group, edge));
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
            // TEMPORARY: the sidebar's resize pill over the separator, following the pointer along it, to compare looks.
            let { onpointermove, ...attributes } = resize(axis, () => {
                    let from = sizes(),
                        total = length();

                    return (delta) => apply(resized(from, index, delta, total, MIN_FRACTION));
                }),
                pointer = reactive({ offset: 0 });

            return html`
                <div
                    aria-orientation='${axis === 'x' ? 'vertical' : 'horizontal'}'
                    class='panels-handle panels-handle--${axis}'
                    role='separator'
                    ${attributes}
                    ${{
                        hidden: () => hidden?.() ?? false,
                        onpointermove: function(this: HTMLElement, e: PointerEvent) {
                            let bounds = this.getBoundingClientRect();

                            pointer.offset = axis === 'x'
                                ? e.clientY - bounds.top - bounds.height / 2
                                : e.clientX - bounds.left - bounds.width / 2;
                            onpointermove(e);
                        },
                        style: () => `--offset: ${pointer.offset}px;`
                    }}
                >
                    <span class='panels-handle-pill'></span>
                </div>
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

            // As shown: a zoom shows a split with only some of its children, sharing the space between them.
            function sizes() {
                let trees = shown(state.layout),
                    found = find(trees.main, current.id) ?? find(trees.bottom, current.id) ?? find(trees.left, current.id) ?? find(trees.right, current.id);

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
                                // Holding the main group a narrow layout shows alone.
                                class: () => state.layout.main !== null && contains(child, state.layout.main) && 'panels-pane--current',
                                style: () => {
                                    let maximized = state.layout.maximized;

                                    if (maximized === null || !contains(current, maximized)) {
                                        return `--flex: 0 0 ${(sizes()[index] ?? 0) * 100}%;`;
                                    }

                                    return contains(current.children[index], maximized)
                                        ? `--flex: 0 0 calc(100% - ${(current.children.length - 1) * COLLAPSED}px);`
                                        : `--flex: 0 0 ${COLLAPSED}px;`;
                                }
                            }}
                        >
                            ${node(child)}
                        </div>
                        ${index < current.children.length - 1 && handle(axis, sizes, index, () => box.length, (next) => state.resize(current.id, next, current.children.map((child) => child.id)))}
                    `)}
                </div>
            `;
        }

        // Strips along the layout's edges a dragged tab docks onto; a static sidebar has none.
        function targets() {
            return (['bottom', 'left', 'right'] as const)
                .filter((placement) => placement === 'bottom' || !stationary(state.layout.root, placement))
                .map((placement) => html`
                    <div
                        aria-hidden='true'
                        class='panels-dock-target panels-dock-target--${placement}'
                        ${drag.droppable(() => ({ data: { kind: 'dock', placement }, id: `dock:${placement}` }))}
                    ></div>
                `);
        }

        // Rebuilt by every structural change, so which groups sit where is read once here. The toggles cover the top
        // corners: each sidebar's corner group clears its toggle, and the main area's while that sidebar is closed.
        function tree(): Renderable<unknown> {
            let trees = shown(state.layout),
                groups = allGroups(trees.main),
                corners = {
                    left: [corner(trees.left, 'left')?.id, corner(trees.main, 'left')?.id],
                    right: [corner(trees.right, 'right')?.id, corner(trees.main, 'right')?.id]
                };

            context.inset = (group, edge) => {
                let [side, main] = corners[edge];

                return trees[edge] !== null && (group === side || (group === main && !state.layout[edge].open));
            };
            context.switcher = groups.length > 1
                ? (e: MouseEvent) => {
                    let { bottom, left } = (e.currentTarget as HTMLElement).getBoundingClientRect();

                    switching?.open({ x: left, y: bottom });
                }
                : null;

            return html`
                <div class='panels-frame'>
                    ${(['left', 'right'] as const).map((edge) => {
                        let dock = trees[edge];

                        return dock && html`
                            ${sidebar(edges, edge, node(dock))}
                            ${grip(edges, edge)}
                            ${options[edge]?.resizable && resizer(edges, edge)}
                            ${toggle(edges, edge)}
                        `;
                    })}
                    <div class='panels-center'>
                        <div class='panels-main'>
                            ${trees.main ? node(trees.main) : launcher(context)}
                        </div>
                        ${trees.bottom && html`
                            ${handle(
                                'y',
                                () => {
                                    let share = bounded(state.layout.bottom.size);

                                    return [1 - share, share];
                                },
                                0,
                                () => size.height,
                                (next) => state.resizeDock('bottom', next[1]),
                                () => state.layout.bottom.maximized
                            )}
                            <div
                                class='panels-dock'
                                ${{
                                    class: () => state.layout.bottom.maximized && 'panels-dock--maximized',
                                    style: () => `flex: 0 0 ${bounded(state.layout.bottom.size) * 100}%;`
                                }}
                            >
                                ${node(trees.bottom)}
                            </div>
                        `}
                    </div>
                </div>
                ${targets()}
                ${context.switcher && tooltip.context(
                    {
                        class: 'panels-menu',
                        controller: (value: Controller) => {
                            switching = value;
                        },
                        items: groups.map((entry) => ({
                            label: () => {
                                let found = findGroup(state.layout.root, entry.id),
                                    surface = found?.surfaces.find((item) => item.id === found.active);

                                return surface ? title(context, surface) : 'Empty group';
                            },
                            onselect: () => state.focus(entry.id)
                        })),
                        [tooltip.context.panel]: { 'aria-label': 'Switch group' }
                    },
                    ''
                )}
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

        // Narrow, opening a sidebar closes the other, so both starting open leaves the left.
        if (matchMedia(NARROW).matches && state.layout.left.open && state.layout.right.open) {
            state.toggle('right', false);
        }

        return html`
            <div
                class='panels'
                ${attributes}
                ${{
                    class: [
                        () => read(drag.active) && 'panels--dragging',
                        () => (frames.left.dragging || frames.right.dragging) && 'panels--sliding',
                        () => (frames.left.resizing || frames.right.resizing) && 'panels--resizing',
                        () => open('left') && 'panels--left-open',
                        () => open('right') && 'panels--right-open'
                    ],
                    onconnect: (element: HTMLElement) => {
                        workspace = element;
                        element.append(parking);
                        unobserve = observe(element, ([entry]) => {
                            size.height = entry.contentRect.height;
                        });
                    },
                    ondisconnect: () => unobserve?.(),
                    onwindowblur: () => write(picks, []),
                    onwindowkeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Escape' && read(picks).length) {
                            e.preventDefault();
                            write(picks, []);
                        }
                    },
                    onwindowkeyup: (e: KeyboardEvent) => {
                        let chosen = read(picks);

                        if (e.key !== (apple ? 'Meta' : 'Control') || chosen.length === 0) {
                            return;
                        }

                        write(picks, []);
                        state.zoom(chosen);
                    },
                    style: () => {
                        let { left, right } = state.layout;

                        return {
                            '--left': frames.left.space,
                            '--left-size': left.size === null ? undefined : `${left.size}px`,
                            '--right': frames.right.space,
                            '--right-size': right.size === null ? undefined : `${right.size}px`
                        };
                    }
                }}
            >
                ${subtree(
                    () => {
                        let layout = state.layout,
                            key = JSON.stringify([layout.bottom.open, layout.zoom.at(-1) ?? null, structure(layout.root)]),
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


const layout: typeof panels & { state: typeof state } = Object.assign(panels, { state });


export default layout;
export type { Catalog, Kind, Layout, Node, Placement, Saved, Store, Surface };
