import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Run against a built docs preview. Reuse existing tooling; no browser package is added to the library.
const require = createRequire(import.meta.url);
const url = process.env.CODE_EDITOR_TEST_URL;
const module = process.env.CODE_EDITOR_PLAYWRIGHT_PATH;

test('real browser editor and file-tree integration', {
    skip: !url || !module ? 'Set CODE_EDITOR_TEST_URL and CODE_EDITOR_PLAYWRIGHT_PATH' : false
}, async t => {
    const { chromium } = require(module);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CODE_EDITOR_BROWSER_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/components/code-editor', url).href);
    const field = page.getByRole('textbox', { name: 'TypeScript example', exact: true });
    await field.waitFor();
    const sample = page.locator('.code-editor-demo').first();
    const value = () => field.inputValue();
    const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await t.test('native typing, brackets, indentation, comments, undo/redo, and focus escape', async () => {
        await field.fill('');
        await field.press('(');
        assert.equal(await value(), '()');
        await field.press('Backspace');
        assert.equal(await value(), '');
        await field.press('{');
        await field.press('Enter');
        assert.equal(await value(), '{\n    \n}');
        await field.press('Control+z');
        assert.equal(await value(), '{}');
        await field.press('Control+Shift+z');
        assert.equal(await value(), '{\n    \n}');
        await field.fill('const score = 1;');
        await field.press('Control+/');
        assert.equal(await value(), '// const score = 1;');
        await field.press('Control+/');
        assert.equal(await value(), 'const score = 1;');
        await field.press('Escape');
        await field.press('Tab');
        assert.equal(await field.evaluate(node => node === document.activeElement), false);
    });

    await t.test('find, replace-all, invalid regex, undo, go-to-line, and save', async () => {
        await field.fill('const answer = 42;\nconst word = "answer";\n');
        await sample.getByRole('button', { name: 'Find / replace', exact: true }).click();
        await sample.getByRole('textbox', { name: 'Find text', exact: true }).fill('answer');
        await sample.getByRole('textbox', { name: 'Replacement text', exact: true }).fill('result');
        await sample.getByRole('button', { name: 'Replace all', exact: true }).click();
        assert.equal(await value(), 'const result = 42;\nconst word = "result";\n');
        await sample.getByRole('button', { name: 'Undo', exact: true }).click();
        assert.equal(await value(), 'const answer = 42;\nconst word = "answer";\n');
        await sample.getByRole('button', { name: 'Regex', exact: true }).click();
        await sample.getByRole('textbox', { name: 'Find text', exact: true }).fill('[');
        assert.equal(await sample.getByRole('textbox', { name: 'Find text', exact: true }).getAttribute('aria-invalid'), 'true');
        assert.equal(await sample.getByRole('button', { name: 'Replace all', exact: true }).isDisabled(), true);
        await sample.locator('.code-editor-find').getByRole('button', { name: 'Close', exact: true }).click();
        await sample.getByRole('button', { name: 'Go to line', exact: true }).click();
        await sample.getByRole('textbox', { name: 'Go to line and optional column' }).fill('2:3');
        await sample.locator('.code-editor-go').getByRole('button', { name: 'Go', exact: true }).click();
        assert.equal(await field.evaluate(node => node.selectionStart), 21);
        await sample.getByRole('button', { name: 'Save draft' }).click();
        assert.match(await sample.locator('.code-editor-demo-status').innerText(), /Saved in memory/);
    });

    await t.test('long source scrolls with aligned overlay/gutter and bounded rows', async () => {
        await field.fill(Array.from({ length: 2000 }, (_, i) => `const line${i + 1} = "${'value '.repeat(30)}";`).join('\n'));
        await field.press('Control+Home');
        await field.press('Control+End');
        await frame();
        const geometry = await field.evaluate(node => {
            const surface = node.closest('.code-editor-surface');
            const rows = [...surface.querySelectorAll('.code-editor-line')];
            const numbers = [...surface.querySelectorAll('.code-editor-number')];
            const style = getComputedStyle(node), box = node.getBoundingClientRect();
            const first = Number(numbers[0].textContent);
            return {
                count: rows.length, first, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft,
                selection: node.selectionStart, length: node.value.length, scrollHeight: node.scrollHeight,
                actualY: rows[0].getBoundingClientRect().top,
                expectedY: box.top + parseFloat(style.paddingTop) + (first - 1) * parseFloat(style.lineHeight) - node.scrollTop,
                actualX: rows[0].getBoundingClientRect().left,
                expectedX: box.left + parseFloat(style.paddingLeft) - node.scrollLeft,
                gutterY: numbers[0].getBoundingClientRect().top
            };
        });
        assert.ok(geometry.count < 50 && geometry.first > 1900, JSON.stringify(geometry));
        assert.ok(geometry.scrollTop > 0 && geometry.scrollLeft > 0);
        assert.ok(Math.abs(geometry.actualY - geometry.expectedY) < 1, JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.actualX - geometry.expectedX) < 1, JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.gutterY - geometry.actualY) < 1);
    });

    await t.test('browser clipboard copy, cut, paste and undo retain exact text', async () => {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await field.fill('alpha\nβeta\n');
        await field.press('Control+a');
        await field.press('Control+c');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'alpha\nβeta\n');
        await field.press('Control+x');
        assert.equal(await value(), '');
        await field.press('Control+v');
        assert.equal(await value(), 'alpha\nβeta\n');
        await field.press('Control+z');
        assert.equal(await value(), '');
        await field.press('Control+z');
        assert.equal(await value(), 'alpha\nβeta\n');
    });

    await t.test('switching files preserves independent drafts and history', async () => {
        const tree = page.getByRole('tree', { name: 'Example files' });
        await tree.getByRole('treeitem', { name: 'package.json', exact: true }).click();
        await page.getByRole('textbox', { name: 'package.json', exact: true }).fill('{"draft": true}');
        await tree.getByRole('treeitem', { name: 'README.md', exact: true }).click();
        await page.getByRole('textbox', { name: 'README.md', exact: true }).waitFor();
        await tree.getByRole('treeitem', { name: 'package.json', exact: true }).click();
        const json = page.getByRole('textbox', { name: 'package.json', exact: true });
        assert.equal(await json.inputValue(), '{"draft": true}');
        await json.press('Control+z');
        assert.match(await json.inputValue(), /"name": "editor-demo"/);
    });

    await t.test('readonly example mounts on scroll and cannot be edited', async () => {
        await page.locator('.preview-example').last().scrollIntoViewIfNeeded();
        const readonly = page.getByRole('textbox', { name: 'Read-only settings' });
        await readonly.waitFor();
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await readonly.scrollIntoViewIfNeeded();
            await frame();
            const geometry = await readonly.evaluate(node => {
                const editor = node.closest('.code-editor');
                const surface = editor.querySelector('.code-editor-surface').getBoundingClientRect();
                const token = [...editor.querySelectorAll('.code-editor-token--property')].find(node => node.textContent === '"theme"');
                const text = token?.getBoundingClientRect();
                return { width: surface.width, visible: !!text && text.width > 0 && text.left >= surface.left && text.right <= surface.right && text.top >= surface.top && text.bottom <= surface.bottom };
            });
            assert.ok(geometry.width > 150 && geometry.visible, `${width}: ${JSON.stringify(geometry)}`);
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        assert.equal(await readonly.evaluate(node => node.readOnly), true);
        const before = await readonly.inputValue();
        await readonly.press('Control+End');
        await readonly.press('x');
        assert.equal(await readonly.inputValue(), before);
    });

    await t.test('desktop and mobile demos stay inside the preview', async () => {
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await sample.scrollIntoViewIfNeeded();
            await frame();
            const bounds = await sample.evaluate(node => {
                const stage = node.closest('.preview-stage');
                const box = stage.getBoundingClientRect(), style = getComputedStyle(stage);
                const editor = node.querySelector('.code-editor').getBoundingClientRect();
                return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight), editorLeft: editor.left, editorRight: editor.right };
            });
            assert.ok(bounds.editorLeft >= bounds.left - 1 && bounds.editorRight <= bounds.right + 1, `${width}: ${JSON.stringify(bounds)}`);
        }
    });

    await t.test('file icons, named folders, collapse and keyboard selection', async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(new URL('/components/file-tree', url).href);
        const tree = page.getByRole('tree', { name: 'File and folder icon examples' });
        await tree.waitFor();
        for (const name of ['typescript', 'react', 'package', 'pnpm', 'archive', 'file']) {
            assert.ok(await tree.locator(`[data-file-tree-icon="${name}"]`).count(), name);
        }
        const paths = await tree.locator('[data-file-tree-icon] path').evaluateAll(nodes => nodes.map(node => ({
            namespace: node.namespaceURI, drawing: node.getAttribute('d'), width: node.getBoundingClientRect().width
        })));
        assert.ok(paths.length > 0);
        assert.ok(paths.every(path => path.namespace === 'http://www.w3.org/2000/svg'), 'all monograms and folder badges use the SVG namespace');
        assert.ok(paths.filter(path => path.drawing).every(path => path.width > 0), 'nonempty glyph paths actually render');
        const folder = tree.getByRole('treeitem').filter({ hasText: /^src$/ });
        await folder.click();
        assert.equal(await folder.getAttribute('aria-expanded'), 'false');
        await folder.press('ArrowRight');
        assert.equal(await folder.getAttribute('aria-expanded'), 'true');
        await folder.press('ArrowDown');
        assert.ok(await tree.locator('[aria-selected="true"]').count());
    });
    assert.deepEqual(errors, []);
});
