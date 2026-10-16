import { read, signal, write } from '@esportsplus/reactivity';


type Direction = 'column' | 'row';

type Group = {
    active: string | null;
    id: string;
    kind: 'group';
    // Docked groups span the whole layout's width below everything else, and show and hide together.
    placement?: 'bottom';
    // Stacks every surface in a scrolling column instead of showing the active one.
    scrollable?: boolean;
    surfaces: Surface[];
};

type Layout = {
    active: string | null;
    bottom: { maximized: boolean; open: boolean; size: number };
    maximized: string | null;
    root: Node | null;
};

type Node = Group | Split;

type Options = {
    root?: Node | null;
    // A localStorage key the layout restores from and saves to.
    storage?: string;
};

type Side = 'after' | 'before';

type Split = {
    children: Node[];
    direction: Direction;
    id: string;
    kind: 'split';
    // Fractions of the split, one per child, summing to 1.
    sizes: number[];
};

// What a tab shows: 'kind' names the catalog entry that titles and renders it.
type Surface = { id: string; kind: string };


// A pane never shrinks below this share of its split.
const MIN_FRACTION = 0.1;

const BOTTOM_SIZE = 0.25;


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
        groups = allGroups(root);

    return {
        ...layout,
        active: groups.some((group) => group.id === layout.active) ? layout.active : (groups[0]?.id ?? null),
        bottom: { ...layout.bottom, size: bounded(layout.bottom.size) },
        root
    };
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

// Takes the surface out of its group, handing the group's active tab to a neighbour, and drops the group with it when
// it was the last.
function take(root: Node | null, source: Group, id: string) {
    let index = source.surfaces.findIndex((surface) => surface.id === id),
        surfaces = source.surfaces.filter((surface) => surface.id !== id);

    if (surfaces.length === 0) {
        return removeLeaf(root, source.id);
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


// The layout's one source of truth: an immutable tree in a signal, replaced whole by each operation. Structural
// operations restore a maximized group first, as moving panes around under it would leave it covering the wrong one.
const state = ({ root = null, storage }: Options = {}) => {
    let counter = 1,
        layout = signal<Layout>(normalizeLayout({
            active: null,
            bottom: { maximized: false, open: true, size: BOTTOM_SIZE },
            maximized: null,
            root: load() ?? root
        }));

    // Generated ids continue past every id the restored tree holds, so a new group never collides with an old one.
    for (let group of allGroups(read(layout).root)) {
        counter = Math.max(counter, Number(/-(\d+)$/.exec(group.id)?.[1] ?? 0) + 1);
    }

    function id(prefix: string) {
        return `${prefix}-${counter++}`;
    }

    function load(): Node | null {
        if (!storage || typeof localStorage === 'undefined') {
            return null;
        }

        try {
            return JSON.parse(localStorage.getItem(storage) ?? 'null')?.root ?? null;
        }
        catch {
            return null;
        }
    }

    function structural(change: (current: Layout) => Layout) {
        update((current) => change({ ...current, bottom: { ...current.bottom, maximized: false }, maximized: null }));
    }

    function update(change: (current: Layout) => Layout) {
        let next = normalizeLayout(change(read(layout)));

        write(layout, next);

        if (storage && typeof localStorage !== 'undefined') {
            localStorage.setItem(storage, JSON.stringify({ root: next.root }));
        }
    }

    function visible(group: Group, current: Layout): Layout {
        return group.placement === 'bottom' ? { ...current, bottom: { ...current.bottom, open: true } } : current;
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

        close(surface: string) {
            structural((current) => {
                let group = findSurfaceGroup(current.root, surface);

                return group ? { ...current, root: take(current.root, group, surface) } : current;
            });
        },

        closeAll() {
            structural((current) => ({ ...current, root: null }));
        },

        closeGroup(group: string) {
            structural((current) => ({ ...current, root: removeLeaf(current.root, group) }));
        },

        closeOthers(group: string, surface: string) {
            structural((current) => ({
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
            structural((current) => ({
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

        // Moves the surface into a group of its own docked along the bottom, spanning the whole layout.
        dock(surface: string, side: Side = 'after') {
            structural((current) => {
                let source = findSurfaceGroup(current.root, surface),
                    item = source?.surfaces.find((entry) => entry.id === surface);

                if (!source || !item || (current.root?.kind === 'group' && source.surfaces.length === 1)) {
                    return current;
                }

                let group: Group = { active: item.id, id: id('group'), kind: 'group', placement: 'bottom', surfaces: [item] },
                    root = take(current.root, source, surface);

                if (root === null) {
                    return current;
                }

                return {
                    ...current,
                    active: group.id,
                    bottom: { ...current.bottom, open: true },
                    root: insertRoot(root, 'column', group, side, id)
                };
            });
        },

        // Focusing another group while one is maximized maximizes it instead.
        focus(group: string) {
            update((current) => {
                let found = findGroup(current.root, group);

                if (!found) {
                    return current;
                }

                return {
                    ...current,
                    active: group,
                    maximized: found.placement !== 'bottom' && current.maximized !== null ? group : current.maximized
                };
            });
        },

        // Tracked: reading it inside an effect re-runs the effect on every change.
        get layout() {
            return read(layout);
        },

        // The bottom dock fills the layout; any other group fills its splits while its siblings collapse to a strip.
        maximize(group: string) {
            update((current) => {
                let found = findGroup(current.root, group);

                if (!found) {
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

                if (!source || !target || !item) {
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

                if (!group && target?.placement === 'bottom') {
                    target = allGroups(current.root).find((entry) => entry.placement !== 'bottom') ?? null;
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

        resize(split: string, sizes: number[]) {
            update((current) => {
                let found = findSplit(current.root, split);

                if (!found || found.children.length !== sizes.length) {
                    return current;
                }

                return { ...current, root: updateSplit(current.root, split, normalizeSizes(sizes, sizes.length)) };
            });
        },

        resizeBottom(size: number) {
            update((current) => ({ ...current, bottom: { ...current.bottom, size } }));
        },

        scrollable(group: string) {
            update((current) => ({
                ...current,
                root: updateGroup(current.root, group, ({ scrollable, ...entry }) => scrollable ? entry : { ...entry, scrollable: true })
            }));
        },

        // Moves the surface into a new group beside 'group', splitting along 'direction'.
        split(surface: string, group: string, direction: Direction, side: Side) {
            structural((current) => {
                let source = findSurfaceGroup(current.root, surface),
                    item = source?.surfaces.find((entry) => entry.id === surface);

                if (!source || !item || !findGroup(current.root, group) || (source.id === group && source.surfaces.length === 1)) {
                    return current;
                }

                let created: Group = { active: item.id, id: id('group'), kind: 'group', surfaces: [item] },
                    root = take(current.root, source, surface);

                // The source was the target and held only this surface: nothing is left to split beside.
                if (root === null || !findGroup(root, group)) {
                    return current;
                }

                return { ...current, active: created.id, root: insertSplit(root, group, direction, created, side, id) };
            });
        },

        // An empty bottom group appears when the dock opens without one, so the launcher has somewhere to render.
        toggleBottom() {
            update((current) => {
                if (current.bottom.open) {
                    return { ...current, bottom: { ...current.bottom, maximized: false, open: false } };
                }

                if (allGroups(current.root).some((group) => group.placement === 'bottom')) {
                    return { ...current, bottom: { ...current.bottom, open: true } };
                }

                let group: Group = { active: null, id: id('group'), kind: 'group', placement: 'bottom', surfaces: [] };

                return {
                    ...current,
                    active: group.id,
                    bottom: { ...current.bottom, open: true },
                    root: current.root === null ? group : insertRoot(current.root, 'column', group, 'after', id)
                };
            });
        }
    };
};


export default state;
export { allGroups, bounded, findGroup, MIN_FRACTION };
export type { Direction, Group, Layout, Node, Side, Split, Surface };
