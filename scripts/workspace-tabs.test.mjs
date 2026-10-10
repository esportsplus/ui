import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { EditorWorkspaceModel, dirty } = await import('../src/components/editor/workspace/model.ts');
const { closable, compareKey, order, place, sides } = await import('../src/components/editor/workspace/tabs.ts');
const { createMemoryWorkspaceHost } = await import('../docs/src/examples/code-editor/fixtures/workspace.ts');
async function fixture(files = { 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c', 'd.ts': 'd' }) {
    const host = createMemoryWorkspaceHost(files),
        model = new EditorWorkspaceModel(host, '/project');
    await model.start();
    return { host, model };
}
const paths = (model) => model.state.tabs.map((tab) => tab.path);
const stub = (path, fields = {}) => ({ document: { value: '' }, missing: false, path, pinned: false, preview: false, saved: '', ...fields });

test('a preview takes the last preview tab\'s place and pinned tabs sort first, stably', () => {
    const tabs = [stub('a'), stub('b', { preview: true }), stub('c')];
    assert.equal(place(tabs, stub('d', { preview: true })).path, 'b');
    assert.deepEqual(tabs.map((tab) => tab.path), ['a', 'd', 'b', 'c']);
    assert.equal(place(tabs, stub('e')), undefined);
    assert.equal(tabs.at(-1).path, 'e');
    const list = [stub('a'), stub('b', { pinned: true }), stub('c'), stub('d', { pinned: true })];
    order(list);
    assert.deepEqual(list.map((tab) => tab.path), ['b', 'd', 'a', 'c']);
});

test('bulk closes spare pinned tabs, the tab asked from, and unsaved or missing drafts for close saved', () => {
    const tabs = [
        stub('p', { pinned: true }),
        stub('a'),
        stub('b', { document: { value: 'draft' } }),
        stub('c', { missing: true }),
        stub('d')
    ];
    const names = (list) => list.map((tab) => tab.path);
    assert.deepEqual(names(closable(tabs, 'others', 'b')), ['a', 'c', 'd']);
    assert.deepEqual(names(closable(tabs, 'right', 'b')), ['c', 'd']);
    assert.deepEqual(names(closable(tabs, 'right', 'missing')), []);
    assert.deepEqual(names(closable(tabs, 'saved')), ['a', 'd']);
});

test('conflict markers split back into the current, incoming and base versions', () => {
    const text = 'top\n<<<<<<< ours\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> theirs\nmid\n<<<<<<< ours\nx\n=======\ny\n>>>>>>> theirs';
    assert.deepEqual(sides(text), { base: null, current: 'top\nmine\nmid\nx', incoming: 'top\ntheirs\nmid\ny' });
    const based = 'a\n<<<<<<< ours\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> theirs\nz\n';
    assert.deepEqual(sides(based), { base: 'a\nold\nz\n', current: 'a\nmine\nz\n', incoming: 'a\ntheirs\nz\n' });
    assert.equal(sides('no conflicts here'), null);
    assert.match(compareKey('a.ts', 'b.ts'), /\0/);
});

test('single-click opens reuse one preview tab until it is edited or opened again as pinned', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    await model.open('a.ts', undefined, undefined, true);
    await model.open('b.ts', undefined, undefined, true);
    assert.deepEqual(paths(model), ['b.ts']);
    assert.equal(model.state.active.preview, true);
    const b = model.state.active;
    b.document.setValue('edited');
    assert.equal(b.preview, false);
    await model.open('c.ts', undefined, undefined, true);
    assert.deepEqual(paths(model), ['b.ts', 'c.ts']);
    await model.open('c.ts');
    assert.equal(model.state.active.preview, false);
    await model.open('d.ts', undefined, undefined, true);
    await model.open('c.ts', undefined, undefined, true);
    assert.deepEqual(paths(model), ['b.ts', 'c.ts', 'd.ts']);
    assert.equal(model.state.tabs[1].preview, false);
    assert.equal(model.state.active.path, 'c.ts');
});

test('concurrent preview and pinned opens of one file share its tab and leave it pinned', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    const [first, second] = await Promise.all([model.open('a.ts', undefined, undefined, true), model.open('a.ts')]);
    assert.equal(first, second);
    assert.equal(first.preview, false);
});

test('pinning moves a tab to the end of the pinned group, keeps it from preview and close others', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    for (const path of ['a.ts', 'b.ts', 'c.ts']) await model.open(path);
    await model.open('d.ts', undefined, undefined, true);
    model.pin('c.ts');
    model.pin('d.ts');
    assert.deepEqual(paths(model), ['c.ts', 'd.ts', 'a.ts', 'b.ts']);
    assert.equal(model.state.tabs[1].preview, false);
    assert.equal(model.state.tabs[1].pinned, true);
    model.unpin('c.ts');
    assert.deepEqual(paths(model), ['d.ts', 'c.ts', 'a.ts', 'b.ts']);
    assert.equal(await model.closeOthers('a.ts'), true);
    assert.deepEqual(paths(model), ['d.ts', 'a.ts']);
});

test('close to the right and close saved ask once for every unsaved draft they close', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    for (const path of ['a.ts', 'b.ts', 'c.ts', 'd.ts']) await model.open(path);
    model.state.tabs[2].document.setValue('draft');
    model.state.tabs[3].document.setValue('draft');
    const asked = [];
    model.setConfirmation((request) => {
        asked.push(request);
        return 'discard';
    });
    assert.equal(await model.closeSaved(), true);
    assert.deepEqual(paths(model), ['c.ts', 'd.ts']);
    assert.equal(asked.length, 0);
    assert.equal(await model.closeRight('c.ts'), true);
    assert.deepEqual(asked.map((request) => request.dirty), [['d.ts']]);
    assert.deepEqual(paths(model), ['c.ts']);
    model.setConfirmation(() => 'cancel');
    await model.open('a.ts');
    model.state.active.document.setValue('draft');
    assert.equal(await model.closeOthers('c.ts'), false);
    assert.deepEqual(paths(model), ['c.ts', 'a.ts']);
});

test('a compare tab is read-only: never dirty, never saved, kept by refresh and apart from file paths', async (t) => {
    const { host, model } = await fixture({ 'a.ts': 'one', 'b.ts': 'two' });
    t.after(() => model.dispose());
    const tab = await model.compare('a.ts', '/project/b.ts');
    assert.deepEqual(tab.compare, { modified: 'two', original: 'one', paths: ['a.ts', 'b.ts'] });
    assert.equal(model.state.active, tab);
    assert.equal(dirty(tab), false);
    assert.equal(await model.compare('a.ts', 'b.ts'), tab);
    assert.equal(model.state.tabs.length, 1);
    await model.refresh();
    assert.equal(tab.missing, false);
    assert.equal(await model.save(tab), false);
    assert.equal(host.writes.length, 0);
    const file = await model.open('a.ts');
    assert.notEqual(file, tab);
    await model.rename('a.ts', 'z.ts');
    assert.equal(tab.path, compareKey('a.ts', 'b.ts'));
    assert.equal(await model.close(tab.path), true);
    assert.deepEqual(paths(model), ['z.ts']);
    await model.compare('a.ts', 'b.ts');
    assert.match(model.state.status, /Compare failed/);
    assert.deepEqual(paths(model), ['z.ts']);
});
