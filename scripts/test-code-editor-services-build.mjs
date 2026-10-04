import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { compile } from 'sass';
import { readFile } from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
test('standalone subsystem SCSS compiles without modifying the core stylesheet', () => {
    for (let name of ['services', 'markdown']) {
        let { css } = compile(resolve(root, `src/components/code-editor/scss/_${name}.scss`));
        assert.ok(css.includes(name === 'services' ? '.code-editor-squiggle' : '.markdown-input'));
    }
});
test('subsystems only import existing first-party runtime APIs and browser/local code', async () => {
    for (let name of ['services', 'services-model', 'services-protocol', 'services-transport', 'markdown', 'markdown-model', 'markdown-view', 'markdown-html', 'markdown-inline', 'markdown-layout', 'markdown-controls', 'markdown-structure', 'markdown-editing']) {
        let source = await readFile(resolve(root, `src/components/code-editor/${name}.ts`), 'utf8');
        for (let match of source.matchAll(/from ['"]([^'"]+)['"]/g)) assert.ok(match[1].startsWith('./') || match[1].startsWith('@esportsplus/'), match[1]);
        assert.ok(!/\.innerHTML\s*=|\beval\(|@ts-ignore|@ts-nocheck/.test(source));
    }
});
