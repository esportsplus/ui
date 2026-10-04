import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';
import { compile } from 'sass';


const root = resolve(import.meta.dirname, '../../..');

test('the complete tree and authored SVG templates compile with the first-party compiler', async () => {
    const result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [template({ root })],
        resolve: { alias: { '~': resolve(root, 'src') } },
        build: {
            write: false,
            minify: false,
            lib: { entry: resolve(import.meta.dirname, 'index.ts'), formats: ['es'] },
            // Runtime packages and the existing sprite assets are supplied by the consumer's normal pipeline.
            // Styles are compiled separately below. This build emits nothing into the shared workspace.
            rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') }
        }
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
    const code = output.filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');

    assert.ok(code.includes('data-file-tree-icon'));
    assert.ok(code.includes('stroke-linejoin'));
    assert.ok(code.includes('fileTreeIcon'));
    assert.ok(code.includes('resolveFileTreeIcon'));
    assert.ok(!/\bhtml\s*`/.test(code), 'no uncompiled template tags reach the bundle');
});

test('tree styles compile with themeable icon colors and a forced-colors override', () => {
    const { css } = compile(resolve(import.meta.dirname, 'scss/index.scss'), {
        importers: [{
            findFileUrl(url) {
                return url === '/shared' || url === '/tokens'
                    ? pathToFileURL(resolve(root, `${url.slice(1)}.scss`))
                    : null;
            }
        }]
    });

    assert.ok(css.includes('--file-tree-icon-blue:'));
    assert.ok(css.includes('var(--file-tree-icon-color, var(--file-tree-glyph-color, inherit))'));
    assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.file-tree-icon--builtin\.icon\s*\{\s*color: inherit;/);
});
