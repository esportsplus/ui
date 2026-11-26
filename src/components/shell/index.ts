import { effect, flush, onCleanup, reactive, read, root, signal, untrack, write, type ReactiveArray } from '@esportsplus/reactivity';
import { component, html, render, type Attributes, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import tooltip from '~/components/tooltip';
import type { Controller, Item } from '~/components/tooltip/menu';
import { mac } from '~/shared/platform';
import { observe } from '~/shared/resize';
import { group, launcher, title, type Catalog, type Context, type Kind } from './group';
import state, { allGroups, bounded, contains, docked, findGroup, findSplit, findSurfaceGroup, MIN_FRACTION, stationary, type Group, type Layout, type Node, type Placement, type Saved, type Split, type Store, type Surface } from './model';
import { resized, separator } from './resize';
import { frame, grip, resizer, sidebar, toggle, type Edge, type Options, type Sidebars } from './sidebar';
import subtree from './subtree';
import './scss/index.scss';


type A = Attributes & {
    catalog: Catalog;
    // What an empty group or main area shows in place of the launcher.
    empty?: (group?: string) => Renderable<unknown>;
    // Tabs show their kind's icon alone, closing from their menu.
    icons?: boolean;
    // At or below this width (px) of the layout, an open sidebar pushes the main area aside, one at a time, and the
    // main area shows one group.
    narrow?: number;
    onconnect?: never;
    // Each sidebar's label, whether it peeks while the pointer rests on its edge, and whether it resizes.
    sidebars?: Partial<Record<Edge, Options>>;
    state: ReturnType<typeof state>;
};

type Host = { dispose: VoidFunction; element: HTMLElement };

type Region = Placement | 'main';

type Shown = Record<Region, Node | null>;

type Side = 'bottom' | 'left' | 'right' | 'top';


// A collapsed sibling of a maximized group keeps this much (px) to click back into.
const COLLAPSED = 80;

const NARROW = 1024;

// Where a tab dropped on a group's edge goes: beside it along the axis, before or after it.
const EDGES = {
    bottom: ['column', 'after'],
    left: ['row', 'before'],
    right: ['row', 'after'],
    top: ['column', 'before']
} as const;


// The group at a tree's top corner on 'edge': the first child down each split, but a row's last toward the right.
function corner(node: Node | null, edge: Edge): Group | null {
    if (node === null || node.kind === 'group') {
        return node;
    }

    return corner((edge === 'right' && node.direction === 'row' ? node.children.at(-1) : node.children[0]) ?? null, edge);
}

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

function findSurface(node: Node | null, id: string) {
    return findSurfaceGroup(node, id)?.surfaces.find((surface) => surface.id === id) ?? null;
}

// Every surface that should own a place on screen: the active surface of each group showing. A closed sidebar's
// groups stay mounted, so it slides out with its content in place.
function mounted(layout: Layout) {
    let ids = new Set<string>();

    for (let group of Object.values(shown(layout)).flatMap(allGroups)) {
        if (group.active !== null) {
            ids.add(group.active);
        }
    }

    return ids;
}

// What the layout shows: under a zoom, its groups fill the main area together, docked or not; otherwise the main
// groups, the bottom dock's below them while it is open, and each sidebar's on its edge, open or not.
function shown(layout: Layout): Shown {
    let zoom = layout.zoom.at(-1);

    if (zoom) {
        let ids = new Set(zoom.groups);

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

// Outside every tab strip, what a dragged tab drops onto: a dock's strip along the layout's edge, or the half of a
// group toward its nearest edge, which splits the group there. A group's header outside its strip takes nothing.
function target(workspace: HTMLElement, x: number, y: number) {
    let elements = document.elementsFromPoint(x, y).filter((element) => element.closest('.shell') === workspace),
        dock = elements.find((element) => element.matches('.shell-dock-target')) as HTMLElement | undefined,
        section = elements.find((element) => element.matches('.shell-group')) as HTMLElement | undefined;

    if (dock) {
        return dock;
    }

    if (!section || y <= (section.querySelector(':scope > .shell-header')?.getBoundingClientRect().bottom ?? -Infinity)) {
        return null;
    }

    let { height, left, top, width } = section.getBoundingClientRect(),
        across = width <= 0 ? 0.5 : (x - left) / width,
        down = height <= 0 ? 0.5 : (y - top) / height,
        side = ([['left', across], ['right', 1 - across], ['top', down], ['bottom', 1 - down]] as [Side, number][])
            .reduce((nearest, candidate) => candidate[1] < nearest[1] ? candidate : nearest)[0];

    return section.querySelector<HTMLElement>(`:scope > .shell-edge--${side}`);
}

// The id of this layout's innermost group under the point, skipping groups of layouts nested inside it.
function under(workspace: HTMLElement, x: number, y: number) {
    let found = document.elementsFromPoint(x, y).find((element) => element.matches('.shell-group') && element.closest('.shell') === workspace);

    return (found as HTMLElement | undefined)?.dataset.group;
}


// The app frame: tabbed groups of surfaces in resizable splits, in a main area between a sidebar on either edge, above
// a bottom dock. Tabs drag to reorder, into another group, onto a group's edge to split beside it, or onto a strip
// along the layout's left, right or bottom edge to dock there; groups clicked or swept across with ⌘ (Ctrl elsewhere)
// held fill the main area together once it, or the sweep, is let go. A double click on a header steps back a view at
// a time, out of a maximized group and then each zoom, and maximizes its group once there is nothing left to step out
// of. An empty group offers the catalog. A surface's content is rendered once and moved, never rebuilt, so it keeps
// its state across every layout change until its tab closes.
//
// A sidebar slides over the main area's edge and makes room as it opens; in a narrow layout it pushes the main area
// aside, one at a time, and the main area shows one group, switched from its header. Its toggle sits in its top
// corner, and a closed sidebar's edge holds a handle to drag it out by. A sidebar holding a single unsortable surface
// is static: it shows the surface without tabs, takes no drops, and swipes closed toward its edge.
const shell = component(
    function({ catalog, empty, icons = false, narrow: breakpoint = NARROW, sidebars: options = {}, state, ...attributes }: A) {
        let adding: Controller | undefined,
            // The add menu shows, opened from 'subject.group''s add button.
            added = reactive({ active: false }),
            apple = mac(),
            // A tab is being dragged, which lights the docks and group halves it can drop onto.
            carrying = signal(false),
            controller: Controller | undefined,
            frames = { left: frame(), right: frame() },
            hosts = new Map<string, Host>(),
            // What a dragged tab does to the layout once its copy lands.
            landing: VoidFunction | null = null,
            // Where hosts wait while their surface isn't showing, inside the layout so they stay connected.
            parking: HTMLElement | undefined,
            picks = signal<string[]>([]),
            // Each region's element, so rebuilding one parks only the hosts inside it.
            regions: Partial<Record<Region, HTMLElement>> = {},
            size = reactive({ height: 0, width: 0 }),
            slots = new Map<string, HTMLElement>(),
            // Each tab strip's group, so a tab sorted into a strip moves into its group.
            strips = new WeakMap<ReactiveArray<Surface>, string>(),
            subject = reactive({ group: '', surface: '' }),
            switching: Controller | undefined,
            unobserve: VoidFunction | undefined,
            workspace: HTMLElement | undefined;

        let narrow = () => size.width > 0 && size.width <= breakpoint;

        let edges: Sidebars = {
            frames,
            id: `shell-${crypto.randomUUID().slice(0, 8)}`,
            narrow,
            options,
            stationary: (edge) => stationary(state.layout.root, edge),
            state
        };

        // A dragged tab changes the layout once its copy has landed, so the strips it moved through stay until then.
        function drop(surface: Surface, element: HTMLElement) {
            let placement = element.dataset.placement as Placement | undefined;

            if (placement) {
                state.dock(surface.id, placement);
                return;
            }

            let group = element.closest<HTMLElement>('.shell-group')?.dataset.group,
                [direction, side] = EDGES[element.dataset.side as Side];

            if (group) {
                state.split(surface.id, group, direction, side);
            }
        }

        // Whether the group already holds the kind, where adding it would only reselect its tab. A kind that opens a new
        // surface on every add never is.
        function holds(group: string, kind: string) {
            return !catalog[kind]?.multiple && !!findGroup(state.layout.root, group)?.surfaces.some((surface) => surface.kind === kind);
        }

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
            addable: Object.entries(catalog).filter(([, entry]) => entry.addable !== false),
            adding: (group: string) => added.active && subject.group === group,
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
            empty,
            held: (e: MouseEvent) => apple ? e.metaKey : e.ctrlKey,
            icons,
            // The toggles cover the top corners: each sidebar's corner group clears its toggle, and the main area's
            // while that sidebar is closed.
            inset(group: string, edge: Edge) {
                let layout = state.layout,
                    trees = shown(layout);

                return trees[edge] !== null && (group === corner(trees[edge], edge)?.id || (group === corner(trees.main, edge)?.id && !layout[edge].open));
            },
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
            offering: (group: string) => context.addable.some(([kind]) => !holds(group, kind)),
            pick(group: string) {
                let current = read(picks);

                write(picks, current.includes(group) ? current.filter((id) => id !== group) : [...current, group]);
            },
            picked: (group: string) => read(picks).includes(group),
            slot: (surface: string) => html`
                <div
                    class='shell-slot'
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
            sorting(strip: ReactiveArray<Surface>, group: string) {
                strips.set(strip, group);

                return {
                    disabled: (surface) => surface.sortable === false,
                    group: edges.id,
                    onland: () => {
                        let land = landing;

                        landing = null;
                        write(carrying, false);
                        land?.();
                    },
                    onlift: () => write(carrying, true),
                    onsort: (surface, _, to, __, target) => {
                        let group = strips.get(target);

                        landing = group ? () => state.move(surface.id, group, to) : null;
                    },
                    outside: {
                        // The strip lets the tab go as it is dropped, before the layout takes it. A drop the layout
                        // turns down, such as a group's only tab onto its own edge, changes nothing, so the group isn't
                        // rebuilt; the tab goes back where it was in its strip.
                        ondrop: (surface, element, from, source) => {
                            landing = () => {
                                drop(surface, element);

                                if (findSurfaceGroup(state.layout.root, surface.id)?.id === strips.get(source)) {
                                    source.splice(from, 0, surface);
                                }
                            };
                        },
                        over: (_, x, y) => workspace ? target(workspace, x, y) : null
                    }
                };
            },
            state,
            // Held down with the modifier, a press sweeps: every group the pointer crosses into is picked, and letting go
            // after leaving the first zooms to every pick at once. A press that stays in its group is a click, which
            // picks or unpicks it instead.
            sweep(e: PointerEvent, group: string) {
                let swept = [group];

                function end(event: PointerEvent) {
                    document.documentElement.classList.remove('shell-sweeping');
                    window.removeEventListener('pointercancel', end);
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', end);

                    if (swept.length < 2) {
                        return;
                    }

                    // The click the release ends with lands on whatever holds both groups; it picks nothing.
                    let swallow = (click: MouseEvent) => {
                        click.preventDefault();
                        click.stopPropagation();
                    };

                    window.addEventListener('click', swallow, { capture: true, once: true });
                    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));

                    if (event.type === 'pointerup') {
                        let chosen = read(picks);

                        write(picks, []);
                        state.zoom(chosen);
                    }
                }

                function move(event: PointerEvent) {
                    let id = workspace && under(workspace, event.clientX, event.clientY);

                    if (!id || swept.includes(id)) {
                        return;
                    }

                    swept.push(id);
                    write(picks, [...new Set([...read(picks), ...swept])]);
                }

                if (e.button !== 0) {
                    return;
                }

                document.documentElement.classList.add('shell-sweeping');
                window.addEventListener('pointercancel', end);
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', end);
            },
            switcher(e: MouseEvent) {
                let { bottom, left } = (e.currentTarget as HTMLElement).getBoundingClientRect();

                switching?.open({ x: left, y: bottom });
            },
            switches: () => allGroups(shown(state.layout).main).length > 1
        };

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
                release = untrack(() => root(() => render(element, { class: 'shell-host', 'data-surface': surface }, () => kind.render(entry))));

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

        function node(current: Node): Renderable<unknown> {
            if (current.kind === 'group') {
                let id = current.id;

                return group(context, () => {
                    let layout = state.layout;

                    return { group: findGroup(layout.root, id) ?? current, layout };
                });
            }

            return split(current);
        }

        // A sidebar makes room while it is open and has groups to show, outside a zoom.
        function open(edge: Edge) {
            let layout = state.layout;

            return layout.zoom.length === 0 && layout[edge].open && allGroups(layout.root).some((group) => docked(group, edge));
        }

        // Every host, or those inside 'within', waits in the parking while what held it is rebuilt.
        function park(within?: HTMLElement) {
            if (!parking) {
                return;
            }

            for (let host of hosts.values()) {
                if (!within || within.contains(host.element)) {
                    move(host.element, parking);
                }
            }
        }

        // One region's groups, rebuilt only when its own structure changes, so opening a tab in the main area leaves
        // the sidebars' content where it is.
        function region(name: Region) {
            let last = '';

            return subtree(
                () => {
                    let key = JSON.stringify(structure(shown(state.layout)[name]));

                    if (key !== last && last !== '' && regions[name]) {
                        park(regions[name]);
                    }

                    last = key;

                    return key;
                },
                () => {
                    let tree = shown(state.layout)[name];

                    if (name !== 'main') {
                        return tree ? node(tree) : '';
                    }

                    return tree ? html`${node(tree)}${switcher(tree)}` : launcher(context);
                },
                {
                    onconnect: (element: HTMLElement) => {
                        regions[name] = element;
                    }
                }
            );
        }

        function split(current: Split) {
            let axis = current.direction === 'row' ? 'x' as const : 'y' as const,
                box = reactive({ length: 0 }),
                unobserve: VoidFunction | undefined;

            // As shown: a zoom shows a split with only some of its children, sharing the space between them.
            function sizes() {
                for (let tree of Object.values(shown(state.layout))) {
                    let found = findSplit(tree, current.id);

                    if (found) {
                        return found.sizes;
                    }
                }

                return current.sizes;
            }

            return html`
                <div
                    class='shell-split shell-split--${current.direction}'
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
                            class='shell-pane'
                            ${{
                                // Holding the main group a narrow layout shows alone.
                                class: () => state.layout.main !== null && contains(child, state.layout.main) && 'shell-pane--current',
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
                        ${index < current.children.length - 1 && separator(axis, () => {
                            let from = sizes(),
                                length = box.length;

                            return (delta) => state.resize(current.id, resized(from, index, delta, length, MIN_FRACTION), current.children.map((child) => child.id));
                        })}
                    `)}
                </div>
            `;
        }

        // The menu of main groups a narrow layout switches between.
        function switcher(main: Node) {
            let groups = allGroups(main);

            return groups.length > 1 && tooltip.context(
                {
                    class: 'shell-menu',
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
            );
        }

        // Hiding a surface or picking another tab keeps its host parked; only closing it releases its content.
        function sync(layout: Layout, attaching: boolean) {
            let shown = mounted(layout);

            for (let [surface, host] of hosts) {
                if (findSurface(layout.root, surface)) {
                    if (!shown.has(surface) && parking) {
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

        // Strips along the layout's edges a dragged tab docks onto; a static sidebar has none.
        function targets() {
            return (['bottom', 'left', 'right'] as const)
                .filter((placement) => placement === 'bottom' || !stationary(state.layout.root, placement))
                .map((placement) => html`
                    <div
                        aria-hidden='true'
                        class='shell-dock-target shell-dock-target--${placement}'
                        data-placement='${placement}'
                    ></div>
                `);
        }

        // Rebuilt when a region appears or goes, the bottom dock opens or closes or the zoom changes; each region
        // rebuilds its own groups. A sidebar named in 'sidebars' shows even without groups, so it can always be opened.
        function tree(): Renderable<unknown> {
            let trees = shown(state.layout);

            return html`
                <div class='shell-frame'>
                    ${(['left', 'right'] as const).map((edge) => (trees[edge] || options[edge]) && html`
                        ${sidebar(edges, edge, region(edge))}
                        ${grip(edges, edge)}
                        ${options[edge]?.resizable && resizer(edges, edge)}
                        ${toggle(edges, edge)}
                    `)}
                    <div class='shell-center'>
                        <div class='shell-main'>
                            ${region('main')}
                        </div>
                        ${trees.bottom && html`
                            ${separator(
                                'y',
                                () => {
                                    let share = bounded(state.layout.bottom.size),
                                        length = size.height;

                                    return (delta) => state.resizeDock('bottom', resized([1 - share, share], 0, delta, length, MIN_FRACTION)[1]);
                                },
                                { hidden: () => state.layout.bottom.maximized }
                            )}
                            <div
                                class='shell-dock'
                                ${{
                                    class: () => state.layout.bottom.maximized && 'shell-dock--maximized',
                                    style: () => `--flex: 0 0 ${bounded(state.layout.bottom.size) * 100}%;`
                                }}
                            >
                                ${region('bottom')}
                            </div>
                        `}
                    </div>
                </div>
                ${targets()}
            `;
        }

        // The layout's own items, then each kind's: a kind with a menu of its own shows only that on its tabs.
        let kind = () => findSurface(state.layout.root, subject.surface)?.kind ?? '',
            own = () => !!catalog[kind()]?.menu,
            items: Item[] = [
                { hidden: own, label: 'Close', onselect: () => void state.close(subject.surface) },
                {
                    hidden: () => own() || (findGroup(state.layout.root, subject.group)?.surfaces.length ?? 0) <= 1,
                    label: 'Close Others',
                    onselect: () => void state.closeOthers(subject.group, subject.surface)
                },
                {
                    hidden: () => {
                        let surfaces = findGroup(state.layout.root, subject.group)?.surfaces ?? [];

                        return own() || surfaces.findIndex((surface) => surface.id === subject.surface) >= surfaces.length - 1;
                    },
                    label: 'Close to the Right',
                    onselect: () => void state.closeRight(subject.group, subject.surface)
                },
                { hidden: own, label: 'Close All', onselect: () => void state.closeGroup(subject.group) },
                ...Object.entries(catalog).flatMap(([name, entry]) => (entry.menu?.(() => subject.surface) ?? []).map((item) => ({
                    ...item,
                    hidden: () => kind() !== name || (typeof item.hidden === 'function' ? !!item.hidden() : !!item.hidden)
                })))
            ],
            last = '';

        onCleanup(() => {
            for (let host of hosts.values()) {
                host.dispose();
            }

            hosts.clear();
            slots.clear();
        });

        // Narrow, opening a sidebar closes the other, so both open on turning narrow leaves the left.
        effect(() => {
            if (narrow() && state.layout.left.open && state.layout.right.open) {
                untrack(() => state.toggle('right', false));
            }
        });

        return html`
            <div
                class='shell'
                ${attributes}
                ${{
                    class: [
                        () => read(carrying) && 'shell--dragging',
                        () => narrow() && 'shell--narrow',
                        () => (frames.left.dragging || frames.right.dragging) && 'shell--sliding',
                        () => open('left') && 'shell--left-open',
                        () => open('right') && 'shell--right-open'
                    ],
                    onconnect: (element: HTMLElement) => {
                        workspace = element;
                        unobserve = observe(element, ([entry]) => {
                            size.height = entry.contentRect.height;
                            size.width = entry.contentRect.width;
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
                <div
                    class='shell-parking'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            parking = element;
                        }
                    }}
                ></div>
                ${subtree(
                    () => {
                        let layout = state.layout,
                            trees = shown(layout),
                            key = JSON.stringify([layout.bottom.open, layout.zoom.at(-1)?.groups ?? null, ...Object.values(trees).map((tree) => tree !== null)]),
                            changed = key !== last;

                        if (changed) {
                            park();
                        }

                        sync(layout, !changed);
                        last = key;

                        return key;
                    },
                    tree,
                    { class: 'shell-tree' }
                )}
                ${tooltip.context(
                    {
                        class: 'shell-menu',
                        controller: (value: Controller) => {
                            adding = value;
                        },
                        items: context.addable.map(([kind, entry]) => ({
                            ...(entry.icon ? { icon: () => icon({ 'aria-hidden': 'true' }, entry.icon!) } : {}),
                            hidden: () => holds(subject.group, kind),
                            label: typeof entry.title === 'function' ? entry.title({ id: '', kind }) : entry.title,
                            onselect: () => context.add(kind, subject.group)
                        })),
                        state: added,
                        [tooltip.context.panel]: { 'aria-label': 'Add panel' }
                    },
                    ''
                )}
                ${tooltip.context(
                    {
                        class: 'shell-menu',
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


const layout: typeof shell & { state: typeof state } = Object.assign(shell, { state });


export default layout;
export type { Catalog, Kind, Layout, Node, Placement, Saved, Store, Surface };
