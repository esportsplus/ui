import assert from 'node:assert/strict';
import test from 'node:test';
import state from '../src/components/panels/model.ts';


const surface = (id) => ({ id, kind: id });

// Two groups side by side: a holds 'one' and 'two', b holds 'three'.
const pair = () => state({
    root: {
        children: [
            { active: 'one', id: 'group-1', kind: 'group', surfaces: [surface('one'), surface('two')] },
            { active: 'three', id: 'group-2', kind: 'group', surfaces: [surface('three')] }
        ],
        direction: 'row',
        id: 'split-1',
        kind: 'split',
        sizes: [0.5, 0.5]
    }
});

const tabs = (layout) => {
    let groups = [],
        walk = (node) => node.kind === 'group' ? groups.push(`${node.id}:${node.surfaces.map((s) => (s.id === node.active ? '*' : '') + s.id).join(',')}`) : node.children.forEach(walk);

    if (layout.root) {
        walk(layout.root);
    }

    return groups;
};


test('opening shows a surface where it is, or adds it to the focused group', () => {
    let panels = pair();

    panels.open(surface('two'));
    assert.deepEqual(tabs(panels.layout), ['group-1:one,*two', 'group-2:*three']);

    panels.focus('group-2');
    panels.open(surface('four'));
    assert.deepEqual(tabs(panels.layout), ['group-1:one,*two', 'group-2:three,*four']);

    // Opened into a named group, a surface open elsewhere moves there.
    panels.open(surface('one'), 'group-2');
    assert.deepEqual(tabs(panels.layout), ['group-1:*two', 'group-2:three,four,*one']);
});

test('an empty layout opens a surface into a new group', () => {
    let panels = state();

    panels.open(surface('one'));
    assert.equal(panels.layout.root.kind, 'group');
    assert.deepEqual(tabs(panels.layout), ['group-1:*one']);
    assert.equal(panels.layout.active, 'group-1');
});

test('moving reorders within a group and empties a group it leaves', () => {
    let panels = pair();

    panels.move('one', 'group-1', 1);
    assert.deepEqual(tabs(panels.layout), ['group-1:two,*one', 'group-2:*three']);

    panels.move('three', 'group-1', 0);
    assert.equal(panels.layout.root.kind, 'group');
    assert.deepEqual(tabs(panels.layout), ['group-1:*three,two,one']);
});

test('closing hands the active tab to its neighbour and drops an emptied group', () => {
    let panels = pair();

    panels.activate('two');
    panels.close('two');
    assert.deepEqual(tabs(panels.layout), ['group-1:*one', 'group-2:*three']);

    panels.close('three');
    assert.deepEqual(tabs(panels.layout), ['group-1:*one']);
    assert.equal(panels.layout.active, 'group-1');
});

test('close others and close to the right keep the chosen tab', () => {
    let panels = state({ root: { active: 'a', id: 'group-1', kind: 'group', surfaces: ['a', 'b', 'c', 'd'].map(surface) } });

    panels.closeRight('group-1', 'b');
    assert.deepEqual(tabs(panels.layout), ['group-1:*a,b']);

    panels.closeOthers('group-1', 'b');
    assert.deepEqual(tabs(panels.layout), ['group-1:*b']);
});

test('splitting joins a split along the same axis and wraps across it', () => {
    let panels = pair();

    panels.split('two', 'group-2', 'row', 'after');
    assert.deepEqual(panels.layout.root.children.map((child) => child.id), ['group-1', 'group-2', 'group-3']);
    assert.deepEqual(panels.layout.root.sizes.map((size) => +size.toFixed(3)), [0.333, 0.333, 0.333]);

    panels.split('one', 'group-2', 'column', 'before');

    let wrapped = panels.layout.root.children[0];

    assert.equal(wrapped.kind, 'split');
    assert.equal(wrapped.direction, 'column');
    assert.deepEqual(wrapped.children.map((child) => child.id), ['group-4', 'group-2']);
    assert.equal(panels.layout.active, 'group-4');
});

test('a lone surface cannot split beside its own group', () => {
    let panels = pair(),
        before = panels.layout;

    panels.split('three', 'group-2', 'row', 'after');
    assert.deepEqual(tabs(panels.layout), tabs(before));
});

test('docking moves a surface into a bottom group spanning the layout', () => {
    let panels = pair();

    panels.dock('two');

    let root = panels.layout.root;

    assert.equal(root.direction, 'column');
    assert.deepEqual(root.sizes, [0.75, 0.25]);
    assert.equal(root.children[1].placement, 'bottom');
    assert.deepEqual(tabs(panels.layout), ['group-1:*one', 'group-2:*three', 'group-3:*two']);
    assert.equal(panels.layout.bottom.open, true);
});

test('resizing keeps every pane above the minimum share', () => {
    let panels = pair();

    panels.resize('split-1', [0.99, 0.01]);
    assert.deepEqual(panels.layout.root.sizes.map((size) => +size.toFixed(3)), [0.892, 0.108]);

    panels.resizeBottom(2);
    assert.equal(panels.layout.bottom.size, 0.9);
});

test('focusing another group while one is maximized maximizes it instead', () => {
    let panels = pair();

    panels.maximize('group-1');
    assert.equal(panels.layout.maximized, 'group-1');

    panels.focus('group-2');
    assert.equal(panels.layout.maximized, 'group-2');

    panels.maximize('group-2');
    assert.equal(panels.layout.maximized, null);

    // A structural change restores the layout first.
    panels.maximize('group-1');
    panels.move('three', 'group-1');
    assert.equal(panels.layout.maximized, null);
});

test('the dock closes, and opens with an empty group to launch into', () => {
    let panels = pair();

    panels.toggleBottom();
    assert.equal(panels.layout.bottom.open, false);

    panels.toggleBottom();

    let docked = panels.layout.root.children.at(-1);

    assert.equal(panels.layout.bottom.open, true);
    assert.equal(docked.placement, 'bottom');
    assert.deepEqual(docked.surfaces, []);
});

test('nested splits along one axis flatten, keeping their shares', () => {
    let panels = state({
        root: {
            children: [
                { active: 'a', id: 'group-1', kind: 'group', surfaces: [surface('a')] },
                {
                    children: [
                        { active: 'b', id: 'group-2', kind: 'group', surfaces: [surface('b')] },
                        { active: 'c', id: 'group-3', kind: 'group', surfaces: [surface('c')] }
                    ],
                    direction: 'row',
                    id: 'split-2',
                    kind: 'split',
                    sizes: [0.5, 0.5]
                }
            ],
            direction: 'row',
            id: 'split-1',
            kind: 'split',
            sizes: [0.5, 0.5]
        }
    });

    assert.deepEqual(panels.layout.root.children.map((child) => child.id), ['group-1', 'group-2', 'group-3']);
    assert.deepEqual(panels.layout.root.sizes, [0.5, 0.25, 0.25]);
});

test('new ids continue past the ones the layout starts with', () => {
    let panels = pair();

    panels.open(surface('four'), undefined);
    panels.dock('four');
    assert.ok(tabs(panels.layout).some((group) => group.startsWith('group-3:')));
});
