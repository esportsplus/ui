import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';
const { EditorDocument } = await import('../src/components/editor/code/document.ts');
const { EditorWorkspaceModel } = await import('../src/components/editor/workspace/model.ts');
const { AUTO_SAVE_MODES, AutoSave, indentation, indentLabel, LANGUAGES, lineEndings } =
    await import('../src/components/editor/workspace/status.ts');
const { createMemoryWorkspaceHost } = await import('../docs/src/examples/code-editor/fixtures/workspace.ts');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
async function fixture(t, preferences = {}) {
    const host = createMemoryWorkspaceHost({ 'a.ts': 'one', 'b.ts': 'two' }),
        model = new EditorWorkspaceModel(host, '/project'),
        writes = [],
        write = host.write;
    host.write = (cwd, path, content) => {
        writes.push([path, content]);
        return write(cwd, path, content);
    };
    await model.start();
    model.setPreferences(preferences);
    await model.whenIdle();
    const autosave = new AutoSave(model),
        disconnect = autosave.connect();
    t.after(() => {
        disconnect();
        model.dispose();
    });
    return { autosave, disconnect, host, model, writes };
}
const type = (tab, text) => tab.document.replace(tab.document.value.length, tab.document.value.length, text);

test('auto save preferences are validated on construction, load and update', async () => {
    let model = new EditorWorkspaceModel(createMemoryWorkspaceHost({}), '/project', { autoSave: 'always', autoSaveDelay: Number.NaN });
    assert.equal(model.state.preferences.autoSave, 'off');
    assert.equal(model.state.preferences.autoSaveDelay, 1000);
    model.setPreferences({ autoSave: 'focus', autoSaveDelay: 5 });
    assert.equal(model.state.preferences.autoSave, 'focus');
    assert.equal(model.state.preferences.autoSaveDelay, 100);
    model.setPreferences({ autoSave: 1, autoSaveDelay: 1e9 });
    assert.equal(model.state.preferences.autoSave, 'focus');
    assert.equal(model.state.preferences.autoSaveDelay, 60000);
    model.setPreferences({ autoSaveDelay: '200' });
    assert.equal(model.state.preferences.autoSaveDelay, 60000);
    model.dispose();
    const host = createMemoryWorkspaceHost({ 'a.ts': '' }, { autoSave: 'delay', autoSaveDelay: 1499.6 });
    model = new EditorWorkspaceModel(host, '/project');
    await model.start();
    assert.equal(model.state.preferences.autoSave, 'delay');
    assert.equal(model.state.preferences.autoSaveDelay, 1500);
    model.dispose();
});

test('delay mode saves a dirty tab once edits pause for the delay', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { autosave, model, writes } = await fixture(t, { autoSave: 'delay', autoSaveDelay: 500 }),
        tab = await model.open('a.ts');
    type(tab, '!');
    assert.equal(autosave.status.phase, 'unsaved');
    t.mock.timers.tick(499);
    type(tab, '?');
    t.mock.timers.tick(499);
    assert.deepEqual(writes, []);
    t.mock.timers.tick(1);
    assert.equal(autosave.status.phase, 'saving');
    await model.whenIdle();
    assert.deepEqual(writes, [['a.ts', 'one!?']]);
    assert.equal(tab.saved, 'one!?');
    assert.equal(autosave.status.phase, 'saved');
    assert.equal(typeof autosave.status.savedAt, 'number');
});

test('undoing back to the saved text cancels a pending delayed save', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { autosave, model, writes } = await fixture(t, { autoSave: 'delay', autoSaveDelay: 500 }),
        tab = await model.open('a.ts');
    type(tab, '!');
    tab.document.undo();
    t.mock.timers.tick(1000);
    await model.whenIdle();
    assert.deepEqual(writes, []);
    assert.equal(autosave.status.phase, 'saved');
    assert.equal(autosave.status.savedAt, null);
});

test('closing a tab or disconnecting drops its pending save', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { disconnect, model, writes } = await fixture(t, { autoSave: 'delay', autoSaveDelay: 500 }),
        a = await model.open('a.ts'),
        b = await model.open('b.ts');
    model.setConfirmation(() => 'discard');
    type(a, '!');
    assert.equal(await model.close('a.ts'), true);
    t.mock.timers.tick(1000);
    await model.whenIdle();
    assert.deepEqual(writes, []);
    type(b, '!');
    disconnect();
    t.mock.timers.tick(1000);
    await model.whenIdle();
    assert.deepEqual(writes, []);
});

test('switching to delay mode schedules tabs that are already dirty; off cancels them', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { model, writes } = await fixture(t, { autoSaveDelay: 500 }),
        a = await model.open('a.ts'),
        b = await model.open('b.ts');
    type(a, '!');
    t.mock.timers.tick(1000);
    assert.deepEqual(writes, []);
    model.setPreferences({ autoSave: 'delay' });
    type(b, '!');
    model.setPreferences({ autoSave: 'off' });
    t.mock.timers.tick(1000);
    await model.whenIdle();
    assert.deepEqual(writes, []);
    model.setPreferences({ autoSave: 'delay' });
    t.mock.timers.tick(500);
    await model.whenIdle();
    assert.deepEqual(writes.sort(), [['a.ts', 'one!'], ['b.ts', 'two!']]);
});

test('focus mode saves on tab change, editor blur and window blur, never a missing file', async (t) => {
    const { autosave, model, writes } = await fixture(t, { autoSave: 'focus' }),
        a = await model.open('a.ts'),
        b = await model.open('b.ts');
    model.activate(a);
    type(a, '1');
    model.activate(b);
    await model.whenIdle();
    assert.deepEqual(writes, [['a.ts', 'one1']]);
    type(b, '2');
    autosave.blur();
    await model.whenIdle();
    assert.deepEqual(writes.at(-1), ['b.ts', 'two2']);
    type(a, '3');
    type(b, '4');
    autosave.blur(true);
    await model.whenIdle();
    assert.deepEqual(writes.slice(2).sort(), [['a.ts', 'one13'], ['b.ts', 'two24']]);
    b.missing = true;
    type(b, '5');
    autosave.blur(true);
    await model.whenIdle();
    assert.equal(writes.length, 4);
});

test('off mode ignores focus changes', async (t) => {
    const { autosave, model, writes } = await fixture(t),
        a = await model.open('a.ts');
    await model.open('b.ts');
    type(a, '!');
    model.activate(a);
    model.activate('b.ts');
    autosave.blur(true);
    await model.whenIdle();
    assert.deepEqual(writes, []);
});

test('the status shows saving while a save is pending and unsaved again when it fails', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { autosave, host, model } = await fixture(t, { autoSave: 'delay', autoSaveDelay: 100 }),
        tab = await model.open('a.ts'),
        pending = deferred();
    host.write = () => pending.promise;
    type(tab, '!');
    t.mock.timers.tick(100);
    await Promise.resolve();
    assert.equal(autosave.status.phase, 'saving');
    pending.reject(new Error('disk full'));
    await model.whenIdle();
    assert.equal(autosave.status.phase, 'unsaved');
    assert.equal(autosave.status.savedAt, null);
    assert.match(model.state.status, /disk full/);
});

test('a manual save also stamps the saved time', async (t) => {
    const { autosave, model } = await fixture(t),
        tab = await model.open('a.ts');
    type(tab, '!');
    assert.equal(autosave.status.phase, 'unsaved');
    await model.save(tab);
    assert.equal(autosave.status.phase, 'saved');
    assert.equal(typeof autosave.status.savedAt, 'number');
});

test('line endings convert in one undoable edit and keep carets on their text', () => {
    const document = new EditorDocument('a\nb\r\nc\rd');
    document.selectMany([{ end: 5, start: 5 }, { end: 2, start: 1 }]);
    assert.equal(lineEndings(document, 'crlf'), true);
    assert.equal(document.value, 'a\r\nb\r\nc\r\nd');
    assert.deepEqual(document.selections.map(({ end, start }) => [start, end]), [[6, 6], [1, 3]]);
    assert.equal(document.eol, '\r\n');
    assert.equal(lineEndings(document, 'crlf'), false);
    assert.equal(lineEndings(document, 'lf'), true);
    assert.equal(document.value, 'a\nb\nc\nd');
    assert.equal(document.selection.start, 4);
    document.select({ end: 2, start: 2 });
    document.undo();
    assert.equal(document.value, 'a\r\nb\r\nc\r\nd');
    document.undo();
    assert.equal(document.value, 'a\nb\r\nc\rd');
    assert.equal(lineEndings(new EditorDocument('single line'), 'crlf'), false);
});

test('a caret inside a CRLF lands before its replacement', () => {
    const document = new EditorDocument('ab\r\ncd');
    document.select({ end: 3, start: 3 });
    lineEndings(document, 'lf');
    assert.equal(document.value, 'ab\ncd');
    assert.equal(document.selection.start, 2);
});

test('status choices cover every language, indentation and auto save mode', () => {
    assert.deepEqual(Object.keys(AUTO_SAVE_MODES).sort(), ['delay', 'focus', 'off']);
    assert.equal(LANGUAGES.typescript, 'TypeScript');
    assert.equal(LANGUAGES.plain, 'Plain Text');
    assert.deepEqual(indentation({ size: 2, tabs: false }), { indent: '  ', tabSize: 2 });
    assert.deepEqual(indentation({ size: 8, tabs: true }), { indent: '\t', tabSize: 8 });
    assert.equal(indentLabel({ size: 4, tabs: false }), 'Spaces: 4');
    assert.equal(indentLabel({ size: 4, tabs: true }), 'Tab Size: 4');
});
