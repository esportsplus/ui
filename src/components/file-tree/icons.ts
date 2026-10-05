type Element = { children?: unknown[]; name: string; type?: 'file' | 'folder' };

// The folders with artwork of their own, drawn as 'folder-<name>' in both states.
type Folder = typeof FOLDERS[number];

// The tree's own glyphs a host can swap for any sprite.
type Interface = 'chevron' | 'file' | 'folder' | 'folder-open' | 'lock' | 'symlink';

type Name = typeof NAMES[number];

type Options = {
    // Keys may start with a dot; compound extensions are tried before shorter ones.
    byFileExtension?: Rules<Name>;
    byFileName?: Rules<Name>;
    // Tried in order against the lowercase basename, after 'byFileName'.
    byFileNameContains?: Rules<Name>;
    byFolderName?: Rules<Folder>;
    // Each icon in its file type's color; false draws them all in the row's.
    colored?: boolean;
    remap?: Partial<Record<Interface, string>>;
    // 'minimal' draws the generic file and folder only, 'standard' the common languages and named folders.
    set?: Tier;
};

type Resolved = {
    // A rule named a sprite rather than a built-in icon.
    custom?: true;
    // The built-in icon drawn, 'folder' or 'folder-<name>' for a folder, or the sprite a rule named.
    name: string;
};

// A rule's value is a built-in icon or the id of any sprite on the page.
type Rules<T extends string> = Readonly<Record<string, T | (string & {})>>;

type Tier = 'complete' | 'minimal' | 'standard';


// What the 'standard' set draws a 'complete' only extension as.
const BASIC: Readonly<Record<string, Name>> = {
    jsx: 'javascript',
    sass: 'css',
    scss: 'css',
    tsx: 'typescript'
};

// '.toolrc' and 'tool.config', either with a script, JSON, TOML or YAML extension, by tool.
const CONFIG = /^(?:\.([a-z\d]+)rc|([a-z\d]+)\.config)(?:\.(?:[cm]?[jt]s|json[5c]?|toml|ya?ml))?$/;

const CONFIGS: Readonly<Record<string, Name>> = {
    astro: 'astro',
    babel: 'babel',
    bash: 'bash',
    browserslist: 'browserslist',
    eslint: 'eslint',
    next: 'nextjs',
    npm: 'npm',
    nuxt: 'vue',
    oxlint: 'oxc',
    postcss: 'postcss',
    prettier: 'prettier',
    stylelint: 'stylelint',
    svelte: 'svelte',
    svgo: 'svgo',
    tailwind: 'tailwind',
    vite: 'vite',
    vitest: 'vite',
    webpack: 'webpack',
    zsh: 'bash'
};

const EXTENSIONS: Readonly<Record<string, Name>> = {
    '7z': 'zip',
    astro: 'astro',
    avif: 'image',
    bash: 'bash',
    bat: 'bash',
    bmp: 'image',
    bz2: 'zip',
    c: 'c',
    'c++': 'c',
    cc: 'c',
    cfg: 'text',
    cjs: 'javascript',
    cmd: 'bash',
    'code-workspace': 'vscode',
    conf: 'text',
    config: 'text',
    cpp: 'c',
    csh: 'bash',
    css: 'css',
    csv: 'table',
    cts: 'typescript',
    cxx: 'c',
    db: 'database',
    dtd: 'html',
    eot: 'font',
    erb: 'ruby',
    es6: 'javascript',
    fish: 'bash',
    gemspec: 'ruby',
    geojson: 'json',
    gif: 'image',
    go: 'go',
    gql: 'graphql',
    graphql: 'graphql',
    gz: 'zip',
    h: 'c',
    hcl: 'terraform',
    heic: 'image',
    hh: 'c',
    hpp: 'c',
    htm: 'html',
    html: 'html',
    hxx: 'c',
    icns: 'image',
    ico: 'image',
    ini: 'text',
    inl: 'c',
    ipynb: 'python',
    jar: 'zip',
    jpeg: 'image',
    jpg: 'image',
    js: 'javascript',
    json: 'json',
    json5: 'json',
    jsonc: 'json',
    jsonl: 'json',
    jsx: 'react',
    ksh: 'bash',
    less: 'css',
    log: 'text',
    m: 'c',
    markdown: 'markdown',
    mcp: 'mcp',
    md: 'markdown',
    mdx: 'markdown',
    'mdx.tsx': 'markdown',
    mjs: 'javascript',
    mm: 'c',
    mts: 'typescript',
    ndjson: 'json',
    ods: 'table',
    otf: 'font',
    parquet: 'table',
    pcss: 'css',
    plist: 'html',
    png: 'image',
    postcss: 'css',
    prefs: 'text',
    properties: 'text',
    ps1: 'bash',
    psd: 'image',
    psd1: 'bash',
    psm1: 'bash',
    pxd: 'python',
    py: 'python',
    pyi: 'python',
    pyw: 'python',
    pyx: 'python',
    rake: 'ruby',
    rar: 'zip',
    rb: 'ruby',
    rs: 'rust',
    rst: 'text',
    rtf: 'text',
    sass: 'sass',
    scss: 'sass',
    sh: 'bash',
    sql: 'database',
    sqlite: 'database',
    sqlite3: 'database',
    styl: 'css',
    stylus: 'css',
    svelte: 'svelte',
    svg: 'svg',
    svgz: 'svg',
    swift: 'swift',
    tar: 'zip',
    tbz2: 'zip',
    text: 'text',
    tf: 'terraform',
    tfstate: 'terraform',
    tfvars: 'terraform',
    tgz: 'zip',
    tif: 'image',
    tiff: 'image',
    ts: 'typescript',
    tsv: 'table',
    tsx: 'react',
    ttf: 'font',
    txt: 'text',
    vue: 'vue',
    war: 'zip',
    wasm: 'wasm',
    wast: 'wasm',
    wat: 'wasm',
    webmanifest: 'json',
    webp: 'image',
    woff: 'font',
    woff2: 'font',
    xhtml: 'html',
    xls: 'table',
    xlsx: 'table',
    xml: 'html',
    xsd: 'html',
    xsl: 'html',
    xslt: 'html',
    xz: 'zip',
    yaml: 'yml',
    yml: 'yml',
    zig: 'zig',
    zip: 'zip',
    zon: 'zig',
    zsh: 'bash',
    zst: 'zip'
};

// Basenames outrank extensions: package.json is a package, not generic JSON.
const FILES: Readonly<Record<string, Name>> = {
    '.bash_aliases': 'bash',
    '.bash_login': 'bash',
    '.bash_logout': 'bash',
    '.bash_profile': 'bash',
    '.dockerignore': 'docker',
    '.editorconfig': 'text',
    '.eslintignore': 'eslint',
    '.gitattributes': 'git',
    '.gitconfig': 'git',
    '.gitignore': 'git',
    '.gitkeep': 'git',
    '.gitmessage': 'git',
    '.gitmodules': 'git',
    '.mcp.json': 'mcp',
    '.node-version': 'text',
    '.npmignore': 'npm',
    '.nvmrc': 'text',
    '.pnpmfile.cjs': 'pnpm',
    '.prettierignore': 'prettier',
    '.profile': 'bash',
    '.python-version': 'python',
    '.ruby-version': 'ruby',
    '.stylelintignore': 'stylelint',
    '.terraform.lock.hcl': 'terraform',
    '.tool-versions': 'text',
    '.watchmanconfig': 'json',
    '.zlogin': 'bash',
    '.zlogout': 'bash',
    '.zprofile': 'bash',
    '.zshenv': 'bash',
    'agents.md': 'agents',
    authors: 'text',
    'biome.json': 'biome',
    'biome.jsonc': 'biome',
    'bootstrap.bundle.js': 'bootstrap',
    'bootstrap.bundle.min.js': 'bootstrap',
    'bootstrap.css': 'bootstrap',
    'bootstrap.js': 'bootstrap',
    'bootstrap.min.css': 'bootstrap',
    'bootstrap.min.js': 'bootstrap',
    browserslist: 'browserslist',
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'bunfig.toml': 'bun',
    'cargo.lock': 'rust',
    'cargo.toml': 'rust',
    changelog: 'text',
    changes: 'text',
    'claude.md': 'claude',
    'compose.yaml': 'docker',
    'compose.yml': 'docker',
    'composer.lock': 'json',
    containerfile: 'docker',
    contributors: 'text',
    'copilot-instructions.md': 'agents',
    copying: 'text',
    dockerfile: 'docker',
    'gemini.md': 'agents',
    gemfile: 'ruby',
    'gemfile.lock': 'ruby',
    'go.mod': 'go',
    'go.sum': 'go',
    'go.work': 'go',
    'go.work.sum': 'go',
    licence: 'text',
    license: 'text',
    'mcp.json': 'mcp',
    notice: 'text',
    'npm-shrinkwrap.json': 'npm',
    'oxlint.json': 'oxc',
    'package-lock.json': 'npm',
    'package.json': 'package',
    pipfile: 'python',
    'pipfile.lock': 'python',
    'pnpm-lock.yaml': 'pnpm',
    'pnpm-workspace.yaml': 'pnpm',
    'poetry.lock': 'python',
    'pyproject.toml': 'python',
    rakefile: 'ruby',
    readme: 'readme',
    'readme.markdown': 'readme',
    'readme.md': 'readme',
    'readme.mdx': 'readme',
    'requirements.txt': 'python',
    'setup.cfg': 'python',
    'setup.py': 'python',
    'uv.lock': 'python',
    'webpack.config.babel.js': 'webpack'
};

const FOLDERS = [
    'assets', 'components', 'docs', 'git', 'output', 'packages', 'public', 'scripts', 'src', 'test'
] as const;

const NAMED: Readonly<Record<string, Folder>> = {
    '.git': 'git',
    '.githooks': 'git',
    '.github': 'git',
    '.gitlab': 'git',
    '.next': 'output',
    '.nuxt': 'output',
    '.output': 'output',
    __mocks__: 'test',
    __snapshots__: 'test',
    __tests__: 'test',
    app: 'src',
    apps: 'src',
    assets: 'assets',
    audio: 'assets',
    bin: 'scripts',
    build: 'output',
    component: 'components',
    components: 'components',
    coverage: 'test',
    cypress: 'test',
    dependencies: 'packages',
    deps: 'packages',
    dist: 'output',
    doc: 'docs',
    docs: 'docs',
    documentation: 'docs',
    e2e: 'test',
    fixtures: 'test',
    font: 'assets',
    fonts: 'assets',
    icons: 'assets',
    images: 'assets',
    img: 'assets',
    lib: 'src',
    libs: 'src',
    media: 'assets',
    music: 'assets',
    node_modules: 'packages',
    out: 'output',
    output: 'output',
    packages: 'packages',
    public: 'public',
    resources: 'assets',
    script: 'scripts',
    scripts: 'scripts',
    sounds: 'assets',
    source: 'src',
    sources: 'src',
    spec: 'test',
    specs: 'test',
    src: 'src',
    static: 'assets',
    target: 'output',
    test: 'test',
    testing: 'test',
    tests: 'test',
    tooling: 'scripts',
    tools: 'scripts',
    vendor: 'packages',
    video: 'assets',
    videos: 'assets',
    widgets: 'components',
    wiki: 'docs',
    www: 'public'
};

const NAMES = [
    'agents', 'astro', 'babel', 'bash', 'biome', 'bootstrap', 'browserslist', 'bun', 'c', 'claude', 'css', 'database',
    'docker', 'eslint', 'file', 'font', 'git', 'go', 'graphql', 'html', 'image', 'javascript', 'json', 'markdown',
    'mcp', 'nextjs', 'npm', 'oxc', 'package', 'pnpm', 'postcss', 'prettier', 'python', 'react', 'readme', 'ruby',
    'rust', 'sass', 'stylelint', 'svelte', 'svg', 'svgo', 'swift', 'table', 'tailwind', 'terraform', 'text',
    'tsconfig', 'typescript', 'vite', 'vscode', 'vue', 'wasm', 'webpack', 'yml', 'zig', 'zip'
] as const;

// Families of names a table can't list, after the exact names and before the extensions.
const PATTERNS: readonly [RegExp, Name][] = [
    [/^tsconfig(?:\.[\w-]+)*\.json$/, 'tsconfig'],
    [/^\.env(?:\..+)?$|\.env$/, 'text'],
    [/^(?:containerfile|dockerfile)\.|^docker-compose(?:\..+)?\.ya?ml$/, 'docker']
];

const STANDARD = new Set<Name>([
    'bash', 'c', 'css', 'database', 'font', 'git', 'go', 'html', 'image', 'javascript', 'json', 'markdown',
    'mcp', 'python', 'ruby', 'rust', 'swift', 'table', 'text', 'typescript', 'zip'
]);

function basename(name: string) {
    return name.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()!.toLowerCase();
}

// A Map, so a name like 'constructor' doesn't find Object's.
function compile(rules: Rules<string> | undefined, extension = false) {
    let map = new Map<string, string>();

    for (let [key, value] of Object.entries(rules ?? {})) {
        key = key.trim().toLowerCase();

        if (extension) {
            key = key.replace(/^\./, '');
        }

        if (key && typeof value === 'string' && value) {
            map.set(key, value);
        }
    }

    return map;
}

function lookup<T>(table: Readonly<Record<string, T>>, key: string) {
    return Object.hasOwn(table, key) ? table[key] : undefined;
}

// Compiled once per tree, not per row. Custom rules come first, by name, then name fragment, then extension; then the
// built-in names, families and extensions the set draws. Each extension layer tries the longest first.
function resolver(options: Options = {}) {
    let contains = compile(options.byFileNameContains),
        extensions = compile(options.byFileExtension, true),
        files = compile(options.byFileName),
        folders = compile(options.byFolderName),
        set = options.set ?? 'complete';

    function drawn(name: Name | undefined) {
        return name !== undefined && set !== 'minimal' && (set === 'complete' || STANDARD.has(name)) ? name : undefined;
    }

    function target(value: string, kinds: readonly string[], prefix = ''): Resolved {
        return kinds.includes(value) ? { name: prefix + value } : { custom: true, name: value };
    }

    return (element: Element): Resolved => {
        let name = basename(element.name);

        if (element.type ? element.type === 'folder' : Array.isArray(element.children)) {
            let custom = folders.get(name);

            if (custom !== undefined) {
                return target(custom, FOLDERS, 'folder-');
            }

            let named = set === 'minimal' ? undefined : lookup(NAMED, name);

            return { name: named ? `folder-${named}` : 'folder' };
        }

        let candidates: string[] = [];

        // No extension on a bare hidden file, nor on a name ending with a dot. '.config.json' still has JSON.
        for (let at = name.indexOf('.', 1); at !== -1 && at < name.length - 1; at = name.indexOf('.', at + 1)) {
            candidates.push(name.slice(at + 1));
        }

        let custom = files.get(name);

        for (let [needle, value] of contains) {
            if (custom === undefined && name.includes(needle)) {
                custom = value;
            }
        }

        for (let candidate of candidates) {
            custom ??= extensions.get(candidate);
        }

        if (custom !== undefined) {
            return target(custom, NAMES);
        }

        let config = CONFIG.exec(name),
            kind = drawn(lookup(FILES, name)) ?? drawn(config ? lookup(CONFIGS, config[1] ?? config[2]) : undefined);

        for (let [pattern, value] of PATTERNS) {
            if (kind === undefined && pattern.test(name)) {
                kind = drawn(value);
            }
        }

        for (let candidate of candidates) {
            let basic = set === 'standard' ? lookup(BASIC, candidate) : undefined;

            kind ??= drawn(basic ?? lookup(EXTENSIONS, candidate));
        }

        return { name: kind ?? 'file' };
    };
}


const resolve = resolver();


export { FOLDERS, NAMES, resolve, resolver };
export type { Folder, Interface, Name, Options, Resolved, Tier };
