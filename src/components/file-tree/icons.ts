// Authored stroke geometry in the library's 16px tree icon style. Semantic glyphs and monograms, not vendored
// brand artwork. Shared paths keep the complete mapping small and independent of the DOM and template compiler.
const SHAPES = {
    archive: 'M3 2.5h10v11H3ZM7 2.5v2h2v2H7v2h2v2H7v2h2',
    audio: 'M6 11V4l7-1v7M6 6l7-1M6 11a2 1.5 0 1 1-4 0 2 1.5 0 0 1 4 0M13 10a2 1.5 0 1 1-4 0 2 1.5 0 0 1 4 0',
    book: 'M8 4C6 2.5 3.5 2.5 1.5 3v9c2-.5 4.5-.5 6.5 1 2-1.5 4.5-1.5 6.5-1V3c-2-.5-4.5-.5-6.5 1ZM8 4v9',
    box: 'M2 4.5l6-3 6 3v7l-6 3-6-3ZM2 4.5l6 3 6-3M8 7.5v7M5 3l6 3',
    braces: 'M6 2.5H4.5v4L3 8l1.5 1.5v4H6M10 2.5h1.5v4L13 8l-1.5 1.5v4H10',
    check: 'M2.5 8l3.5 3.5 7.5-8M2.5 13.5h11',
    chip: 'M4 4h8v8H4ZM6 6h4v4H6ZM6 1.5V4M10 1.5V4M6 12v2.5M10 12v2.5M1.5 6H4M1.5 10H4M12 6h2.5M12 10h2.5',
    code: 'M5 4L1.5 8 5 12M11 4l3.5 4-3.5 4M9.5 2.5l-3 11',
    config: 'M2 4h12M2 8h12M2 12h12M5 2.5v3M11 6.5v3M7 10.5v3',
    database: 'M2.5 4c0-3 11-3 11 0s-11 3-11 0ZM2.5 4v8c0 3 11 3 11 0V4M2.5 8c0 3 11 3 11 0',
    diamond: 'M4 2.5h8l3 4-7 8-7-8ZM1 6.5h14M4 2.5l4 12 4-12',
    document: 'M3 2h6l4 4v8H3ZM9 2v4h4M5 9h6M5 11.5h4',
    environment: 'M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3M6 8h4M8 6v4',
    font: 'M2 13L6 3l4 10M3.5 9h5M10 8h4M12 8v5',
    git: 'M4 4v8M4 6h5c2 0 3 1 3 3M4 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M4 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M12 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
    graph: 'M8 2l6 3.5v5L8 14l-6-3.5v-5ZM8 2l-6 8.5h12ZM2 5.5l6 8.5 6-8.5',
    image: 'M2 2.5h12v11H2ZM2 11l4-4 3 3 2-2 3 3M11 4.5h.01',
    key: 'M7.5 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM7.5 6H14M11 6v3M13.5 6v2',
    layers: 'M8 2l6 3-6 3-6-3ZM2 8l6 3 6-3M2 11l6 3 6-3',
    lint: 'M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7ZM5.5 8l2 2 3.5-4',
    lock: 'M4 7h8v7H4ZM5.5 7V4a2.5 2.5 0 0 1 5 0v3M8 10v1.5',
    markdown: 'M1.5 3h13v10h-13ZM4 10V6l2 2 2-2v4M11.5 6v4M10 8.5l1.5 1.5L13 8.5',
    network: 'M8 1.5v5M3 11V8h10v3M8 6.5V11M1.5 11h3v3h-3ZM6.5 11h3v3h-3ZM11.5 11h3v3h-3Z',
    notebook: 'M4 2h9v12H4ZM2 4h3M2 7h3M2 10h3M7 5h3M7 8h3',
    pdf: 'M3 2h6l4 4v8H3ZM9 2v4h4M5 11c3-2 3-5 2-5s-1 4 4 5',
    play: 'M2 3h12v10H2ZM6 5.5l4 2.5-4 2.5Z',
    robot: 'M3 5h10v8H3ZM8 2v3M6 8h.01M10 8h.01M6 11h4M1 8v2M15 8v2',
    rocket: 'M5 11C4 6 8 2 13 2c0 5-4 9-9 8ZM6 6H3l-1 4h3M9 10v3l-4 1v-3M3 12l-1 2M10 5h.01',
    shield: 'M8 1.5l5.5 2v5c0 3-3 5-5.5 6-2.5-1-5.5-3-5.5-6v-5ZM5.5 8l2 2 3-4',
    sparkle: 'M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z',
    styles: 'M3 2.5h10l-1.5 11-3.5 1-3.5-1ZM5.5 6h5l-1 5-2 .5-2-.5',
    table: 'M2 2.5h12v11H2ZM2 6h12M6 2.5v11M10 6v7.5M2 10h12',
    terminal: 'M2 3h12v10H2ZM4 6l2 2-2 2M8 10h3',
    test: 'M5.5 2h5M6.5 2v4L3 12c-.5 1 .5 2 1.5 2h7c1 0 2-1 1.5-2L9.5 6V2M5 9h6',
    text: 'M3 3h10M3 6.5h10M3 10h10M3 13h6',
    wave: 'M1.5 6c2-5 4 5 6.5 0s4 5 6.5 0M1.5 11c2-5 4 5 6.5 0s4 5 6.5 0',
    yaml: 'M3 3h.01M6 3h7M5 7h.01M8 7h5M3 11h.01M6 11h7'
} as const;

// Small stroke monograms distinguish languages without relying on fonts.
const LETTERS = {
    B: 'M0 8V2h2c3 0 3 3 0 3H0h2c3 0 3 3 0 3Z', C: 'M4 2H1v6h3',
    D: 'M0 8V2h2l2 2v2L2 8Z', E: 'M4 2H0v6h4M0 5h3', F: 'M4 2H0v6M0 5h3',
    G: 'M4 2H0v6h4V5H2', H: 'M0 2v6M4 2v6M0 5h4', J: 'M4 2v6H1L0 7',
    K: 'M0 2v6M4 2L0 5l4 3', L: 'M0 2v6h4', M: 'M0 8V2l2 3 2-3v6',
    N: 'M0 8V2l4 6V2', O: 'M0 2h4v6H0Z', P: 'M0 8V2h4v3H0',
    R: 'M0 8V2h4v3H0M2 5l2 3', S: 'M4 2H0v3h4v3H0', T: 'M0 2h4M2 2v6',
    U: 'M0 2v6h4V2', V: 'M0 2l2 6 2-6', W: 'M0 2v6l2-3 2 3V2',
    X: 'M0 2l4 6M4 2L0 8', Y: 'M0 2l2 3 2-3M2 5v3', Z: 'M0 2h4L0 8h4',
    '+': 'M0 5h4M2 3v4', '#': 'M1 2v6M3 2v6M0 4h4M0 6h4'
} as const;

type Color = 'blue' | 'cyan' | 'green' | 'grey' | 'orange' | 'purple' | 'red' | 'yellow';
type Glyph = { color?: Color; path: string; letters?: readonly string[] };

function shape(path: keyof typeof SHAPES, color?: Color): Glyph {
    return { color, path: SHAPES[path] };
}

function language(letters: readonly (keyof typeof LETTERS)[], color: Color): Glyph {
    return { color, path: 'M1 1.5h14v13H1Z', letters: letters.map((letter) => LETTERS[letter]) };
}

const GLYPHS = {
    file: { path: 'M3 2h6l4 4v8H3ZM9 2v4h4' },
    archive: shape('archive', 'orange'), audio: shape('audio', 'purple'), book: shape('book', 'blue'),
    code: shape('code', 'blue'), config: shape('config', 'grey'), database: shape('database', 'yellow'),
    document: shape('document', 'blue'), environment: shape('environment', 'yellow'), font: shape('font', 'red'),
    git: shape('git', 'orange'), graphql: shape('graph', 'purple'), html: shape('code', 'orange'),
    image: shape('image', 'purple'), json: shape('braces', 'yellow'), key: shape('key', 'yellow'),
    layers: shape('layers', 'purple'), license: shape('shield', 'yellow'), lock: shape('lock', 'yellow'),
    markdown: shape('markdown', 'blue'), network: shape('network', 'green'), notebook: shape('notebook', 'orange'),
    package: shape('box', 'red'), pdf: shape('pdf', 'red'), shell: shape('terminal', 'green'),
    styles: shape('styles', 'blue'), table: shape('table', 'green'), test: shape('test', 'green'),
    text: shape('text', 'grey'), video: shape('play', 'purple'), wasm: shape('chip', 'purple'), yaml: shape('yaml', 'purple'),
    agents: shape('robot', 'purple'), astro: shape('sparkle', 'orange'), babel: language(['B', 'B'], 'yellow'),
    biome: shape('layers', 'cyan'), bootstrap: language(['B'], 'purple'), browserslist: shape('network', 'blue'), bun: language(['B', 'N'], 'orange'),
    clang: shape('config', 'blue'), cmake: shape('layers', 'blue'), deno: language(['D', 'N'], 'grey'),
    docker: shape('box', 'blue'), eslint: shape('lint', 'purple'), mcp: shape('network', 'cyan'),
    next: language(['N'], 'grey'), npm: language(['N', 'P'], 'red'), nuxt: language(['N', 'X'], 'green'),
    oxc: shape('check', 'orange'), pnpm: shape('box', 'orange'), postcss: shape('styles', 'red'),
    prettier: shape('text', 'orange'), react: shape('graph', 'cyan'), sass: shape('styles', 'purple'),
    stylelint: shape('lint', 'blue'), svelte: language(['S', 'V'], 'orange'), svg: shape('diamond', 'orange'),
    tailwind: shape('wave', 'cyan'), terraform: shape('layers', 'purple'), typescriptConfig: shape('config', 'blue'),
    vite: shape('rocket', 'purple'), vscode: shape('code', 'blue'), vue: language(['V'], 'green'),
    webpack: shape('box', 'cyan'), yarn: language(['Y', 'N'], 'blue'),
    c: language(['C'], 'blue'), cpp: language(['C', '+'], 'blue'), csharp: language(['C', '#'], 'purple'),
    clojure: language(['C', 'L'], 'green'), dart: language(['D', 'T'], 'cyan'), elixir: language(['E', 'X'], 'purple'),
    erlang: language(['E', 'R'], 'red'), fortran: language(['F'], 'purple'), go: language(['G', 'O'], 'cyan'),
    groovy: language(['G', 'R'], 'blue'), haskell: language(['H', 'S'], 'purple'), java: language(['J', 'V'], 'orange'),
    javascript: language(['J', 'S'], 'yellow'), kotlin: language(['K', 'T'], 'purple'), lua: language(['L', 'U'], 'blue'),
    objectivec: language(['O', 'C'], 'blue'), perl: language(['P', 'L'], 'blue'), php: language(['P', 'H'], 'purple'),
    powershell: language(['P', 'S'], 'blue'), python: language(['P', 'Y'], 'yellow'), r: language(['R'], 'blue'),
    ruby: shape('diamond', 'red'), rust: language(['R', 'S'], 'orange'), scala: language(['S', 'C'], 'red'),
    solidity: language(['S', 'L'], 'grey'), swift: language(['S', 'W'], 'orange'), toml: language(['T', 'M'], 'orange'),
    typescript: language(['T', 'S'], 'blue'), zig: language(['Z'], 'orange')
} as const satisfies Record<string, Glyph>;

type Name = keyof typeof GLYPHS;
type Element = { name: string; type?: 'file' | 'folder'; children?: unknown[] };
type Options = {
    colored?: boolean;
    byFileName?: Readonly<Record<string, Name>>;
    // Keys may start with a dot. Compound extensions take precedence over shorter ones.
    byFileExtension?: Readonly<Record<string, Name>>;
    byFolderName?: Readonly<Record<string, Name>>;
};
type Resolved = Glyph & { name: string; badge?: Glyph; custom?: boolean };

const FILES = new Map<string, Name>();
const EXTENSIONS = new Map<string, Name>();
const FOLDERS = new Map<string, Name>();

function add(map: Map<string, Name>, glyph: Name, names: string) {
    for (let name of names.split(' ')) {
        map.set(name, glyph);
    }
}

// Basenames outrank suffixes: package.json is a package, not generic JSON. Extensionless and dot files belong
// here too. Case folding is deliberate, matching the existing named folder behavior.
add(FILES, 'agents', 'agents.md claude.md gemini.md copilot-instructions.md');
add(FILES, 'book', 'readme readme.md readme.markdown readme.txt contributing.md code_of_conduct.md');
add(FILES, 'text', 'authors contributors changelog changelog.md changes notice');
add(FILES, 'license', 'license licence license.md license.txt licence.md licence.txt copying copying.txt');
add(FILES, 'git', '.gitignore .gitattributes .gitmodules .gitkeep .gitconfig .gitmessage');
add(FILES, 'config', '.editorconfig .npmrc .yarnrc .yarnrc.yml .nvmrc .node-version .python-version .tool-versions .browserslistrc browserslist .watchmanconfig');
add(FILES, 'browserslist', '.browserslistrc browserslist');
add(FILES, 'package', 'package.json package-lock.json npm-shrinkwrap.json composer.json composer.lock cargo.toml cargo.lock pyproject.toml poetry.lock pipfile pipfile.lock uv.lock requirements.txt setup.py setup.cfg');
add(FILES, 'npm', '.npmignore');
add(FILES, 'pnpm', 'pnpm-lock.yaml pnpm-workspace.yaml');
add(FILES, 'yarn', 'yarn.lock');
add(FILES, 'bun', 'bun.lock bun.lockb bunfig.toml');
add(FILES, 'deno', 'deno.json deno.jsonc deno.lock');
add(FILES, 'docker', 'dockerfile containerfile .dockerignore compose.yaml compose.yml docker-compose.yml docker-compose.yaml docker-compose.override.yml docker-compose.override.yaml');
add(FILES, 'shell', '.bashrc .bash_profile .bash_login .bash_logout .profile .zshrc .zshenv .zprofile .zlogin .zlogout .bash_aliases');
add(FILES, 'ruby', 'gemfile gemfile.lock rakefile .ruby-version');
add(FILES, 'go', 'go.mod go.sum go.work go.work.sum');
add(FILES, 'cmake', 'cmakelists.txt cmakepresets.json cmakeuserpresets.json');
add(FILES, 'config', 'makefile gnumakefile justfile procfile .htaccess .htpasswd');
add(FILES, 'clang', '.clang-format .clang-tidy');
add(FILES, 'biome', 'biome.json biome.jsonc');
add(FILES, 'oxc', '.oxlintrc.json oxlint.json');
add(FILES, 'mcp', '.mcp.json mcp.json');
add(FILES, 'terraform', '.terraform.lock.hcl');
add(FILES, 'test', '.nycrc .nycrc.json .mocharc.json .mocharc.yml .mocharc.yaml');
add(FILES, 'environment', '.env');

const CONFIG_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'json', 'jsonc', 'yaml', 'yml', 'toml'];
for (let [tool, glyph] of [
    ['astro', 'astro'], ['babel', 'babel'], ['eslint', 'eslint'], ['next', 'next'], ['nuxt', 'nuxt'],
    ['postcss', 'postcss'], ['prettier', 'prettier'], ['rollup', 'package'], ['stylelint', 'stylelint'],
    ['svelte', 'svelte'], ['svgo', 'svg'], ['tailwind', 'tailwind'], ['vite', 'vite'], ['vitest', 'test'],
    ['jest', 'test'], ['playwright', 'test'], ['cypress', 'test'], ['webpack', 'webpack']
] as const) {
    for (let extension of CONFIG_EXTENSIONS) {
        FILES.set(`${tool}.config.${extension}`, glyph);
        FILES.set(`.${tool}rc.${extension}`, glyph);
    }
    FILES.set(`.${tool}rc`, glyph);
}
add(FILES, 'eslint', '.eslintignore');
add(FILES, 'prettier', '.prettierignore');
add(FILES, 'stylelint', '.stylelintignore');
add(FILES, 'webpack', 'webpack.config.babel.js');
add(FILES, 'bootstrap', 'bootstrap.js bootstrap.min.js bootstrap.bundle.js bootstrap.bundle.min.js bootstrap.css bootstrap.min.css');

add(EXTENSIONS, 'javascript', 'js mjs cjs es6');
add(EXTENSIONS, 'typescript', 'ts mts cts d.ts d.mts d.cts');
add(EXTENSIONS, 'react', 'jsx tsx');
add(EXTENSIONS, 'markdown', 'md markdown mdx mdx.tsx');
add(EXTENSIONS, 'vue', 'vue');
add(EXTENSIONS, 'svelte', 'svelte');
add(EXTENSIONS, 'astro', 'astro');
add(EXTENSIONS, 'styles', 'css less styl stylus pcss postcss');
add(EXTENSIONS, 'sass', 'scss sass');
add(EXTENSIONS, 'html', 'html htm xhtml xml xsl xslt xsd dtd plist');
add(EXTENSIONS, 'json', 'json jsonc json5 jsonl ndjson geojson webmanifest');
add(EXTENSIONS, 'yaml', 'yaml yml');
add(EXTENSIONS, 'toml', 'toml');
add(EXTENSIONS, 'config', 'ini cfg conf config properties prefs');
add(EXTENSIONS, 'shell', 'sh bash zsh fish csh ksh bat cmd');
add(EXTENSIONS, 'powershell', 'ps1 psm1 psd1');
add(EXTENSIONS, 'python', 'py pyi pyw pyx pxd');
add(EXTENSIONS, 'notebook', 'ipynb');
add(EXTENSIONS, 'ruby', 'rb erb rake gemspec');
add(EXTENSIONS, 'rust', 'rs');
add(EXTENSIONS, 'go', 'go');
add(EXTENSIONS, 'c', 'c h');
add(EXTENSIONS, 'cpp', 'cpp cc cxx c++ hpp hh hxx inl mm');
add(EXTENSIONS, 'objectivec', 'm');
add(EXTENSIONS, 'csharp', 'cs csx csproj sln');
add(EXTENSIONS, 'java', 'java class');
add(EXTENSIONS, 'kotlin', 'kt kts');
add(EXTENSIONS, 'swift', 'swift');
add(EXTENSIONS, 'dart', 'dart');
add(EXTENSIONS, 'php', 'php phtml');
add(EXTENSIONS, 'perl', 'pl pm');
add(EXTENSIONS, 'lua', 'lua');
add(EXTENSIONS, 'r', 'r rmd');
add(EXTENSIONS, 'scala', 'scala sc');
add(EXTENSIONS, 'clojure', 'clj cljs cljc edn');
add(EXTENSIONS, 'haskell', 'hs lhs');
add(EXTENSIONS, 'elixir', 'ex exs');
add(EXTENSIONS, 'erlang', 'erl hrl');
add(EXTENSIONS, 'groovy', 'groovy gradle');
add(EXTENSIONS, 'fortran', 'f f90 f95 for f03');
add(EXTENSIONS, 'zig', 'zig zon');
add(EXTENSIONS, 'solidity', 'sol');
add(EXTENSIONS, 'database', 'sql db sqlite sqlite3');
add(EXTENSIONS, 'graphql', 'graphql gql');
add(EXTENSIONS, 'terraform', 'tf tfvars tfstate hcl');
add(EXTENSIONS, 'wasm', 'wasm wat wast');
add(EXTENSIONS, 'mcp', 'mcp');
add(EXTENSIONS, 'vscode', 'code-workspace');
add(EXTENSIONS, 'cmake', 'cmake');
add(EXTENSIONS, 'image', 'png jpg jpeg gif webp avif bmp ico icns tif tiff heic psd');
add(EXTENSIONS, 'svg', 'svg svgz');
add(EXTENSIONS, 'audio', 'mp3 wav ogg flac aac m4a opus aiff');
add(EXTENSIONS, 'video', 'mp4 webm mov avi mkv m4v');
add(EXTENSIONS, 'font', 'woff woff2 ttf otf eot');
add(EXTENSIONS, 'archive', 'zip gz bz2 xz zst tar tgz tbz2 7z rar jar war tar.gz tar.bz2 tar.xz tar.zst');
add(EXTENSIONS, 'table', 'csv tsv xls xlsx ods parquet');
add(EXTENSIONS, 'pdf', 'pdf');
add(EXTENSIONS, 'document', 'doc docx odt rtf');
add(EXTENSIONS, 'text', 'txt text log rst adoc');
add(EXTENSIONS, 'lock', 'lock');
add(EXTENSIONS, 'key', 'pem key crt cer p12 pfx');

add(FOLDERS, 'git', '.git .github .gitlab .githooks');
add(FOLDERS, 'test', '__tests__ __mocks__ __snapshots__ test tests spec specs testing coverage e2e cypress fixtures');
add(FOLDERS, 'image', 'assets images img media static resources');
add(FOLDERS, 'shell', 'bin script scripts tools tooling');
add(FOLDERS, 'archive', 'build dist out output target .next .nuxt .output');
add(FOLDERS, 'layers', 'components component widgets');
add(FOLDERS, 'book', 'doc docs documentation wiki');
add(FOLDERS, 'package', 'node_modules packages vendor deps dependencies');
add(FOLDERS, 'network', 'public www');
add(FOLDERS, 'code', 'src source sources lib libs app apps');
add(FOLDERS, 'config', '.config config configs configuration settings');
add(FOLDERS, 'vscode', '.vscode .idea');
add(FOLDERS, 'styles', 'styles style css scss sass themes');
add(FOLDERS, 'font', 'fonts font');
add(FOLDERS, 'audio', 'audio sounds music');
add(FOLDERS, 'video', 'videos video');
add(FOLDERS, 'database', 'data database databases db migrations prisma');
add(FOLDERS, 'network', 'api apis routes router controllers server servers');
add(FOLDERS, 'lock', 'auth security certs certificates .ssh');
add(FOLDERS, 'agents', '.claude .codex .agents');
add(FOLDERS, 'docker', 'docker containers .devcontainer');
add(FOLDERS, 'terraform', 'terraform infrastructure infra');
add(FOLDERS, 'text', 'logs log');
add(FOLDERS, 'config', 'utils utilities helpers hooks composables');

function basename(name: string) {
    return name.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()!.toLowerCase();
}

function overrides(rules: Readonly<Record<string, Name>> | undefined, extension = false) {
    let map = new Map<string, Name>();

    for (let [key, value] of Object.entries(rules ?? {})) {
        // Guard JavaScript consumers as well as TypeScript callers; prototype names are never glyphs.
        if (!Object.hasOwn(GLYPHS, value)) {
            continue;
        }

        key = key.trim().toLowerCase();

        if (extension) {
            key = key.replace(/^\./, '');
        }

        if (key) {
            map.set(key, value);
        }
    }

    return map;
}

// Compile custom rules once per tree, not once per row. Ordering is: custom filename, custom extension, built-in
// filename, built-in filename family, built-in extension, generic. Each extension layer tries longest first.
function resolver(options: Options = {}) {
    let files = overrides(options.byFileName),
        extensions = overrides(options.byFileExtension, true),
        folders = overrides(options.byFolderName),
        colored = options.colored !== false;

    function glyph(name: Name): Glyph {
        let glyph: Glyph = GLYPHS[name];

        return colored ? glyph : { ...glyph, color: undefined };
    }

    return (element: Element, open = false): Resolved => {
        let name = basename(element.name);

        if (element.type ? element.type === 'folder' : Array.isArray(element.children)) {
            let custom = folders.get(name),
                kind = custom ?? FOLDERS.get(name),
                badge = kind && glyph(kind);

            return {
                name: kind ? `folder-${kind}` : 'folder',
                color: badge?.color,
                custom: custom !== undefined,
                path: badge
                    ? (open ? 'M2 11V4.5h4l1.5 1.5H13v1M7 13H2l2-5h10' : 'M14 7V5.5H7.5L6 4H2v9h5')
                    : (open ? 'M2 11V4.5h4l1.5 1.5H13v1M2 11l2-3h10l-2 5H2Z' : 'M2 4h4l1.5 1.5H14V13H2Z'),
                badge: badge || undefined
            };
        }

        let kind = files.get(name),
            candidates: string[] = [];

        // No extension on a bare hidden file, nor on a name ending with a dot. '.config.json' still has JSON.
        for (let at = name.indexOf('.', 1); at !== -1 && at < name.length - 1; at = name.indexOf('.', at + 1)) {
            candidates.push(name.slice(at + 1));
        }

        for (let candidate of candidates) {
            kind ??= extensions.get(candidate);
        }

        kind ??= FILES.get(name);

        if (!kind) {
            if (/^tsconfig(?:\.[\w-]+)*\.json$/.test(name) || /^jsconfig(?:\.[\w-]+)*\.json$/.test(name)) {
                kind = 'typescriptConfig';
            }
            else if (name.startsWith('.env.') || name.endsWith('.env')) {
                kind = 'environment';
            }
            else if (/^(?:dockerfile|containerfile)\./.test(name) || /^docker-compose\..+\.ya?ml$/.test(name)) {
                kind = 'docker';
            }
        }

        for (let candidate of candidates) {
            kind ??= EXTENSIONS.get(candidate);
        }

        kind ??= 'file';

        return { ...glyph(kind), name: kind };
    };
}

const resolve = resolver();

export { resolver, resolve };
export type { Color, Glyph, Name, Options, Resolved };
