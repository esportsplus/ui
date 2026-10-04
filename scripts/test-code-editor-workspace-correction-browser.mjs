import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';
import { compile, compileString } from 'sass';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const module = process.env.CODE_EDITOR_PLAYWRIGHT_PATH;

// Compile current sources in memory with real tokens; no docs build or listening server is needed.
test('current workspace: theme contrast, embedded narrow layout and filtered context actions in Chrome', {
    skip: !module ? 'Set CODE_EDITOR_PLAYWRIGHT_PATH' : false
}, async t => {
    const fixture = resolve(root, 'scripts/workspace-correction-fixture.ts').replaceAll('\\', '/');
    const result = await build({
        configFile: false, root, logLevel: 'silent',
        plugins: [
            { name: 'workspace-fixture', enforce: 'pre',
                resolveId: id => id.replaceAll('\\', '/') === fixture ? fixture : /\.(scss|svg)$/.test(id) ? '\0workspace-empty' : undefined,
                load: id => id === fixture ? `
                    import workspace, { createMemoryWorkspaceHost } from ${JSON.stringify(resolve(root, 'src/components/code-editor/workspace.ts').replaceAll('\\', '/'))};
                    import { render } from ${JSON.stringify(require.resolve('@esportsplus/template').replaceAll('\\', '/'))};
                    const host = createMemoryWorkspaceHost({ 'src/a.ts': 'const a = 1;', 'notes/new-file.txt': 'new file' });
                    render(document.querySelector('#fixture'), workspace({ host, cwd: '/project', controller: api => globalThis.workspaceApi = api }));
                ` : id === '\0workspace-empty' ? 'export default "test-icon";' : undefined
            }, template({ root })
        ],
        resolve: { alias: { '~': resolve(root, 'src') } },
        build: { write: false, minify: false, lib: { entry: fixture, name: 'WorkspaceFixture', formats: ['iife'] } }
    });
    const code = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output).find(item => item.type === 'chunk').code;
    const css = ['code-editor/scss/index.scss', 'code-editor/scss/_workspace.scss', 'file-tree/scss/index.scss']
        .map(file => compile(resolve(root, 'src/components', file), { importers: [{ findFileUrl: name =>
            ['/shared', '/tokens'].includes(name) ? pathToFileURL(resolve(root, `${name.slice(1)}.scss`)) : null
        }] }).css).join('\n');
    const { chromium } = require(module);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CODE_EDITOR_BROWSER_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const tokens = compileString(`@use 'src/tokens/scss/color' as palette;
        @use 'src/tokens/scss/size' as sizes;
        @use 'src/tokens/scss/font-size' as fonts;
        @use 'src/tokens/scss/border-radius' as radii;
        :root { @each $name, $scale in palette.$color { @each $step, $value in $scale { --color-#{$name}-#{$step}: #{$value}; } }
        @each $step, $value in sizes.$size { --size-#{$step}: #{$value}; }
        @each $step, $value in fonts.$font-size { --font-size-#{$step}: #{$value}; }
        @each $step, $value in radii.$border-radius { --border-radius-#{$step}: #{$value}; }
        --color-primary-400: var(--color-blue-400); }
        body { margin: 0; }`, { loadPaths: [root] }).css;
    await page.route('http://127.0.0.1:4190/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="fixture" style="width:900px;height:580px;margin:20px"></div>' }));
    await page.goto('http://127.0.0.1:4190/fixture');
    await page.addStyleTag({ content: tokens });
    await page.addStyleTag({ content: css }); await page.addScriptTag({ content: code });
    assert.deepEqual(errors, []);
    await page.evaluate(() => workspaceApi.open('src/a.ts'));
    const shell = page.locator('.code-workspace');
    await shell.locator('textarea').waitFor();

    const contrast = async () => page.evaluate(() => {
        const rgb = color => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n / 255);
        };
        const luminance = color => rgb(color).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
            .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
        return ['.code-workspace-explorer', '.code-workspace-statusbar', '.code-workspace-tab[aria-selected="true"]'].map(selector => {
            const css = getComputedStyle(document.querySelector(selector));
            const values = [luminance(css.color), luminance(css.backgroundColor)].sort((a, b) => b - a);
            return (values[0] + .05) / (values[1] + .05);
        });
    });
    const lightContrast = await contrast();
    assert.ok(lightContrast.every(value => value >= 4.5), `light chrome contrast: ${lightContrast}`);

    for (const side of ['right', 'left']) {
        if (await shell.getAttribute('data-explorer-side') !== side) await page.evaluate(() => workspaceApi.toggleExplorerSide());
        await page.locator('#fixture').evaluate(node => { node.style.width = '350px'; });
        await page.waitForFunction(() => document.querySelector('.code-workspace').dataset.compact === 'true');
        const geometry = await shell.evaluate(node => {
            const main = node.querySelector('.code-workspace-main').getBoundingClientRect();
            const explorer = node.querySelector('.code-workspace-explorer').getBoundingClientRect();
            const editor = node.querySelector('textarea').getBoundingClientRect();
            const bounds = node.getBoundingClientRect();
            const buttons = [...node.querySelectorAll('.code-workspace-breadcrumb-bar button, .code-workspace-tree-header button')];
            return { overflow: node.scrollWidth - node.clientWidth, editorWidth: editor.width, editorHeight: editor.height,
                stacked: explorer.top >= main.bottom - 1,
                buttonsFit: buttons.every(button => { const r = button.getBoundingClientRect(); return r.left >= bounds.left && r.right <= bounds.right; }) };
        });
        assert.ok(geometry.overflow <= 1 && geometry.editorWidth >= 180 && geometry.editorHeight >= 100 && geometry.stacked && geometry.buttonsFit, JSON.stringify(geometry));
        await shell.getByRole('button', { name: 'Hide file explorer', exact: true }).click();
        assert.ok(await shell.locator('.code-workspace-main').evaluate(node => node.getBoundingClientRect().width >= 330), 'hidden explorer leaves a usable editor on either side');
        await shell.getByRole('button', { name: 'Peek file explorer', exact: true }).click();
        await shell.getByRole('searchbox', { name: 'Search files', exact: true }).fill('new-file');
        await shell.getByRole('button', { name: 'Show file explorer', exact: true }).click();
        const row = shell.getByRole('treeitem', { name: 'new-file.txt', exact: true });
        await row.click({ button: 'right' }); await shell.getByRole('menuitem', { name: 'Copy Path', exact: true }).click();
        await row.waitFor(); assert.equal(await shell.getByRole('searchbox').inputValue(), 'new-file');
        await row.click({ button: 'right' }); await shell.getByRole('menuitem', { name: 'Add to Chat', exact: true }).click(); await row.waitFor();
        await shell.getByRole('searchbox').fill('');
    }
    await shell.screenshot({ path: resolve(tmpdir(), 'editor-workspace-correction-light-350.png') });
    await shell.locator('textarea').fill('draft');
    await shell.getByRole('button', { name: 'Save file (Ctrl/Cmd+S)', exact: true }).click();
    await shell.getByRole('button', { name: 'Wrap long lines', exact: true }).click();
    await shell.getByRole('button', { name: 'Show whitespace', exact: true }).click();
    await page.evaluate(() => {
        const root = document.documentElement, css = getComputedStyle(root);
        const aliases = { 'white-300': 'black-300', 'white-400': 'black-400', 'grey-300': 'black-400',
            'text-500': 'grey-300', 'text-300': 'grey-500', 'border-300': 'text-300' };
        const values = Object.entries(aliases).map(([target, source]) => [target, css.getPropertyValue(`--color-${source}`)]);
        for (const [target, value] of values) root.style.setProperty(`--color-${target}`, value);
        root.style.colorScheme = 'dark';
    });
    assert.ok((await contrast()).every(value => value >= 4.5), 'dark token overrides retain contrast');
    await shell.screenshot({ path: resolve(tmpdir(), 'editor-workspace-correction-dark-350.png') });
    await page.locator('#fixture').evaluate(node => { node.style.width = '900px'; });
    await page.waitForFunction(() => document.querySelector('.code-workspace').dataset.compact === 'false');
    await page.evaluate(async () => { await workspaceApi.close(); await workspaceApi.close(); });
    assert.equal(await shell.getAttribute('data-has-tabs'), 'false');
    await page.locator('#fixture').evaluate(node => { node.style.width = '350px'; });
    await page.waitForFunction(() => document.querySelector('.code-workspace').dataset.compact === 'true');
    assert.ok(await shell.locator('.code-workspace-explorer').evaluate(node => node.getBoundingClientRect().width >= 349), 'empty workspace gives the explorer full narrow width');
    assert.deepEqual(errors, []);
});
