import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { EditorWorkspaceModel, dirty } = await import('../src/components/editor/workspace/model.ts');
const { default: hosted, parse } = await import('../src/components/editor/workspace/session.ts');
const { default: navigate, step } = await import('../src/components/editor/workspace/navigate.ts');
const { createMemoryWorkspaceHost } = await import('../docs/src/examples/code-editor/fixtures/workspace.ts');

const FILES = { 'src/a.ts': 'alpha\nbeta\ngamma\n', 'src/b.ts': 'one\ntwo\n', 'c.md': '# C\n' };

async function fixture({ files = FILES, head, session, delay = 1 } = {}) {
    const host = createMemoryWorkspaceHost(files, {}, [], { head }),
        model = new EditorWorkspaceModel(host, '/project'),
        view = { shown: undefined },
        hosting = hosted(model, () => view.shown, delay);
    const writes = [];
    if (session !== undefined) await host.session.set(session);
    const set = host.session.set;
    host.session.set = async (next) => {
        writes.push(next);
        await set(next);
    };
    return { host, hosting, model, view, writes };
}

const idle = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

// Stands in for the code editor's controller: commands move the caret through 'marks' offsets, wrapping round.
function fakeEditor(tab, marks = { change: [], problem: [] }) {
    const document = tab.document,
        caret = () => (document.selection.direction === 'backward' ? document.selection.start : document.selection.end),
        move = (kind, backward) => {
            const list = marks[kind];
            if (!list.length) return false;
            const at = caret(),
                found = backward ? [...list].reverse().find((offset) => offset < at) : list.find((offset) => offset > at);
            document.select({ start: found ?? (backward ? list.at(-1) : list[0]) });
            return true;
        },
        folds = [];
    return {
        baselines: [],
        document,
        fold: (line) => (folds.includes(line) ? false : (folds.push(line), true)),
        folds: () => [...folds],
        host: { isConnected: true },
        nextChange: () => move('change', false),
        nextProblem: () => move('problem', false),
        previousChange: () => move('change', true),
        previousProblem: () => move('problem', true),
        scroller: { scrollLeft: 3, scrollTop: 40 },
        select(selection) {
            document.select(selection);
        },
        setBaseline(text) {
            this.baselines.push(text);
        },
        state: { problems: { errors: marks.problem.length, warnings: 0 } }
    };
}

test('parse keeps well-formed fields and drops what a hand-edited store got wrong', () => {
    assert.equal(parse(null), null);
    assert.equal(parse({ tabs: 'nope' }), null);
    assert.deepEqual(parse({
        active: 5,
        explorer: { expanded: ['src', 7], scroll: -3 },
        tabs: [
            { path: 'a.ts', folds: [1, 'x', 4], selection: { anchor: '2', head: 1 }, pinned: 'yes', draft: 1 },
            { nope: true },
            null
        ]
    }), {
        active: null,
        explorer: { expanded: ['src'], scroll: 0 },
        tabs: [{ folds: [1, 4], path: 'a.ts', pinned: false, preview: false, scroll: { left: 0, top: 0 }, selection: { anchor: 2, head: 1 } }]
    });
});

test('the session stores tabs, selection, scroll, folds, explorer state and only unsaved drafts', async (t) => {
    const { host, hosting, model, view, writes } = await fixture({ session: null });
    t.after(() => model.dispose());
    const stop = hosting.connect({ addEventListener() {}, ownerDocument: {} });
    t.after(stop);
    await hosting.restore();
    const a = await model.open('src/a.ts'),
        b = await model.open('src/b.ts');
    a.pinned = true;
    a.document.setValue('alpha draft\n');
    a.document.select({ direction: 'backward', end: 5, start: 2 });
    a.scroll = { left: 0, top: 12 };
    const editor = fakeEditor(b);
    editor.fold(2);
    view.shown = { controller: editor, tab: b };
    hosting.explorer.expanded = ['src'];
    hosting.explorer.scroll = 30;
    hosting.flush();
    const saved = writes.at(-1);
    assert.equal(saved.active, 'src/b.ts');
    assert.deepEqual(saved.explorer, { expanded: ['src'], scroll: 30 });
    assert.deepEqual(saved.tabs[0], {
        draft: 'alpha draft\n',
        folds: [],
        path: 'src/a.ts',
        pinned: true,
        preview: false,
        scroll: { left: 0, top: 12 },
        selection: { anchor: 5, head: 2 }
    });
    assert.deepEqual(saved.tabs[1], {
        folds: [2],
        path: 'src/b.ts',
        pinned: false,
        preview: false,
        scroll: { left: 3, top: 40 },
        selection: { anchor: 0, head: 0 }
    });
    // An unchanged session isn't written again.
    hosting.flush();
    assert.equal(writes.length, 1);
    // Typing schedules a debounced write rather than one per keystroke.
    for (let i = 0; i < 5; i++) a.document.replace(0, 0, 'x');
    assert.equal(writes.length, 1);
    await idle();
    assert.equal(writes.length, 2);
    assert.match(writes.at(-1).tabs[0].draft, /^xxxxxalpha draft/);
    assert.ok(host.contents.get('src/a.ts').startsWith('alpha\n'));
});

test('restore brings back tabs, hot-exit drafts against the file on disk and the active tab; nothing is written first', async (t) => {
    const stored = {
        active: 'src/b.ts',
        explorer: { expanded: ['src'], scroll: 24 },
        tabs: [
            { draft: 'alpha edited\n', folds: [], path: 'src/a.ts', pinned: true, preview: false, scroll: { left: 0, top: 8 }, selection: { anchor: 3, head: 1 } },
            { folds: [1], path: 'src/b.ts', pinned: false, preview: true, scroll: { left: 0, top: 0 }, selection: { anchor: 2, head: 2 } },
            { draft: 'kept\n', folds: [], path: 'gone.ts', pinned: false, preview: false, scroll: { left: 0, top: 0 }, selection: { anchor: 0, head: 0 } },
            { folds: [], path: 'dropped.ts', pinned: false, preview: false, scroll: { left: 0, top: 0 }, selection: { anchor: 0, head: 0 } }
        ]
    };
    const { hosting, model, view, writes } = await fixture({ session: stored });
    t.after(() => model.dispose());
    assert.equal(hosting.ready(), false);
    hosting.connect({ addEventListener() {}, ownerDocument: {} });
    await hosting.restore();
    assert.equal(hosting.ready(), true);
    assert.deepEqual(hosting.explorer, { expanded: ['src'], scroll: 24 });
    const [a, b, gone] = model.state.tabs;
    assert.deepEqual(model.state.tabs.map((tab) => tab.path), ['src/a.ts', 'src/b.ts', 'gone.ts']);
    assert.equal(a.document.value, 'alpha edited\n');
    assert.equal(a.saved, FILES['src/a.ts']);
    assert.equal(dirty(a), true);
    assert.equal(a.pinned, true);
    assert.deepEqual(a.scroll, { left: 0, top: 8 });
    assert.deepEqual({ ...a.document.selection }, { direction: 'backward', end: 3, start: 1 });
    assert.equal(b.preview, true);
    assert.equal(dirty(b), false);
    assert.equal(gone.missing, true);
    assert.equal(gone.document.value, 'kept\n');
    assert.equal(model.state.active, b);
    assert.equal(writes.length, 0);
    // Folds wait for the editor to show the tab, and go on it once.
    const editor = fakeEditor(b);
    view.shown = { controller: editor, tab: b };
    hosting.shown(b, editor);
    assert.deepEqual(editor.folds(), [1]);
    hosting.flush();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].tabs[2].draft, 'kept\n');
});

test('a tab opened while the session loads keeps focus; its path is not restored twice', async (t) => {
    const stored = {
        active: 'src/a.ts',
        explorer: { expanded: [], scroll: 0 },
        tabs: [{ folds: [], path: 'src/a.ts', pinned: false, preview: false, scroll: { left: 0, top: 0 }, selection: { anchor: 0, head: 0 } }]
    };
    const { hosting, model } = await fixture({ session: stored });
    t.after(() => model.dispose());
    await model.start();
    const opened = model.open('c.md'),
        restored = hosting.restore();
    await Promise.all([opened, restored]);
    assert.equal(model.state.active.path, 'c.md');
    assert.deepEqual(model.state.tabs.map((tab) => tab.path).sort(), ['c.md', 'src/a.ts']);
});

test('baselines are fetched per open tab, marked when they differ, and fetched again on save and on watch', async (t) => {
    const head = { 'src/a.ts': 'alpha\n', 'src/b.ts': FILES['src/b.ts'] },
        { host, hosting, model } = await fixture({ head });
    t.after(() => model.dispose());
    hosting.connect({ addEventListener() {}, ownerDocument: {} });
    await hosting.restore();
    let reads = 0;
    const baseline = host.baseline;
    host.baseline = (cwd, path) => {
        reads++;
        return baseline(cwd, path);
    };
    const a = await model.open('src/a.ts');
    await model.open('src/b.ts');
    assert.equal(await hosting.loaded('src/a.ts'), 'alpha\n');
    assert.equal(hosting.baseline('src/a.ts'), 'alpha\n');
    assert.equal(hosting.baseline('src/b.ts'), FILES['src/b.ts']);
    assert.equal(hosting.marks.get('src/a.ts')?.status, 'modified');
    assert.equal(hosting.marks.get('src/b.ts'), undefined);
    const before = reads;
    head['src/a.ts'] = 'alpha\nbeta\n';
    a.document.setValue('alpha\nbeta\n');
    await model.save(a);
    await model.whenIdle();
    assert.ok(reads > before);
    assert.equal(await hosting.loaded('src/a.ts'), 'alpha\nbeta\n');
    hosting.flush();
    assert.equal(hosting.marks.get('src/a.ts'), undefined);
    head['src/b.ts'] = 'one\n';
    host.change('src/b.ts', FILES['src/b.ts']);
    assert.equal(await hosting.loaded('src/b.ts'), 'one\n');
    assert.equal(hosting.marks.get('src/b.ts')?.status, 'modified');
    await model.close('src/b.ts');
    assert.equal(hosting.baseline('src/b.ts'), null);
});

test('without the optional host methods the editor options and tree callbacks stay unset', async (t) => {
    const host = createMemoryWorkspaceHost(FILES),
        model = new EditorWorkspaceModel(host, '/project');
    t.after(() => model.dispose());
    delete host.export;
    delete host.import;
    const hosting = hosted(model, () => undefined);
    assert.equal(hosting.baseline('src/a.ts'), undefined);
    assert.equal(hosting.export, undefined);
    assert.equal(hosting.import, undefined);
    assert.equal(hosting.ready(), false);
    delete host.session;
    assert.equal(hosted(model, () => undefined).ready(), true);
});

test('OS drops import into the dropped-on folder, or the top level, and refresh; files export their text', async (t) => {
    const { host, hosting, model } = await fixture();
    t.after(() => model.dispose());
    await hosting.restore();
    const calls = [],
        imported = host.import;
    host.import = (cwd, target, entries) => {
        calls.push(target);
        return imported(cwd, target, entries);
    };
    await hosting.import({ children: [], id: 'src', name: 'src', type: 'folder' }, [{ file: new File(['new'], 'n.ts'), path: 'n.ts' }]);
    await hosting.import({ id: 'src/a.ts', name: 'a.ts', type: 'file' }, [{ file: null, path: 'assets' }]);
    await hosting.import(null, [{ file: null, path: 'top' }, { file: new File(['x'], 'x.txt'), path: 'top/x.txt' }]);
    assert.deepEqual(calls, ['src', 'src', '']);
    assert.equal(host.contents.get('src/n.ts'), 'new');
    assert.equal(host.contents.get('top/x.txt'), 'x');
    const paths = model.state.entries.map((entry) => entry.path);
    for (const path of ['src/n.ts', 'src/assets', 'top/x.txt']) assert.ok(paths.includes(path), path);
    await hosting.import(null, [{ file: new File(['dup'], 'a.ts'), path: 'src/a.ts' }]);
    assert.match(model.state.status, /Import failed: .*already exists/);
    const exported = hosting.export({ id: 'src/b.ts', name: 'b.ts', type: 'file' });
    assert.equal(exported.name, 'b.ts');
    assert.equal(exported.text, FILES['src/b.ts']);
    assert.equal(decodeURIComponent(exported.url.split(',')[1]), FILES['src/b.ts']);
    assert.equal(hosting.export({ id: 'src', name: 'src', type: 'folder' }), null);
});

test('step reports a move, a wrap round the file, or nothing to move to', async (t) => {
    const { model } = await fixture();
    t.after(() => model.dispose());
    const tab = await model.open('src/a.ts'),
        editor = fakeEditor(tab, { change: [6, 11], problem: [] });
    tab.document.select({ start: 0 });
    assert.equal(step(editor, 'change', false), 'moved');
    assert.equal(step(editor, 'change', false), 'moved');
    assert.equal(step(editor, 'change', false), 'wrapped');
    assert.equal(step(editor, 'change', true), 'wrapped');
    assert.equal(step(editor, 'change', true), 'moved');
    assert.equal(step(editor, 'problem', false), 'none');
});

test('navigation crosses to the next marked file once the shown one has none left, and lands on its first', async (t) => {
    const { hosting, model, view } = await fixture();
    t.after(() => model.dispose());
    await hosting.restore();
    const editors = new Map(),
        show = (tab) => {
            const editor = editors.get(tab.path) ?? fakeEditor(tab, { change: tab.path === 'src/a.ts' ? [6] : [4], problem: [] });
            editors.set(tab.path, editor);
            view.shown = { controller: editor, tab };
            hosting.shown(tab, editor);
        };
    model.subscribe((state) => {
        if (state.active && view.shown?.tab !== state.active) queueMicrotask(() => show(state.active));
    });
    const a = await model.open('src/a.ts');
    show(a);
    const jumps = [],
        tree = {
            next: async (kind) => (jumps.push(kind), { id: 'src/b.ts', name: 'b.ts', type: 'file' }),
            previous: async () => null
        },
        navigation = navigate({ bindings: () => undefined, hosting, model, tree: () => tree });
    a.document.select({ start: 0 });
    assert.equal(await navigation.go('change'), true);
    assert.equal(a.document.selection.start, 6);
    assert.deepEqual(jumps, []);
    // Past the last change in a.ts: on to b.ts, whose first change the caret lands on, while a.ts keeps its caret.
    assert.equal(await navigation.go('change'), true);
    assert.deepEqual(jumps, ['change']);
    assert.equal(model.state.active.path, 'src/b.ts');
    assert.equal(model.state.active.document.selection.start, 4);
    assert.equal(a.document.selection.start, 6);
    // Nothing anywhere: the status says so.
    editors.get('src/b.ts').nextProblem = () => false;
    tree.next = async () => null;
    assert.equal(await navigation.go('problem'), false);
    assert.equal(model.state.status, 'No problems');
});

test('the navigation keys follow the editor keymap, rebindings included, ahead of the editor', async (t) => {
    const { hosting, model } = await fixture();
    t.after(() => model.dispose());
    let bindings,
        handler;
    const runs = [],
        navigation = navigate({ bindings: () => bindings, hosting, model, tree: () => undefined });
    navigation.connect({ addEventListener: (_type, listener) => (handler = listener) });
    const press = (key, extra = {}) => {
        const event = {
            altKey: false, code: key, ctrlKey: false, defaultPrevented: false, isComposing: false, key, metaKey: false, shiftKey: false,
            preventDefault() {
                this.defaultPrevented = true;
            },
            stopPropagation() {
                runs.push(key);
            },
            ...extra
        };
        handler(event);
        return event.defaultPrevented;
    };
    assert.equal(press('F8'), true);
    assert.equal(press('F5', { altKey: true }), true);
    assert.equal(press('F5', { altKey: true, shiftKey: true }), true);
    assert.equal(press('F3'), false);
    bindings = { F8: null, F9: 'nextProblem' };
    assert.equal(press('F8'), false);
    assert.equal(press('F9'), true);
    assert.deepEqual(runs, ['F8', 'F5', 'F5', 'F9']);
});
