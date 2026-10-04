import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
export async function compiledBrowser(t, entry) {
    let JSDOM;
    for (let location of [process.env.CODE_EDITOR_JSDOM_PATH, 'jsdom'].filter(Boolean)) {
        try { ({ JSDOM } = require(location)); break; } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
    }
    if (!JSDOM) throw new Error('Set CODE_EDITOR_JSDOM_PATH to existing jsdom; this suite never installs packages');
    let browser = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true }), win = browser.window, originals = new Map(), frames = new Map(), frameId = 0;
    const raf = (callback) => { let id = ++frameId; frames.set(id, callback); return id; }, cancel = (id) => frames.delete(id);
    win.requestAnimationFrame = raf; win.cancelAnimationFrame = cancel;
    for (let [key, value] of Object.entries({ window: win, document: win.document, navigator: win.navigator, Node: win.Node, NodeList: win.NodeList, NodeFilter: win.NodeFilter, HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement, requestAnimationFrame: raf, cancelAnimationFrame: cancel, getComputedStyle: win.getComputedStyle.bind(win) })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    t.after(() => {
        win.close(); for (let [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
    });
    let output = await build({ configFile: false, root, logLevel: 'silent', plugins: [template({ root })],
        build: { write: false, minify: false, lib: { entry: resolve(root, entry), formats: ['es'] }, rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') } }
    });
    let code = (Array.isArray(output) ? output : [output]).flatMap((bundle) => bundle.output).filter((item) => item.type === 'chunk').map((item) => item.code).join('\n')
        .replace(/^import\s*['"][^'"]+\.scss['"];?\s*$/gm, '')
        .replace(/from\s*(['"])(@esportsplus\/[^'"]+)\1/g, (_match, _quote, id) => `from ${JSON.stringify(import.meta.resolve(id))}`);
    code += '\n//# sourceURL=compiled-code-editor-subsystem.mjs\n';
    let api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')), { flush } = await import('@esportsplus/reactivity');
    async function settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); flush(); } }
    async function paint() { await settle(); let pending = [...frames.values()]; frames.clear(); for (let callback of pending) callback(0); await settle(); }
    function host() { let node = win.document.createElement('div'); win.document.body.append(node); return node; }
    return { api, win, settle, paint, host, code, frames };
}
