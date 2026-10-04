import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const url = process.env.CODE_EDITOR_TEST_URL, module = process.env.CODE_EDITOR_PLAYWRIGHT_PATH;

test('real browser complete workspace', { skip: !url || !module ? 'Set browser test environment variables' : false }, async t => {
    const { chromium } = require(module);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CODE_EDITOR_BROWSER_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/components/code-editor', url).href);
    for (const preview of await page.locator('.preview-example').all()) {
        await preview.scrollIntoViewIfNeeded(); await page.waitForTimeout(80);
    }
    const demo = page.getByRole('region', { name: 'Complete workspace example', exact: true });
    const workspace = demo.getByRole('region', { name: 'Editor workspace', exact: true });
    const field = name => workspace.getByRole('textbox', { name, exact: true });
    const open = async path => {
        await workspace.getByRole('button', { name: 'Go to file (Ctrl/Cmd+P)', exact: true }).click();
        const input = workspace.getByRole('combobox', { name: 'Go to file', exact: true });
        await input.fill(path); await input.press('Enter');
        if (/\.(md|markdown)$/.test(path)) await workspace.locator('.markdown-editor').waitFor();
        else await field(path).waitFor();
    };
    await demo.scrollIntoViewIfNeeded();
    await field('src/greeting.ts').waitFor();

    await t.test('tabs, fuzzy quick-open, drafts, save, watcher refresh and line navigation', async () => {
        const source = field('src/greeting.ts');
        await source.fill('const draft = 17;\n');
        assert.equal(await workspace.getByRole('img', { name: 'Unsaved changes' }).count(), 1);
        await open('package.json');
        await workspace.getByRole('tab').filter({ hasText: 'greeting.ts' }).click();
        assert.equal(await source.inputValue(), 'const draft = 17;\n');
        await demo.getByRole('button', { name: 'Simulate external update', exact: true }).click();
        await page.waitForTimeout(150);
        assert.equal(await source.inputValue(), 'const draft = 17;\n', 'dirty draft survives watcher');
        await workspace.getByRole('button', { name: 'Save file (Ctrl/Cmd+S)', exact: true }).click();
        await workspace.getByRole('img', { name: 'Unsaved changes' }).waitFor({ state: 'detached' });
        await demo.getByRole('button', { name: 'Simulate external update', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('textarea[aria-label="src/greeting.ts"]')?.value.includes('External update 2'));
        await demo.getByRole('button', { name: 'Open greeting at line 8', exact: true }).click();
        await page.waitForTimeout(50);
        assert.equal(await source.evaluate(node => node.value.slice(0, node.selectionStart).split('\n').length), 8);
        assert.match(await workspace.getByRole('navigation', { name: 'File breadcrumb' }).innerText(), /demo.*src.*greeting.ts/s);
    });

    await t.test('explorer moves, hides, peeks and searches; new files arrive through watcher', async () => {
        await workspace.getByRole('button', { name: 'Move file explorer to left', exact: true }).click();
        assert.equal(await workspace.getAttribute('data-explorer-side'), 'left');
        await workspace.getByRole('button', { name: 'Hide file explorer', exact: true }).click();
        assert.equal(await workspace.getAttribute('data-explorer-open'), 'false');
        await workspace.getByRole('button', { name: 'Peek file explorer', exact: true }).hover();
        await page.waitForTimeout(300);
        assert.equal(await workspace.locator('.code-workspace-explorer').getAttribute('data-peek'), 'true');
        await workspace.getByRole('button', { name: 'Save file (Ctrl/Cmd+S)', exact: true }).hover();
        await page.waitForTimeout(300);
        assert.equal(await workspace.locator('.code-workspace-explorer').getAttribute('data-peek'), 'false');
        await workspace.getByRole('button', { name: 'Show file explorer', exact: true }).click();
        await demo.getByRole('button', { name: 'Simulate new file', exact: true }).click();
        const search = workspace.getByRole('searchbox', { name: 'Search files', exact: true });
        await search.fill('new-file');
        await workspace.getByRole('treeitem', { name: 'new-file.txt', exact: true }).waitFor();
        await search.fill('');
        await workspace.getByRole('button', { name: 'Move file explorer to right', exact: true }).click();
    });

    await t.test('multiple occurrence edits undo atomically', async () => {
        await open('notes/whitespace.txt');
        const source = field('notes/whitespace.txt');
        await source.fill('same same same');
        await source.press('Control+Home');
        await source.press('Control+d'); await source.press('Control+d'); await source.press('Control+d');
        await source.press('x');
        assert.equal(await source.inputValue(), 'x x x');
        await source.press('Control+z');
        assert.equal(await source.inputValue(), 'same same same');
    });

    await t.test('file context actions copy, mention, rename, delete and undo through the host', async () => {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        const search = workspace.getByRole('searchbox', { name: 'Search files', exact: true });
        await search.fill('new-file');
        let row = workspace.getByRole('treeitem', { name: 'new-file.txt', exact: true });
        await row.click({ button: 'right' });
        await workspace.getByRole('menuitem', { name: 'Copy Path', exact: true }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'notes/new-file.txt');
        await row.click({ button: 'right' });
        await workspace.getByRole('menuitem', { name: 'Add to Chat', exact: true }).click();
        assert.match(await demo.locator('.code-editor-demo-status').innerText(), /Added to chat: notes\/new-file.txt/);
        await row.click({ button: 'right' });
        await workspace.getByRole('menuitem', { name: 'Rename', exact: true }).click();
        const rename = workspace.getByRole('textbox', { name: 'Rename new-file.txt', exact: true });
        await rename.fill('renamed-file.txt'); await rename.press('Enter');
        await search.fill('renamed-file');
        row = workspace.getByRole('treeitem', { name: 'renamed-file.txt', exact: true });
        await row.waitFor();
        await row.click({ button: 'right' });
        await workspace.getByRole('menuitem', { name: 'Delete', exact: true }).click();
        await row.waitFor({ state: 'detached' });
        await workspace.getByRole('button', { name: 'Undo file operation', exact: true }).click();
        await row.waitFor();
        await search.fill('');
    });

    await t.test('Markdown tabs retain edited source and history across code document switches', async () => {
        await open('README.md');
        await workspace.locator('.markdown-block.markdown-h1').click();
        const markdown = field('README.md');
        await markdown.fill('# Workspace draft\n');
        await open('package.json');
        await workspace.getByRole('tab').filter({ hasText: 'README.md' }).click();
        assert.match(await workspace.locator('.markdown-block.markdown-h1').innerText(), /Workspace draft/);
        await workspace.locator('.markdown-block.markdown-h1').click();
        await markdown.press('Control+z');
        await workspace.getByRole('button', { name: 'Save file (Ctrl/Cmd+S)', exact: true }).click();
        assert.match(await workspace.locator('.markdown-block.markdown-h1').innerText(), /Editor workspace/);
    });

    await t.test('Markdown shares search, replacement, occurrence editing, layout controls and navigation', async () => {
        await open('README.md');
        const source = field('README.md');
        const heading = workspace.locator('.markdown-block.markdown-h1');
        if (await heading.count()) await heading.click(); else await source.focus();
        await source.press('Control+a'); await source.press('Control+c');
        const original = await page.evaluate(() => navigator.clipboard.readText());
        await source.press('Control+h');
        const find = workspace.getByRole('textbox', { name: 'Find text', exact: true });
        await find.fill('Editor workspace');
        await workspace.getByRole('textbox', { name: 'Replacement text', exact: true }).fill('Review draft');
        await workspace.getByRole('button', { name: 'Replace all', exact: true }).click();
        await workspace.locator('.markdown-find').getByRole('button', { name: 'Close', exact: true }).click();
        await source.press('Control+a'); await source.press('Control+c');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), original.replaceAll('Editor workspace', 'Review draft'));
        await source.press('Control+z');
        await source.press('Control+f'); await find.fill('Editor workspace');
        await workspace.locator('.markdown-find').getByRole('button', { name: 'Next', exact: true }).click();
        await workspace.locator('.markdown-find').getByRole('button', { name: 'Close', exact: true }).click();
        await source.press('Control+Shift+l'); await source.press('x');
        await source.press('Control+a'); await source.press('Control+c');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), original.replaceAll('Editor workspace', 'x'));
        await source.press('Control+z');
        await source.press('Control+Alt+g');
        const go = workspace.getByRole('textbox', { name: 'Go to line and optional column', exact: true });
        await go.fill('8:1'); await workspace.locator('.markdown-go').getByRole('button', { name: 'Go', exact: true }).click();
        assert.match(await source.inputValue(), /Click a block/);
        await workspace.getByRole('button', { name: 'Wrap long lines', exact: true }).click();
        assert.equal(await workspace.locator('.markdown-surface').getAttribute('data-wrap'), 'true');
        await workspace.getByRole('button', { name: 'Show whitespace', exact: true }).click();
        await workspace.locator('.markdown-whitespace').first().waitFor();
        await workspace.getByRole('button', { name: 'Hide whitespace', exact: true }).click();
        const map = workspace.getByRole('slider', { name: 'Document minimap', exact: true });
        assert.ok(await map.locator('.markdown-minimap-line').evaluateAll(nodes => new Set(nodes.map(node => getComputedStyle(node).backgroundColor)).size) > 1, 'Markdown minimap uses syntax colors');
        await map.press('End');
        assert.ok(await workspace.locator('.markdown-surface').evaluate(node => node.scrollTop) > 0);
        await map.press('Home');
        await workspace.getByRole('button', { name: 'Disable wrap', exact: true }).click();
        await workspace.locator('.markdown-fold-toggle').first().click();
        await workspace.locator('.markdown-fold-chip').first().waitFor();
        await workspace.locator('.markdown-fold-chip').first().click();
        await workspace.getByRole('button', { name: 'Save file (Ctrl/Cmd+S)', exact: true }).click();
    });

    await t.test('folding preserves source and wrapping keeps long rows within the text surface', async () => {
        await open('src/greeting.ts');
        const source = field('src/greeting.ts');
        const before = await source.inputValue();
        await workspace.locator('.code-editor-fold-button[aria-label="Fold line 7"]').click();
        assert.ok((await source.inputValue()).length < before.length);
        assert.ok(!(await source.inputValue()).includes('return "Welcome"'), 'function body, rather than parameter list, is folded');
        await source.press('Control+a'); await source.press('Control+c');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), before, 'copy includes exact hidden source');
        await source.press('Control+End');
        await source.press('Enter'); await source.press('x');
        assert.equal(await workspace.locator('.code-editor-fold-button[aria-label="Unfold line 7"]').count(), 1, 'editing elsewhere retains the fold');
        await source.press('Control+z'); await source.press('Control+z');
        assert.equal(await workspace.locator('.code-editor-fold-button[aria-label="Unfold line 7"]').count(), 1, 'undo outside the fold retains it');
        // The function header is wider than this embedded editor. Reveal the end
        // of its visible folded row before testing the pointer hit target.
        await source.press('Control+Home');
        for (let line = 1; line < 7; line++) await source.press('ArrowDown');
        await source.press('End');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const placeholder = await workspace.locator('.code-editor-fold-placeholder').first().boundingBox();
        assert.ok(placeholder && placeholder.width > 0);
        await page.mouse.click(placeholder.x + placeholder.width / 2, placeholder.y + placeholder.height / 2);
        assert.equal(await source.inputValue(), before);
        await open('notes/long-lines.txt');
        await workspace.getByRole('button', { name: 'Wrap long lines', exact: true }).click();
        const long = field('notes/long-lines.txt');
        await long.press('Control+End');
        await page.waitForTimeout(100);
        const geometry = await long.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, top: node.scrollTop }));
        assert.ok(geometry.scrollWidth <= geometry.width + 1, JSON.stringify(geometry));
        assert.ok(geometry.top > 0);
        const minimap = workspace.locator('.code-editor-minimap');
        await minimap.click({ position: { x: 10, y: 10 } });
        assert.ok(await long.evaluate(node => node.scrollTop) < geometry.top, 'minimap navigates wrapped document');
        assert.ok(await workspace.locator('.code-editor-line').count() < 80, 'wrapped rows remain bounded');
        await workspace.getByRole('button', { name: 'Disable wrap', exact: true }).click();
    });

    await t.test('rectangular selection edits each row; whitespace and bracket marks render', async () => {
        await open('notes/whitespace.txt');
        const source = field('notes/whitespace.txt');
        await source.fill('abc\nabc\nabc');
        await source.press('Control+Home');
        const metrics = await source.evaluate(node => {
            const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
            const context = document.createElement('canvas').getContext('2d'); context.font = css.font;
            return { x: rect.left + parseFloat(css.paddingLeft), y: rect.top + parseFloat(css.paddingTop), char: context.measureText('a').width, line: parseFloat(css.lineHeight) };
        });
        await page.keyboard.down('Alt'); await page.keyboard.down('Shift');
        await page.mouse.move(metrics.x + metrics.char, metrics.y + metrics.line / 2);
        await page.mouse.down();
        await page.mouse.move(metrics.x + metrics.char * 2, metrics.y + metrics.line * 2.5, { steps: 5 });
        await page.mouse.up(); await page.keyboard.up('Shift'); await page.keyboard.up('Alt');
        await source.press('x');
        assert.equal(await source.inputValue(), 'axc\naxc\naxc');
        await source.press('Control+z');
        assert.equal(await source.inputValue(), 'abc\nabc\nabc');
        await source.fill('const pair = (1);\n\tspace  ');
        await workspace.getByRole('button', { name: 'Show whitespace', exact: true }).click();
        assert.ok(await workspace.locator('.code-editor-whitespace-space').count());
        assert.ok(await workspace.locator('.code-editor-whitespace-tab').count());
        await workspace.getByRole('button', { name: 'Hide whitespace', exact: true }).click();
    });
    assert.deepEqual(errors, []);
});
