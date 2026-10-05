import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { FOLDERS, NAMES, resolve, resolver } from '../src/components/file-tree/icons.ts';
import Elements from '../src/components/file-tree/model.ts';


const SVG = new URL('../storage/svg/', import.meta.url);

const VARIABLES = readFileSync(new URL('../src/components/file-tree/scss/variables.scss', import.meta.url), 'utf8');


const file = (name) => ({ name, type: 'file' });
const folder = (name) => ({ name, type: 'folder' });
const named = (resolve, element) => resolve(element).name;


test('specific project filenames beat their generic suffixes', () => {
    for (const [name, expected] of [
        ['package.json', 'package'], ['PACKAGE-LOCK.JSON', 'npm'], ['Cargo.toml', 'rust'], ['pyproject.toml', 'python'],
        ['tsconfig.json', 'tsconfig'], ['tsconfig.app.json', 'tsconfig'], ['pnpm-lock.yaml', 'pnpm'],
        ['pnpm-workspace.yaml', 'pnpm'], ['AGENTS.md', 'agents'], ['CLAUDE.md', 'claude'], ['readme.md', 'readme'],
        ['README', 'readme'], ['readme.txt', 'text'], ['LICENSE', 'text'], ['LICENSE.txt', 'text'],
        ['Dockerfile', 'docker'], ['Dockerfile.dev', 'docker'], ['docker-compose.local.yaml', 'docker'],
        ['compose.yml', 'docker'], ['bun.lockb', 'bun'], ['bunfig.toml', 'bun'], ['.gitignore', 'git'],
        ['.gitattributes', 'git'], ['.gitmodules', 'git'], ['.editorconfig', 'text'], ['.npmrc', 'npm'],
        ['.bashrc', 'bash'], ['.zshrc', 'bash'], ['.zprofile', 'bash'], ['.env', 'text'], ['.env.production.local', 'text'],
        ['Gemfile', 'ruby'], ['go.mod', 'go'], ['AUTHORS', 'text'], ['.mcp.json', 'mcp'], ['biome.jsonc', 'biome'],
        ['.oxlintrc.json', 'oxc'], ['.browserslistrc', 'browserslist'], ['browserslist', 'browserslist']
    ]) {
        assert.equal(named(resolve, file(name)), expected, name);
    }
});

test('tool configuration variants retain their artwork', () => {
    for (const [name, expected] of [
        ['eslint.config.mts', 'eslint'], ['.eslintrc', 'eslint'], ['.eslintrc.yml', 'eslint'], ['.eslintignore', 'eslint'],
        ['prettier.config.cjs', 'prettier'], ['.prettierrc.toml', 'prettier'], ['.prettierignore', 'prettier'],
        ['babel.config.json', 'babel'], ['.babelrc', 'babel'], ['next.config.ts', 'nextjs'], ['astro.config.mjs', 'astro'],
        ['nuxt.config.ts', 'vue'], ['svelte.config.js', 'svelte'], ['postcss.config.cts', 'postcss'],
        ['.postcssrc.json', 'postcss'], ['stylelint.config.mjs', 'stylelint'], ['.stylelintignore', 'stylelint'],
        ['svgo.config.ts', 'svgo'], ['tailwind.config.ts', 'tailwind'], ['vite.config.mts', 'vite'],
        ['vitest.config.ts', 'vite'], ['webpack.config.js', 'webpack'], ['webpack.config.babel.js', 'webpack'],
        ['bootstrap.bundle.min.js', 'bootstrap'], ['playwright.config.ts', 'typescript'], ['.yarnrc.yml', 'yml']
    ]) {
        assert.equal(named(resolve, file(name)), expected, name);
    }
});

test('languages, frameworks and resources map onto artwork, or the generic file without any', () => {
    for (const [extension, expected] of [
        ['js', 'javascript'], ['cjs', 'javascript'], ['mjs', 'javascript'], ['ts', 'typescript'], ['mts', 'typescript'],
        ['cts', 'typescript'], ['tsx', 'react'], ['jsx', 'react'], ['md', 'markdown'], ['mdx', 'markdown'],
        ['vue', 'vue'], ['svelte', 'svelte'], ['astro', 'astro'], ['css', 'css'], ['less', 'css'], ['sass', 'sass'],
        ['scss', 'sass'], ['html', 'html'], ['xml', 'html'], ['json', 'json'], ['jsonc', 'json'], ['yaml', 'yml'],
        ['ini', 'text'], ['py', 'python'], ['ipynb', 'python'], ['rb', 'ruby'], ['go', 'go'], ['rs', 'rust'],
        ['c', 'c'], ['hpp', 'c'], ['m', 'c'], ['swift', 'swift'], ['zig', 'zig'], ['sh', 'bash'], ['ps1', 'bash'],
        ['sql', 'database'], ['sqlite3', 'database'], ['gql', 'graphql'], ['tfvars', 'terraform'], ['wasm', 'wasm'],
        ['code-workspace', 'vscode'], ['mcp', 'mcp'], ['png', 'image'], ['webp', 'image'], ['svg', 'svg'],
        ['woff2', 'font'], ['zip', 'zip'], ['csv', 'table'], ['xlsx', 'table'], ['log', 'text'], ['rtf', 'text'],
        ['java', 'file'], ['kt', 'file'], ['cs', 'file'], ['toml', 'file'], ['mp3', 'file'], ['mp4', 'file'],
        ['pdf', 'file'], ['lock', 'file'], ['pem', 'file']
    ]) {
        assert.equal(named(resolve, file(`example.${extension.toUpperCase()}`)), expected, extension);
    }
});

test('compound suffixes are tried longest first and both path separators work', () => {
    for (const [name, expected] of [
        ['guide.mdx.tsx', 'markdown'], ['types.d.ts', 'typescript'], ['types.d.mts', 'typescript'],
        ['backup.tar.gz', 'zip'], ['backup.tar.xz', 'zip'], ['C:\\project\\README.MD', 'readme'],
        ['/project/COMPONENT.TSX', 'react'], ['folder.ts/file.unknown', 'file'], ['folder.ts/.hidden', 'file'],
        ['file.ts.', 'file'], ['.ts', 'file']
    ]) {
        assert.equal(named(resolve, file(name)), expected, name);
    }

    const custom = resolver({ byFileExtension: { '.D.TS': 'text', ts: 'zig', 'tar.gz': 'package', gz: 'file' } });

    assert.equal(named(custom, file('types.d.ts')), 'text');
    assert.equal(named(custom, file('types.ts')), 'zig');
    assert.equal(named(custom, file('backup.tar.gz')), 'package');
    assert.equal(named(custom, file('backup.gz')), 'file');
});

test('custom rules come before built-ins, by name, then fragment, then extension', () => {
    const custom = resolver({
        byFileExtension: { ' .JSON ': 'yml', '.d.ts': 'text' },
        byFileName: { '  PACKAGE.JSON  ': 'agents', 'types.d.ts': 'json' },
        byFileNameContains: { DOCKER: 'zip', license: 'markdown', 'types.d': 'go' },
        byFolderName: { SRC: 'docs' }
    });

    assert.equal(named(custom, file('package.json')), 'agents');
    assert.equal(named(custom, file('types.d.ts')), 'json', 'an exact name beats a fragment');
    assert.equal(named(custom, file('other.d.ts')), 'text');
    assert.equal(named(custom, file('Dockerfile')), 'zip');
    assert.equal(named(custom, file('LICENSE-MIT')), 'markdown');
    assert.equal(named(custom, file('license.json')), 'markdown', 'a fragment beats an extension');
    assert.equal(named(custom, file('tsconfig.json')), 'yml', 'a custom extension beats built-in names');
    assert.equal(named(custom, file('other.py')), 'python');
    assert.equal(named(custom, folder('src')), 'folder-docs');
    assert.equal(named(custom, folder('docs')), 'folder-docs');
});

test('rules may name any sprite; those are reported as custom and drawn uncolored', () => {
    const custom = resolver({
        byFileName: { 'package.json': 't3-file-icon-package-json' },
        byFileNameContains: { secret: '#lock' },
        byFolderName: { '.vscode': 'a1b2c3d4' }
    });

    assert.deepEqual(custom(file('package.json')), { custom: true, name: 't3-file-icon-package-json' });
    assert.deepEqual(custom(file('my-secret.txt')), { custom: true, name: '#lock' });
    assert.deepEqual(custom(folder('.vscode')), { custom: true, name: 'a1b2c3d4' });
    assert.deepEqual(custom(file('index.ts')), { name: 'typescript' });
});

test('folders report the artwork drawn, regardless of extensions', () => {
    for (const [name, expected] of [
        ['.git', 'git'], ['.github', 'git'], ['__tests__', 'test'], ['coverage', 'test'], ['assets', 'assets'],
        ['fonts', 'assets'], ['bin', 'scripts'], ['tools', 'scripts'], ['build', 'output'], ['dist', 'output'],
        ['.next', 'output'], ['components', 'components'], ['doc', 'docs'], ['docs', 'docs'], ['wiki', 'docs'],
        ['images', 'assets'], ['node_modules', 'packages'], ['packages', 'packages'], ['vendor', 'packages'],
        ['public', 'public'], ['www', 'public'], ['scripts', 'scripts'], ['src', 'src'], ['lib', 'src'],
        ['app', 'src'], ['spec', 'test'], ['tests', 'test']
    ]) {
        assert.equal(named(resolve, folder(name.toUpperCase())), `folder-${expected}`, name);
    }

    for (const name of ['config', '.vscode', 'styles', 'migrations', 'api', 'auth', 'index.ts', 'utils']) {
        assert.equal(named(resolve, folder(name)), 'folder', name);
    }

    assert.equal(named(resolve, { name: 'docs', children: [] }), 'folder-docs');
    assert.equal(named(resolve, { name: 'docs', type: 'file', children: [] }), 'file');
    assert.equal(named(resolve, { name: 'src', type: 'folder' }), 'folder-src', 'a lazy folder needs no children');
});

test('the minimal and standard sets draw less', () => {
    const minimal = resolver({ set: 'minimal' });
    const standard = resolver({ set: 'standard' });

    for (const element of [file('index.ts'), file('package.json'), file('app.vue')]) {
        assert.equal(named(minimal, element), 'file', element.name);
    }

    assert.equal(named(minimal, folder('src')), 'folder');
    assert.equal(named(minimal, file('Dockerfile')), 'file');
    assert.equal(named(resolver({ byFileName: { dockerfile: 'docker' }, set: 'minimal' }), file('Dockerfile')), 'docker');

    for (const [name, expected] of [
        ['index.ts', 'typescript'], ['app.tsx', 'typescript'], ['app.jsx', 'javascript'], ['main.scss', 'css'],
        ['package.json', 'json'], ['README.md', 'markdown'], ['.gitignore', 'git'], ['app.vue', 'file'],
        ['vite.config.ts', 'typescript'], ['config.yml', 'file'], ['Dockerfile', 'file']
    ]) {
        assert.equal(named(standard, file(name)), expected, name);
    }

    assert.equal(named(standard, folder('src')), 'folder-src');
});

test('unknown and prototype-like names fall back safely', () => {
    const custom = resolver({ byFileExtension: { '': 'agents', '.': 'json' }, byFileName: { 'a.ts': '' } });

    for (const name of ['', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'unknown', 'a.not-a-known-extension']) {
        assert.equal(named(custom, file(name)), 'file', name);
        assert.equal(named(custom, folder(name)), 'folder', name);
    }

    assert.equal(named(custom, file('a.ts')), 'typescript', 'an empty rule is ignored');
    assert.equal(named(custom, file('a.constructor')), 'file');
});

test('compiled custom mappings are isolated per tree and do not mutate caller rules', () => {
    const options = Object.freeze({ byFileName: Object.freeze({ 'special.txt': 'agents' }) });
    const custom = resolver(options);

    assert.equal(named(custom, file('special.txt')), 'agents');
    assert.equal(named(resolve, file('special.txt')), 'text');
    assert.equal(named(resolver(), file('special.txt')), 'text');
    assert.deepEqual(options, { byFileName: { 'special.txt': 'agents' } });
});

test('renaming and moving through the store resolve the new name while retaining identity', () => {
    const model = new Elements([{ id: 'f', name: 'notes.txt' }, { id: 'src', name: 'src', children: [] }]);

    assert.equal(named(resolve, model.index.get('f').element), 'text');
    assert.ok(model.rename('f', 'package.json'));
    assert.equal(named(resolve, model.index.get('f').element), 'package');
    assert.ok(model.move('f', 'src'));
    assert.equal(named(resolve, model.index.get('f').element), 'package');
    assert.equal(model.index.get('f').element.id, 'f');
    assert.ok(model.rename('src', 'docs'));
    assert.equal(named(resolve, model.index.get('src').element), 'folder-docs');
});

test('every icon has its sprite, drawn in currentColor, and its color family', () => {
    const families = new Set([...VARIABLES.matchAll(/^    '(\w+)': light-dark\(/gm)].map((match) => match[1]));
    const colors = new Map([...VARIABLES.matchAll(/^    (\w+): '(\w+)',?$/gm)].map((match) => [match[1], match[2]]));

    assert.equal(families.size, 12);

    for (const name of NAMES) {
        const sprite = new URL(name === 'file' ? 'file.svg' : `file-${name}.svg`, SVG);

        assert.ok(existsSync(sprite), name);
        assert.ok(families.has(colors.get(name)), name);

        // Masks paint in black and white; everything else takes the row's color.
        const source = readFileSync(sprite, 'utf8').replace(/<mask[\s\S]*?<\/mask>|<linearGradient[\s\S]*?<\/linearGradient>/g, '');

        assert.doesNotMatch(source, /#[\da-f]{3,6}\b|class=/i, name);
    }

    for (const kind of FOLDERS) {
        assert.ok(existsSync(new URL(`folder-${kind}.svg`, SVG)), kind);
        assert.ok(existsSync(new URL(`folder-${kind}-open.svg`, SVG)), kind);
    }

    assert.deepEqual([...colors.keys()].filter((name) => name !== 'folder' && !NAMES.includes(name)), []);
    assert.ok(families.has(colors.get('folder')));
});

test('every icon is drawn for something, so none is dead', () => {
    const reached = new Set(['file']);
    const source = readFileSync(new URL('../src/components/file-tree/icons.ts', import.meta.url), 'utf8');

    for (const match of source.matchAll(/:\s*'(\w+)'|, '(\w+)'\]/g)) {
        reached.add(match[1] ?? match[2]);
    }

    assert.deepEqual(NAMES.filter((name) => !reached.has(name)), []);
});
