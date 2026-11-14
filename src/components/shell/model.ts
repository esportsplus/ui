import { read, signal, write } from '@esportsplus/reactivity';


type Direction = 'column' | 'row';

// Whether a dock shows, and its size: a fraction of the main area for the bottom, pixels for a sidebar, which holds
// the stylesheet's width until a resize sets one.
type Dock = { open: boolean; size: number | null };

type Group = {
    active: string | null;
    id: string;
    kind: 'group';
    // Docked groups show and hide together: the bottom dock spans the main area below it, a sidebar the layout's
    // height on its edge.
    placement?: Placement;
    surfaces: Surface[];
};

type Layout = {
    active: string | null;
    bottom: Dock & { maximized: boolean; size: number };
    left: Dock;
    // The main group a narrow layout shows alone: the focused one, or the last focused while a dock holds focus.
    main: string | null;
    maximized: string | null;
    right: Dock;
    root: Node | null;
    // Each zoom narrows the view to a set of groups, the last one showing; leaving a zoom returns to the one before.
    zoom: Zoom[];
};

type Node = Group | Split;

type Options = {
    // Asked before a close takes surfaces away, with those surfaces: false, or a promise of false, keeps them.
    closing?: (surfaces: Surface[]) => boolean | Promise<boolean>;
    // Which docks start open; each does unless set false.
    open?: Partial<Record<Placement, boolean>>;
    root?: Node | null;
    // Restores the layout's tree once it reads back, unless the tree changed first, and saves it after each change.
    store?: Store;
};

type Placement = 'bottom' | 'left' | 'right';

// What the store keeps: the tree of groups, splits and surfaces.
type Saved = { root: Node | null };

type Side = 'after' | 'before';

type Split = {
    children: Node[];
    direction: Direction;
    id: string;
    kind: 'split';
    // Fractions of the split, one per child, summing to 1.
    sizes: number[];
};

// What a tab shows: 'kind' names the catalog entry that titles and renders it. An unsortable surface stays in its
// group; alone there, the group is static and shows it without a tab strip.
type Surface = { id: string; kind: string; sortable?: boolean };

// The slice of @esportsplus/web-storage's Local<T> the layout uses, so any Local<{ shell: Saved }> is a store.
type Store = {
    get(key: typeof KEY): Promise<unknown>;
    set(key: typeof KEY, value: Saved): Promise<boolean>;
};

// A zoom's groups, and the main group the view it left had maximized, restored on stepping back out of it.
type Zoom = { groups: string[]; maximized: string | null };


const BOTTOM_SIZE = 0.25;

const KEY = 'shell';

// A pane never shrinks below this share of its split.
const MIN_FRACTION = 0.1;


function allGroups(node: Node | null): Group[] {
    if (node === null) {
        return [];
    }

    if (node.kind === 'group') {
        return [node];
    }

    return node.children.flatMap(allGroups);
}

function bounded(size: number) {
    return Math.min(1 - MIN_FRACTION, Math.max(MIN_FRACTION, size));
}

function contains(node: Node, id: string): boolean {
    return node.id === id || (node.kind === 'split' && node.children.some((child) => contains(child, id)));
}

function docked(group: Group, placement: Placement) {
    return group.placement === placement;
}

// A group emptied in place, as a sidebar's last group is.
function emptyGroup(root: Node | null, id: string) {
    return updateGroup(root, id, (group) => ({ ...group, active: null, surfaces: [] }));
}

function equalSizes(count: number) {
    return Array.from({ length: count }, () => 1 / count);
}

function findGroup(node: Node | null, id: string) {
    return allGroups(node).find((group) => group.id === id) ?? null;
}

function findSplit(node: Node | null, id: string): Split | null {
    if (node === null || node.kind !== 'split') {
        return null;
    }

    if (node.id === id) {
        return node;
    }

    for (let i = 0, n = node.children.length; i < n; i++) {
        let found = findSplit(node.children[i], id);

        if (found) {
            return found;
        }
    }

    return null;
}

function findSurfaceGroup(node: Node | null, id: string) {
    return allGroups(node).find((group) => group.surfaces.some((surface) => surface.id === id)) ?? null;
}

// A group showing one surface that cannot move: it renders without a tab strip and nothing joins it.
function fixed(group: Group) {
    return group.surfaces.length === 1 && group.surfaces[0].sortable === false;
}

// Joins the root's split along the same axis, or wraps the root with it, taking a quarter of the space; either way
// the inserted node spans the whole layout on that side.
function insertRoot(root: Node, direction: Direction, inserted: Node, side: Side, id: (prefix: string) => string): Node {
    if (root.kind === 'split' && root.direction === direction) {
        let at = side === 'before' ? 0 : root.children.length,
            children = [...root.children],
            sizes = normalizeSizes(root.sizes, root.children.length).map((size) => size * 0.75);

        children.splice(at, 0, inserted);
        sizes.splice(at, 0, 0.25);

        return { ...root, children, sizes };
    }

    return {
        children: side === 'before' ? [inserted, root] : [root, inserted],
        direction,
        id: id('split'),
        kind: 'split',
        sizes: side === 'before' ? [0.25, 0.75] : [0.75, 0.25]
    };
}

// Beside the target group on the given side: a sibling when the target's split runs along the same axis, otherwise
// a fresh split wrapping the two.
function insertSplit(node: Node, target: string, direction: Direction, inserted: Node, side: Side, id: (prefix: string) => string): Node {
    if (node.kind !== 'split') {
        if (node.id !== target) {
            return node;
        }

        return {
            children: side === 'before' ? [inserted, node] : [node, inserted],
            direction,
            id: id('split'),
            kind: 'split',
            sizes: [0.5, 0.5]
        };
    }

    let at = node.children.findIndex((child) => child.kind === 'group' && child.id === target);

    if (node.direction === direction && at !== -1) {
        let children = [...node.children];

        children.splice(at + (side === 'after' ? 1 : 0), 0, inserted);

        return { ...node, children, sizes: equalSizes(children.length) };
    }

    return { ...node, children: node.children.map((child) => insertSplit(child, target, direction, inserted, side, id)) };
}

// The only group docked to its sidebar.
function lastInSidebar(root: Node | null, group: Group) {
    let placement = group.placement;

    return (placement === 'left' || placement === 'right') && allGroups(root).filter((entry) => docked(entry, placement)).length === 1;
}

// Drops empty branches, collapses single-child splits, flattens a split into a parent along the same axis and keeps
// each group's active surface one it holds.
function normalize(node: Node | null): Node | null {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        let active = node.surfaces.some((surface) => surface.id === node.active) ? node.active : (node.surfaces[0]?.id ?? null);

        return active === node.active ? node : { ...node, active };
    }

    let entries = node.children.flatMap((child, index) => {
        let normalized = normalize(child),
            size = node.sizes[index] ?? 0;

        if (normalized === null) {
            return [];
        }

        if (normalized.kind === 'split' && normalized.direction === node.direction) {
            return normalized.children.map((nested, i) => ({ child: nested, size: size * (normalized.sizes[i] ?? 0) }));
        }

        return [{ child: normalized, size }];
    });

    if (entries.length === 0) {
        return null;
    }

    if (entries.length === 1) {
        return entries[0].child;
    }

    return {
        ...node,
        children: entries.map(({ child }) => child),
        sizes: normalizeSizes(entries.map(({ size }) => size), entries.length)
    };
}

function normalizeLayout(layout: Layout): Layout {
    let root = normalize(layout.root),
        groups = allGroups(root),
        main = groups.filter((group) => group.placement === undefined).map((group) => group.id);

    return {
        ...layout,
        active: groups.some((group) => group.id === layout.active) ? layout.active : (groups[0]?.id ?? null),
        bottom: { ...layout.bottom, size: bounded(layout.bottom.size) },
        main: main.find((id) => id === layout.active) ?? main.find((id) => id === layout.main) ?? main[0] ?? null,
        root
    };
}

// The surfaces 'previous' holds that 'next' no longer does.
function removed(previous: Node | null, next: Node | null) {
    let kept = new Set(allGroups(next).flatMap((group) => group.surfaces.map((surface) => surface.id)));

    return allGroups(previous).flatMap((group) => group.surfaces.filter((surface) => !kept.has(surface.id)));
}

// Every size at least the minimum share, all of them summing to 1.
function normalizeSizes(sizes: readonly number[], count: number) {
    if (count === 0) {
        return [];
    }

    let minimum = Math.min(MIN_FRACTION, 1 / count),
        values = Array.from({ length: count }, (_, i) => Math.max(0, Number.isFinite(sizes[i]) ? sizes[i] : 0)),
        total = values.reduce((sum, value) => sum + value, 0);

    if (values.every((value) => value >= minimum) && Math.abs(total - 1) < 1e-9) {
        return values;
    }

    let remainder = 1 - minimum * count;

    return values.map((value) => minimum + remainder * (total === 0 ? 1 / count : value / total));
}

// A sidebar's last group is emptied rather than removed, so the sidebar shows its empty state instead of going.
function release(root: Node | null, group: Group) {
    return lastInSidebar(root, group) ? emptyGroup(root, group.id) : removeLeaf(root, group.id);
}

function removeLeaf(node: Node | null, id: string): Node | null {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        return node.id === id ? null : node;
    }

    return normalize({
        ...node,
        children: node.children.flatMap((child) => {
            let next = removeLeaf(child, id);

            return next === null ? [] : [next];
        })
    });
}

// A sidebar given a single static surface, which takes nothing else.
function stationary(root: Node | null, placement: Placement) {
    let groups = allGroups(root).filter((group) => docked(group, placement));

    return groups.length === 1 && fixed(groups[0]);
}

// Takes the surface out of its group, handing the group's active tab to a neighbour, and drops the group with it when
// it was the last, unless the group is its sidebar's last.
function take(root: Node | null, source: Group, id: string) {
    let index = source.surfaces.findIndex((surface) => surface.id === id),
        surfaces = source.surfaces.filter((surface) => surface.id !== id);

    if (surfaces.length === 0) {
        return release(root, source);
    }

    return updateGroup(root, source.id, (group) => ({
        ...group,
        active: group.active === id ? surfaces[Math.min(index, surfaces.length - 1)].id : group.active,
        surfaces
    }));
}

function updateGroup(node: Node | null, id: string, update: (group: Group) => Group): Node | null {
    if (node === null) {
        return null;
    }

    if (node.kind === 'group') {
        return node.id === id ? update(node) : node;
    }

    return { ...node, children: node.children.map((child) => updateGroup(child, id, update) ?? child) };
}

function updateSplit(node: Node | null, id: string, sizes: number[]): Node | null {
    if (node === null || node.kind !== 'split') {
        return node;
    }

    if (node.id === id) {
        return { ...node, sizes };
    }

    return { ...node, children: node.children.map((child) => updateSplit(child, id, sizes) ?? child) };
}

// Keeps every zoom to groups that still exist, and adds groups created while zoomed to each, so a split made in a zoom
// shows there and in the views it returns to; a zoom left without groups is dropped.
function zoomed(previous: Layout, next: Layout) {
    let before = new Set(allGroups(previous.root).map((group) => group.id)),
        after = allGroups(next.root).map((group) => group.id),
        created = after.filter((id) => !before.has(id)),
        existing = new Set(after);

    return next.zoom
        .map((level) => ({
            groups: [...level.groups.filter((id) => existing.has(id)), ...created],
            maximized: level.maximized !== null && existing.has(level.maximized) ? level.maximized : null
        }))
        .filter((level) => level.groups.length > 0);
}


// The layout's one source of truth: an immutable tree in a signal, replaced whole by each operation. Structural
// operations restore a maximized group first, as moving panes around under it would leave it covering the wrong one.
const state = ({ closing, open = {}, root = null, store }: Options = {}) => {
    let counter = 1,
        touched = false,
        layout = signal<Layout>(normalizeLayout({
            active: null,
            bottom: { maximized: false, open: open.bottom ?? true, size: BOTTOM_SIZE },
            left: { open: open.left ?? true, size: null },
            main: null,
            maximized: null,
            right: { open: open.right ?? true, size: null },
            root,
            zoom: []
        }));

    advance(read(layout).root);

    store?.get(KEY).then(
        (value) => {
            let saved = (value as Partial<Saved> | null | undefined)?.root;

            if (touched || !saved || (saved.kind !== 'group' && saved.kind !== 'split')) {
                return;
            }

            advance(saved);
            write(layout, normalizeLayout({ ...read(layout), root: saved }));
        },
        () => {}
    );

    // Generated ids continue past every id the tree holds, so a new group never collides with a restored one.
    function advance(node: Node | null) {
        for (let group of allGroups(node)) {
            counter = Math.max(counter, Number(/-(\d+)$/.exec(group.id)?.[1] ?? 0) + 1);
        }
    }

    // A close applies once 'closing' allows it, against the layout as it stands then.
    function guarded(change: (current: Layout) => Layout) {
        let surfaces = removed(read(layout).root, change(read(layout)).root),
            allowed = surfaces.length && closing ? closing(surfaces) : true;

        if (typeof allowed === 'boolean') {
            if (allowed) {
                structural(change);
            }

            return Promise.resolve(allowed);
        }

        return allowed.then(
            (value) => {
                if (value) {
                    structural(change);
                }

                return value;
            },
            () => false
        );
    }

    function id(prefix: string) {
        return `${prefix}-${counter++}`;
    }

    // A tree changed before the store reads back keeps its change rather than the saved one.
    function structural(change: (current: Layout) => Layout) {
        touched = true;
        update((current) => change({ ...current, bottom: { ...current.bottom, maximized: false }, maximized: null }));
    }

    function unzoom() {
        update((current) => {
            let level = current.zoom.at(-1);

            if (!level) {
                return current;
            }

            return {
                ...current,
                maximized: level.maximized !== null && findGroup(current.root, level.maximized) ? level.maximized : null,
                zoom: current.zoom.slice(0, -1)
            };
        });
    }

    function update(change: (current: Layout) => Layout) {
        let previous = read(layout),
            next = normalizeLayout(change(previous));

        if (next.zoom.length) {
            next = { ...next, zoom: zoomed(previous, next) };
        }

        write(layout, next);
        void store?.set(KEY, { root: next.root });
    }

    function visible(group: Group, current: Layout): Layout {
        let placement = group.placement;

        return placement ? { ...current, [placement]: { ...current[placement], open: true } } : current;
    }

    return {
        activate(surface: string) {
            update((current) => {
                let group = findSurfaceGroup(current.root, surface);

                if (!group) {
                    return current;
                }

                return {
                    ...visible(group, current),
                    active: group.id,
                    root: updateGroup(current.root, group.id, (entry) => ({ ...entry, active: surface }))
                };
            });
        },

        // Steps back one view: out of a maximized group or bottom dock, then out of each zoom in turn, the last zoom
        // first. False once the layout is back at its own view, with nothing left to step out of.
        back() {
            let current = read(layout);

            if (current.maximized !== null || current.bottom.maximized) {
                update((now) => ({ ...now, bottom: { ...now.bottom, maximized: false }, maximized: null }));
                return true;
            }

            if (current.zoom.length) {
                unzoom();
                return true;
            }

            return false;
        },

        close(surface: string) {
            return guarded((current) => {
                let group = findSurfaceGroup(current.root, surface);

                return group ? { ...current, root: take(current.root, group, surface) } : current;
            });
        },

        closeAll() {
            return guarded((current) => ({ ...current, root: null }));
        },

        closeGroup(group: string) {
            return guarded((current) => {
                let found = findGroup(current.root, group);

                return found ? { ...current, root: release(current.root, found) } : current;
            });
        },

        closeOthers(group: string, surface: string) {
            return guarded((current) => ({
                ...current,
                active: group,
                root: updateGroup(current.root, group, (entry) => ({
                    ...entry,
                    active: surface,
                    surfaces: entry.surfaces.filter((item) => item.id === surface)
                }))
            }));
        },

        closeRight(group: string, surface: string) {
            return guarded((current) => ({
                ...current,
                root: updateGroup(current.root, group, (entry) => {
                    let surfaces = entry.surfaces.slice(0, entry.surfaces.findIndex((item) => item.id === surface) + 1);

                    return {
                        ...entry,
                        active: surfaces.some((item) => item.id === entry.active) ? entry.active : surface,
                        surfaces
                    };
                })
            }));
        },

        // Moves the surface into a group of its own in the dock: into the dock's empty group, beside its last group,
        // across the dock, or along the layout's edge while the dock has none. A static sidebar takes nothing; a static
        // group moves whole, into a dock without groups.
        dock(surface: string, placement: Placement = 'bottom') {
            structural((current) => {
                let source = findSurfaceGroup(current.root, surface),
                    item = source?.surfaces.find((entry) => entry.id === surface);

                if (source && fixed(source)) {
                    return source.placement === placement || allGroups(current.root).some((entry) => docked(entry, placement))
                        ? current
                        : {
                            ...current,
                            [placement]: { ...current[placement], open: true },
                            root: updateGroup(current.root, source.id, (entry) => ({ ...entry, placement }))
                        };
                }

                if (
                    !source ||
                    !item ||
                    item.sortable === false ||
                    stationary(current.root, placement) ||
                    (current.root?.kind === 'group' && source.surfaces.length === 1)
                ) {
                    return current;
                }

                let root = take(current.root, source, surface);

                if (root === null) {
                    return current;
                }

                let groups = allGroups(root).filter((entry) => docked(entry, placement)),
                    vacant = groups.find((entry) => entry.surfaces.length === 0);

                if (vacant) {
                    return {
                        ...current,
                        active: vacant.id,
                        [placement]: { ...current[placement], open: true },
                        root: updateGroup(root, vacant.id, (entry) => ({ ...entry, active: item.id, surfaces: [item] }))
                    };
                }

                let group: Group = { active: item.id, id: id('group'), kind: 'group', placement, surfaces: [item] },
                    last = groups.at(-1),
                    sidebar = placement !== 'bottom';

                return {
                    ...current,
                    active: group.id,
                    [placement]: { ...current[placement], open: true },
                    root: last
                        ? insertSplit(root, last.id, sidebar ? 'column' : 'row', group, 'after', id)
                        : insertRoot(root, sidebar ? 'row' : 'column', group, placement === 'left' ? 'before' : 'after', id)
                };
            });
        },

        focus(group: string) {
            update((current) => findGroup(current.root, group) ? { ...current, active: group } : current);
        },

        // Tracked: reading it inside an effect re-runs the effect on every change.
        get layout() {
            return read(layout);
        },

        // Takes a whole tree in place of the current one, as a restored session does.
        load(root: Node | null) {
            advance(root);
            structural((current) => ({ ...current, root }));
        },

        // The bottom dock fills the main area; a main group fills its splits while its siblings collapse to a strip.
        // Sidebars keep their size.
        maximize(group: string) {
            update((current) => {
                let found = findGroup(current.root, group);

                if (!found || docked(found, 'left') || docked(found, 'right')) {
                    return current;
                }

                if (found.placement === 'bottom') {
                    return { ...current, bottom: { ...current.bottom, maximized: !current.bottom.maximized }, maximized: null };
                }

                return {
                    ...current,
                    active: group,
                    bottom: { ...current.bottom, maximized: false },
                    maximized: current.maximized === group ? null : group
                };
            });
        },

        // Into the group at 'index' among its tabs, or at the end; within its own group it reorders.
        move(surface: string, group: string, index?: number) {
            structural((current) => {
                let source = findSurfaceGroup(current.root, surface),
                    target = findGroup(current.root, group),
                    item = source?.surfaces.find((entry) => entry.id === surface);

                if (!source || !target || !item || (source.id !== target.id && (item.sortable === false || fixed(target)))) {
                    return current;
                }

                let root = source.id === target.id ? current.root : take(current.root, source, surface);

                return {
                    ...visible(target, current),
                    active: target.id,
                    root: updateGroup(root, target.id, (entry) => {
                        let surfaces = entry.surfaces.filter((other) => other.id !== surface);

                        surfaces.splice(Math.max(0, Math.min(index ?? surfaces.length, surfaces.length)), 0, item);

                        return { ...entry, active: surface, surfaces };
                    })
                };
            });
        },

        // Shows the surface, wherever it already is, or adds it to 'group', the focused group or a new one. A surface
        // open elsewhere moves into the given group.
        open(surface: Surface, group?: string) {
            structural((current) => {
                let existing = findSurfaceGroup(current.root, surface.id),
                    target = group ? findGroup(current.root, group) : null;

                if (existing && (!target || existing.id === target.id)) {
                    return {
                        ...visible(existing, current),
                        active: existing.id,
                        root: updateGroup(current.root, existing.id, (entry) => ({ ...entry, active: surface.id }))
                    };
                }

                target ??= findGroup(current.root, current.active ?? '');

                if (target && ((!group && target.placement !== undefined) || fixed(target))) {
                    target = allGroups(current.root).find((entry) => entry.placement === undefined && !fixed(entry)) ?? null;
                }

                if (!target) {
                    let created: Group = { active: surface.id, id: id('group'), kind: 'group', surfaces: [surface] };

                    return {
                        ...current,
                        active: created.id,
                        root: current.root === null ? created : insertRoot(current.root, 'row', created, 'after', id)
                    };
                }

                let root = existing ? take(current.root, existing, surface.id) : current.root;

                return {
                    ...visible(target, current),
                    active: target.id,
                    root: updateGroup(root, target.id, (entry) => ({ ...entry, active: surface.id, surfaces: [...entry.surfaces, surface] }))
                };
            });
        },

        // Puts the surface where 'previous' is, in its place among the tabs and active if it was, without asking
        // 'closing': the caller is the one taking 'previous' away.
        replace(previous: string, surface: Surface) {
            structural((current) => {
                let target = findSurfaceGroup(current.root, previous);

                if (!target) {
                    return current;
                }

                let existing = findSurfaceGroup(current.root, surface.id),
                    root = existing ? take(current.root, existing, surface.id) : current.root;

                return {
                    ...current,
                    root: updateGroup(root, target.id, (entry) => ({
                        ...entry,
                        active: entry.active === previous ? surface.id : entry.active,
                        surfaces: entry.surfaces.map((item) => item.id === previous ? surface : item)
                    }))
                };
            });
        },

        // 'shown' names the nodes a zoomed view shows of the split, one per size: their new shares are fitted into the
        // space those children held, leaving the hidden ones theirs.
        resize(split: string, sizes: number[], shown?: string[]) {
            touched = true;
            update((current) => {
                let found = findSplit(current.root, split);

                if (!found) {
                    return current;
                }

                if (shown && shown.length === sizes.length && shown.length < found.children.length) {
                    let indices = shown.map((id) => found.children.findIndex((child) => contains(child, id)));

                    if (indices.includes(-1)) {
                        return current;
                    }

                    let next = [...found.sizes],
                        share = indices.reduce((sum, i) => sum + (found.sizes[i] ?? 0), 0),
                        total = sizes.reduce((sum, size) => sum + size, 0) || 1;

                    indices.forEach((i, j) => {
                        next[i] = share * sizes[j] / total;
                    });

                    return { ...current, root: updateSplit(current.root, split, normalizeSizes(next, next.length)) };
                }

                if (found.children.length !== sizes.length) {
                    return current;
                }

                return { ...current, root: updateSplit(current.root, split, normalizeSizes(sizes, sizes.length)) };
            });
        },

        // A fraction of the main area for the bottom dock, pixels for a sidebar.
        resizeDock(placement: Placement, size: number) {
            update((current) => ({ ...current, [placement]: { ...current[placement], size } }));
        },

        // Moves the surface into a new group beside 'group', splitting along 'direction' in the group's own dock.
        split(surface: string, group: string, direction: Direction, side: Side) {
            structural((current) => {
                let source = findSurfaceGroup(current.root, surface),
                    target = findGroup(current.root, group),
                    item = source?.surfaces.find((entry) => entry.id === surface);

                if (
                    !source ||
                    !item ||
                    !target ||
                    item.sortable === false ||
                    (source.id === group && source.surfaces.length === 1) ||
                    (target.placement !== undefined && stationary(current.root, target.placement))
                ) {
                    return current;
                }

                let created: Group = { active: item.id, id: id('group'), kind: 'group', placement: target.placement, surfaces: [item] },
                    root = take(current.root, source, surface);

                // The source was the target and held only this surface: nothing is left to split beside.
                if (root === null || !findGroup(root, group)) {
                    return current;
                }

                // An empty group takes the surface itself rather than splitting beside its empty state.
                if (target.surfaces.length === 0) {
                    return { ...current, active: group, root: updateGroup(root, group, (entry) => ({ ...entry, active: item.id, surfaces: [item] })) };
                }

                return { ...current, active: created.id, root: insertSplit(root, group, direction, created, side, id) };
            });
        },

        // Shows or hides the dock, flipping it unless 'open' says which; a dock without groups counts as hidden. One
        // opening without a group gets an empty one, so its empty state has somewhere to render.
        toggle(placement: Placement, open?: boolean) {
            update((current) => {
                let has = allGroups(current.root).some((group) => docked(group, placement)),
                    next = open ?? !(current[placement].open && has);

                if (!next) {
                    if (!current[placement].open) {
                        return current;
                    }

                    return placement === 'bottom'
                        ? { ...current, bottom: { ...current.bottom, maximized: false, open: false } }
                        : { ...current, [placement]: { ...current[placement], open: false } };
                }

                if (has) {
                    return current[placement].open ? current : { ...current, [placement]: { ...current[placement], open: true } };
                }

                let group: Group = { active: null, id: id('group'), kind: 'group', placement, surfaces: [] };

                return {
                    ...current,
                    active: group.id,
                    [placement]: { ...current[placement], open: true },
                    root: current.root === null
                        ? group
                        : insertRoot(current.root, placement === 'bottom' ? 'column' : 'row', group, placement === 'left' ? 'before' : 'after', id)
                };
            });
        },

        // Returns to the view before the current zoom, with the group it had maximized.
        unzoom,

        // Narrows the view to these groups, filling the layout with them in their arrangement. Stepping back out
        // restores the group maximized before it.
        zoom(groups: string[]) {
            update((current) => {
                let existing = new Set(allGroups(current.root).map((group) => group.id)),
                    level = groups.filter((id) => existing.has(id));

                if (level.length === 0) {
                    return current;
                }

                return {
                    ...current,
                    active: level.includes(current.active ?? '') ? current.active : level[0],
                    bottom: { ...current.bottom, maximized: false },
                    maximized: null,
                    zoom: [...current.zoom, { groups: level, maximized: current.maximized }]
                };
            });
        }
    };
};


export default state;
export { allGroups, bounded, contains, docked, findGroup, findSplit, findSurfaceGroup, fixed, MIN_FRACTION, stationary };
export type { Direction, Dock, Group, Layout, Node, Placement, Saved, Side, Split, Store, Surface, Zoom };
