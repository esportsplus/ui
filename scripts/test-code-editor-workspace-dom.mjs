import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
let JSDOM;
for (const location of [process.env.CODE_EDITOR_WORKSPACE_JSDOM_PATH, process.env.CODE_EDITOR_JSDOM_PATH, 'jsdom'].filter(Boolean)) {
    try { ({ JSDOM } = require(location)); break; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
}

test('compiled workspace UI: tabs, shortcuts, menus, search, drawer, confirmation, watcher and addon lifecycle', {
    skip: !JSDOM && 'Point CODE_EDITOR_WORKSPACE_JSDOM_PATH at an existing jsdom; no package installation is required'
}, async (t) => {
    const browser = new JSDOM('<!doctype html><style>.file-tree-viewport{overflow-y:auto;height:400px}.code-editor-input{font:13px monospace;line-height:20px;padding:12px}</style><body></body>', { pretendToBeVisual: true }), win = browser.window,
        originals = new Map(), frames = new Map(), observers = new Set();
    let nextFrame = 0, workspaceCleanup;
    const raf = (fn) => { const id = ++nextFrame; frames.set(id, fn); return id; }, cancel = (id) => frames.delete(id);
    win.ResizeObserver = class { constructor(fn) { this.fn = fn; this.targets = new Set(); } observe(target) { this.targets.add(target); observers.add(this); } unobserve(target) { this.targets.delete(target); if (!this.targets.size) observers.delete(this); } disconnect() { this.targets.clear(); observers.delete(this); } };
    win.scrollTo = () => {};
    win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    win.requestAnimationFrame = raf; win.cancelAnimationFrame = cancel;
    win.HTMLElement.prototype.scrollIntoView = function () {};
    win.HTMLElement.prototype.getAnimations = () => [];
    win.HTMLElement.prototype.getBoundingClientRect = function () {
        return new win.DOMRect(0, 0, this.classList.contains('code-workspace') ? 900 : 600, this.classList.contains('file-tree-row') ? 22 : 400);
    };
    Object.defineProperties(win.HTMLElement.prototype, {
        clientWidth: { configurable: true, get: () => 600 }, clientHeight: { configurable: true, get: () => 400 },
        offsetWidth: { configurable: true, get: () => 600 }, offsetHeight: { configurable: true, get() { return this.classList.contains('file-tree-row') ? 22 : 400; } }
    });
    win.HTMLCanvasElement.prototype.getContext = () => new Proxy({ measureText: (text) => ({ width: text.length * 7 }) }, { get: (value, key) => value[key] ?? (() => {}) });
    for (const [key, value] of Object.entries({ window: win, document: win.document, navigator: win.navigator,
        Node: win.Node, NodeList: win.NodeList, NodeFilter: win.NodeFilter, Element: win.Element,
        HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
        HTMLButtonElement: win.HTMLButtonElement, DOMRect: win.DOMRect, ResizeObserver: win.ResizeObserver, MutationObserver: win.MutationObserver,
        requestAnimationFrame: raf, cancelAnimationFrame: cancel, getComputedStyle: win.getComputedStyle.bind(win) })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    t.after(() => { workspaceCleanup?.(); browser.window.close(); for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
    const output = await build({
        configFile: false, root, logLevel: 'silent', plugins: [template({ root })], resolve: { alias: { '~': resolve(root, 'src') } },
        build: { write: false, minify: false, lib: { entry: resolve(root, 'src/components/code-editor/workspace.ts'), formats: ['es'] },
            rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') } }
    });
    let code = (Array.isArray(output) ? output : [output]).flatMap((bundle) => bundle.output)
        .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n')
        .replace(/^import\s*['"][^'"]+\.scss['"];?\s*$/gm, '')
        .replace(/import\s+([\w$]+)\s+from\s*(['"])@esportsplus\/ui\/svg\/([^'"]+)\2;?/g, (_all, name, _quote, path) => `const ${name} = ${JSON.stringify('test-' + path.replace(/\.svg$/, ''))};`)
        .replace(/from\s*(['"])(@esportsplus\/[^'"]+)\1/g, (_all, _quote, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
    code += '\n//# sourceURL=workspace-dom.compiled.js';
    const { default: workspace, EditorWorkspaceModel, createMemoryWorkspaceHost } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
    const { render } = await import('@esportsplus/template'), { flush } = await import('@esportsplus/reactivity');
    async function settle() {
        for (let turn = 0; turn < 8; turn++) { flush(); await Promise.resolve(); }
        let turn = 0;
        while (frames.size && turn++ < 12) {
            const pending = [...frames.values()]; frames.clear(); for (const frame of pending) frame(turn * 16);
            flush(); await Promise.resolve();
        }
        flush();
    }
    function key(target, name, command = false) { const event = new win.KeyboardEvent('keydown', { key: name, ctrlKey: command, bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; }
    function button(host, name) { return [...host.querySelectorAll('button')].find((element) => element.getAttribute('aria-label') === name || element.textContent.trim() === name); }
    const host = createMemoryWorkspaceHost({ 'src/a.ts': 'const a = 1;\nline two', 'docs/readme.md': '# Hello', 'b.json': '{}' }),
        model = new EditorWorkspaceModel(host, '/project'), mount = win.document.createElement('div');
    win.document.body.append(mount);
    let api, addonMounts = 0, addonStops = 0;
    const unrender = render(mount, workspace({ model, controller: (value) => { api = value; }, addons: () => { addonMounts++; return () => { addonStops++; }; } }));
    workspaceCleanup = () => { unrender(); model.dispose(); mount.remove(); };
    await model.start(); await settle();
    const shell = mount.querySelector('.code-workspace');
    assert.equal(host.watchCount(), 1); assert.equal(shell.dataset.hasTabs, 'false');

    await t.test('tabs, dirty indicators, breadcrumb and textarea retention through edits and watcher updates', async () => {
        await api.open('src/a.ts', 2); await settle();
        const textarea = api.editor.textarea;
        assert.equal(model.state.active.document.position().line, 2);
        assert.match(mount.querySelector('.code-workspace-breadcrumb').textContent, /project.*src.*a.ts/);
        model.state.active.document.setValue('new draft'); await settle();
        assert.equal(api.editor.textarea, textarea); assert.ok(mount.querySelector('.code-workspace-dirty'));
        await api.open('b.json'); await settle(); await api.open('src/a.ts'); await settle();
        assert.equal(api.editor.document.value, 'new draft'); assert.equal(api.editor.document.undo(), true); await settle();
        host.change('src/a.ts', 'remote update'); await model.whenIdle(); await settle();
        assert.equal(api.editor.document.value, 'remote update');
        assert.equal(mount.querySelectorAll('[role=tab]').length, 2);
    });

    await t.test('preferences update the live editor and persist; peek waits for its transition and stays open off-edge', async () => {
        button(mount, 'Wrap long lines').click(); button(mount, 'Show whitespace').click(); await model.whenIdle(); await settle();
        assert.equal(model.state.preferences.wrapText, true); assert.equal(model.state.preferences.showWhitespace, true);
        assert.equal(button(mount, 'Disable wrap').getAttribute('aria-pressed'), 'true');
        assert.equal(mount.querySelector('.code-editor-view').dataset.wrap, 'true', 'the preference reaches the live core editor');
        button(mount, 'Move file explorer to left').click(); button(mount, 'Hide file explorer').click(); await settle();
        assert.equal(shell.dataset.explorerSide, 'left'); assert.equal(shell.dataset.explorerOpen, 'false');
        const explorer = mount.querySelector('.code-workspace-explorer');
        explorer.dispatchEvent(new win.MouseEvent('mouseenter')); await settle();
        assert.equal(explorer.dataset.peek, 'true'); assert.equal(explorer.dataset.peekReady, 'false');
        const transition = new win.Event('transitionend', { bubbles: true }); Object.defineProperty(transition, 'propertyName', { value: 'transform' }); explorer.dispatchEvent(transition); await settle();
        assert.equal(explorer.dataset.peekReady, 'true'); explorer.dispatchEvent(new win.MouseEvent('mouseleave')); await settle(); assert.equal(explorer.dataset.peek, 'true');
        mount.querySelector('.code-workspace-main').dispatchEvent(new win.MouseEvent('mouseenter')); await settle(); assert.equal(explorer.dataset.peek, 'false');
        api.toggleExplorer(); await settle();
    });

    await t.test('single-click and keyboard tree selection open files like the reference explorer', async () => {
        const row = [...mount.querySelectorAll('[role=treeitem]')].find((item) => item.textContent.includes('b.json'));
        row.click(); await model.whenIdle(); await settle(); assert.equal(model.state.active.path, 'b.json');
        const viewport = mount.querySelector('.file-tree-viewport');
        key(viewport, 'Home'); await settle(); key(viewport, 'ArrowRight'); await settle(); key(viewport, 'ArrowDown');
        await settle(); await model.whenIdle(); await settle(); assert.equal(model.state.active.path, 'docs/readme.md');
    });

    await t.test('workspace shortcuts are focus-scoped; quick-open supports keyboard, mouse and Escape', async () => {
        const outside = win.document.createElement('input'); win.document.body.append(outside); outside.focus();
        assert.equal(key(outside, 'p', true).defaultPrevented, false); assert.ok(!mount.querySelector('.code-workspace-quick'));
        api.editor.focus(); assert.equal(key(api.editor.textarea, 'p', true).defaultPrevented, true); await settle();
        let input = mount.querySelector('.code-workspace-quick-input'); assert.equal(win.document.activeElement, input);
        input.value = 'rdm'; input.dispatchEvent(new win.Event('input', { bubbles: true })); await settle();
        assert.equal(mount.querySelectorAll('[role=option]').length, 1); key(input, 'ArrowUp'); key(input, 'Enter'); await model.whenIdle(); await settle();
        assert.equal(model.state.active.path, 'docs/readme.md');
        api.quickOpen('b.json'); await settle(); mount.querySelector('[role=option]').click(); await settle(); assert.equal(model.state.active.path, 'b.json');
        api.quickOpen('no results'); await settle(); assert.match(mount.querySelector('.code-workspace-quick').textContent, /No matching/);
        key(mount.querySelector('.code-workspace-quick-input'), 'Escape'); await settle(); assert.ok(!mount.querySelector('.code-workspace-quick'));
        outside.remove();
    });

    await t.test('dirty close uses the live confirmation dialog, scoped Ctrl+S saves, and addon cleanup follows tab mounts', async () => {
        model.state.active.document.setValue('dirty json'); await settle(); key(api.editor.textarea, 'w', true); await settle();
        assert.ok(mount.querySelector('.code-workspace-confirm')); button(mount, 'Cancel').click(); await settle(); assert.equal(model.state.active.path, 'b.json');
        key(api.editor.textarea, 's', true); await model.whenIdle(); await settle(); assert.equal(await host.read('/project', 'b.json'), 'dirty json');
        key(api.editor.textarea, 'w', true); await settle(); assert.ok(!model.state.tabs.some((tab) => tab.path === 'b.json'));
        assert.ok(addonMounts >= 3); assert.equal(addonMounts - addonStops, 1);
    });

    await t.test('search, collapse-all and context-menu actions use the real tree and injected host', async () => {
        api.search('readme'); await settle();
        assert.ok(!mount.querySelector('.file-tree-find'), 'external search does not create a second find bar');
        api.search(''); api.collapseAll(); await settle();
        assert.equal([...mount.querySelectorAll('[role=treeitem][aria-expanded]')].some((item) => item.getAttribute('aria-expanded') === 'true'), false);
        await api.open('src/a.ts'); await settle();
        const row = [...mount.querySelectorAll('[role=treeitem]')].find((item) => item.textContent.includes('a.ts'));
        assert.ok(row, 'active path is revealed in tree');
        row.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 850, clientY: 350 })); await settle();
        assert.ok(mount.querySelector('[role=menu]')); button(mount, 'Add to Chat').click(); await settle(); assert.deepEqual(host.mentions, ['src/a.ts']);
        row.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle(); button(mount, 'Copy Path').click(); await settle(); assert.deepEqual(host.copiedPaths, ['/project/src/a.ts']);
        row.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle(); button(mount, 'Rename').click(); await settle();
        const rename = mount.querySelector('.file-tree-input'), textarea = api.editor.textarea, mountsBeforeRename = addonMounts;
        assert.ok(rename); rename.value = 'renamed.ts'; rename.dispatchEvent(new win.Event('input', { bubbles: true })); key(rename, 'Enter');
        await settle(); await model.whenIdle(); await settle(); assert.equal(model.state.active.path, 'src/renamed.ts'); assert.equal(api.editor.textarea, textarea);
        assert.equal(addonMounts, mountsBeforeRename + 1, 'addons reopen on rename with the new file identity');
        assert.equal(addonMounts - addonStops, 1);
        const tree = mount.querySelector('[role=tree]'); tree.focus(); assert.equal(key(tree, 'z', true).defaultPrevented, true);
        await model.whenIdle(); await settle(); assert.equal(model.state.active.path, 'src/a.ts', 'tree-local shortcut undoes a file rename');
        const restored = [...mount.querySelectorAll('[role=treeitem]')].find((item) => item.textContent.includes('a.ts'));
        restored.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle(); button(mount, 'Delete').click();
        await settle(); await model.whenIdle(); await settle(); assert.ok(!model.state.entries.some((entry) => entry.path === 'src/a.ts'));
        button(mount, 'Undo file operation').click(); await model.whenIdle(); await settle(); assert.ok(model.state.entries.some((entry) => entry.path === 'src/a.ts'));
    });

    await t.test('filtered context actions preserve row names and resize observes the component width', async () => {
        host.change('notes/new-file.txt', 'new file'); await model.whenIdle(); await settle();
        api.search('new-file'); await settle();
        const findRow = () => mount.querySelector('[role=treeitem][aria-label="new-file.txt"]');
        assert.ok(findRow());
        findRow().dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle();
        button(mount, 'Copy Path').click(); await model.whenIdle(); await settle();
        assert.equal(mount.querySelector('[aria-label="Search files"]').value, 'new-file');
        assert.ok(findRow(), 'opening a context target keeps its accessible filename');
        assert.match(findRow().getAttribute('aria-description'), /open in editor/);
        findRow().dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle();
        button(mount, 'Add to Chat').click(); await settle(); assert.ok(findRow());
        const observer = [...observers].find(value => value.targets.has(shell));
        observer.fn([{ target: shell, contentRect: { width: 350 } }]); await settle();
        assert.equal(shell.dataset.compact, 'true');
        observer.fn([{ target: shell, contentRect: { width: 900 } }]); await settle();
        assert.equal(shell.dataset.compact, 'false'); api.search(''); await settle();
    });

    await t.test('loading failures, retry and open errors are visible and recoverable', async () => {
        const list = host.list; host.list = async () => { throw new Error('Workspace is offline'); };
        await api.refresh(); await settle(); assert.match(mount.querySelector('.code-workspace-tree-wrap [role=alert]').textContent, /offline/);
        host.list = list; button(mount, 'Retry').click(); await settle(); assert.ok(!mount.querySelector('.code-workspace-tree-wrap [role=alert]'));
        await api.open('not-found.ts'); await settle(); assert.match(mount.querySelector('.code-workspace-statusbar [role=status]').textContent, /Open failed/);
        assert.equal(mount.querySelector('.code-workspace-statusbar [role=status]').dataset.error, 'true');
    });
    unrender(); workspaceCleanup = () => { model.dispose(); mount.remove(); }; await settle(); assert.equal(host.watchCount(), 0); assert.equal(addonMounts, addonStops);
});
