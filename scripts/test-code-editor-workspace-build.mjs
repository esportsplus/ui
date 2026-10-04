import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import template from '@esportsplus/template/compiler/vite';
import { compile } from 'sass';

const root = resolve(import.meta.dirname, '..');
test('workspace and tree templates compile with first-party tooling, without emitting files', async () => {
    const bundle = await build({
        configFile: false, root, logLevel: 'silent', plugins: [template({ root })],
        resolve: { alias: { '~': resolve(root, 'src') } },
        build: { write: false, minify: false,
            lib: { entry: resolve(root, 'src/components/code-editor/workspace.ts'), formats: ['es'] },
            rollupOptions: { external: (id) => id.startsWith('@esportsplus/') || id.endsWith('.scss') }
        }
    });
    const code = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((item) => item.output)
        .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');
    assert.ok(!/\bhtml\s*`/.test(code));
    assert.ok(!/@codemirror|monaco-editor|lucide|preact/.test(code));
    for (const behavior of ['code-workspace-tabbar', 'code-workspace-breadcrumb', 'code-workspace-quick-input',
        'code-workspace-menu', 'code-workspace-confirm', 'data-peek-ready', 'EditorWorkspaceModel', 'createMemoryWorkspaceHost']) assert.ok(code.includes(behavior), behavior);
});

test('standalone workspace styles support both explorer sides, peek, keyboard focus and system colors', () => {
    const { css } = compile(resolve(root, 'src/components/code-editor/scss/_workspace.scss'));
    for (const rule of ['data-explorer-side', 'data-explorer-open', 'data-peek-ready', 'translateX',
        'focus-visible', 'prefers-reduced-motion', 'forced-colors', '.code-workspace-quick', '.code-workspace-menu']) assert.ok(css.includes(rule), rule);
    assert.ok(css.includes('data-compact'));
    assert.ok(css.includes('var(--color-grey-300, Canvas)'));
    assert.ok(!css.includes('--color-grey-100'));
});

test('workspace and its dependency graph pass the repository focused typecheck', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'ui-workspace-check-'));
    try {
        const config = resolve(directory, 'tsconfig.json');
        const contract = resolve(directory, 'contracts.ts');
        const modulePath = (name) => JSON.stringify(resolve(root, `src/components/code-editor/${name}`).replaceAll('\\', '/'));
        await writeFile(contract, `
import markdownEditor from ${modulePath('markdown')};
import { mountLanguageServices } from ${modulePath('services')};
import { isWorkspaceCodeEditor, type CodeEditorWorkspaceAttributes } from ${modulePath('workspace')};
export const hooks: Pick<CodeEditorWorkspaceAttributes, 'renderEditor' | 'addons'> = {
    renderEditor: (_tab, attributes) => markdownEditor(attributes),
    addons: ({ host, controller, tab, workspace }) => {
        if (!isWorkspaceCodeEditor(controller)) return;
        const service = mountLanguageServices(host, controller, { fileName: tab.path, cwd: workspace.state.cwd });
        return () => service.dispose();
    }
};
`);
        await writeFile(config, JSON.stringify({
            extends: resolve(root, 'tsconfig.json'),
            compilerOptions: {
                noEmit: true, plugins: [], rootDir: parse(root).root,
                typeRoots: [resolve(root, 'node_modules/@types')],
                paths: { '~/*': [resolve(root, 'src/*')], '~/storage/*': [resolve(root, 'storage/*')] }
            },
            include: [contract, resolve(root, 'src/components/code-editor/workspace.ts'), resolve(root, 'src/components/code-editor/workspace-model.ts'), resolve(root, 'vite-env.d.ts')]
        }));
        const tsc = resolve(dirname(fileURLToPath(import.meta.resolve('@esportsplus/typescript/package.json'))), 'bin/tsc');
        const result = spawnSync(process.execPath, [tsc, '-p', config, '--noEmit'], { cwd: root, encoding: 'utf8', timeout: 60000 });
        assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    finally { await rm(directory, { recursive: true, force: true }); }
});
