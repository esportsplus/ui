import assert from 'node:assert/strict';
import test from 'node:test';
import { compiledBrowser } from './test-code-editor-services-support.mjs';

test('in-place Markdown controller mounts shared injected services without a core/controller shim', async t => {
    let { api, win, host, paint, settle } = await compiledBrowser(t, 'scripts/test-code-editor-markdown-services-entry.mjs');
    let doc = new api.EditorDocument('# ti\r\n\r\n> text'), node = host(), editor = api.mountMarkdownEditor(node, doc),
        range = { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } },
        fixture = api.mockLanguageTransport({ completion: () => [{ label: 'title', textEdit: { range, newText: 'title' } }], hover: () => ({ contents: 'Provider hover' }) }),
        services = api.mountLanguageServices(node, editor, { fileName: 'readme.md', uri: 'file:///readme.md', transport: fixture.transport, completionDelay: 99999, changeDelay: 99999 });
    editor.select({ start: 4 }); await services.requestCompletion(); await settle(); assert.ok(node.querySelector('[role=option]')); node.querySelector('[role=option]').click();
    assert.equal(doc.value, '# title\r\n\r\n> text'); assert.ok(editor.textarea.classList.contains('markdown-h1')); editor.undo(); assert.equal(doc.value, '# ti\r\n\r\n> text');
    await services.requestHover(2); await paint(); assert.equal(node.querySelector('[role=tooltip]').textContent, 'Provider hover');
    fixture.publish({ method: 'textDocument/publishDiagnostics', params: { uri: 'file:///readme.md', diagnostics: [{ range, severity: 2, message: 'Provider warning' }] } }); await paint(); assert.equal(node.querySelector('.code-editor-diagnostic-messages button').textContent, 'Provider warning');
    editor.textarea.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle(); assert.equal(node.querySelector('[role=tooltip]').hidden, true);
    services.dispose(); editor.dispose(); await settle(); assert.equal(node.querySelector('.code-editor-services,.markdown-controls'), null); assert.equal(fixture.subscribers, 0); node.remove();
});
