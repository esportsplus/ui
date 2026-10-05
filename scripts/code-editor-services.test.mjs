import assert from 'node:assert/strict';
import test from 'node:test';
import './resolve.mjs';


const { EditorDocument } = await import('../src/components/code-editor/document.ts');
const { diagnostics } = await import('../src/components/code-editor/services/diagnostics.ts');
const { session: services } = await import('../src/components/code-editor/services/session.ts');
const { applyCompletion, expandSnippet, fileUri, languageIdFor, localWords, mapStops, offsetAt, positionAt } =
    await import('../src/components/code-editor/services/model.ts');
const { referenceRpcTransport } = await import('../src/components/code-editor/services/transport.ts');
const { mockLanguageTransport } = await import('../docs/src/examples/code-editor/fixtures/language.ts');


function key(key, extra = {}) {
    return { altKey: false, code: key === ' ' ? 'Space' : key, ctrlKey: false, isComposing: false, key, metaKey: false, shiftKey: false, ...extra };
}

function range(start, end, line = 0) {
    return { end: { character: end, line }, start: { character: start, line } };
}

function settle(ms = 5) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// The addon against a document-only controller; geometry is a fixed caret box.
function setup(text, options = {}) {
    let doc = new EditorDocument(text),
        controller = {
            document: doc,
            focus: () => {},
            offsetAt: () => null,
            rectAt: () => ({ height: 20, left: 0, top: 0, width: 1 }),
            select: (selection) => doc.select(selection)
        },
        addon = services({ busy: () => false, controller, rect: () => ({ height: 20, left: 0, top: 0, width: 1 }), schedule: () => {} });

    addon.configure({ fileName: 'src/a.ts', services: { changeDelay: 0, completionDelay: 0, cwd: '/w', hoverDelay: 0, ...options } });

    return { addon, doc };
}


test('UTF-16 positions follow mixed line endings', () => {
    let doc = new EditorDocument('😀a\r\nb\rc\n');

    assert.deepEqual(positionAt(doc, 2), { character: 2, line: 0 });
    assert.deepEqual(positionAt(doc, 5), { character: 0, line: 1 });
    assert.equal(offsetAt(doc, { character: 500, line: 1 }), 6);
    assert.equal(offsetAt(doc, { character: 0, line: -1 }), null);
    assert.equal(languageIdFor('a.TSX'), 'typescript');
    assert.equal(languageIdFor('styles/site.scss'), 'scss');
    assert.equal(languageIdFor('.ts'), 'plaintext');
});

test('fileUri keeps every segment, encodes and resolves', () => {
    assert.equal(fileUri('G:\\work space', 'src/a#b.ts'), 'file:///G:/work%20space/src/a%23b.ts');
    assert.equal(fileUri('/w', 'a b?%.ts'), 'file:///w/a%20b%3F%25.ts');
    assert.equal(fileUri('/w/', './x/../deep/name.test.ts'), 'file:///w/deep/name.test.ts');
    assert.equal(fileUri('/w', '/abs/é.ts'), 'file:///abs/%C3%A9.ts');
    assert.equal(fileUri('/w', '\\\\server\\share\\a.ts'), 'file://server/share/a.ts');
    assert.equal(fileUri('C:\\', 'a.ts'), 'file:///C:/a.ts');
    assert.equal(fileUri('', 'a.ts'), 'file:///a.ts');
    assert.equal(fileUri('/w', 'dir/'), 'file:///w/dir/');
    assert.equal(fileUri('/w', 'untitled:Untitled-1'), 'file:///w/untitled%3AUntitled-1');
    assert.equal(fileUri('/w', 'file:///x/y.ts'), 'file:///x/y.ts');
});

test('textEdit and additionalTextEdits apply atomically with selection and history', () => {
    let doc = new EditorDocument('ab foo'),
        item = {
            additionalTextEdits: [{ newText: 'import; ', range: range(0, 0) }],
            label: 'ignored',
            textEdit: { newText: 'food', range: range(3, 6) }
        };

    doc.select({ start: 6 });
    assert.deepEqual(applyCompletion(doc, item, 6, '.'), []);
    assert.equal(doc.value, 'import; ab food.');
    assert.equal(doc.selection.start, doc.value.length);
    doc.undo();
    assert.equal(doc.value, 'ab foo');
    assert.equal(doc.selection.start, 6);

    let revision = doc.revision;

    assert.equal(applyCompletion(doc, { ...item, additionalTextEdits: [{ newText: 'bad', range: range(4, 6) }] }, 6), null);
    assert.equal(doc.revision, revision);
});

test('snippets expand stops, mirrors, choices and escapes; edits inside the active stop move the others', () => {
    let snippet = expandSnippet('call(${1:name}, $1, ${2|one,two|})$0 \\$x');

    assert.equal(snippet.text, 'call(name, name, one) $x');
    assert.deepEqual(snippet.stops.map((stop) => stop.index), [1, 1, 2, 0]);

    let doc = new EditorDocument('ca');

    doc.select({ start: 2 });

    let stops = applyCompletion(doc, { insertText: 'call(${1:name})$0', insertTextFormat: 2, label: 'call' }, 2);

    assert.equal(doc.value, 'call(name)');
    assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'name');
    assert.equal(stops.length, 2);

    let moved = mapStops(stops, 0, [[{ from: 5, insert: 'id', to: 9 }]]);

    assert.deepEqual(moved.map(({ from, to }) => [from, to]), [[5, 7], [8, 8]]);
    assert.equal(mapStops(stops, 0, [[{ from: 0, insert: 'x', to: 0 }]]), null);
});

test('local completion returns distinct matching document words', () => {
    assert.deepEqual(localWords('apple apple apricot\nap', 22).map((item) => item.label), ['apple', 'apricot']);
});

test('reference RPC envelope, result unwrapping, filtering, abort and unsubscribe', async () => {
    let calls = [],
        events = [],
        receive,
        unsubscribed = false;

    let adapter = referenceRpcTransport({
        cwd: 'G:/w',
        invoke: async (method, payload) => {
            calls.push({ method, payload });
            return method === 'editor.lsp.request' && payload.method === 'textDocument/hover' ? null : { result: [{ label: 'server' }] };
        },
        languageId: 'typescript',
        subscribe: (channel, listener) => {
            assert.equal(channel, 'editor.lsp.notification');
            receive = listener;

            return () => {
                unsubscribed = true;
            };
        }
    });

    await adapter.notify('textDocument/didOpen', { text: 'exact' });
    assert.equal((await adapter.request('textDocument/completion', { position: 2 }))[0].label, 'server');
    assert.equal(await adapter.request('textDocument/hover', {}), null);
    assert.equal(calls[0].method, 'editor.lsp.notify');
    assert.equal(calls[1].payload.languageId, 'typescript');

    let stop = adapter.subscribe((event) => events.push(event));

    receive({ cwd: 'wrong', method: 'x' });
    receive({ cwd: 'G:/w', languageId: 'typescript', method: 'x' });
    assert.equal(events.length, 1);
    stop();
    assert.equal(unsubscribed, true);

    let abort = new AbortController();

    abort.abort();
    await assert.rejects(adapter.request('textDocument/hover', {}, abort.signal), { name: 'AbortError' });
});

test('diagnostics follow edits, drop when touched and mark only overlapping rows', () => {
    let doc = new EditorDocument('let a = TODO;\nlet b = 1;'),
        list = diagnostics({ select: () => {} });

    list.publish(doc, [
        { message: 'one', range: range(8, 12) },
        { message: 'two', range: range(4, 4, 1), severity: 2 },
        { message: 'bad', range: range(4, 2) }
    ]);
    assert.equal(list.count, 2);
    assert.deepEqual(list.marks(14, 24).map(({ from, kind, to }) => [from, to, kind]), [[18, 19, 'code-editor-diagnostic code-editor-diagnostic--warning']]);
    list.map([[{ from: 0, insert: '// ', to: 0 }]]);
    assert.deepEqual(list.hit(11, 12).map((entry) => [entry.from, entry.to]), [[11, 15]]);
    list.map([[{ from: 15, insert: 'x', to: 15 }]]);
    assert.equal(list.count, 2);
    list.map([[{ from: 12, insert: '', to: 13 }]]);
    assert.equal(list.count, 1);
});

test('document lifecycle: open, debounced full sync, close on dispose', async () => {
    let fixture = mockLanguageTransport(),
        { addon, doc } = setup('a', { transport: fixture.transport });

    await settle();
    assert.deepEqual(fixture.notifications[0], {
        method: 'textDocument/didOpen',
        params: { textDocument: { languageId: 'typescript', text: 'a', uri: 'file:///w/src/a.ts', version: 0 } }
    });
    assert.equal(fixture.subscribers, 1);
    doc.replace(1, 1, 'b');
    doc.replace(2, 2, 'c');
    await settle(20);

    let changes = fixture.notifications.filter((entry) => entry.method === 'textDocument/didChange');

    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].params, { contentChanges: [{ text: 'abc' }], textDocument: { uri: 'file:///w/src/a.ts', version: 2 } });
    addon.dispose();
    await settle();
    assert.equal(fixture.notifications.at(-1).method, 'textDocument/didClose');
    assert.equal(fixture.subscribers, 0);
});

test('a changed file name or transport closes the old document and opens the new one', async () => {
    let fixture = mockLanguageTransport(),
        { addon } = setup('x', { transport: fixture.transport });

    addon.configure({ fileName: 'src/a.ts', services: { cwd: '/w', transport: fixture.transport } });
    addon.configure({ fileName: 'src/b.ts', services: { cwd: '/w', transport: fixture.transport } });
    await settle();
    assert.deepEqual(fixture.notifications.map((entry) => entry.method), ['textDocument/didOpen', 'textDocument/didClose', 'textDocument/didOpen']);
    assert.equal(fixture.notifications[2].params.textDocument.uri, 'file:///w/src/b.ts');
    addon.configure({ fileName: 'src/b.ts' });
    await settle();
    assert.equal(fixture.notifications.at(-1).method, 'textDocument/didClose');
    assert.equal(fixture.subscribers, 0);
});

test('completion: explicit request, stale responses dropped, keyboard accept and Escape', async () => {
    let release,
        fixture = mockLanguageTransport({
            completion: () => new Promise((resolve) => {
                release = () => resolve([{ label: 'greet' }, { label: 'gremlin' }]);
            })
        }),
        { addon, doc } = setup('gr', { transport: fixture.transport });

    doc.select({ start: 2 });
    assert.equal(addon.keydown(key(' ', { ctrlKey: true })), true);
    await settle();
    doc.replace(2, 2, 'e');
    release();
    await settle();
    assert.equal(addon.keydown(key('Enter')), false, 'a response for an older revision never opens');

    doc.select({ start: 3 });
    addon.keydown(key(' ', { ctrlKey: true }));
    await settle();
    release();
    await settle();
    assert.equal(addon.keydown(key('ArrowDown')), true);
    assert.equal(addon.keydown(key('Enter')), true);
    assert.equal(doc.value, 'gremlin');

    doc.select({ start: 7 });
    addon.keydown(key(' ', { ctrlKey: true }));
    await settle();
    release();
    await settle();
    assert.equal(addon.keydown(key('Escape')), true);
    assert.equal(addon.keydown(key('Enter')), false);
    assert.equal(doc.value, 'gremlin');
    addon.dispose();
});

test('completion opens while typing a word or after a dot, never for other edits', async () => {
    let fixture = mockLanguageTransport({ completion: () => [{ label: 'length' }] }),
        { addon, doc } = setup('s', { transport: fixture.transport });

    doc.select({ start: 1 });
    doc.replace(1, 1, '.', { selection: { start: 2 }, source: 'input' });
    await settle(20);

    let request = fixture.requests.at(-1);

    assert.deepEqual(request.params.context, { triggerCharacter: '.', triggerKind: 2 });
    assert.equal(addon.keydown(key('Tab')), true);
    assert.equal(doc.value, 's.length');

    let count = fixture.requests.length;

    doc.replace(0, 0, 'x', { source: 'paste' });
    await settle(20);
    assert.equal(fixture.requests.length, count);
    addon.dispose();
});

test('without a transport, completion comes from the document words', async () => {
    let { addon, doc } = setup('alpha alps al');

    doc.select({ start: 13 });
    addon.keydown(key(' ', { ctrlKey: true }));
    await settle();
    addon.keydown(key('Enter'));
    assert.equal(doc.value, 'alpha alps alpha');
    addon.dispose();
});

test('published diagnostics apply to the current version only and clear with the session', async () => {
    let fixture = mockLanguageTransport(),
        { addon, doc } = setup('TODO', { transport: fixture.transport }),
        uri = 'file:///w/src/a.ts';

    fixture.publish({ method: 'textDocument/publishDiagnostics', params: { diagnostics: [{ message: 'm', range: range(0, 4) }], uri, version: 5 } });
    assert.equal(addon.marks(0, 4).length, 0);
    fixture.publish({ method: 'textDocument/publishDiagnostics', params: { diagnostics: [{ message: 'm', range: range(0, 4) }], uri: 'file:///other', version: 0 } });
    assert.equal(addon.marks(0, 4).length, 0);
    fixture.publish({ method: 'textDocument/publishDiagnostics', params: { diagnostics: [{ message: 'm', range: range(0, 4) }], uri, version: 0 } });
    assert.equal(addon.marks(0, 4).length, 1);
    doc.replace(4, 4, ' ok');
    assert.equal(addon.marks(0, 4).length, 1, 'typing past a squiggle keeps it');
    addon.dispose();
    assert.equal(addon.marks(0, 4).length, 0);
});

test('snippet completions select placeholders, mirror and Tab through stops', async () => {
    let fixture = mockLanguageTransport({ completion: () => [{ insertText: 'f(${1:a}, $1)$0', insertTextFormat: 2, label: 'f' }] }),
        { addon, doc } = setup('', { transport: fixture.transport });

    addon.keydown(key(' ', { ctrlKey: true }));
    await settle();
    addon.keydown(key('Enter'));
    assert.equal(doc.value, 'f(a, a)');
    assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'a');
    doc.replace(2, 3, 'xy', { selection: { start: 4 }, source: 'input' });
    await settle();
    assert.equal(doc.value, 'f(xy, xy)');
    assert.equal(addon.keydown(key('Tab')), true);
    assert.equal(doc.selection.start, doc.value.length);
    assert.equal(addon.keydown(key('Tab')), false, 'the session ends at $0');
    addon.dispose();
});
