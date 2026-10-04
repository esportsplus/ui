import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('./') && context.parentURL?.includes('/src/components/code-editor/') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
    return next(specifier, context);
} });
const { EditorDocument } = await import('../src/components/code-editor/document.ts');
const { applyCompletion, expandSnippet, fileUri, languageIdFor, localWords, positionAt, offsetAtPosition } = await import('../src/components/code-editor/services-model.ts');
const { referenceRpcTransport, mockLanguageTransport } = await import('../src/components/code-editor/services-transport.ts');
const range = (start, end) => ({ start: { line: 0, character: start }, end: { line: 0, character: end } });

test('UTF-16 positions preserve mixed EOL and URI escaping', () => {
    let doc = new EditorDocument('😀a\r\nb\rc\n');
    assert.deepEqual(positionAt(doc, 2), { line: 0, character: 2 });
    assert.deepEqual(positionAt(doc, 5), { line: 1, character: 0 });
    assert.equal(offsetAtPosition(doc, { line: 1, character: 500 }), 6);
    assert.equal(offsetAtPosition(doc, { line: -1, character: 0 }), null);
    assert.equal(fileUri('G:\\work space', 'src/a#b.ts'), 'file:///G:/work%20space/src/a%23b.ts');
    assert.equal(languageIdFor('a.TSX'), 'typescript');
});
test('textEdit and additionalTextEdits are atomic with correct selection and history', () => {
    let doc = new EditorDocument('ab foo'), item = { label: 'ignored', textEdit: { range: range(3, 6), newText: 'food' }, additionalTextEdits: [{ range: range(0, 0), newText: 'import; ' }] };
    doc.select({ start: 6 });
    assert.deepEqual(applyCompletion(doc, item, 6, '.'), []);
    assert.equal(doc.value, 'import; ab food.'); assert.equal(doc.selection.start, doc.value.length);
    doc.undo(); assert.equal(doc.value, 'ab foo'); assert.equal(doc.selection.start, 6);
    let snapshot = doc.state;
    assert.equal(applyCompletion(doc, { ...item, additionalTextEdits: [{ range: range(4, 6), newText: 'bad' }] }, 6), null);
    assert.deepEqual(doc.state, snapshot);
});
test('snippets expand stops, mirrors, choices and escapes; first placeholder is selected', () => {
    let snippet = expandSnippet('call(${1:name}, $1, ${2|one,two|})$0 \\$x');
    assert.equal(snippet.text, 'call(name, name, one) $x');
    assert.deepEqual(snippet.stops.map((s) => s.index), [1, 1, 2, 0]);
    let doc = new EditorDocument('ca'); doc.select({ start: 2 });
    let stops = applyCompletion(doc, { label: 'call', insertTextFormat: 2, insertText: 'call(${1:name})$0' }, 2);
    assert.equal(doc.value, 'call(name)'); assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'name'); assert.equal(stops.length, 2);
});
test('local completion only returns actual unique matching document words', () => {
    assert.deepEqual(localWords('apple apple apricot\nap', 22).map((i) => i.label), ['apple', 'apricot']);
});
test('reference RPC envelope, result unwrapping, filtering, abort and unsubscribe', async () => {
    let calls = [], receive, unsubscribed = false, events = [];
    let adapter = referenceRpcTransport({ cwd: 'G:/w', languageId: 'typescript',
        invoke: async (method, payload) => { calls.push({ method, payload }); return { result: [{ label: 'server' }] }; },
        subscribe: (channel, listener) => { assert.equal(channel, 'editor.lsp.notification'); receive = listener; return () => { unsubscribed = true; }; }
    });
    await adapter.notify('textDocument/didOpen', { text: 'exact' });
    assert.equal((await adapter.request('textDocument/completion', { position: 2 }))[0].label, 'server');
    assert.equal(calls[0].method, 'editor.lsp.notify'); assert.equal(calls[1].payload.languageId, 'typescript');
    let stop = adapter.subscribe((event) => events.push(event));
    receive({ cwd: 'wrong', method: 'x' }); receive({ cwd: 'G:/w', languageId: 'typescript', method: 'x' });
    assert.equal(events.length, 1); stop(); assert.equal(unsubscribed, true);
    let abort = new AbortController(); abort.abort(); await assert.rejects(adapter.request('textDocument/hover', {}, abort.signal), { name: 'AbortError' });
    let fixture = mockLanguageTransport(); assert.equal(await fixture.transport.request('textDocument/completion', {}), null);
});
