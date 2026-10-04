import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from 'sass';
import { resolve } from 'node:path';
import { compiledBrowser } from './test-code-editor-services-support.mjs';

test('compiled Markdown same-surface editing, safe HTML, exact text, IME and cleanup', async (t) => {
    let { api, win, settle, paint, host, code } = await compiledBrowser(t, 'src/components/code-editor/markdown.ts');
    assert.ok(!/\bhtml\s*`/.test(code));
    function type(field, data) {
        let before = new win.InputEvent('beforeinput', { inputType: 'insertText', data, bubbles: true, cancelable: true }); field.dispatchEvent(before);
        if (!before.defaultPrevented) { field.setRangeText(data, field.selectionStart, field.selectionEnd, 'end'); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertText', data, bubbles: true })); }
    }
    await t.test('inactive Markdown renders and clicking activates the very same block position', async () => {
        let source = '---\r\ntitle: demo\r\n---\r\n# Heading\r\n\r\n**strong** *em* ~~gone~~ `code` [link](https://example.com)\r\n\r\n> quote\r\n\r\n- [ ] task\r\n\r\n```js\r\nconst x = 1;\r\n```',
            doc = new api.EditorDocument(source), node = host(), changes = [], editor = api.mountMarkdownEditor(node, doc, {}, { onChange: (value) => changes.push(value) });
        await settle(); assert.equal(node.querySelector('.markdown-input').hidden, true); assert.ok(node.querySelector('.markdown-frontmatter')); assert.equal(node.querySelector('.markdown-h1').textContent, 'Heading');
        assert.equal(node.querySelector('strong').textContent, 'strong'); assert.equal(node.querySelector('em').textContent, 'em'); assert.equal(node.querySelector('s').textContent, 'gone'); assert.equal(node.querySelector('a').textContent, 'link');
        assert.equal(node.querySelector('pre code').textContent, 'const x = 1;');
        let checkbox = node.querySelector('[type=checkbox]'); checkbox.click(); await settle(); assert.ok(doc.value.includes('- [x] task')); editor.undo(); assert.equal(doc.value, source);
        node.querySelector('.markdown-h1').click(); await settle(); let field = editor.textarea;
        assert.equal(field.value, '# Heading\n'); assert.equal(node.querySelector('.markdown-block.markdown-h1'), null); assert.ok(node.querySelector('.markdown-block--frontmatter'));
        field.setSelectionRange(2, 9); type(field, 'Changed'); await settle(); assert.ok(doc.value.includes('# Changed\r\n')); assert.equal(editor.textarea, field);
        editor.undo(); assert.equal(doc.value, source); field.blur(); await settle(); assert.equal(node.querySelector('.markdown-block.markdown-h1').textContent, 'Heading'); assert.equal(field.hidden, true);
        assert.ok(changes.length); editor.dispose(); assert.equal(node.querySelector('textarea'), null); node.remove();
    });
    await t.test('HTML parser allowlist strips scripts, events, style, forms and hostile URLs', async () => {
        let source = '<div onclick="evil()" style="background:url(javascript:evil())"><strong>Safe</strong><script>bad</script><img src="javascript:evil()" onerror="evil()" alt="alt"><a href="java&#10;script:evil()">bad URL</a><a href="https://example.com" target="_blank">good URL</a><svg><script>bad2</script></svg><iframe srcdoc="evil"></iframe><input autofocus onfocus="evil()"></div>',
            doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc);
        await settle(); assert.equal(node.querySelector('strong').textContent, 'Safe'); assert.equal(node.querySelector('.markdown-block--html').querySelector('script,svg,iframe,input,img'), null);
        assert.equal(node.querySelector('[onclick],[onerror],[onfocus]'), null); assert.equal(node.querySelector('.markdown-block--html').querySelector('[style]'), null); assert.equal(node.querySelectorAll('a')[0].getAttribute('href'), null); assert.equal(node.querySelectorAll('a')[1].getAttribute('href'), 'https://example.com'); assert.equal(doc.value, source);
        editor.dispose(); node.remove();
    });
    await t.test('list Enter/Backspace, Mod+B/I, save, readonly and external multi-block selections', async () => {
        let doc = new api.EditorDocument('- task\r\n\r\nsecond'), node = host(), saves = [], editor = api.mountMarkdownEditor(node, doc, {}, { onSave: (value) => saves.push(value) });
        editor.select({ start: 6 }); let field = editor.textarea;
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); assert.equal(doc.value, '- task\r\n- \r\n\r\nsecond');
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })); assert.equal(doc.value, '- task\r\n\r\n\r\nsecond');
        editor.select({ start: doc.value.indexOf('second') + 2 }); field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true })); assert.ok(doc.value.endsWith('**second**'));
        editor.select({ start: 0, end: doc.value.length }); await settle(); assert.equal(field.value, doc.value.replace(/\r\n/g, '\n')); assert.ok(node.querySelector('.markdown-active')); assert.ok(field.classList.contains('markdown-input--selection'));
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); assert.equal(saves[0], doc.value);
        editor.setOptions({ readonly: true }); await settle(); let value = doc.value; type(field, 'blocked'); assert.equal(doc.value, value); assert.equal(editor.bold(), false); assert.equal(editor.undo(), false);
        editor.dispose(); node.remove();
    });
    await t.test('composition commits once, queues controlled values and preserves native input', async () => {
        let doc = new api.EditorDocument('hello\r\n'), node = host(), changes = [], editor = api.mountMarkdownEditor(node, doc, {}, { onChange: (_value, change) => changes.push(change.source) });
        editor.select({ start: 5 }); let field = editor.textarea;
        field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true })); field.setRangeText('日', 5, 5, 'end'); field.dispatchEvent(new win.InputEvent('input', { isComposing: true, inputType: 'insertCompositionText', bubbles: true }));
        assert.equal(doc.value, 'hello\r\n'); assert.equal(editor.setValue('external\r\n'), false);
        field.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true })); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertFromComposition', bubbles: true })); await settle(); assert.equal(doc.value, 'external\r\n'); assert.deepEqual(changes, ['composition', 'external']); assert.equal(editor.textarea, field);
        editor.undo(); assert.equal(doc.value, 'hello日\r\n'); editor.undo(); assert.equal(doc.value, 'hello\r\n');
        editor.select({ start: 5 }); field.dispatchEvent(new win.CompositionEvent('compositionstart')); field.setRangeText('語', 5, 5, 'end'); editor.dispose(); assert.equal(doc.value, 'hello語\r\n');
        let count = changes.length; doc.setValue('orphan'); field.dispatchEvent(new win.Event('input')); assert.equal(changes.length, count); node.remove();
    });
    await t.test('component options react and stop after controller disposal', async () => {
        let { render } = await import('@esportsplus/template'), { reactive } = await import('@esportsplus/reactivity'), options = reactive({ readonly: false }), doc = new api.EditorDocument('# component'), node = host(), editor, reads = 0;
        let unmount = render(node, {}, () => api.markdownEditor({ document: doc, options: () => { reads++; return options; }, controller: (view) => { editor = view; } }));
        await paint(); assert.ok(editor); options.readonly = true; await settle(); assert.equal(editor.textarea.readOnly, true);
        editor.dispose(); await settle(); let count = reads; options.readonly = false; await settle(); assert.equal(reads, count); unmount(); node.remove();
    });
    await t.test('dragged rendered selection, Shift+Arrow and Mod+A select across source blocks', async () => {
        let doc = new api.EditorDocument('# first\r\n\r\nsecond'), node = host(), editor = api.mountMarkdownEditor(node, doc); await settle();
        let first = node.querySelector('.markdown-h1 span').firstChild, second = node.querySelector('.markdown-block--paragraph span').firstChild,
            range = win.document.createRange(); range.setStart(first, 1); range.setEnd(second, 3);
        win.getSelection().removeAllRanges(); win.getSelection().addRange(range); node.dispatchEvent(new win.Event('pointerup', { bubbles: true })); await settle();
        assert.equal(doc.value.slice(doc.selection.start, doc.selection.end), 'irst\r\n\r\nsec');
        editor.select({ start: doc.value.indexOf('second') }); let field = editor.textarea;
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true })); assert.equal(doc.selection.direction, 'backward'); assert.equal(doc.selection.end - doc.selection.start, 2);
        field.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true })); assert.equal(doc.selection.start, 0); assert.equal(doc.selection.end, doc.value.length);
        editor.dispose(); node.remove();
    });
    await t.test('active headings, nested quotes and code retain the inactive typography and block styling', async () => {
        let style = win.document.createElement('style'); style.textContent = compile(resolve(import.meta.dirname, '../src/components/code-editor/scss/_markdown.scss')).css; win.document.head.append(style);
        let source = '# Heading\n\n> > nested quote\n\n    literal code', doc = new api.EditorDocument(source), node = host(); node.style.font = '13px/20px monospace';
        let editor = api.mountMarkdownEditor(node, doc); await settle();
        let heading = node.querySelector('.markdown-block.markdown-h1'), inactive = win.getComputedStyle(heading);
        let headingMetrics = [inactive.fontSize, inactive.fontWeight, inactive.lineHeight]; heading.click(); await settle();
        let field = editor.textarea, active = win.getComputedStyle(field);
        assert.deepEqual([active.fontSize, active.fontWeight, active.lineHeight], headingMetrics); assert.equal(active.fontWeight, '600'); assert.ok(field.classList.contains('markdown-h1')); assert.equal(field.value, '# Heading\n');
        assert.ok(parseFloat(field.style.height) > 20, `heading keeps its enlarged line height: ${field.style.cssText}; ${active.fontSize}/${active.lineHeight}`);
        field.blur(); await settle(); let quote = node.querySelector('.markdown-block--quote'), quoteMetrics = win.getComputedStyle(quote), quoteStyle = [quoteMetrics.paddingLeft, quoteMetrics.backgroundImage, quoteMetrics.color];
        assert.equal(quote.textContent, 'nested quote'); assert.equal(quote.style.getPropertyValue('--markdown-quote-depth'), '2'); quote.click(); await settle();
        active = win.getComputedStyle(field); assert.deepEqual([active.paddingLeft, active.backgroundImage, active.color], quoteStyle); assert.equal(field.value, '> > nested quote\n'); assert.equal(field.style.getPropertyValue('--markdown-quote-depth'), '2');
        field.blur(); await settle(); node.querySelector('.markdown-block--code').click(); await settle(); assert.ok(field.classList.contains('markdown-block--code')); assert.equal(field.value, '    literal code'); assert.ok(win.getComputedStyle(field).backgroundColor !== 'rgba(0, 0, 0, 0)');
        editor.dispose(); node.remove(); style.remove();
    });
    await t.test('nested containers, indented code, balanced links and reference links render the reference forms', async () => {
        let source = '- parent\n  - child\n    - grandchild\n\n> first\n> > second\n\n    **literal code**\n\n[balanced](https://example.test/a(b(c))) **one\\** two** *one **two** three*\n\n[shown][ref]\n\n[ref]: https://example.test/reference',
            doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc); await settle();
        assert.deepEqual([...node.querySelectorAll('.markdown-block--list')].map((row) => row.style.getPropertyValue('--markdown-indent')), ['0', '2', '4']);
        assert.deepEqual([...node.querySelectorAll('.markdown-block--quote')].map((row) => [row.textContent, row.style.getPropertyValue('--markdown-quote-depth')]), [['first', '1'], ['second', '2']]);
        assert.equal(node.querySelector('pre code').textContent, '**literal code**'); assert.equal(node.querySelector('pre strong'), null);
        assert.equal(node.querySelector('a').getAttribute('href'), 'https://example.test/a(b(c))'); assert.equal(node.querySelector('strong').textContent, 'one** two'); assert.ok(node.querySelector('em strong'));
        let reference = [...node.querySelectorAll('a')].find((link) => link.textContent === '[shown][ref]'); assert.equal(reference.getAttribute('href'), 'https://example.test/reference');
        reference.click(); await settle(); assert.equal(editor.textarea.value, '[shown][ref]\n'); assert.equal(doc.value, source);
        editor.dispose(); node.remove();
    });
    await t.test('ten thousand blocks use a bounded measured window, distant selection and native region geometry', async () => {
        let source = Array.from({ length: 5000 }, (_, i) => `## row ${i}\n\n`).join(''), doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc), surface = node.querySelector('.markdown-surface');
        Object.defineProperties(surface, { clientHeight: { configurable: true, value: 200 }, clientWidth: { configurable: true, value: 600 } });
        const descriptor = Object.getOwnPropertyDescriptor(win.HTMLElement.prototype, 'getBoundingClientRect');
        const rowHeight = (element) => element.hidden || element.classList.contains('markdown-measure') ? 0 : element.classList.contains('markdown-spacer') || element.tagName === 'TEXTAREA' ? parseFloat(element.style.height) || 0 : element.classList.contains('markdown-h2') ? 24.505 : 20;
        win.HTMLElement.prototype.getBoundingClientRect = function () {
            if (this === surface) return { left: 0, top: 0, right: 600, bottom: 200, width: 600, height: 200 };
            if (this.parentElement !== surface) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
            let top = 12 - surface.scrollTop; for (let previous = this.previousElementSibling; previous; previous = previous.previousElementSibling) top += rowHeight(previous);
            let height = rowHeight(this); return { left: 12, top, right: 588, bottom: top + height, width: 576, height };
        };
        try {
            await paint(); assert.ok(node.querySelectorAll('.markdown-block').length <= 120); assert.ok(node.querySelectorAll('*').length < 500); assert.ok(parseFloat(surface.lastElementChild.previousElementSibling.style.height) > 100000);
            surface.scrollTop = 90000; surface.dispatchEvent(new win.Event('scroll')); await paint();
            let first = node.querySelector('.markdown-block'); assert.ok(Number(first.dataset.mdFrom) > source.indexOf('row 1000'));
            let offset = source.indexOf('row 4500'); editor.select({ start: offset }); await paint();
            assert.equal(editor.textarea.value, '## row 4500\n'); assert.equal(doc.selection.start, offset); assert.ok(node.querySelectorAll('.markdown-block').length <= 120);
            let box = editor.textarea.getBoundingClientRect(); assert.ok(box.top >= 0 && box.bottom <= 200, 'active native editor is at the selected region in the viewport');
            editor.textarea.setSelectionRange(editor.textarea.value.length, editor.textarea.value.length); editor.textarea.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); await paint();
            assert.ok(doc.selection.start >= offset + 'row 4500'.length); assert.ok(node.querySelectorAll('.markdown-block').length <= 120);
            editor.select({ start: 0, end: source.length }); await paint(); assert.equal(editor.textarea.value, source); assert.ok(node.querySelectorAll('.markdown-block').length <= 120); assert.ok(node.querySelector('.markdown-active.markdown-h2')); assert.ok(node.querySelectorAll('*').length < 500);
            editor.textarea.blur(); await paint(); assert.ok(node.querySelectorAll('.markdown-block').length <= 120); assert.equal(doc.value, source);
            editor.focus(); await paint(); let field = editor.textarea;
            field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true })); field.setRangeText('日', field.selectionStart, field.selectionEnd, 'end'); field.dispatchEvent(new win.InputEvent('input', { isComposing: true, inputType: 'insertCompositionText', bubbles: true })); await settle();
            assert.equal(doc.value, source); assert.equal(node.querySelector('.markdown-active .markdown-selection').textContent, '日'); assert.ok(node.querySelectorAll('.markdown-block').length <= 120);
            field.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true })); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertFromComposition', bubbles: true })); await paint(); assert.equal(doc.value, '日'); editor.undo(); await paint(); assert.equal(doc.value, source);
            editor.dispose(); await paint(); assert.equal(node.querySelector('textarea'), null);
        } finally { if (descriptor) Object.defineProperty(win.HTMLElement.prototype, 'getBoundingClientRect', descriptor); else delete win.HTMLElement.prototype.getBoundingClientRect; editor.dispose(); node.remove(); }
    });
    await t.test('a single five-thousand-line code fence is windowed and navigation works in readonly mode', async () => {
        let source = '```ts\n' + Array.from({ length: 5000 }, (_, i) => `const x${i} = ${i};\n`).join('') + '```\n\nend', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc, { readonly: true }), surface = node.querySelector('.markdown-surface');
        await paint(); assert.ok(node.querySelectorAll('pre code span').length <= 96); assert.ok(node.querySelectorAll('*').length < 150);
        surface.scrollTop = 60000; surface.dispatchEvent(new win.Event('scroll')); await paint();
        let block = node.querySelector('.markdown-block--fence'); assert.ok(Number(block.dataset.mdFrom) > source.indexOf('x1000')); block.click(); await paint();
        assert.ok(editor.textarea.value.startsWith('```ts\n')); assert.ok(editor.textarea.value.endsWith('```\n')); assert.ok(editor.textarea.classList.contains('markdown-block--fence')); assert.equal(editor.textarea.readOnly, true);
        editor.textarea.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, cancelable: true })); await paint(); assert.equal(doc.selection.start, source.length); assert.equal(editor.textarea.value, 'end');
        editor.textarea.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true, cancelable: true })); await paint(); assert.equal(doc.selection.start, 0); assert.ok(node.querySelectorAll('.markdown-block').length <= 120);
        assert.equal(doc.value, source); editor.dispose(); node.remove();
    });
    await t.test('multi-block raw selections retain individual block styling and commit native typing/IME once', async () => {
        let source = '# Heading\r\n\r\n> quote\r\n\r\n```js\r\ncode\r\n```\r\n\r\nend', doc = new api.EditorDocument(source), node = host(), changes = [], editor = api.mountMarkdownEditor(node, doc, {}, { onChange: (_value, change) => changes.push(change.source) });
        editor.select({ start: 0, end: source.indexOf('end') }); await settle();
        assert.equal(node.querySelector('.markdown-active.markdown-h1').textContent.trim(), '# Heading');
        assert.equal(node.querySelector('.markdown-active.markdown-quoted').textContent.trim(), '> quote');
        assert.ok(node.querySelector('.markdown-active.markdown-block--fence').textContent.includes('```js'));
        let field = editor.textarea; assert.ok(field.classList.contains('markdown-input--selection')); type(field, 'replacement'); await settle(); assert.equal(doc.value, 'replacementend'); assert.ok(!field.classList.contains('markdown-input--selection'));
        editor.undo(); assert.equal(doc.value, source); editor.select({ start: 0, end: source.indexOf('end') }); await settle();
        field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true })); field.setRangeText('日', field.selectionStart, field.selectionEnd, 'end'); field.dispatchEvent(new win.InputEvent('input', { isComposing: true, inputType: 'insertCompositionText', bubbles: true })); await settle();
        assert.equal(doc.value, source); assert.equal(node.querySelector('.markdown-active .markdown-selection').textContent, '日');
        field.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true })); field.dispatchEvent(new win.InputEvent('input', { inputType: 'insertFromComposition', bubbles: true })); await settle();
        assert.equal(doc.value, '日end'); assert.equal(changes.filter((source) => source === 'composition').length, 1); editor.undo(); assert.equal(doc.value, source);
        editor.dispose(); node.remove();
    });
    await t.test('viewport cuts retain logical inline markup across long paragraphs and quote lines', async () => {
        let source = '**' + Array.from({ length: 300 }, (_, i) => `word${i} `).join('').repeat(8).trimEnd() + '**\n\n> *first\n> second*', doc = new api.EditorDocument(source), node = host(), editor = api.mountMarkdownEditor(node, doc), surface = node.querySelector('.markdown-surface');
        await paint(); assert.ok(node.querySelector('strong')); assert.ok(!node.querySelector('.markdown-block').textContent.startsWith('**'));
        surface.scrollTop = 3000; surface.dispatchEvent(new win.Event('scroll')); await paint(); assert.ok(node.querySelector('strong')); assert.ok(node.querySelector('.markdown-block').classList.contains('markdown-continuation'));
        editor.select({ start: source.indexOf('first') }); editor.textarea.blur(); await paint();
        assert.equal(node.querySelector('.markdown-block--quote').textContent, 'first\nsecond'); assert.equal(node.querySelectorAll('.markdown-block--quote em').length, 2);
        assert.equal(doc.value, source); editor.dispose(); node.remove();
    });
});
