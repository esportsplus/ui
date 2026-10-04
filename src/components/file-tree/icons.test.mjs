import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve, resolver } from './icons.ts';
import Elements from './model.ts';


const file = (name) => ({ name, type: 'file' });
const folder = (name) => ({ name, type: 'folder' });

test('specific project filenames beat their generic suffixes', () => {
    for (const [name, expected] of [
        ['package.json', 'package'], ['PACKAGE-LOCK.JSON', 'package'], ['Cargo.toml', 'package'],
        ['tsconfig.json', 'typescriptConfig'], ['tsconfig.app.json', 'typescriptConfig'],
        ['jsconfig.build.json', 'typescriptConfig'], ['pnpm-lock.yaml', 'pnpm'], ['pnpm-workspace.yaml', 'pnpm'],
        ['AGENTS.md', 'agents'], ['CLAUDE.md', 'agents'], ['readme.md', 'book'], ['LICENSE.txt', 'license'],
        ['Dockerfile', 'docker'], ['Dockerfile.dev', 'docker'], ['docker-compose.local.yaml', 'docker'],
        ['compose.yml', 'docker'], ['bun.lockb', 'bun'], ['bunfig.toml', 'bun'], ['yarn.lock', 'yarn'],
        ['.gitignore', 'git'], ['.gitattributes', 'git'], ['.gitmodules', 'git'], ['.editorconfig', 'config'],
        ['.bashrc', 'shell'], ['.zprofile', 'shell'], ['.env', 'environment'], ['.env.production.local', 'environment'],
        ['Gemfile', 'ruby'], ['go.mod', 'go'], ['CMakeLists.txt', 'cmake'], ['AUTHORS', 'text'],
        ['.mcp.json', 'mcp'], ['biome.jsonc', 'biome'], ['.oxlintrc.json', 'oxc'], ['.browserslistrc', 'browserslist']
    ]) {
        assert.equal(resolve(file(name)).name, expected, name);
    }
});

test('tool configuration variants retain their semantic icons', () => {
    for (const [name, expected] of [
        ['eslint.config.mts', 'eslint'], ['.eslintrc', 'eslint'], ['.eslintrc.yml', 'eslint'],
        ['prettier.config.cjs', 'prettier'], ['.prettierrc.toml', 'prettier'], ['.prettierignore', 'prettier'],
        ['babel.config.json', 'babel'], ['.babelrc', 'babel'], ['next.config.ts', 'next'],
        ['astro.config.mjs', 'astro'], ['nuxt.config.ts', 'nuxt'], ['svelte.config.js', 'svelte'],
        ['postcss.config.cts', 'postcss'], ['stylelint.config.mjs', 'stylelint'], ['.stylelintignore', 'stylelint'],
        ['svgo.config.ts', 'svg'], ['tailwind.config.ts', 'tailwind'], ['vite.config.mts', 'vite'],
        ['vitest.config.ts', 'test'], ['playwright.config.ts', 'test'], ['webpack.config.js', 'webpack'], ['webpack.config.babel.js', 'webpack'],
        ['bootstrap.bundle.min.js', 'bootstrap']
    ]) {
        assert.equal(resolve(file(name)).name, expected, name);
    }
});

test('language, framework and resource families have meaningful geometry and colors', () => {
    for (const [extension, expected] of [
        ['js', 'javascript'], ['cjs', 'javascript'], ['mjs', 'javascript'], ['ts', 'typescript'],
        ['mts', 'typescript'], ['cts', 'typescript'], ['tsx', 'react'], ['jsx', 'react'],
        ['md', 'markdown'], ['mdx', 'markdown'], ['vue', 'vue'], ['svelte', 'svelte'], ['astro', 'astro'],
        ['css', 'styles'], ['less', 'styles'], ['sass', 'sass'], ['scss', 'sass'], ['html', 'html'], ['xml', 'html'],
        ['json', 'json'], ['jsonc', 'json'], ['yaml', 'yaml'], ['toml', 'toml'], ['py', 'python'], ['ipynb', 'notebook'],
        ['rb', 'ruby'], ['go', 'go'], ['rs', 'rust'], ['c', 'c'], ['hpp', 'cpp'], ['cs', 'csharp'],
        ['java', 'java'], ['kt', 'kotlin'], ['swift', 'swift'], ['dart', 'dart'], ['php', 'php'], ['pl', 'perl'],
        ['lua', 'lua'], ['r', 'r'], ['scala', 'scala'], ['clj', 'clojure'], ['hs', 'haskell'], ['ex', 'elixir'],
        ['erl', 'erlang'], ['gradle', 'groovy'], ['f90', 'fortran'], ['zig', 'zig'], ['sol', 'solidity'],
        ['sh', 'shell'], ['ps1', 'powershell'], ['sql', 'database'], ['sqlite3', 'database'], ['gql', 'graphql'],
        ['tfvars', 'terraform'], ['wasm', 'wasm'], ['code-workspace', 'vscode'], ['mcp', 'mcp'],
        ['png', 'image'], ['webp', 'image'], ['svg', 'svg'], ['mp3', 'audio'], ['mp4', 'video'],
        ['woff2', 'font'], ['zip', 'archive'], ['csv', 'table'], ['xlsx', 'table'], ['pdf', 'pdf'],
        ['docx', 'document'], ['log', 'text'], ['lock', 'lock'], ['pem', 'key']
    ]) {
        const glyph = resolve(file(`example.${extension.toUpperCase()}`));

        assert.equal(glyph.name, expected, extension);
        assert.ok(glyph.path.startsWith('M'), extension);
        assert.ok(glyph.color, extension);
        assert.ok((glyph.letters ?? []).every((path) => typeof path === 'string' && path.startsWith('M')), extension);
    }

    assert.notDeepEqual(resolve(file('a.js')), resolve(file('a.ts')));
    assert.notEqual(resolve(file('a.js')).letters[0], resolve(file('a.ts')).letters[0]);
    assert.notEqual(resolve(file('a.png')).path, resolve(file('a.zip')).path);
});

test('compound suffixes are tried longest first and both path separators work', () => {
    for (const [name, expected] of [
        ['guide.mdx.tsx', 'markdown'], ['types.d.ts', 'typescript'], ['types.d.mts', 'typescript'],
        ['backup.tar.gz', 'archive'], ['backup.tar.bz2', 'archive'], ['backup.tar.xz', 'archive'],
        ['C:\\project\\README.MD', 'book'], ['/project/COMPONENT.TSX', 'react'],
        ['folder.ts/file.unknown', 'file'], ['folder.ts/.hidden', 'file'], ['file.ts.', 'file'], ['.ts', 'file']
    ]) {
        assert.equal(resolve(file(name)).name, expected, name);
    }

    const custom = resolver({ byFileExtension: { '.D.TS': 'document', ts: 'test', 'tar.gz': 'package', gz: 'file' } });

    assert.equal(custom(file('types.d.ts')).name, 'document');
    assert.equal(custom(file('types.ts')).name, 'test');
    assert.equal(custom(file('backup.tar.gz')).name, 'package');
});

test('partial custom rules override built-ins without losing other built-ins', () => {
    const custom = resolver({
        byFileName: { '  PACKAGE.JSON  ': 'agents', 'types.d.ts': 'license' },
        byFileExtension: { ' .JSON ': 'test', '.d.ts': 'document' },
        byFolderName: { SRC: 'database' }
    });

    assert.equal(custom(file('package.json')).name, 'agents');
    assert.equal(custom(file('types.d.ts')).name, 'license');
    assert.equal(custom(file('other.d.ts')).name, 'document');
    assert.equal(custom(file('tsconfig.json')).name, 'test', 'explicit extension overrides built-in filenames');
    assert.equal(custom(file('other.json')).name, 'test');
    assert.equal(custom(file('other.py')).name, 'python');
    assert.equal(custom(folder('src')).name, 'folder-database');
    assert.equal(custom(folder('src')).custom, true);
    assert.equal(custom(folder('docs')).name, 'folder-book');
});

test('folder icons are independent of extensions and have distinct open states', () => {
    for (const [name, expected] of [
        ['.git', 'git'], ['__tests__', 'test'], ['assets', 'image'], ['bin', 'shell'], ['build', 'archive'],
        ['components', 'layers'], ['dist', 'archive'], ['doc', 'book'], ['docs', 'book'], ['images', 'image'],
        ['img', 'image'], ['media', 'image'], ['node_modules', 'package'], ['out', 'archive'],
        ['packages', 'package'], ['public', 'network'], ['scripts', 'shell'], ['spec', 'test'], ['src', 'code'],
        ['static', 'image'], ['test', 'test'], ['tests', 'test'], ['vendor', 'package'],
        ['.github', 'git'], ['.devcontainer', 'docker'], ['.codex', 'agents'], ['config', 'config'],
        ['styles', 'styles'], ['fonts', 'font'], ['migrations', 'database'], ['api', 'network'], ['auth', 'lock']
    ]) {
        const closed = resolve(folder(name.toUpperCase()));
        const opened = resolve(folder(name), true);

        assert.equal(closed.name, `folder-${expected}`, name);
        assert.ok(closed.badge?.path, name);
        assert.notEqual(opened.path, closed.path, name);
        assert.deepEqual(opened.badge, closed.badge, name);
    }

    assert.equal(resolve(folder('index.ts')).name, 'folder');
    assert.equal(resolve({ name: 'docs', children: [] }).name, 'folder-book');
    assert.equal(resolve({ name: 'docs', type: 'file', children: [] }).name, 'file');
    assert.equal(resolve({ name: 'src', type: 'folder' }).name, 'folder-code', 'lazy folder needs no children');
});

test('monochrome removes palette colors from files and folder badges', () => {
    const monochrome = resolver({ colored: false });

    for (const element of [file('a.ts'), file('package.json'), folder('src'), folder('docs'), folder('unknown')]) {
        const colored = resolve(element);
        const plain = monochrome(element);

        assert.equal(plain.color, undefined);
        assert.equal(plain.badge?.color, undefined);
        assert.equal(plain.path, colored.path);
        assert.deepEqual(plain.letters, colored.letters);
    }
});

test('unknown and prototype-like names safely fall back; invalid JavaScript override targets are ignored', () => {
    const custom = resolver({
        byFileName: { 'a.ts': 'constructor', 'a.py': 'does-not-exist' },
        byFileExtension: { '': 'agents', '.': 'test', zip: 'toString' },
        byFolderName: { src: '__proto__' }
    });

    for (const name of ['', 'constructor', '__proto__', 'toString', 'unknown', 'a.not-a-known-extension']) {
        assert.equal(custom(file(name)).name, 'file', name);
        assert.equal(custom(folder(name)).name, 'folder', name);
    }

    assert.equal(custom(file('a.ts')).name, 'typescript');
    assert.equal(custom(file('a.py')).name, 'python');
    assert.equal(custom(file('a.zip')).name, 'archive');
    assert.equal(custom(folder('src')).name, 'folder-code');
});

test('compiled custom mappings are isolated per tree and do not mutate caller rules', () => {
    const options = Object.freeze({ byFileName: Object.freeze({ 'special.txt': 'agents' }) });
    const custom = resolver(options);

    assert.equal(custom(file('special.txt')).name, 'agents');
    assert.equal(resolve(file('special.txt')).name, 'text');
    assert.equal(resolver()(file('special.txt')).name, 'text');
    assert.deepEqual(options, { byFileName: { 'special.txt': 'agents' } });
});

test('renaming and moving through the existing store resolve the new name while retaining identity', () => {
    const model = new Elements([{ id: 'f', name: 'notes.txt' }, { id: 'src', name: 'src', children: [] }]);

    assert.equal(resolve(model.index.get('f').element).name, 'text');
    assert.ok(model.rename('f', 'package.json'));
    assert.equal(resolve(model.index.get('f').element).name, 'package');
    assert.ok(model.move('f', 'src'));
    assert.equal(resolve(model.index.get('f').element).name, 'package');
    assert.equal(model.index.get('f').element.id, 'f');
    assert.ok(model.rename('src', 'docs'));
    assert.equal(resolve(model.index.get('src').element).name, 'folder-book');
});
