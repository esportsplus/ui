import assert from 'node:assert/strict';
import test from 'node:test';
import { compiledBrowser } from './test-code-editor-services-support.mjs';
import { EditorDocument } from '../src/components/code-editor/document.ts';

test('compiled services lifecycle, real data, keyboard/mouse, cancellation and disposal', async (t) => {
    let { api, win, settle, paint, host, code, frames } = await compiledBrowser(t, 'src/components/code-editor/services.ts');
    assert.ok(!/\bhtml\s*`/.test(code));
    const range = (start, end) => ({ start: { line: 0, character: start }, end: { line: 0, character: end } });
    function editor(doc) {
        let node = host(), field = win.document.createElement('textarea'); node.append(field);
        let unsubscribe = doc.subscribe(() => { field.value = doc.value; }); field.value = doc.value;
        let controller = { document: doc, textarea: field, focus() { field.focus(); }, select(selection) { doc.select(selection); }, refresh() {},
            rectAt(offset) { return { left: 10 + offset * 8, top: 20, width: 8, height: 20 }; }, offsetAt(x) { return Math.max(0, Math.min(doc.value.length, Math.floor((x - 10) / 8))); }
        };
        t.after(() => { unsubscribe(); node.remove(); }); return { node, field, controller };
    }
    await t.test('open → latest full-text change → request → close, completion edits and diagnostics', async () => {
        let doc = new EditorDocument('fo'), { node, field, controller } = editor(doc), errors = [],
            fixture = api.mockLanguageTransport({ completion: () => [{ label: '<img onerror=x>', detail: 'server detail', textEdit: { range: range(0, 2), newText: 'food' }, commitCharacters: ['.'] }], hover: () => ({ contents: [{ value: '<script>literal</script>' }, 'second'] }) }),
            services = api.mountLanguageServices(node, controller, { fileName: 'a.ts', uri: 'file:///a.ts', transport: fixture.transport, changeDelay: 99999, completionDelay: 99999, onError: (error) => errors.push(error) });
        doc.select({ start: 2 }); await services.requestCompletion(); await settle();
        assert.equal(fixture.notifications[0].method, 'textDocument/didOpen'); assert.equal(node.querySelector('[role=listbox]').hidden, false);
        assert.equal(node.querySelector('[role=option]').textContent, '<img onerror=x>server detail'); assert.equal(node.querySelector('img'), null);
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true })); await settle();
        assert.equal(doc.value, 'food.'); doc.undo(); assert.equal(doc.value, 'fo');
        doc.setValue('fox'); doc.select({ start: 3 }); await services.requestCompletion();
        assert.equal(fixture.notifications.at(-1).method, 'textDocument/didChange'); assert.equal(fixture.notifications.at(-1).params.contentChanges[0].text, 'fox');
        fixture.publish({ method: 'textDocument/publishDiagnostics', params: { uri: 'file:///a.ts', version: 0, diagnostics: [{ range: range(0, 2), message: 'old' }] } }); await paint();
        assert.equal(node.querySelector('.code-editor-squiggle'), null);
        fixture.publish({ method: 'textDocument/publishDiagnostics', params: { uri: 'file:///a.ts', version: 3, diagnostics: [{ range: range(0, 2), severity: 2, message: 'real warning' }] } }); await paint();
        assert.equal(node.querySelectorAll('.code-editor-squiggle').length, 1); assert.ok(node.textContent.includes('real warning'));
        node.querySelector('.code-editor-diagnostic-messages button').click(); assert.equal(doc.selection.end, 2);
        await services.requestHover(1); await settle(); assert.equal(node.querySelector('[role=tooltip]').textContent, '<script>literal</script>\n\nsecond'); assert.equal(node.querySelector('script'), null);
        services.dispose(); services.dispose(); await settle(); assert.equal(fixture.notifications.at(-1).method, 'textDocument/didClose'); assert.equal(fixture.subscribers, 0); assert.equal(node.querySelector('.code-editor-services'), null); assert.equal(frames.size, 0); assert.deepEqual(errors, []);
    });
    await t.test('out-of-order responses, selection changes, composition and disposal never reveal stale data', async () => {
        let doc = new EditorDocument('fo'), { node, field, controller } = editor(doc), pending = [],
            fixture = api.mockLanguageTransport({ completion: () => new Promise((resolve) => pending.push(resolve)) }),
            services = api.mountLanguageServices(node, controller, { fileName: 'a.ts', transport: fixture.transport, completionDelay: 99999 });
        doc.select({ start: 2 }); let first = services.requestCompletion(); await settle();
        doc.select({ start: 1 }); let second = services.requestCompletion(); await settle();
        pending[1]([{ label: 'new' }]); await second; pending[0]([{ label: 'old' }]); await first; await settle();
        assert.equal(node.querySelector('[role=option]').textContent, 'new');
        field.dispatchEvent(new win.CompositionEvent('compositionstart')); await settle(); assert.equal(node.querySelector('[role=listbox]').hidden, true);
        field.dispatchEvent(new win.CompositionEvent('compositionend')); let last = services.requestCompletion(); await settle();
        services.dispose(); pending[2]([{ label: 'disposed' }]); await last; await settle(); assert.equal(node.querySelector('.code-editor-services'), null);
    });
    await t.test('provider absence offers actual words, mouse accept, readonly guards and instance independence', async () => {
        let doc = new EditorDocument('apple apricot\nap'), { node, field, controller } = editor(doc), services = api.mountLanguageServices(node, controller, { fileName: 'a.txt' });
        doc.select({ start: doc.value.length }); field.focus(); await services.requestCompletion(); await settle();
        assert.equal(node.querySelectorAll('[role=option]').length, 2); node.querySelector('[role=option]').click(); assert.equal(doc.value, 'apple apricot\napple');
        field.readOnly = true; await services.requestCompletion(); await settle(); assert.equal(node.querySelector('[role=listbox]').hidden, true);
        services.dispose(); await settle();
    });
    await t.test('snippets retain Tab navigation after typing and update linked numeric placeholders', async () => {
        let doc = new EditorDocument('ca'), { node, field, controller } = editor(doc), fixture = api.mockLanguageTransport({ completion: () => [{ label: 'call', insertTextFormat: 2, insertText: 'call(${1:name}, $1, ${2:value})$0' }] }),
            services = api.mountLanguageServices(node, controller, { fileName: 'a.ts', transport: fixture.transport });
        doc.select({ start: 2 }); field.focus(); await services.requestCompletion(); await settle(); node.querySelector('[role=option]').click();
        assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'name');
        doc.replace(doc.selection.start, doc.selection.end, 'foo', { source: 'input', group: 'insertText', selection: { start: 8 } }); await settle();
        assert.equal(doc.value, 'call(foo, foo, value)');
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'value');
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); assert.equal(doc.selection.start, doc.value.length);
        services.dispose(); await settle();
    });
});
