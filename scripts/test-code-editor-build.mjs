import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';
import { compile } from 'sass';

const root = resolve(import.meta.dirname, '..');

test('code editor compiles with the repository template compiler without emitting files', async () => {
    let result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [template({ root })],
        build: {
            write: false,
            minify: false,
            lib: { entry: resolve(root, 'src/components/code-editor/index.ts'), formats: ['es'] },
            rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') }
        }
    });
    let code = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output)
        .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');
    assert.ok(!/\bhtml\s*`/.test(code), 'compiled templates reach consumers');
    assert.ok(!/@codemirror|monaco-editor/.test(code), 'no third-party editor runtime');
});

test('editor SCSS compiles with repository root imports', () => {
    let { css } = compile(resolve(root, 'src/components/code-editor/scss/index.scss'), {
        importers: [{ findFileUrl: (url) => url === '/shared' || url === '/tokens'
            ? pathToFileURL(resolve(root, url.slice(1) + '.scss')) : null }]
    });
    assert.ok(css.includes('.code-editor-input'));
    assert.ok(css.includes('forced-colors: active'));
});
