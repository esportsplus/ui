import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { EditorWorkspaceModel, dirty, workspacePath } =
    await import('../src/components/editor/workspace/model.ts');
const { createMemoryWorkspaceHost } = await import('../docs/src/examples/code-editor/fixtures/workspace.ts');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
async function fixture(files = { 'src/a.ts': 'one\r\ntwo', 'b.md': '# Hello', 'c.json': '{}' }) {
    const host = createMemoryWorkspaceHost(files),
        model = new EditorWorkspaceModel(host, '/project');
    await model.start();
    return { host, model };
}

test('path identity supports Windows/POSIX open targets and rejects escaping paths', () => {
    assert.equal(workspacePath('C:\\Project\\src\\a.ts', 'c:/project'), 'src/a.ts');
    assert.equal(workspacePath('/project/src/a.ts', '/project'), 'src/a.ts');
    assert.equal(workspacePath('src\\a.ts'), 'src/a.ts');
    for (const path of ['../a.ts', 'src/../a.ts', '/elsewhere/a.ts', 'src//a.ts', '', 'src/\0.ts'])
        assert.throws(() => workspacePath(path, '/project'));
});

test('memory host retains empty directories and reverses directory rename/delete', async (t) => {
    const host = createMemoryWorkspaceHost({ 'src/a.ts': 'a' }, {}, ['empty/nested']),
        model = new EditorWorkspaceModel(host, '/project');
    t.after(() => model.dispose());
    await model.start();
    assert.ok(model.state.entries.some((entry) => entry.path === 'empty/nested' && entry.kind === 'directory'));
    await model.delete(['src/a.ts']);
    assert.ok(model.state.entries.some((entry) => entry.path === 'src'));
    await model.rename('empty', 'vacant');
    assert.ok(model.state.entries.some((entry) => entry.path === 'vacant/nested'));
    await model.undoFiles();
    assert.ok(model.state.entries.some((entry) => entry.path === 'empty/nested'));
    await model.delete(['empty']);
    assert.ok(!model.state.entries.some((entry) => entry.path.startsWith('empty')));
    await model.undoFiles();
    assert.ok(model.state.entries.some((entry) => entry.path === 'empty/nested'));
});

test('deduplicated failed opens show the current request error without replacing the active tab', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    await model.open('src/a.ts');
    const pending = deferred();
    host.read = () => pending.promise;
    const first = model.open('missing.ts'),
        second = model.open('missing.ts');
    pending.reject(new Error('permission denied'));
    await Promise.all([first, second]);
    assert.match(model.state.status, /permission denied/);
    assert.equal(model.state.active.path, 'src/a.ts');
});

test('typing emits only when a tab turns dirty or clean, never per keystroke', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    const a = await model.open('src/a.ts');
    await model.open('b.md');
    let emits = 0;
    const saved = a.saved,
        stop = model.subscribe(() => emits++);
    a.document.setValue(`${saved}!`);
    assert.equal(emits, 1);
    for (let i = 0; i < 50; i++) a.document.replace(a.document.value.length, a.document.value.length, 'x');
    assert.equal(emits, 1);
    a.document.setValue(saved);
    assert.equal(emits, 2);
    assert.equal(dirty(a), false);
    a.document.select({ start: 1, end: 1 });
    assert.equal(emits, 2);
    stop();
});

test('host actions run against workspace-relative paths and report failures in the status line', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const calls = [],
        action = { id: 'tag', label: 'Tag', run: (cwd, paths) => { calls.push([cwd, paths]); } };
    await model.run(action, ['src/a.ts', 'b.md']);
    assert.deepEqual(calls, [['/project', ['src/a.ts', 'b.md']]]);
    await model.run({ ...action, run: () => { throw new Error('offline'); } }, ['b.md']);
    assert.equal(model.state.status, 'Tag failed: offline');
    assert.equal(model.state.statusKind, 'error');
    await model.run(action, ['../escape.ts']);
    assert.match(model.state.status, /^Tag failed: path is outside|^Tag failed: a valid/);
    assert.equal(calls.length, 1);
    assert.equal(host.watchCount(), 1);
});

test('tabs retain independent documents, undo, selection and scroll; closing chooses the next neighbor', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const a = await model.open('src/a.ts'),
        b = await model.open('b.md'),
        c = await model.open('c.json');
    a.document.setValue('draft');
    a.document.select({ start: 3, end: 3 });
    a.scroll = { top: 80, left: 20 };
    model.activate(a);
    assert.equal(model.state.active.document, a.document);
    assert.equal(dirty(a), true);
    assert.equal(a.document.undo(), true);
    assert.equal(a.document.value, 'one\r\ntwo');
    model.activate(b);
    assert.equal(await model.close(), true);
    assert.equal(model.state.active, c);
    assert.equal(await model.close(), true);
    assert.equal(model.state.active, a);
    assert.equal(a.scroll.top, 80);
    assert.equal(host.watchCount(), 1);
    model.stop();
    assert.equal(host.watchCount(), 0);
    await model.start();
    assert.equal(host.watchCount(), 1);
});

test('open reads deduplicate, latest intent wins and closing a pending open cancels it', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const original = host.read,
        aRead = deferred(),
        bRead = deferred();
    let count = 0;
    host.read = async (_cwd, path) => {
        count++;
        return path === 'src/a.ts' ? aRead.promise : bRead.promise;
    };
    const a = model.open('src/a.ts'),
        aAgain = model.open('src/a.ts'),
        b = model.open('b.md');
    bRead.resolve('# b');
    await b;
    aRead.resolve('a');
    await a;
    await aAgain;
    assert.equal(count, 2);
    assert.equal(model.state.active.path, 'b.md');
    assert.equal(model.state.tabs.length, 2);
    host.read = async () => {
        await Promise.resolve();
        return '{}';
    };
    const pending = model.open('c.json');
    await model.close('c.json');
    await pending;
    assert.ok(!model.state.tabs.some((tab) => tab.path === 'c.json'));
    host.read = original;
});

test('a save marks only its captured snapshot saved, and queued writes cannot finish out of order', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    const first = deferred(),
        started = deferred(),
        values = [],
        original = host.write;
    host.write = async (cwd, path, value) => {
        values.push(value);
        if (values.length === 1) {
            started.resolve();
            await first.promise;
        }
        await original(cwd, path, value);
    };
    tab.document.setValue('snapshot');
    const save = model.save();
    await started.promise;
    tab.document.setValue('typed during write');
    const nextSave = model.save();
    first.resolve();
    await save;
    assert.equal(tab.saved, 'snapshot');
    assert.equal(dirty(tab), true);
    await nextSave;
    assert.equal(tab.saved, 'typed during write');
    assert.equal(dirty(tab), false);
    assert.deepEqual(values, ['snapshot', 'typed during write']);
});

test('failed saves leave drafts dirty and failures do not poison the operation queue', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    tab.document.setValue('draft');
    const write = host.write;
    host.write = async () => {
        throw new Error('Disk is full');
    };
    assert.equal(await model.save(), undefined);
    assert.equal(dirty(tab), true);
    assert.match(model.state.status, /Disk is full/);
    host.write = write;
    assert.equal(await model.save(), true);
    assert.equal(dirty(tab), false);
});

test('watcher refresh updates clean tabs, preserves dirty tabs and rechecks cleanliness after an async read', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const a = await model.open('src/a.ts'),
        b = await model.open('b.md');
    b.document.setValue('my draft');
    host.change('src/a.ts', 'external');
    host.change('b.md', 'remote draft');
    await model.whenIdle();
    assert.equal(a.document.value, 'external');
    assert.equal(b.document.value, 'my draft');
    assert.equal(b.saved, '# Hello');
    const reading = deferred(),
        readStarted = deferred(),
        read = host.read;
    host.read = async (_cwd, path) => {
        if (path === 'src/a.ts') {
            readStarted.resolve();
            return reading.promise;
        }
        return read(_cwd, path);
    };
    const refresh = model.refresh();
    await readStarted.promise;
    a.document.setValue('typed while read pending');
    reading.resolve('stale remote');
    await refresh;
    assert.equal(a.document.value, 'typed while read pending');
    assert.equal(a.saved, 'external');
});

test('older list responses cannot replace a newer watcher snapshot', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const old = deferred(),
        fresh = deferred();
    let lists = 0;
    host.list = async () => (++lists === 1 ? old.promise : fresh.promise);
    const a = model.refresh(),
        b = model.refresh();
    fresh.resolve([{ path: 'fresh.ts', kind: 'file' }]);
    await b;
    old.resolve([{ path: 'stale.ts', kind: 'file' }]);
    await a;
    assert.deepEqual(
        model.state.entries.map((entry) => entry.path),
        ['fresh.ts']
    );
});

test('rename carries dirty descendant tabs and independent file undo reverses it', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    tab.document.setValue('draft');
    const document = tab.document;
    assert.equal(await model.rename('src', 'lib'), true);
    assert.equal(tab.path, 'lib/a.ts');
    assert.equal(tab.document, document);
    assert.equal(model.state.active.path, 'lib/a.ts');
    assert.equal(dirty(tab), true);
    assert.equal(await model.undoFiles(), true);
    assert.equal(tab.path, 'src/a.ts');
    assert.equal(tab.document.value, 'draft');
    assert.equal(await host.read('/project', 'src/a.ts'), 'one\r\ntwo');
    assert.equal(await model.rename('src', 'src/inner'), undefined);
    assert.match(model.state.status, /inside itself/);
});

test('dirty close/delete offer save, discard and cancellation; document undo stays independent', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    tab.document.setValue('draft');
    host.confirm = () => 'cancel';
    assert.equal(await model.close(), false);
    assert.equal(await model.delete(['src/a.ts']), false);
    host.confirm = () => 'save';
    assert.equal(await model.close(), true);
    assert.equal(await host.read('/project', 'src/a.ts'), 'draft');
    const b = await model.open('b.md');
    b.document.setValue('discard me');
    host.confirm = () => 'discard';
    assert.equal(await model.delete(['b.md']), true);
    assert.ok(!model.state.tabs.includes(b));
    assert.equal(await model.undoFiles(), true);
    assert.equal(await host.read('/project', 'b.md'), '# Hello');
});

test('a draft edited while delete awaits IO survives as a missing-file tab', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    const started = deferred(),
        remove = deferred(),
        original = host.delete;
    host.delete = async (cwd, paths) => {
        started.resolve();
        await remove.promise;
        return original(cwd, paths);
    };
    const deleting = model.delete(['src/a.ts']);
    await started.promise;
    tab.document.setValue('keep this new draft');
    remove.resolve();
    await deleting;
    assert.ok(model.state.tabs.includes(tab));
    assert.equal(tab.document.value, 'keep this new draft');
    assert.equal(tab.missing, true);
    assert.equal(await model.save(tab), true);
    assert.equal(await host.read('/project', 'src/a.ts'), 'keep this new draft');
});

test('pending deletion and rename overlays survive a stale index until acknowledgement', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const list = host.list,
        stale = await list('/project');
    host.list = async () => stale;
    assert.equal(await model.delete(['b.md']), true);
    await model.refresh();
    assert.ok(!model.state.entries.some((entry) => entry.path === 'b.md'));
    assert.equal(await model.rename('src/a.ts', 'src/new.ts'), true);
    await model.refresh();
    assert.ok(model.state.entries.some((entry) => entry.path === 'src/new.ts'));
    assert.ok(!model.state.entries.some((entry) => entry.path === 'src/a.ts'));
    host.list = list;
    await model.refresh();
    assert.ok(model.state.entries.some((entry) => entry.path === 'src/new.ts'));
    await model.undoFiles();
    assert.ok(model.state.entries.some((entry) => entry.path === 'src/a.ts'));
});

test('preferences load safely and serialize snapshots; failed writes do not stop subsequent writes', async (t) => {
    const host = createMemoryWorkspaceHost({ 'a.ts': 'a' }),
        pending = deferred(),
        written = [];
    host.preferences.get = () => pending.promise;
    host.preferences.set = async (value) => {
        written.push({ ...value });
        if (written.length === 1) throw new Error('offline');
    };
    const model = new EditorWorkspaceModel(host, '/project');
    t.after(() => model.dispose());
    const starting = model.start();
    model.setPreferences({ wrapText: true });
    model.setPreferences({ explorerSide: 'left', showWhitespace: true });
    pending.resolve({ wrapText: false, explorerSide: 'right' });
    await starting;
    await model.whenIdle();
    assert.equal(model.state.preferences.wrapText, true);
    assert.equal(model.state.preferences.explorerSide, 'left');
    assert.equal(written[0].explorerSide, 'right');
    assert.equal(written[1].explorerSide, 'left');
});

test('open-path plus line targets are clamped and deduplicated by request ID, including an already active tab', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    await model.openTarget({ path: 'src/a.ts', line: 2, column: 2, requestId: 1 });
    assert.deepEqual(model.state.active.document.position(), { line: 2, column: 2 });
    const request = model.state.reveal.request;
    await model.openTarget({ path: 'src/a.ts', line: 1, requestId: 1 });
    assert.equal(model.state.reveal.request, request);
    await model.openTarget({ path: 'src/a.ts', line: 999, column: 999, requestId: 2 });
    assert.deepEqual(model.state.active.document.position(), { line: 2, column: 4 });
});

test('missing files retain drafts, host actions execute, workspace changes and disposal invalidate async work', async (t) => {
    const { host, model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts');
    tab.document.setValue('draft');
    host.change('src/a.ts', null);
    await model.whenIdle();
    assert.equal(tab.missing, true);
    assert.equal(tab.document.value, 'draft');
    await model.copyPath('src/a.ts');
    assert.deepEqual(host.copiedPaths, ['/project/src/a.ts']);
    host.confirm = () => 'cancel';
    assert.equal(await model.setWorkspace('/other'), false);
    host.confirm = () => 'discard';
    assert.equal(await model.setWorkspace('/other'), true);
    assert.equal(model.state.tabs.length, 0);
    const pending = deferred();
    host.read = () => pending.promise;
    const opening = model.open('late.ts');
    model.dispose();
    pending.resolve('late');
    await opening;
    assert.equal(model.state.tabs.length, 0);
    assert.equal(host.watchCount(), 0);
});
