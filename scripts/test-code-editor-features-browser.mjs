import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const url = process.env.CODE_EDITOR_TEST_URL;
const module = process.env.CODE_EDITOR_PLAYWRIGHT_PATH;

test('real browser language services and in-place Markdown', {
    skip: !url || !module ? 'Set CODE_EDITOR_TEST_URL and CODE_EDITOR_PLAYWRIGHT_PATH' : false
}, async t => {
    const { chromium } = require(module);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CODE_EDITOR_BROWSER_PATH });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/components/code-editor', url).href);
    // Documentation previews mount when visible.
    for (const preview of await page.locator('.preview-example').all()) {
        await preview.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
    }

    await t.test('transport diagnostics select source; keyboard completion edits and undoes', async () => {
        const sample = page.getByRole('region', { name: 'Language services example', exact: true });
        const field = sample.getByRole('textbox', { name: 'Language services source', exact: true });
        await field.scrollIntoViewIfNeeded();
        const diagnostic = sample.getByRole('button', { name: 'Sample language service: Replace TODO_ERROR with a number.', exact: true });
        await diagnostic.waitFor();
        assert.ok(await sample.locator('.code-editor-squiggle').count());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const sourceBounds = await field.boundingBox(), markBounds = await sample.locator('.code-editor-squiggle').first().boundingBox();
        assert.ok(markBounds.y >= sourceBounds.y && markBounds.y < sourceBounds.y + sourceBounds.height, 'diagnostic follows page scrolling');
        await diagnostic.click();
        assert.equal(await field.evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd)), 'TODO_ERROR');
        await field.press('7');
        await diagnostic.waitFor({ state: 'detached' });
        await field.press('Control+End');
        await field.press('ArrowLeft');
        await field.press('Control+Space');
        const completion = sample.getByRole('option').filter({ hasText: 'greet' });
        await completion.waitFor();
        await field.press('Enter');
        assert.match(await field.inputValue(), /\ngreet\n$/);
        await field.press('Control+z');
        assert.match(await field.inputValue(), /\ngre\n$/);
        assert.equal(await sample.getByRole('listbox', { name: 'Completions' }).isVisible(), false);
        await field.hover({ position: { x: 35, y: 18 } });
        await sample.getByRole('tooltip').waitFor({ state: 'visible' });
        assert.match(await sample.getByRole('tooltip').innerText(), /function greet\(person: Person\): string/);
        await field.press('Escape');
        await sample.getByRole('tooltip').waitFor({ state: 'hidden' });
        await field.press('Control+Space');
        await completion.waitFor();
        await completion.click();
        assert.match(await field.inputValue(), /\ngreet\n$/);
    });

    await t.test('Markdown renders inactive blocks, toggles tasks with undo, and edits source in place', async () => {
        const sample = page.getByRole('region', { name: 'Markdown example', exact: true });
        await sample.scrollIntoViewIfNeeded();
        assert.equal(await sample.locator('.markdown-frontmatter').count(), 1);
        assert.ok(await sample.locator('strong').count());
        assert.ok(await sample.locator('em').count());
        assert.ok(await sample.locator('s').count());
        assert.ok(await sample.locator('pre code').count());
        assert.ok(await sample.locator('details summary').count());
        const task = sample.getByRole('checkbox', { name: 'Toggle task' }).first();
        assert.equal(await task.isChecked(), false);
        await task.click();
        assert.equal(await task.isChecked(), true);
        await sample.getByRole('button', { name: 'Undo', exact: true }).click();
        assert.equal(await task.isChecked(), false);
        const heading = sample.locator('.markdown-block.markdown-h1');
        await heading.click();
        const field = sample.getByRole('textbox', { name: 'Markdown source', exact: true });
        await field.waitFor({ state: 'visible' });
        assert.match(await field.inputValue(), /^# Editor workspace/);
        assert.ok(await sample.locator('pre code').count(), 'other blocks remain rendered during editing');
        await field.fill('# Changed heading\n');
        await sample.getByRole('button', { name: 'Save draft', exact: true }).click();
        assert.equal(await sample.locator('.markdown-block.markdown-h1').innerText(), 'Changed heading');
        assert.match(await sample.locator('.code-editor-demo-status').innerText(), /Saved in memory/);
        await sample.getByRole('button', { name: 'Undo', exact: true }).click();
        assert.equal(await sample.locator('.markdown-block.markdown-h1').innerText(), 'Editor workspace');
    });
    await t.test('large Markdown keeps a bounded block window and edits at the far end', async () => {
        const sample = page.getByRole('region', { name: 'Markdown example', exact: true });
        await sample.getByRole('button', { name: 'Load large document', exact: true }).click();
        const surface = sample.locator('.markdown-surface');
        assert.ok(await surface.locator('.markdown-block').count() <= 120);
        await surface.evaluate(node => { node.scrollTop = node.scrollHeight; });
        await page.waitForTimeout(150);
        const last = surface.locator('.markdown-block.markdown-h2').filter({ hasText: /^Section 1500$/ });
        await last.waitFor();
        assert.ok(await surface.locator('.markdown-block').count() <= 120);
        const style = await last.evaluate(node => ({ font: getComputedStyle(node).fontSize, line: getComputedStyle(node).lineHeight }));
        await last.click();
        const source = sample.getByRole('textbox', { name: 'Markdown source', exact: true });
        assert.match(await source.inputValue(), /^## Section 1500/);
        assert.deepEqual(await source.evaluate(node => ({ font: getComputedStyle(node).fontSize, line: getComputedStyle(node).lineHeight })), style);
        await source.press('End'); await source.press('!');
        await sample.getByRole('button', { name: 'Save draft', exact: true }).click();
        assert.match(await surface.locator('.markdown-block.markdown-h2').last().innerText(), /Section 1500!/);
        await sample.getByRole('button', { name: 'Restore example', exact: true }).click();
        await surface.evaluate(node => { node.scrollTop = 0; });
    });
    assert.deepEqual(errors, []);
});
