import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
let JSDOM;
for (let location of [process.env.CODE_EDITOR_JSDOM_PATH, 'jsdom'].filter(Boolean)) {
    try { ({ JSDOM } = require(location)); break; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}

test('compiled template DOM input, controls, viewport and disposal smoke', {
    skip: !JSDOM && 'Use an existing jsdom via CODE_EDITOR_JSDOM_PATH; no installation is required'
}, async (t) => {
    let browser = new JSDOM('<!doctype html><style>.code-editor-input { font: 13px monospace; line-height: 20px; padding: 12px; }</style><body></body>', { pretendToBeVisual: true }),
        win = browser.window, frames = new Map(), frameId = 0, observers = new Set(),
        raf = (fn) => { let id = ++frameId; frames.set(id, fn); return id; },
        cancel = (id) => frames.delete(id), originals = new Map();
    for (let [key, value] of Object.entries({
        window: win, document: win.document, navigator: win.navigator,
        Node: win.Node, NodeList: win.NodeList, NodeFilter: win.NodeFilter,
        HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement,
        HTMLTextAreaElement: win.HTMLTextAreaElement,
        requestAnimationFrame: raf, cancelAnimationFrame: cancel, getComputedStyle: win.getComputedStyle.bind(win)
    })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    win.requestAnimationFrame = raf; win.cancelAnimationFrame = cancel;
    win.ResizeObserver = class {
        constructor(fn) { this.fn = fn; }
        observe() { observers.add(this); }
        disconnect() { observers.delete(this); }
    };
    // jsdom supplies DOM/event semantics, not layout/canvas. These fixed metrics exercise windowing only.
    Object.defineProperties(win.HTMLTextAreaElement.prototype, {
        clientWidth: { configurable: true, get: () => 600 },
        clientHeight: { configurable: true, get: () => 200 }
    });
    let canvasDraws=[];
    win.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: (text) => ({ width: text.length * 7 }),setTransform(){},clearRect(){},fillRect(...args){canvasDraws.push(args);} });
    t.after(() => {
        win.close(); frames.clear();
        for (let [key, original] of originals) {
            if (original) Object.defineProperty(globalThis, key, original);
            else delete globalThis[key];
        }
    });

    // Exercise real compiled editor templates and the consumer's shared first-party runtimes.
    let bundle = await build({
        configFile: false, root, logLevel: 'silent', plugins: [template({ root })],
        build: {
            write: false, minify: false,
            lib: { entry: resolve(root, 'src/components/code-editor/index.ts'), formats: ['es'] },
            rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') }
        }
    });
    let code = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((item) => item.output)
        .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n')
        .replace(/^import\s*['"][^'"]+\.scss['"];?\s*$/gm, '')
        .replace(/from\s*(['"])(@esportsplus\/[^'"]+)\1/g, (_match, _quote, id) => `from ${JSON.stringify(import.meta.resolve(id))}`);
    let { default: codeEditor, mountEditor, EditorDocument } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')),
        { render } = await import('@esportsplus/template'),
        { flush, reactive } = await import('@esportsplus/reactivity');

    async function settle() { flush(); await Promise.resolve(); await Promise.resolve(); flush(); }
    async function paint() {
        await settle();
        for (let turn = 0; frames.size && turn < 10; turn++) {
            let pending = [...frames.values()]; frames.clear();
            for (let frame of pending) frame(turn * 16);
            await settle();
        }
        assert.equal(frames.size, 0, 'no continuous animation loop');
    }
    function host() {
        let node = win.document.createElement('div'); node.className = 'code-editor';
        node.style.setProperty('--editor-height', '400px'); win.document.body.append(node);
        return node;
    }
    function nativeInput(api, inputType, text, from = api.textarea.selectionStart, to = api.textarea.selectionEnd) {
        let field = api.textarea;
        field.setSelectionRange(from, to);
        let before = new win.InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType, data: text });
        field.dispatchEvent(before);
        if (!before.defaultPrevented) {
            field.value = field.value.slice(0, from) + text + field.value.slice(to);
            field.setSelectionRange(from + text.length, from + text.length);
            field.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType, data: text }));
        }
        return before;
    }
    function button(node, label) {
        return [...node.querySelectorAll('button')].find((field) => field.textContent === label);
    }

    await t.test('mount exposes a persistent native input; native and command edits preserve exact source and history', async () => {
        let node = host(), doc = new EditorDocument('a\r\nb\rc\n'), changes = [], selections = [], saves = [],
            api = mountEditor(node, doc, { fileName: 'a.ts' }, {
                onChange: (value, change) => changes.push([value, change.source]),
                onSelection: (selection) => selections.push(selection), onSave: (value) => saves.push(value)
            }), field = api.textarea;
        assert.equal(node.querySelector('textarea'), field);
        assert.equal(field.value, 'a\nb\nc\n');
        nativeInput(api, 'insertText', 'X', 3, 3);
        assert.equal(doc.value, 'a\r\nbX\rc\n');
        assert.equal(changes.at(-1)[1], 'input');
        api.undo(); assert.equal(doc.value, 'a\r\nb\rc\n');
        api.redo(); assert.equal(doc.value, 'a\r\nbX\rc\n');
        api.setValue(''); api.select({ start: 0 });
        assert.equal(nativeInput(api, 'insertText', '(').defaultPrevented, true);
        assert.equal(doc.value, '()');
        nativeInput(api, 'insertLineBreak', '\n');
        assert.equal(doc.value, '(\n    \n)');
        api.save(); assert.equal(saves.at(-1), doc.value); assert.ok(selections.length);
        await paint();
        assert.equal(node.querySelector('textarea'), field);
        assert.equal(node.style.getPropertyValue('--editor-height'), '400px');
        api.dispose(); api.dispose(); node.remove(); await paint();
    });

    await t.test('template find/go controls, status, replacement, options and errors stay reactive without replacing input', async () => {
        let node = host(), doc = new EditorDocument('one ONE\r\none'), api = mountEditor(node, doc), field = api.textarea;
        api.openFind(true); await settle();
        let bar = node.querySelector('.code-editor-find'), query = bar.querySelector('[aria-label="Find text"]'),
            replacement = bar.querySelector('[aria-label="Replacement text"]');
        assert.equal(bar.hidden, false); assert.equal(replacement.hidden, false);
        query.value = 'one'; query.dispatchEvent(new win.Event('input', { bubbles: true })); await settle();
        assert.equal(node.querySelector('.code-editor-find-status').textContent, '0 / 3');
        button(bar, 'Case').click(); await settle();
        assert.equal(button(bar, 'Case').getAttribute('aria-pressed'), 'true');
        assert.equal(node.querySelector('.code-editor-find-status').textContent, '0 / 2');
        button(bar, 'Next').click(); await settle();
        assert.equal(node.querySelector('.code-editor-find-status').textContent, '1 / 2');
        replacement.value = 'two'; replacement.dispatchEvent(new win.Event('input', { bubbles: true }));
        button(bar, 'Replace all').click(); await settle();
        assert.equal(doc.value, 'two ONE\r\ntwo'); api.undo();
        api.setOptions({ readonly: true }); await settle();
        assert.equal(field.readOnly, true); assert.equal(button(bar, 'Replace all').disabled, true);
        assert.equal(api.insert('blocked'), false); assert.equal(api.undo(), false);
        api.setOptions({ readonly: false });
        api.find('[', { regex: true }); await settle();
        assert.equal(query.getAttribute('aria-invalid'), 'true');
        assert.equal(button(bar, 'Replace all').disabled, true);
        api.closeFind(); await settle(); assert.equal(bar.hidden, true);
        api.openGoToLine(); await settle();
        let go = node.querySelector('.code-editor-go'), goInput = go.querySelector('input');
        goInput.value = 'bad'; goInput.dispatchEvent(new win.Event('input', { bubbles: true }));
        go.dispatchEvent(new win.Event('submit', { cancelable: true })); await settle();
        assert.equal(goInput.getAttribute('aria-invalid'), 'true');
        goInput.value = '2:2'; goInput.dispatchEvent(new win.Event('input', { bubbles: true }));
        go.dispatchEvent(new win.Event('submit', { cancelable: true })); await settle();
        assert.equal(go.hidden, true); assert.equal(doc.selection.start, doc.offset(2, 2));
        assert.equal(node.querySelector('textarea'), field);
        api.dispose(); node.remove(); await paint();
    });

    await t.test('bounded template rows/tokens and gutter safely render source and scroll a long document', async () => {
        let node = host(), source = '<img src=x onerror=alert(1)>',
            doc = new EditorDocument(source + '\n' + Array.from({ length: 5000 }, (_, i) => `const row${i} = ${i};`).join('\n')),
            api = mountEditor(node, doc, { language: 'typescript' }), field = api.textarea;
        await paint();
        assert.equal(node.querySelector('.code-editor-line').textContent, source);
        assert.equal(node.querySelector('img'), null);
        assert.ok(node.querySelector('.code-editor-token--keyword'));
        assert.ok(node.querySelectorAll('.code-editor-line').length <= 20);
        assert.equal(node.querySelector('.code-editor-number > span').textContent, '1');
        field.scrollTop = 4000; field.scrollLeft = 30;
        field.dispatchEvent(new win.Event('scroll')); await paint();
        assert.equal(node.querySelector('.code-editor-number > span').textContent, '196');
        assert.ok(node.querySelector('.code-editor-lines').style.transform.startsWith('translate(-18px'));
        assert.ok(node.querySelectorAll('.code-editor-line').length <= 20);
        api.setOptions({ highlight: false, lineNumbers: false }); await paint();
        let view = node.querySelector('.code-editor-view');
        assert.equal(view.dataset.highlight, 'false'); assert.equal(view.dataset.lineNumbers, 'false');
        assert.equal(node.querySelector('textarea'), field);
        api.dispose(); node.remove(); await paint();
    });

    await t.test('composition commits once, queued values follow it, and disposal flushes composition without leaking listeners', async () => {
        let node = host(), doc = new EditorDocument('a\r\n'), changes = [],
            api = mountEditor(node, doc, {}, { onChange: (_value, change) => changes.push(change.source) }), field = api.textarea;
        api.select({ start: doc.value.length });
        field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true }));
        field.value = 'a\n日'; field.setSelectionRange(3, 3);
        field.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', isComposing: true }));
        await settle(); assert.equal(doc.value, 'a\r\n');
        assert.equal(node.querySelector('.code-editor-view').dataset.composing, 'true');
        api.setOptions({ language: 'typescript' });
        assert.equal(api.setValue('external\r\n'), false);
        assert.equal(field.value, 'a\n日');
        field.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true }));
        field.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'insertFromComposition' }));
        await settle(); assert.equal(doc.value, 'external\r\n');
        assert.deepEqual(changes, ['composition', 'external']);
        api.undo(); assert.equal(doc.value, 'a\r\n日');
        api.undo(); assert.equal(doc.value, 'a\r\n');
        api.select({ start: doc.value.length });
        field.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true }));
        field.value = 'a\n語'; field.setSelectionRange(3, 3);
        api.dispose(); assert.equal(doc.value, 'a\r\n語');
        assert.equal(node.querySelector('textarea'), null);
        let count = changes.length;
        field.value = 'stale'; field.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        doc.setValue('after disposal');
        assert.equal(changes.length, count); assert.equal(api.insert('blocked'), false);
        await paint(); assert.equal(node.dataset.composing, undefined);
        assert.equal(observers.size, 0); node.remove();
    });

    await t.test('component prop effects preserve draft on option changes and stop on unmount; remount owns a fresh view', async () => {
        let node = host(), doc = new EditorDocument('initial'), draft = reactive({ value: 'initial' }),
            options = reactive({ readonly: false, label: 'Source' }), controllers = [],
            unmount = render(node, {}, () => codeEditor({
                document: doc, value: () => draft.value, options: () => options,
                controller: (api) => controllers.push(api)
            }));
        await paint();
        assert.equal(controllers.length, 1);
        let api = controllers[0], field = api.textarea;
        nativeInput(api, 'insertText', '!', 7, 7); assert.equal(doc.value, 'initial!');
        options.label = 'Updated source'; await paint();
        assert.equal(doc.value, 'initial!'); assert.equal(field.getAttribute('aria-label'), 'Updated source');
        assert.equal(node.querySelector('textarea'), field);
        draft.value = 'controlled\r\n'; await paint(); assert.equal(doc.value, 'controlled\r\n');
        options.readonly = true; await paint(); assert.equal(field.readOnly, true);
        unmount(); await paint();
        assert.equal(node.querySelector('textarea'), null); assert.equal(observers.size, 0);
        draft.value = 'orphan'; options.readonly = false; await paint();
        assert.equal(doc.value, 'controlled\r\n');
        let again = mountEditor(node, doc); await paint();
        assert.notEqual(again.textarea, field); assert.equal(again.textarea.value, 'controlled\n');
        again.dispose(); node.remove(); await paint(); assert.equal(observers.size, 0);
    });

    await t.test('explicit controller disposal stops component prop effects and same-host remount resets template state', async () => {
        let node = host(), doc = new EditorDocument('source'), options = reactive({ readonly: false }),
            draft = reactive({ value: 'source' }), reads = { value: 0, options: 0 }, api,
            unmount = render(node, {}, () => codeEditor({
                document: doc,
                value: () => { reads.value++; return draft.value; },
                options: () => { reads.options++; return options; },
                controller: (controller) => { api = controller; }
            }));
        await paint();
        api.dispose(); await paint();
        let before = { ...reads };
        draft.value = 'should not run'; options.readonly = true; await paint();
        assert.deepEqual(reads, before, 'disposed component prop effects do not reevaluate getters');
        assert.equal(doc.value, 'source'); unmount();

        let first = mountEditor(node, doc, { highlight: false, readonly: true, tabSize: 8 });
        await paint();
        assert.equal(node.querySelector('.code-editor-view').dataset.highlight, 'false');
        assert.equal(first.textarea.readOnly, true);
        let oldCase = button(node, 'Case');
        first.dispose(); await paint();
        assert.equal(node.querySelector('.code-editor-view'), null);
        assert.equal(node.style.getPropertyValue('--editor-height'), '400px');
        let second = mountEditor(node, doc, { highlight: true, readonly: false, tabSize: 2 });
        await paint();
        let view = node.querySelector('.code-editor-view');
        assert.equal(view.dataset.highlight, 'true'); assert.equal(view.dataset.readonly, 'false');
        assert.equal(view.style.getPropertyValue('--editor-tab-size'), '2');
        assert.notEqual(second.textarea, first.textarea);
        second.find('source'); await settle();
        node.append(oldCase); oldCase.click(); await settle();
        assert.equal(button(view, 'Case').getAttribute('aria-pressed'), 'false', 'old template handlers were released');
        oldCase.remove(); first.dispose();
        second.setValue('still mounted'); await paint();
        assert.equal(second.textarea.value, 'still mounted');
        second.dispose(); node.remove(); await paint();
        assert.equal(observers.size, 0);
    });
    await t.test('wrapped geometry, fold projection, whitespace, bracket/occurrence marks and minimap stay composable',async()=>{
        let node=host(),doc=new EditorDocument('{\r\n  const foo = 1;\r\n  foo();\r\n}\r\n'+'x'.repeat(170)),api=mountEditor(node,doc,{language:'typescript',wrap:true,whitespace:true,minimap:true,fold:true}),field=api.textarea;
        await paint();assert.equal(field.wrap,'soft');assert.ok(canvasDraws.length>0);assert.equal(node.querySelector('.code-editor-minimap').hidden,false);
        assert.ok(node.querySelector('.code-editor-whitespace-space'));api.select({start:0});await paint();assert.ok(node.querySelector('.code-editor-bracket-match'));
        api.select({start:doc.value.indexOf('foo'),end:doc.value.indexOf('foo')+3});await paint();assert.ok(node.querySelectorAll('.code-editor-occurrence').length>=2);
        let last=doc.value.length-1,rect=api.rectAt(last);assert.ok(rect.top>100);assert.equal(api.offsetAt(rect.left,rect.top+10),last);
        assert.equal(api.fold(1),true);await paint();assert.equal(field.value,'{…}\n'+'x'.repeat(170));assert.equal(api.rectAt(doc.value.indexOf('foo')),null);
        let closure=api.rectAt(doc.value.indexOf('}'));assert.equal(api.offsetAt(closure.left,closure.top+10),doc.value.indexOf('}'));
        api.unfold(1);api.refresh();await paint();assert.equal(field.value,doc.value.replace(/\r\n/g,'\n'));
        let source=doc.value,map=node.querySelector('.code-editor-minimap');
        map.dispatchEvent(new win.MouseEvent('pointerdown',{clientY:190,bubbles:true,cancelable:true}));map.dispatchEvent(new win.MouseEvent('pointermove',{clientY:195,bubbles:true}));map.dispatchEvent(new win.MouseEvent('pointerup',{bubbles:true}));await paint();assert.equal(doc.value,source);
        api.setValue('');await paint();assert.equal(field.value,'');api.dispose();assert.equal(api.rectAt(0),null);assert.equal(api.offsetAt(0,0),null);node.remove();await paint();assert.equal(observers.size,0);
    });
    await t.test('persistent two-fold native editing, history, clipboard, wrapped placeholder click and seam deletion',async()=>{
        let node=host(),source='before\r\n{\r\n one\r\n}\r\nbetween\r\n{\r\n two\r\n}\r\nafter',doc=new EditorDocument(source),api=mountEditor(node,doc,{language:'typescript',wrap:true}),field=api.textarea;
        api.fold(2);api.fold(6);await paint();assert.equal(field.value,'before\n{…}\nbetween\n{…}\nafter');assert.deepEqual([...node.querySelectorAll('.code-editor-number > span')].map(n=>n.textContent),['1','2','5','6','9']);
        for(let word of ['before','between','after']) {
            let at=doc.value.indexOf(word);api.select({start:at});nativeInput(api,'insertText','x');assert.equal((field.value.match(/…/g)||[]).length,2);api.undo();assert.equal(doc.value,source);assert.equal((field.value.match(/…/g)||[]).length,2);api.redo();api.undo();
        }
        api.select({start:doc.value.length});api.newline();nativeInput(api,'insertText','x');api.undo();api.undo();assert.equal(doc.value,source);assert.equal((field.value.match(/…/g)||[]).length,2);
        let data=new Map(),clipboard={getData:type=>data.get(type)??'',setData:(type,value)=>data.set(type,value)};
        api.select({start:0,end:doc.value.length});let copy=new win.Event('copy',{bubbles:true,cancelable:true});Object.defineProperty(copy,'clipboardData',{value:clipboard});field.dispatchEvent(copy);assert.equal(data.get('text/plain'),source);assert.equal((field.value.match(/…/g)||[]).length,2);
        let seam=doc.value.indexOf('{')+1;api.select({start:seam});data.set('text/plain','P\r\n');let paste=new win.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:clipboard});field.dispatchEvent(paste);assert.equal(doc.value,source.slice(0,seam)+'P\r\n'+source.slice(seam));assert.equal((field.value.match(/…/g)||[]).length,2);api.undo();assert.equal(doc.value,source);
        api.select({start:doc.value.indexOf('}')});let deletion=new win.InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true});field.dispatchEvent(deletion);assert.equal(deletion.defaultPrevented,true);assert.equal(doc.value,source);assert.equal((field.value.match(/…/g)||[]).length,1);assert.equal(api.rectAt(doc.value.indexOf('two')),null);
        api.fold(2);await paint();assert.equal((field.value.match(/…/g)||[]).length,2);
        let start=api.rectAt(seam);assert.ok(start);assert.equal(api.offsetAt(start.left,start.top+10),seam);assert.ok(node.querySelector('.code-editor-fold-placeholder'));
        field.dispatchEvent(new win.MouseEvent('pointerdown',{clientX:start.left+2,clientY:start.top+10,bubbles:true,cancelable:true}));await paint();assert.equal((field.value.match(/…/g)||[]).length,1);assert.equal(doc.value,source);assert.equal(api.rectAt(doc.value.indexOf('two')),null);
        api.setOptions({readonly:true});api.select({start:doc.value.length});assert.equal(api.insert('x'),false);assert.equal(doc.value,source);
        api.setOptions({readonly:false});field.dispatchEvent(new win.CompositionEvent('compositionstart',{bubbles:true}));field.value+='漢';field.setSelectionRange(field.value.length,field.value.length);field.dispatchEvent(new win.CompositionEvent('compositionend',{bubbles:true}));field.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:'insertFromComposition'}));assert.equal(doc.value,source+'漢');assert.equal((field.value.match(/…/g)||[]).length,1);api.undo();assert.equal(doc.value,source);assert.equal((field.value.match(/…/g)||[]).length,1);
        api.setValue('x'.repeat(100)+'{\r\n secret\r\n}\r\nend');api.select({start:0});api.fold(1);await paint();
        let wrapped=api.rectAt(101);assert.ok(wrapped.top>=20);assert.equal(api.offsetAt(wrapped.left,wrapped.top+10),101);
        field.dispatchEvent(new win.MouseEvent('pointerdown',{clientX:wrapped.left+2,clientY:wrapped.top+10,bubbles:true,cancelable:true}));await paint();assert.ok(!field.value.includes('…'));assert.ok(field.value.includes('secret'));
        api.fold(1);api.select({start:101});let forward=new win.InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}),saved=doc.value;field.dispatchEvent(forward);assert.equal(forward.defaultPrevented,true);assert.equal(doc.value,saved);assert.ok(!field.value.includes('…'));
        api.fold(1);api.select({start:101,end:doc.value.indexOf('}')});field.dispatchEvent(new win.CompositionEvent('compositionstart',{bubbles:true}));let a=field.selectionStart,b=field.selectionEnd;field.value=field.value.slice(0,a)+'漢'+field.value.slice(b);field.setSelectionRange(a+1,a+1);field.dispatchEvent(new win.CompositionEvent('compositionend',{bubbles:true}));field.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:'insertFromComposition'}));assert.equal(doc.value,'x'.repeat(100)+'{漢}\r\nend');api.undo();assert.equal(doc.value,saved);
        api.dispose();node.remove();await paint();
    });
    await t.test('multi native input, distributed paste/copy/cut, commands and IME share atomic history',async()=>{
        let node=host(),doc=new EditorDocument('foo\r\nfoo'),api=mountEditor(node,doc),field=api.textarea;
        api.selectMany([{start:0,end:3},{start:5,end:8}]);assert.equal(nativeInput(api,'insertText','x').defaultPrevented,true);assert.equal(doc.value,'x\r\nx');assert.equal(doc.selections.length,2);api.undo();assert.equal(doc.value,'foo\r\nfoo');
        let data=new Map(),clipboard={getData:type=>data.get(type)??'',setData:(type,value)=>data.set(type,value)},copy=new win.Event('copy',{bubbles:true,cancelable:true});Object.defineProperty(copy,'clipboardData',{value:clipboard});field.dispatchEvent(copy);assert.equal(data.get('text/plain'),'foo\r\nfoo');
        data.set('text/plain','one\r\ntwo');let paste=new win.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:clipboard});field.dispatchEvent(paste);assert.equal(doc.value,'one\r\ntwo');api.undo();
        field.dispatchEvent(new win.CompositionEvent('compositionstart',{bubbles:true}));field.value='漢\nfoo';field.setSelectionRange(1,1);field.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:'insertCompositionText',isComposing:true}));field.dispatchEvent(new win.CompositionEvent('compositionend',{bubbles:true}));field.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:'insertFromComposition'}));
        assert.equal(doc.value,'漢\r\n漢');assert.equal(doc.selections.length,2);api.undo();assert.equal(doc.value,'foo\r\nfoo');assert.equal(doc.selections.length,2);
        doc.reset('foo\r\nbar');api.selectMany([{start:0,end:3},{start:5,end:8}]);
        field.dispatchEvent(new win.CompositionEvent('compositionstart',{bubbles:true}));field.setSelectionRange(3,3);field.dispatchEvent(new win.CompositionEvent('compositionend',{bubbles:true}));field.dispatchEvent(new win.InputEvent('input',{bubbles:true,inputType:'insertFromComposition'}));assert.equal(doc.value,'foo\r\nfoo','an unchanged primary IME replacement is still mirrored to other selections');api.undo();assert.equal(doc.value,'foo\r\nbar');
        api.selectMany([{start:0},{start:5}]);field.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.deepEqual(doc.selections.map(range=>range.start),[1,6]);
        field.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(doc.selections.length,1);
        api.dispose();node.remove();await paint();assert.equal(observers.size,0);
    });
    await t.test('selection commands, rectangle pointer geometry, readonly and completion hook disposal',async()=>{
        let node=host(),doc=new EditorDocument('abc\ndef\nghi'),requests=0,api=mountEditor(node,doc,{onAutocomplete:()=>requests++}),field=api.textarea;
        field.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(requests,1);
        field.dispatchEvent(new win.MouseEvent('pointerdown',{clientX:19,clientY:22,altKey:true,shiftKey:true,bubbles:true,cancelable:true}));
        field.dispatchEvent(new win.MouseEvent('pointermove',{clientX:26,clientY:62,altKey:true,shiftKey:true,bubbles:true,cancelable:true}));field.dispatchEvent(new win.MouseEvent('pointerup',{bubbles:true}));
        assert.deepEqual(doc.selections.map(range=>[range.start,range.end]),[[1,2],[5,6],[9,10]]);api.insert('X');assert.equal(doc.value,'aXc\ndXf\ngXi');api.undo();
        doc.reset('abcdef\nx\nabcdef\nabcdef');api.selectMany([{start:5},{start:21}]);
        field.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(doc.selection.start,8);
        field.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(doc.selection.start,14,'vertical motion retains its goal column across a short line');
        api.setOptions({readonly:true});let before=doc.value;assert.equal(api.lineCommand('delete'),false);assert.equal(api.insert('blocked'),false);assert.equal(doc.value,before);
        api.dispose();field.dispatchEvent(new win.KeyboardEvent('keydown',{key:' ',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(requests,1);node.remove();await paint();assert.equal(observers.size,0);
    });

});
