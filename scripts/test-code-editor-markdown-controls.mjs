import assert from 'node:assert/strict';
import test from 'node:test';
import { compiledBrowser } from './test-code-editor-services-support.mjs';

test('compiled Markdown shares source search, controls, geometry and multi-range editing', async t => {
    let { api, win, settle, paint, host } = await compiledBrowser(t, 'src/components/code-editor/markdown.ts');
    function key(target, key, extra = {}) { let event = new win.KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...extra }); target.dispatchEvent(event); return event; }
    function type(field, data) { let event = new win.InputEvent('beforeinput', { inputType: 'insertText', data, bubbles: true, cancelable: true }); field.dispatchEvent(event); if (!event.defaultPrevented) { field.setRangeText(data, field.selectionStart, field.selectionEnd, 'end'); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertText', data, bubbles: true })); } }
    function clipboard(field, kind, text = '') { let values = { 'text/plain': text }, data = { setData(type, value) { values[type] = value; }, getData(type) { return values[type] ?? ''; } }, event = new win.Event(kind, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'clipboardData', { value: data }); field.dispatchEvent(event); return values['text/plain']; }
    await t.test('find/replace/go shortcuts use exact raw source and history, with regex errors and readonly guards', async () => {
        let source = '# first\r\n\r\n**needle**\r\n\r\n' + Array.from({ length: 2000 }, (_, i) => `row ${i}\r\n\r\n`).join('') + '> needle', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc);
        editor.focus(); assert.equal(key(editor.textarea, 'f').defaultPrevented, true); await settle(); assert.equal(node.querySelector('.markdown-find').hidden, false);
        let input = node.querySelector('[aria-label="Find text"]'); input.value = 'needle'; input.dispatchEvent(new win.Event('input', { bubbles: true }));
        key(input, 'g'); assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'needle'); key(editor.textarea, 'g'); assert.equal(doc.selection.start, source.lastIndexOf('needle'));
        await paint(); assert.ok(node.querySelector('.markdown-surface').scrollTop > 1000); assert.ok(editor.textarea.classList.contains('markdown-quoted'));
        key(editor.textarea, 'g', { shiftKey: true }); assert.equal(doc.selection.start, source.indexOf('needle'));
        editor.find('(', { regex: true }); assert.ok(editor.find().error); assert.equal(editor.replaceAll('bad'), false);
        editor.find('(needle)', { regex: true }); assert.equal(editor.replaceAll('$1!'), true); assert.equal(doc.value.match(/needle!/g).length, 2); editor.undo(); assert.equal(doc.value, source);
        editor.find('needle'); editor.findNext(); assert.equal(editor.replace('new'), true); editor.undo(); assert.equal(doc.value, source);
        key(editor.textarea, 'h'); await settle(); assert.equal(node.querySelector('[aria-label="Replacement text"]').hidden, false);
        key(editor.textarea, 'g', { altKey: true }); await settle(); let go = node.querySelector('[aria-label="Go to line and optional column"]'); assert.equal(node.querySelector('.markdown-go').hidden, false);
        go.value = 'bad'; go.dispatchEvent(new win.Event('input', { bubbles: true })); node.querySelector('.markdown-go').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await settle(); assert.equal(go.getAttribute('aria-invalid'), 'true');
        go.value = '3:3'; go.dispatchEvent(new win.Event('input', { bubbles: true })); node.querySelector('.markdown-go').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); assert.equal(doc.selection.start, doc.offset(3, 3));
        editor.setOptions({ readonly: true }); editor.find('needle'); assert.equal(editor.replaceAll('bad'), false); assert.equal(editor.replace('bad'), false); assert.ok(editor.findNext()); assert.equal(editor.insert('bad'), false);
        editor.dispose(); node.remove();
    });
    await t.test('wrap, whitespace, structural folding and source minimap update the real surface', async () => {
        let source = '# Section\n\nlong paragraph ' + 'word '.repeat(180) + '\n\n## Nested\n\n> first\n> second\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\n# Next\nend', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc, { fold: true, minimap: true, whitespace: true });
        await paint(); assert.ok(node.querySelectorAll('.markdown-fold-toggle').length >= 3); assert.ok(node.querySelectorAll('.markdown-minimap-line').length > 4); assert.ok(node.querySelector('.markdown-minimap-thumb').style.height); assert.ok(node.querySelectorAll('.markdown-whitespace').length > 0);
        let map = node.querySelector('.markdown-minimap'); key(map, 'End', { ctrlKey: false }); assert.ok(node.querySelector('.markdown-surface').scrollTop > 100); key(map, 'Home', { ctrlKey: false });
        editor.select({ start: source.indexOf('long') }); let height = parseFloat(editor.textarea.style.height); editor.setOptions({ wrap: false }); await settle(); assert.equal(editor.textarea.wrap, 'off'); assert.ok(parseFloat(editor.textarea.style.height) < height); assert.equal(node.querySelector('.markdown-surface').dataset.wrap, 'false');
        editor.setOptions({ wrap: true }); await settle(); assert.equal(editor.textarea.wrap, 'soft');
        assert.equal(editor.fold(1), true); await paint(); assert.ok(node.querySelector('.markdown-fold-chip')); assert.equal(node.querySelector('.markdown-quoted'), null); assert.equal(doc.value, source); assert.equal(editor.rectAt(source.indexOf('const')), null);
        editor.find('const b'); editor.findNext(); await paint(); assert.ok(editor.textarea.value.startsWith('```js')); assert.ok(editor.rectAt(source.indexOf('const b'))); assert.equal(node.querySelector('.markdown-fold-chip'), null);
        editor.foldAll(); await paint(); assert.ok(node.querySelectorAll('.markdown-block').length < 6); editor.unfoldAll(); await paint(); assert.ok(node.querySelector('.markdown-block--fence'));
        let fenceLine = doc.position(source.indexOf('```js')).line; assert.equal(editor.fold(fenceLine), true); await paint(); assert.ok([...node.querySelectorAll('.markdown-fold-chip')].length); assert.ok(node.textContent.includes('```js')); editor.goToLine(fenceLine + 2, 1); assert.equal(editor.textarea.value.startsWith('```js'), true);
        editor.setOptions({ fold: false, minimap: false, whitespace: false }); await paint(); assert.equal(node.querySelector('.markdown-minimap').hidden, true); assert.equal(node.querySelector('.markdown-fold-toggle'), null); assert.equal(node.querySelector('.markdown-whitespace'), null);
        assert.equal(doc.value, source); editor.dispose(); node.remove();
    });
    await t.test('occurrences, native typing, clipboard, grapheme deletion, formatting and IME are atomic across ranges', async () => {
        let source = '# cat\r\n\r\n> cat\r\n\r\ncat', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc);
        editor.select({ start: 2, end: 5 }); key(editor.textarea, 'd'); key(editor.textarea, 'l', { shiftKey: true }); assert.equal(doc.selections.length, 3); await paint(); assert.ok(node.querySelector('.markdown-quoted.markdown-active'));
        assert.equal(clipboard(editor.textarea, 'copy'), 'cat\r\ncat\r\ncat'); type(editor.textarea, 'dog'); assert.equal(doc.value, source.replaceAll('cat', 'dog')); assert.equal(doc.selections.length, 3); editor.undo(); assert.equal(doc.value, source); assert.equal(doc.selections.length, 3);
        clipboard(editor.textarea, 'paste', 'one\r\ntwo\r\nthree'); assert.equal(doc.value, '# one\r\n\r\n> two\r\n\r\nthree'); editor.undo();
        clipboard(editor.textarea, 'cut'); assert.equal(doc.value, '# \r\n\r\n> \r\n\r\n'); editor.undo(); assert.equal(doc.value, source);
        editor.bold(); assert.equal(doc.value, '# **cat**\r\n\r\n> **cat**\r\n\r\n**cat**'); editor.undo();
        editor.selectMany([{ start: 5 }, { start: source.indexOf('cat', 6) + 3 }]); key(editor.textarea, 'Backspace', { ctrlKey: false }); assert.equal(doc.value, '# ca\r\n\r\n> ca\r\n\r\ncat'); editor.undo();
        editor.selectMany([{ start: 2, end: 5 }, { start: source.indexOf('cat', 6), end: source.indexOf('cat', 6) + 3 }]); let field = editor.textarea;
        field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true })); field.setRangeText('猫', field.selectionStart, field.selectionEnd, 'end'); field.dispatchEvent(new win.InputEvent('input', { isComposing: true, inputType: 'insertCompositionText', bubbles: true })); assert.equal(doc.value, source);
        field.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true })); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertFromComposition', bubbles: true })); await settle(); assert.equal(doc.value, '# 猫\r\n\r\n> 猫\r\n\r\ncat'); editor.undo(); assert.equal(doc.value, source);
        editor.setOptions({ readonly: true }); assert.equal(clipboard(field, 'cut'), 'cat\r\ncat'); assert.equal(doc.value, source); assert.equal(editor.bold(), false); assert.equal(editor.undo(), false);
        editor.dispose(); node.remove();
    });
    await t.test('search option buttons, truncation safeguards, active fold buttons and edit mapping remain functional', async () => {
        let source = '# Head\n\ncat concatenate CAT\n\n# Next\nend', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc, { fold: true });
        editor.find('cat'); assert.equal(editor.find().matches.length, 3); editor.openFind(true); await settle();
        let panel = node.querySelector('.markdown-find'), button = label => [...panel.querySelectorAll('button')].find(button => button.textContent === label);
        button('Whole word').click(); assert.equal(editor.find().matches.length, 2); button('Match case').click(); assert.equal(editor.find().matches.length, 1);
        editor.closeFind(); editor.select({ start: 2 }); await settle(); let activeFold = node.querySelector('.markdown-active-fold'); assert.equal(activeFold.hidden, false); activeFold.click(); await paint(); assert.ok(node.querySelector('.markdown-fold-chip'));
        doc.replace(doc.value.indexOf('# Next'), doc.value.indexOf('# Next'), '\n'); await paint(); assert.ok(node.querySelector('.markdown-fold-chip')); assert.equal(editor.rectAt(doc.value.indexOf('cat')), null);
        doc.replace(doc.value.indexOf('cat'), doc.value.indexOf('cat') + 3, 'dog'); await paint(); assert.equal(node.querySelector('.markdown-fold-chip'), null); assert.ok(node.textContent.includes('dog'));
        editor.setValue('x '.repeat(10001)); editor.find('x'); assert.equal(editor.find().truncated, true); assert.equal(editor.replaceAll('y'), false); assert.equal(doc.value, 'x '.repeat(10001));
        editor.dispose(); node.remove();
    });
    await t.test('complete controller contract, source geometry round trips, rectangles, refresh and cleanup', async () => {
        let doc = new api.EditorDocument('# Head\n\nalpha\nbeta\n\nlast'), node = host(), editor = api.mountMarkdownEditor(node, doc), surface = node.querySelector('.markdown-surface');
        surface.getBoundingClientRect = () => ({ left: 10, top: 20, right: 610, bottom: 340, width: 600, height: 320 });
        for (let method of ['rectAt', 'offsetAt', 'refresh', 'selectMany', 'addNextOccurrence', 'fold', 'unfold', 'foldAll', 'unfoldAll', 'lineCommand', 'insert', 'undoSelection', 'redoSelection', 'indent', 'outdent', 'newline', 'toggleComment', 'find', 'findNext', 'findPrevious', 'replace', 'replaceAll', 'openFind', 'closeFind', 'goToLine', 'openGoToLine']) assert.equal(typeof editor[method], 'function', method);
        editor.select({ start: doc.value.indexOf('alpha') + 2 }); await paint(); let rect = editor.rectAt(doc.selection.start); assert.ok(rect.height > 0); assert.equal(editor.offsetAt(rect.left, rect.top + rect.height / 2), doc.selection.start); assert.equal(editor.offsetAt(1, 1), null); assert.equal(editor.rectAt(-1), null);
        let a = editor.rectAt(doc.offset(3, 2)), b = editor.rectAt(doc.offset(4, 4));
        let down = new win.MouseEvent('pointerdown', { altKey: true, clientX: a.left, clientY: a.top + a.height / 2, bubbles: true, cancelable: true }); surface.dispatchEvent(down);
        win.dispatchEvent(new win.MouseEvent('pointermove', { altKey: true, clientX: b.left, clientY: b.top + b.height / 2 })); win.dispatchEvent(new win.MouseEvent('pointerup', { altKey: true })); assert.equal(doc.selections.length, 2);
        editor.refresh(); await paint(); assert.equal(editor.state.value, doc.value); assert.equal(editor.state.selections.length, doc.selections.length);
        editor.dispose(); assert.equal(node.querySelector('.markdown-controls'), null); assert.equal(editor.rectAt(0), null); node.remove();
    });
});
