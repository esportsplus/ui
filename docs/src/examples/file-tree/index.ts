import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { fileTree, FileTreeDecorations, FileTreeEditor, FileTreeElements, FileTreeHistory, icon, input, select, switch as toggle } from '@esportsplus/ui/components';
import symlink from '@esportsplus/ui/svg/corner-down-right.svg';
import lock from '@esportsplus/ui/svg/lock.svg';
import type {
    FileTreeController,
    FileTreeElement,
    FileTreeHistoryOperation,
    FileTreeKind,
    FileTreeSnapshot,
    FileTreeSortCase,
    FileTreeSortOrder
} from '@esportsplus/ui/components/file-tree';
import 'docs/examples/file-tree/scss/index.scss';


type Legend = {
    label: string;
    // Built per render, since a rendered sample can't be shown in two places at once.
    sample: () => Renderable<unknown>;
};


const FILE_EXTENSION = /(\.[^.]*)?$/;

const TEST_PATH = /^tests(\/|$)/;

const EXECUTABLE_EXTENSION = /\.exe$/i;


const CASES: FileTreeSortCase[] = ['insensitive', 'upper', 'lower'];

const ELEMENTS: FileTreeElement[] = [
    {
        children: [
            {
                children: [{ id: 'utils', name: 'utils.ts' }],
                id: 'lib',
                name: 'lib',
                type: 'folder'
            },
            {
                children: [
                    { id: 'page', name: 'page.tsx' },
                    { id: 'layout', name: 'layout.tsx' }
                ],
                id: 'app',
                name: 'app',
                type: 'folder'
            },
            {
                children: [
                    { id: 'header', name: 'header.tsx' },
                    {
                        children: [{ id: 'button', name: 'button.tsx' }],
                        id: 'ui',
                        name: 'ui',
                        type: 'folder'
                    },
                    { id: 'footer', name: 'footer.tsx' }
                ],
                id: 'components',
                name: 'components',
                type: 'folder'
            }
        ],
        id: 'src',
        name: 'src',
        type: 'folder'
    }
];


const EXCLUDE = ['**/node_modules', '**/*.log'];

// Samples drawn with the tree's own markup and tones, so the legend reads exactly as the rows do.
const LEGEND: { entries: Legend[]; title: string }[] = [
    {
        entries: [
            letter('U', 'Untracked', 'added'),
            letter('A', 'Added', 'added'),
            letter('M', 'Modified', 'modified'),
            letter('D', 'Deleted', 'deleted'),
            letter('R', 'Renamed', 'added'),
            letter('!', 'Conflict', 'conflict'),
            letter('S', 'Submodule', 'submodule'),
            letter('M', 'Staged; beside the unstaged letter when both', 'modified', { staged: true })
        ],
        title: 'Git letters'
    },
    {
        entries: [
            letter('+12', 'Lines added; folders total their contents', 'additions'),
            letter('−9', 'Lines removed', 'deletions'),
            letter('64%', 'Custom badge, in its own color', undefined, { color: 'var(--color-purple-400)' })
        ],
        title: 'Counts and badges'
    },
    {
        entries: [
            letter('●', 'Folder: errors inside', 'error'),
            letter('●', 'Folder: conflicts inside', 'conflict'),
            letter('●', 'Folder: warnings inside', 'warning'),
            letter('●', 'Folder: changes inside, deletions too', 'modified'),
            letter('●', 'Folder: only new files inside', 'added'),
            letter('●', 'Unsaved in the editor', 'unsaved'),
            letter('○', 'Open in the editor', 'open'),
            marker(symlink, 'Symbolic link'),
            marker(lock, 'Read-only')
        ],
        title: 'Dots and markers'
    },
    {
        entries: [
            tint('error', 'Errors'),
            tint('conflict', 'Conflict'),
            tint('deleted', 'Deleted, when shown'),
            tint('warning', 'Warnings'),
            tint('modified', 'Modified'),
            tint('added', 'Untracked or added'),
            tint('ignored', 'Ignored by git')
        ],
        title: 'Name colors, most severe first'
    }
];

const LOCKED: FileTreeElement[] = [
    {
        children: [
            { id: 'readme', name: 'README.md' },
            { id: 'env', name: '.env.production', selectable: false },
            { id: 'file10', name: 'file10.ts' },
            { id: 'file2', name: 'file2.ts' },
            { children: [{ id: 'key', name: 'private.key' }], id: 'secrets', name: 'secrets', selectable: false, type: 'folder' },
            { children: [{ id: 'logo', name: 'logo.svg' }], id: 'assets', name: 'assets', type: 'folder' }
        ],
        id: 'project',
        name: 'project',
        type: 'folder'
    }
];


const ORDERS: FileTreeSortOrder[] = ['folders', 'files', 'mixed', 'type', 'modified'];

// Dates are days ago, so the 'modified' order reads the same whenever the page loads.
const PROJECT: FileTreeElement[] = [
    {
        children: [{ children: [{ id: '.github/workflows/ci.yml', name: 'ci.yml' }], id: '.github/workflows', name: 'workflows', type: 'folder' }],
        id: '.github',
        name: '.github',
        type: 'folder'
    },
    { children: [{ id: 'dist/index.js', name: 'index.js' }], id: 'dist', name: 'dist', type: 'folder' },
    { children: [{ id: 'node_modules/vite/index.js', name: 'index.js' }], id: 'node_modules', name: 'node_modules', type: 'folder' },
    {
        children: [
            { id: 'src/Button.tsx', modified: ago(3), name: 'Button.tsx' },
            { id: 'src/app.tsx', modified: ago(1), name: 'app.tsx' },
            { id: 'src/file10.ts', modified: ago(9), name: 'file10.ts' },
            { id: 'src/file2.ts', modified: ago(12), name: 'file2.ts' },
            { id: 'src/index.ts', modified: ago(0.1), name: 'index.ts' },
            { id: 'src/styles.css', modified: ago(5), name: 'styles.css' },
            { id: 'src/Zebra.ts', modified: ago(30), name: 'Zebra.ts' },
            { id: 'src/éclair.ts', modified: ago(2), name: 'éclair.ts' }
        ],
        id: 'src',
        modified: ago(0.1),
        name: 'src',
        type: 'folder'
    },
    { id: '.env', modified: ago(40), name: '.env' },
    { id: '.gitignore', modified: ago(60), name: '.gitignore' },
    { id: 'debug.log', modified: ago(0.5), name: 'debug.log' },
    { id: 'package.json', modified: ago(4), name: 'package.json' },
    { id: 'README.md', modified: ago(20), name: 'README.md' }
];


// Ids are paths, as an editor would key them.
const REPOSITORY: FileTreeElement[] = [
    {
        children: [
            {
                children: [
                    { id: 'src/components/card/expand.ts', name: 'expand.ts' },
                    { id: 'src/components/card/index.ts', name: 'index.ts' }
                ],
                id: 'src/components/card',
                name: 'card',
                type: 'folder'
            },
            {
                children: [
                    { id: 'src/components/file-tree/decorations.ts', name: 'decorations.ts' },
                    { id: 'src/components/file-tree/index.ts', name: 'index.ts' },
                    { id: 'src/components/file-tree/legacy.ts', name: 'legacy.ts' }
                ],
                id: 'src/components/file-tree',
                name: 'file-tree',
                type: 'folder'
            },
            {
                children: [
                    { id: 'src/components/heatmap/index.ts', name: 'index.ts' }
                ],
                id: 'src/components/heatmap',
                name: 'heatmap',
                type: 'folder'
            },
            {
                children: [
                    { id: 'src/components/tooltip/index.ts', name: 'index.ts' },
                    { id: 'src/components/tooltip/position.ts', name: 'position.ts' }
                ],
                id: 'src/components/tooltip',
                name: 'tooltip',
                type: 'folder'
            },
            { id: 'src/components/index.ts', name: 'index.ts' }
        ],
        id: 'src/components',
        name: 'components',
        type: 'folder'
    },
    { children: [{ id: 'build/index.js', name: 'index.js' }], id: 'build', name: 'build', type: 'folder' },
    { children: [], id: 'theme', name: 'theme', type: 'folder' },
    { id: '.env', name: '.env' },
    { id: 'CLAUDE.md', name: 'CLAUDE.md', symlink: true },
    { id: 'LICENSE', name: 'LICENSE', readonly: true },
    { id: 'package.json', name: 'package.json' },
    { id: 'tsconfig.json', name: 'tsconfig.json' }
];


// Names that test a matcher: camelCase humps, snake_case, dotfiles, numbers, capitals and one long enough to cut short.
const SEARCHABLE: FileTreeElement[] = [
    {
        children: [
            {
                children: [
                    { id: '.github/workflows/ci.yml', name: 'ci.yml' },
                    { id: '.github/workflows/release-please.yml', name: 'release-please.yml' }
                ],
                id: '.github/workflows',
                name: 'workflows',
                type: 'folder'
            }
        ],
        id: '.github',
        name: '.github',
        type: 'folder'
    },
    {
        children: [
            { id: 'migrations/001_create_users.sql', name: '001_create_users.sql' },
            { id: 'migrations/002_add_session_tokens.sql', name: '002_add_session_tokens.sql' },
            { id: 'migrations/v2_backfill_file_tree_state.sql', name: 'v2_backfill_file_tree_state.sql' }
        ],
        id: 'migrations',
        name: 'migrations',
        type: 'folder'
    },
    {
        children: [
            {
                children: [
                    {
                        children: [
                            { id: 'src/components/file-tree/fileTreeUtils.ts', name: 'fileTreeUtils.ts' },
                            { id: 'src/components/file-tree/fuzzy.ts', name: 'fuzzy.ts' },
                            { id: 'src/components/file-tree/index.ts', name: 'index.ts' },
                            { id: 'src/components/file-tree/useFileTree.ts', name: 'useFileTree.ts' }
                        ],
                        id: 'src/components/file-tree',
                        name: 'file-tree',
                        type: 'folder'
                    },
                    { id: 'src/components/HTMLParser.ts', name: 'HTMLParser.ts' },
                    { id: 'src/components/navigation-drawer-with-nested-sections.tsx', name: 'navigation-drawer-with-nested-sections.tsx' },
                    { id: 'src/components/snake_case_helpers.py', name: 'snake_case_helpers.py' }
                ],
                id: 'src/components',
                name: 'components',
                type: 'folder'
            }
        ],
        id: 'src',
        name: 'src',
        type: 'folder'
    },
    {
        children: [
            { id: 'tests/file10.test.ts', name: 'file10.test.ts' },
            { id: 'tests/file2.test.ts', name: 'file2.test.ts' },
            { id: 'tests/test_fuzzy_match.py', name: 'test_fuzzy_match.py' }
        ],
        id: 'tests',
        name: 'tests',
        type: 'folder'
    },
    { id: '.env.local', name: '.env.local' },
    { id: '.eslintrc.json', name: '.eslintrc.json' },
    { id: '.gitignore', name: '.gitignore' },
    { id: 'CHANGELOG.md', name: 'CHANGELOG.md' },
    { id: 'package.json', name: 'package.json' },
    { id: 'README.md', name: 'README.md' },
    { id: 'tsconfig.json', name: 'tsconfig.json' }
];


// Well-known folder names, with sizes and dates for the tooltip.
const WORKSPACE: FileTreeElement[] = [
    { children: [{ id: '.git/HEAD', name: 'HEAD', size: 21 }], id: '.git', name: '.git', type: 'folder' },
    { children: [{ id: 'docs/guide.md', modified: Date.UTC(2026, 8, 14, 9, 30), name: 'guide.md', size: 18_432 }], id: 'docs', name: 'docs', type: 'folder' },
    { children: [{ id: 'dist/index.js', name: 'index.js', size: 1_284_096 }], id: 'dist', name: 'dist', type: 'folder' },
    { children: [{ id: 'node_modules/.bin', name: '.bin', type: 'folder' }], id: 'node_modules', name: 'node_modules', type: 'folder' },
    { children: [{ id: 'public/favicon.ico', name: 'favicon.ico', size: 4_286 }], id: 'public', name: 'public', type: 'folder' },
    { children: [{ id: 'scripts/release.ts', name: 'release.ts', size: 2_048 }], id: 'scripts', name: 'scripts', type: 'folder' },
    {
        children: [
            { children: [{ id: 'src/assets/logo.svg', name: 'logo.svg', size: 912 }], id: 'src/assets', name: 'assets', type: 'folder' },
            {
                children: [
                    { id: 'src/components/button.ts', modified: Date.UTC(2026, 8, 27, 16, 5), name: 'button.ts', size: 3_210 },
                    { id: 'src/components/navigation-drawer-with-nested-sections.ts', modified: Date.UTC(2026, 8, 25, 11, 42), name: 'navigation-drawer-with-nested-sections.ts', size: 12_800 },
                    { id: 'src/components/old-menu.ts', name: 'old-menu.ts', size: 1_530 },
                    { id: 'src/components/tabs.ts', modified: Date.UTC(2026, 8, 20, 8, 15), name: 'tabs.ts', size: 5_632 }
                ],
                id: 'src/components',
                name: 'components',
                type: 'folder'
            },
            { id: 'src/index.ts', modified: Date.UTC(2026, 8, 28, 10, 0), name: 'index.ts', size: 640 }
        ],
        id: 'src',
        name: 'src',
        type: 'folder'
    },
    {
        children: [
            { id: 'tests/button.test.ts', modified: Date.UTC(2026, 8, 27, 16, 20), name: 'button.test.ts', size: 2_710 },
            { id: 'tests/tabs.test.ts', name: 'tabs.test.ts', size: 1_998 }
        ],
        id: 'tests',
        name: 'tests',
        type: 'folder'
    },
    { id: 'package.json', modified: Date.UTC(2026, 8, 26, 13, 45), name: 'package.json', size: 1_156 }
];


// 40 packages of 250 files: 10,040 rows once expanded, of which only the few on screen are in the DOM.
const MONOREPO: FileTreeElement[] = Array.from({ length: 40 }, (_, p) => ({
    children: Array.from({ length: 250 }, (_, f) => ({ id: `package-${p}/file-${f}`, name: `file-${f}.ts` })),
    id: `package-${p}`,
    name: `package-${p}`,
    type: 'folder' as const
}));

const NESTED_FOLDERS = ['components', 'hooks', 'utils'];

// Packages, their src, folders in it, files in those: deep enough for three folders to pin at once.
const NESTED: FileTreeElement[] = Array.from({ length: 8 }, (_, p) => ({
    children: [
        {
            children: NESTED_FOLDERS.map((folder) => ({
                children: Array.from({ length: 12 }, (_, f) => ({ id: `packages/${p}/src/${folder}/${f}`, name: `${folder}-${f}.ts` })),
                id: `packages/${p}/src/${folder}`,
                name: folder,
                type: 'folder' as const
            })),
            id: `packages/${p}/src`,
            name: 'src',
            type: 'folder' as const
        },
        { id: `packages/${p}/package.json`, name: 'package.json' },
        { id: `packages/${p}/README.md`, name: 'README.md' }
    ],
    id: `packages/${p}`,
    name: `package-${p}`,
    type: 'folder' as const
}));


function ago(days: number) {
    return Date.now() - days * 86_400_000;
}

// Folders nested one in the next, 'main/java/com' under 'src', the last holding what 'children' gives for its id.
function chain(parent: string, names: string, children: (id: string) => FileTreeElement[]): FileTreeElement {
    let parts = names.split('/'),
        id = `${parent}/${names}`,
        element: FileTreeElement = { children: children(id), id, name: parts[parts.length - 1], type: 'folder' };

    for (let i = parts.length - 2; i >= 0; i--) {
        element = { children: [element], id: `${parent}/${parts.slice(0, i + 1).join('/')}`, name: parts[i], type: 'folder' };
    }

    return element;
}

// A select over 'values', each shown as itself, named by the text beside it.
function choice(label: string, values: string[], state: { active: boolean; error: string; selected?: number | string }) {
    return html`
        <div class='file-tree-demo-field'>
            <span aria-hidden='true'>${label}</span>
            ${select({ class: 'file-tree-demo-select', label, options: Object.fromEntries(values.map((value) => [value, value])), state })}
        </div>
    `;
}

// Java packages and a deep web app, with ids as paths. Fresh per render, since the store changes it in place.
function compacted(): FileTreeElement[] {
    return [
        {
            children: [chain('.github', 'workflows', (id) => [{ id: `${id}/build.yml`, name: 'build.yml' }])],
            id: '.github',
            name: '.github',
            type: 'folder'
        },
        {
            children: [
                chain('src', 'main/java/com/example/app', (id) => [
                    {
                        children: [
                            { id: `${id}/controller/HealthController.java`, name: 'HealthController.java' },
                            { id: `${id}/controller/UserController.java`, name: 'UserController.java' }
                        ],
                        id: `${id}/controller`,
                        name: 'controller',
                        type: 'folder'
                    },
                    chain(id, 'domain/user', (user) => [{ id: `${user}/User.java`, name: 'User.java' }]),
                    { id: `${id}/Application.java`, name: 'Application.java' }
                ]),
                chain('src', 'test/java/com/example/app', (id) => [{ id: `${id}/ApplicationTests.java`, name: 'ApplicationTests.java' }])
            ],
            id: 'src',
            name: 'src',
            type: 'folder'
        },
        // No children given: fetched when opened, one folder at a time.
        { id: 'vendor', name: 'vendor', type: 'folder' },
        {
            children: [
                chain('web', 'src/components', (id) => [
                    { id: `${id}/.gitkeep`, name: '.gitkeep' },
                    {
                        children: [
                            { id: `${id}/ui/button.tsx`, name: 'button.tsx' },
                            { id: `${id}/ui/dialog.tsx`, name: 'dialog.tsx' }
                        ],
                        id: `${id}/ui`,
                        name: 'ui',
                        type: 'folder'
                    }
                ])
            ],
            id: 'web',
            name: 'web',
            type: 'folder'
        },
        { id: 'pom.xml', name: 'pom.xml' },
        { id: 'README.md', name: 'README.md' }
    ];
}

// A pasted or dropped copy, named apart from what it copies.
function copy(element: FileTreeElement, uid: number): FileTreeElement {
    return { ...duplicate(element, uid), name: element.name.replace(FILE_EXTENSION, ' copy$1') };
}

function duplicate(element: FileTreeElement, uid: number): FileTreeElement {
    return {
        ...element,
        children: element.children?.map((child) => duplicate(child, uid)),
        id: `${element.id}~${uid}`
    };
}

// A switch named by the text beside it, which toggles it too.
function flag(label: string, value: () => boolean, change: (value: boolean) => void) {
    return html`
        <label class='file-tree-demo-field'>
            ${toggle({
                [toggle.input]: {
                    checked: value,
                    onchange: (event: Event) => {
                        change((event.target as HTMLInputElement).checked);
                    }
                }
            })}
            ${label}
        </label>
    `;
}

// What a history label calls them: one by name, several by count.
function items(elements: FileTreeElement[]) {
    return elements.length === 1 ? elements[0].name : `${elements.length} items`;
}

function legend() {
    return html`
        <div class='file-tree file-tree-demo-legend'>
            ${LEGEND.map((group) => html`
                <section>
                    <h4 class='file-tree-demo-legend-title'>${group.title}</h4>
                    <dl class='file-tree-demo-legend-list'>
                        ${group.entries.map((entry) => html`
                            <dt class='file-tree-demo-legend-term'>${entry.sample()}</dt>
                            <dd class='file-tree-demo-legend-description'>${entry.label}</dd>
                        `)}
                    </dl>
                </section>
            `)}
        </div>
    `;
}

// A badge part as a row draws it: the tone colors it, a staged part sits in the tinted chip.
function letter(text: string, label: string, tone?: string, options: { color?: string; staged?: boolean } = {}): Legend {
    return {
        label,
        sample: () => html`
            <span class='file-tree-badge file-tree-demo-legend-badge'>
                <span
                    class='file-tree-badge-part ${options.staged && 'file-tree-badge-part--staged'} ${tone && `file-tree-badge-part--${tone}`}'
                    ${{ style: options.color && `color: ${options.color}` }}
                >${text}</span>
            </span>
        `
    };
}

function list(elements: FileTreeElement[]) {
    return elements.map((element) => element.id).join(', ');
}

// Fresh per render, since the store changes the elements it's given in place.
function live(): FileTreeElement[] {
    return [
        {
            children: [
                { id: 'src/app.ts', name: 'app.ts' },
                { id: 'src/index.ts', name: 'index.ts' }
            ],
            id: 'src',
            name: 'src',
            type: 'folder'
        },
        { children: [], id: 'lib', name: 'lib', type: 'folder' },
        // No children given: fetched when opened.
        { id: 'remote', name: 'remote', type: 'folder' },
        { id: 'flaky', name: 'flaky', type: 'folder' },
        { id: 'README.md', name: 'README.md' }
    ];
}

function marker(svg: string, label: string): Legend {
    return {
        label,
        sample: () => icon({ 'aria-hidden': 'true', class: 'file-tree-marker' }, svg)
    };
}

// Fresh per render, since drops change it in place.
function movable(): FileTreeElement[] {
    return [
        {
            children: [
                {
                    children: [
                        { id: 'layout', name: 'layout.tsx' },
                        { id: 'page', name: 'page.tsx' }
                    ],
                    id: 'app',
                    name: 'app',
                    type: 'folder'
                },
                {
                    children: [
                        { id: 'button', name: 'button.tsx' },
                        { id: 'footer', name: 'footer.tsx' },
                        { id: 'header', name: 'header.tsx' },
                        { children: [{ id: 'icon', name: 'icon.tsx' }], id: 'ui', name: 'ui', type: 'folder' }
                    ],
                    id: 'components',
                    name: 'components',
                    type: 'folder'
                },
                {
                    children: [
                        { id: 'format', name: 'format.ts' },
                        { id: 'utils', name: 'utils.ts' }
                    ],
                    id: 'lib',
                    name: 'lib',
                    type: 'folder'
                },
                { children: [{ id: 'react', name: 'react.js' }], id: 'vendor', name: 'vendor', selectable: false, type: 'folder' },
                { id: 'index', name: 'index.ts' }
            ],
            id: 'src',
            name: 'src',
            type: 'folder'
        },
        { id: 'lock', name: 'package-lock.json', selectable: false },
        { id: 'package', name: 'package.json' },
        { id: 'readme', name: 'README.md' }
    ];
}

// What a typed path like 'a/b.ts' asks the store to create: its folders, outermost first, each holding the next, then
// the item; 'id' names each in turn.
function nest(parts: string[], kind: FileTreeKind, id: (name: string) => string) {
    let made = parts.map((name, i): FileTreeElement => i === parts.length - 1 && kind === 'file'
        ? { id: id(name), name }
        : { children: [], id: id(name), name, type: 'folder' });

    for (let i = made.length - 1; i > 0; i--) {
        made[i - 1].children!.push(made[i]);
    }

    return made;
}

// A history step's operation as an app mirroring it on disk would log it.
function operation(value: FileTreeHistoryOperation) {
    switch (value.type) {
        case 'move':
            return `move ${value.element.name} to ${value.to.parent ?? 'the root'}`;
        case 'rename':
            return `rename ${value.from} to ${value.to}`;
        default:
            return `${value.type} ${value.element.name}`;
    }
}

function packages(): FileTreeElement[] {
    return Array.from({ length: 12 }, (_, p) => ({
        children: Array.from({ length: 30 }, (_, f) => ({ id: `package-${p}/file-${f}`, name: `file-${f}.ts` })),
        id: `package-${p}`,
        name: `package-${p}`,
        type: 'folder' as const
    }));
}

// Ids as paths for 'nest', each from the one before: 'a', then 'a/b'; 'parent' is the folder the first lands in.
function path(parent: string) {
    return (name: string) => parent = parent ? `${parent}/${name}` : name;
}

// Fresh per render, since the store changes the elements it's given in place. Each top-level folder is a root.
function roots(): FileTreeElement[] {
    return [
        {
            children: [
                {
                    children: [
                        {
                            children: [
                                { id: 'app/src/components/button.tsx', name: 'button.tsx' },
                                { id: 'app/src/components/header.tsx', name: 'header.tsx' }
                            ],
                            id: 'app/src/components',
                            name: 'components',
                            type: 'folder'
                        },
                        { id: 'app/src/index.ts', name: 'index.ts' }
                    ],
                    id: 'app/src',
                    name: 'src',
                    type: 'folder'
                },
                { id: 'app/.env', name: '.env' },
                { id: 'app/package.json', name: 'package.json' }
            ],
            id: 'app',
            name: 'app',
            type: 'folder'
        },
        {
            children: [
                { children: [{ id: 'api/node_modules/hono', name: 'hono', type: 'folder' }], id: 'api/node_modules', name: 'node_modules', type: 'folder' },
                {
                    children: [
                        { id: 'api/routes/auth.ts', name: 'auth.ts' },
                        { id: 'api/routes/users.ts', name: 'users.ts' }
                    ],
                    id: 'api/routes',
                    name: 'routes',
                    type: 'folder'
                },
                { id: 'api/package.json', name: 'package.json' },
                { id: 'api/server.ts', name: 'server.ts' }
            ],
            id: 'api',
            name: 'api',
            type: 'folder'
        },
        {
            // A root heads its tree alone, while the chain below it shares one row.
            children: [
                chain('shared', 'src/lib', (id) => [
                    { id: `${id}/types.ts`, name: 'types.ts' },
                    { id: `${id}/utils.ts`, name: 'utils.ts' }
                ])
            ],
            id: 'shared',
            name: 'shared',
            type: 'folder'
        }
    ];
}

// A name in the color a row takes from its most severe decoration.
function tint(tone: string, label: string): Legend {
    return {
        label,
        sample: () => html`<span class='file-tree-demo-legend-name file-tree-demo-legend-name--${tone}' style='color: var(--${tone}-color)'>index.ts</span>`
    };
}

// Fresh per render, since the store changes the elements it's given in place.
function workspace(): FileTreeElement[] {
    return [
        {
            children: [
                {
                    children: [
                        { id: 'button', name: 'button.tsx' },
                        { id: 'header', name: 'header.tsx' }
                    ],
                    id: 'components',
                    name: 'components',
                    type: 'folder'
                },
                { id: 'index', name: 'index.ts' }
            ],
            id: 'src',
            name: 'src',
            type: 'folder'
        },
        { id: 'env', name: '.env' },
        { id: 'package', name: 'package.json' },
        { id: 'readme', name: 'README.md' }
    ];
}


export default {
    name: 'file-tree',
    variants: [
        {
            render: () => fileTree({
                class: 'file-tree-demo',
                compact: false,
                elements: [
                    { children: [], id: 'config', name: 'config', type: 'folder' },
                    {
                        children: ['index.ts', 'app.tsx', 'styles.scss', 'types.d.ts', 'worker.py', 'main.rs', 'schema.sql']
                            .map(name => ({ id: `src/${name}`, name })),
                        id: 'src', name: 'src', type: 'folder'
                    },
                    {
                        children: ['logo.svg', 'photo.png', 'intro.mp4', 'audio.wav', 'font.woff2']
                            .map(name => ({ id: `assets/${name}`, name })),
                        id: 'assets', name: 'assets', type: 'folder'
                    },
                    ...['.gitignore', '.env.local', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'Dockerfile', 'README.md', 'LICENSE', 'backup.tar.gz', 'unknown.custom']
                        .map(name => ({ id: name, name }))
                ],
                expanded: ['src', 'assets'],
                label: 'File and folder icon examples'
            }),
            title: 'file types, special filenames, compound extensions, and folders'
        },
        {
            render: () => {
                let state = reactive({ selected: 'button' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({ elements: ELEMENTS, expanded: ['app', 'lib'], state, toggle: true })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                    </div>
                `;
            },
            title: 'default'
        },
        {
            render: () => {
                let coverage = new FileTreeDecorations(),
                    editor = reactive({ dirty: false, file: 'src/components/file-tree/index.ts' }),
                    git = new FileTreeDecorations(),
                    problems = new FileTreeDecorations(),
                    state = reactive({ selected: editor.file }),
                    tabs = new FileTreeDecorations();

                // One store per provider, so each refreshes on its own schedule. Git's is a full `git status` with
                // `git diff --numstat`; later refreshes only re-render what changed.
                git.replace([
                    ['.env', { status: 'ignored' }],
                    ['build', { status: 'ignored' }],
                    ['src/components/card/expand.ts', { additions: 132, status: 'untracked' }],
                    ['src/components/card/index.ts', { additions: 48, status: 'untracked' }],
                    ['src/components/file-tree/decorations.ts', { additions: 121, staged: 'added' }],
                    ['src/components/file-tree/index.ts', { additions: 214, deletions: 87, staged: 'modified', status: 'modified' }],
                    ['src/components/file-tree/legacy.ts', { deletions: 64, staged: 'deleted' }],
                    ['src/components/heatmap/index.ts', { additions: 12, deletions: 9, status: 'conflict' }],
                    ['src/components/index.ts', { additions: 1, deletions: 1, status: 'modified' }],
                    ['src/components/tooltip/index.ts', { deletions: 58, status: 'deleted' }],
                    ['theme', { submodule: true }]
                ]);
                problems.replace([
                    ['src/components/file-tree/index.ts', { errors: 2 }],
                    ['src/components/index.ts', { warnings: 1 }]
                ]);
                tabs.replace([
                    ['src/components/file-tree/index.ts', { editor: { open: true, unsaved: true } }],
                    ['src/components/index.ts', { editor: { open: true } }]
                ]);
                coverage.replace([
                    ['src/components/card/index.ts', { badges: [{ color: 'var(--color-purple-400)', text: '92%', tooltip: '92% test coverage' }] }],
                    ['src/components/file-tree/index.ts', { badges: [{ color: 'var(--color-purple-400)', text: '64%', tooltip: '64% test coverage' }] }]
                ]);

                let view = (id: string) => {
                    editor.file = state.selected = id;
                    tabs.update([[id, { editor: { ...tabs.get(id)?.editor, open: true } }]]);
                };

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                decorations: [git, problems, tabs, coverage],
                                display: { stats: true },
                                elements: REPOSITORY,
                                open: (element) => view(element.id),
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Viewing: <code>${() => editor.file}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    editor.dirty = !editor.dirty;
                                    tabs.update([['package.json', { editor: { open: true, unsaved: editor.dirty } }]]);

                                    if (!editor.dirty) {
                                        git.update([['package.json', { additions: 2, deletions: 2, status: 'modified' }]]);
                                    }
                                }}'
                                type='button'
                            >
                                ${() => editor.dirty ? 'Save package.json' : 'Edit package.json'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => view('src/components/card/expand.ts')}'
                                type='button'
                            >
                                Switch editor tab
                            </button>
                        </div>
                        ${legend()}
                    </div>
                `;
            },
            title: 'git status, staging, problems, editor state, custom badges'
        },
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${fileTree({ elements: LOCKED, expanded: ['project'], indicator: 'never' })}
                </div>
            `,
            title: 'locked items, natural sort, no indicator'
        },
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${fileTree({ elements: MONOREPO, expanded: ['package-0'], toggle: true })}
                </div>
            `,
            title: 'virtualized, 10,000 files'
        },
        {
            render: () => {
                let controller: FileTreeController | undefined;

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                controller: (value) => {
                                    controller = value;
                                },
                                elements: MONOREPO,
                                expanded: ['package-0']
                            })}
                        </div>
                        <div class='file-tree-demo-actions'>
                            <button class='button' onclick='${() => controller?.find('file-42.')}' type='button'>
                                Find file-42.
                            </button>
                        </div>
                        <p class='file-tree-demo-caption'>
                            <code>Ctrl+Alt+F</code> searches every folder, closed ones too. <code>Enter</code>,
                            <code>F3</code> or the arrows step through the matches, opening their folders; the filter
                            button leaves only the matches.
                        </p>
                    </div>
                `;
            },
            title: 'find in 10,000 files, highlight mode'
        },
        {
            render: () => {
                let controller: FileTreeController | undefined,
                    count = 0,
                    decorations = new FileTreeDecorations(),
                    files = new FileTreeElements([...structuredClone(REPOSITORY), { id: 'vendor', name: 'vendor', type: 'folder' }]);

                decorations.replace([
                    ['src/components/card/expand.ts', { status: 'untracked' }],
                    ['src/components/file-tree/index.ts', { status: 'modified' }],
                    ['src/components/heatmap/index.ts', { status: 'conflict' }]
                ]);

                // Loaded only once opened, so a search before then can't see inside it.
                function load(element: FileTreeElement) {
                    return new Promise<FileTreeElement[]>((resolve) => {
                        setTimeout(() => {
                            resolve([
                                { id: `${element.id}/index.ts`, name: 'index.ts' },
                                { id: `${element.id}/react.js`, name: 'react.js' }
                            ]);
                        }, 600);
                    });
                }

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                controller: (value) => {
                                    controller = value;
                                },
                                decorations,
                                elements: files,
                                find: 'filter',
                                load,
                                typing: 'find'
                            })}
                        </div>
                        <div class='file-tree-demo-actions'>
                            <button class='button' onclick='${() => controller?.find('index')}' type='button'>
                                Find index
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    files.add({ id: `src/components/card/index-${++count}.ts`, name: `index-${count}.ts` }, 'src/components/card');
                                }}'
                                type='button'
                            >
                                Add a matching file
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    let id = 'src/components/tooltip/index.ts';

                                    files.rename(id, files.get(id)?.name === 'index.ts' ? 'tooltip.ts' : 'index.ts');
                                }}'
                                type='button'
                            >
                                Rename tooltip index
                            </button>
                        </div>
                        <p class='file-tree-demo-caption'>
                            Typing in the tree filters it, opening the folders down to each match and closing them again
                            once the search ends. Folder marks still count what's filtered out.
                        </p>
                    </div>
                `;
            },
            title: 'find: filter mode, find on type, live and lazy folders'
        },
        {
            render: () => {
                let casing = reactive({ active: false, error: '', render: false, selected: CASES[0] as number | string }),
                    order = reactive({ active: false, error: '', render: false, selected: ORDERS[0] as number | string }),
                    settings = reactive({ unicode: false });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo-actions'>
                            ${choice('Order', ORDERS, order)}
                            ${choice('Case', CASES, casing)}
                            ${flag('Unicode', () => settings.unicode, (value) => {
                                settings.unicode = value;
                            })}
                        </div>
                        <div class='file-tree-demo'>
                            ${() => {
                                let sort = { case: casing.selected as FileTreeSortCase, order: order.selected as FileTreeSortOrder, unicode: settings.unicode };

                                // A fresh tree per sort.
                                return fileTree({ elements: PROJECT, expanded: ['src'], sort });
                            }}
                        </div>
                    </div>
                `;
            },
            title: 'sort order, case, unicode'
        },
        {
            render: () => {
                let decorations = new FileTreeDecorations(),
                    display = reactive({ dotfiles: true, ignored: true });

                decorations.replace([
                    ['.env', { status: 'ignored' }],
                    ['dist', { status: 'ignored' }],
                    ['src/app.tsx', { additions: 4, status: 'modified' }]
                ]);

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({ decorations, display, elements: PROJECT, exclude: EXCLUDE, expanded: ['src'] })}
                        </div>
                        <p class='file-tree-demo-caption'>Excluded: <code>${EXCLUDE.join(', ')}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    display.dotfiles = !display.dotfiles;
                                }}'
                                type='button'
                            >
                                ${() => display.dotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    display.ignored = !display.ignored;
                                }}'
                                type='button'
                            >
                                ${() => display.ignored ? 'Hide gitignored' : 'Show gitignored'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    decorations.update([['src/styles.css', decorations.get('src/styles.css') ? null : { status: 'ignored' }]]);
                                }}'
                                type='button'
                            >
                                Ignore styles.css
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'hide dotfiles and gitignored, exclude patterns'
        },
        {
            render: () => {
                let search = reactive({ query: 'ftu' });

                return html`
                    <div class='file-tree-demo-stack'>
                        ${input({
                            'aria-label': 'Highlight matches',
                            class: 'file-tree-demo-search',
                            oninput: (event: Event) => {
                                search.query = (event.target as HTMLInputElement).value;
                            },
                            placeholder: 'Fuzzy query',
                            value: search.query
                        })}
                        <div class='file-tree-demo'>
                            ${fileTree({
                                elements: SEARCHABLE,
                                expanded: ['.github', '.github/workflows', 'migrations', 'src', 'src/components', 'src/components/file-tree', 'tests'],
                                highlight: () => search.query
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Try <code>ftu</code>, <code>uft</code>, <code>env</code>, <code>001</code> or <code>HP</code>: lowercase matches either case, capitals only themselves.</p>
                    </div>
                `;
            },
            title: 'fuzzy match highlight'
        },
        {
            render: () => {
                let decorations = new FileTreeDecorations(),
                    removed = false;

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                decorations,
                                elements: WORKSPACE,
                                expanded: ['src', 'src/components', 'tests'],
                                indicator: 'hover',
                                // First match wins; a folder's color carries down to everything inside it.
                                scopes: [
                                    { color: 'var(--color-green-500)', match: TEST_PATH },
                                    { color: 'var(--color-yellow-500)', match: (element) => element.name === 'node_modules' || element.name === 'dist' }
                                ]
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Guides show while hovering; rest on a row for its path. Deleting a file keeps the set sizes screen readers hear in step.</p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    removed = !removed;
                                    decorations.update([['src/components/old-menu.ts', removed ? { deletions: 48, status: 'deleted' } : null]]);
                                }}'
                                type='button'
                            >
                                Delete old-menu.ts
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'guides on hover, named folders, path tooltip, scope colors'
        },
        {
            render: () => {
                let decorations = new FileTreeDecorations();

                decorations.replace([
                    ['packages/1/src/hooks/4', { additions: 18, deletions: 3, status: 'modified' }],
                    ['packages/2/src/components/7', { errors: 1, status: 'modified' }],
                    ['packages/3/src/utils/0', { additions: 40, status: 'untracked' }]
                ]);

                return html`
                    <div class='file-tree-demo'>
                        ${fileTree({
                            decorations,
                            elements: NESTED,
                            expanded: NESTED.flatMap((element) => [
                                element.id,
                                `${element.id}/src`,
                                ...NESTED_FOLDERS.map((folder) => `${element.id}/src/${folder}`)
                            ]),
                            sticky: 3
                        })}
                    </div>
                `;
            },
            title: 'sticky scroll, three folders deep'
        },
        {
            render: () => {
                let decorations = new FileTreeDecorations(),
                    display = reactive({ dotfiles: true, stats: true }),
                    files = new FileTreeElements(compacted()),
                    history = new FileTreeHistory(files),
                    log = reactive({ text: 'Click a segment to select its folder. F2 renames, Alt+N adds a file, drag onto a segment to move into it, Ctrl+Z undoes.' }),
                    settings = reactive({ compact: true, resources: false }),
                    state = reactive({ selected: '' });

                decorations.replace([
                    ['src/main/java/com/example/app/controller/UserController.java', { additions: 12, deletions: 3, status: 'modified' }],
                    ['src/test/java/com/example/app/ApplicationTests.java', { additions: 40, status: 'untracked' }]
                ]);

                // Ctrl+Z and Ctrl+Y can bring src/main/resources back or take it away again.
                history.subscribe(() => {
                    settings.resources = !!files.get('src/main/resources');
                });

                // Each folder arrives holding one more, so the row grows a segment per load.
                function load(element: FileTreeElement) {
                    return new Promise<FileTreeElement[]>((resolve) => {
                        setTimeout(() => {
                            resolve(element.id === 'vendor/acme/sdk'
                                ? [{ id: `${element.id}/client.ts`, name: 'client.ts' }, { id: `${element.id}/index.ts`, name: 'index.ts' }]
                                : [{ id: `${element.id}/${element.id === 'vendor' ? 'acme' : 'sdk'}`, name: element.id === 'vendor' ? 'acme' : 'sdk', type: 'folder' }]);
                        }, 400);
                    });
                }

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${() => fileTree({
                                // A fresh tree per setting, on the same store.
                                compact: settings.compact,
                                // Stands in for the file system: the new item lands in the store, with the folders a
                                // path like 'a/b.ts' names around it.
                                create: (parent, parts, kind) => {
                                    let made = nest(parts, kind, path(parent?.id ?? ''));

                                    history.transact(() => files.add(made[0], parent?.id ?? null), `Create ${parts.join('/')}`);
                                    log.text = `Created ${parts.join('/')} in ${parent?.id ?? 'the root'}`;
                                    setTimeout(() => {
                                        state.selected = made[made.length - 1].id;
                                    });
                                },
                                decorations,
                                display,
                                drag: {
                                    drop: (drop) => {
                                        history.transact(() => {
                                            for (let element of drop.elements) {
                                                files.move(element.id, drop.target?.id ?? null);
                                            }
                                        }, `Move ${items(drop.elements)}`);
                                        log.text = `Moved ${list(drop.elements)} into ${drop.target?.id ?? 'the root'}`;
                                    }
                                },
                                elements: files,
                                expanded: ['src', 'src/main/java/com/example/app', 'web/src/components'],
                                history,
                                load,
                                rename: (element, name) => {
                                    history.transact(() => files.rename(element.id, name), `Rename ${element.name}`);
                                    log.text = `Renamed ${element.name} to ${name}`;
                                },
                                shortcuts: true,
                                state,
                                toggle: true
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    // A second folder in src/main splits its row; taking it away joins it again.
                                    history.transact(() => settings.resources
                                        ? files.remove('src/main/resources')
                                        : files.add(chain('src/main', 'resources', (id) => [{ id: `${id}/application.yml`, name: 'application.yml' }]), 'src/main'));
                                    settings.resources = !!files.get('src/main/resources');
                                }}'
                                type='button'
                            >
                                ${() => settings.resources ? 'Remove src/main/resources' : 'Add src/main/resources'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    display.dotfiles = !display.dotfiles;
                                }}'
                                type='button'
                            >
                                ${() => display.dotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    state.selected = 'src/main/java/com';
                                }}'
                                type='button'
                            >
                                Select com
                            </button>
                            ${flag('Compact', () => settings.compact, (value) => {
                                settings.compact = value;
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => log.text}</p>
                    </div>
                `;
            },
            title: 'compact folders, live split and join, lazy chains'
        },
        {
            render: () => {
                let controller: FileTreeController | undefined,
                    decorations = new FileTreeDecorations(),
                    editor = reactive({ file: '', how: '' }),
                    state = reactive({ selected: '' });

                decorations.replace([
                    ['src/components/card/expand.ts', { status: 'untracked' }],
                    ['src/components/file-tree/index.ts', { status: 'modified' }],
                    ['src/components/heatmap/index.ts', { status: 'conflict' }],
                    ['tsconfig.json', { status: 'modified' }]
                ]);

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                controller: (value) => {
                                    controller = value;
                                },
                                decorations,
                                elements: REPOSITORY,
                                expand: 'dblclick',
                                open: (element, { mode, side }) => {
                                    editor.file = element.id;
                                    editor.how = side ? `${mode}, to the side` : mode;
                                },
                                preview: true,
                                reveal: 'select',
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>
                            Viewing: <code>${() => editor.file || 'nothing'}</code>${() => editor.how && ` (${editor.how})`}
                        </p>
                        <div class='file-tree-demo-actions'>
                            <button class='button' onclick='${() => controller?.previous()}' type='button'>
                                Previous change
                            </button>
                            <button class='button' onclick='${() => controller?.next()}' type='button'>
                                Next change
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    state.selected = 'src/components/heatmap/index.ts';
                                }}'
                                type='button'
                            >
                                Select heatmap
                            </button>
                        </div>
                        <p class='file-tree-demo-caption'>
                            Folders open on double click or the chevron; arrows preview files. <code>*</code> opens sibling
                            folders, <code>Alt</code>+click or <code>Alt+Right</code> / <code>Alt+Left</code> a whole subtree,
                            <code>Alt+F5</code> / <code>Shift+Alt+F5</code> jump between changes, <code>Ctrl+Enter</code>
                            or <code>Alt</code>+click opens to the side.
                        </p>
                    </div>
                `;
            },
            title: 'navigation: preview & pinned, double-click folders, changes, reveal without scrolling'
        },
        {
            render: () => {
                let copies = 0,
                    files = new FileTreeElements(structuredClone(REPOSITORY)),
                    history = new FileTreeHistory(files),
                    log = reactive({ text: 'Ctrl/Shift+click, Shift+arrows, Ctrl+A, Ctrl+X then Ctrl+V, Delete, Ctrl+Z, Shift+Alt+C, right-click' }),
                    state = reactive({ selected: 'src/components/file-tree/index.ts', selection: new Set<string>() });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                elements: files,
                                history,
                                menu: (elements, position) => {
                                    log.text = `Menu at ${Math.round(position.x)}, ${Math.round(position.y)} for ${list(elements) || 'the background'}`;
                                },
                                // The store stands in for the disk: deletes and pastes change the tree live.
                                operations: {
                                    confirm: (elements, permanent) => window.confirm(`${permanent ? 'Delete' : 'Move to trash'} ${list(elements)}?`),
                                    copy: (elements) => {
                                        log.text = `Copied ${list(elements)}`;
                                    },
                                    cut: (elements) => {
                                        log.text = `Cut ${list(elements)}`;
                                    },
                                    delete: (elements, permanent) => {
                                        history.transact(() => {
                                            for (let element of elements) {
                                                files.remove(element.id);
                                            }
                                        }, `Delete ${items(elements)}`);

                                        log.text = `${permanent ? 'Deleted' : 'Trashed'} ${list(elements)}`;
                                    },
                                    duplicate: (elements) => {
                                        history.transact(() => {
                                            for (let element of elements) {
                                                files.add(copy(element, ++copies), files.index.get(element.id)?.parent ?? null);
                                            }
                                        }, `Duplicate ${items(elements)}`);

                                        log.text = `Duplicated ${list(elements)}`;
                                    },
                                    // A move takes a moment on disk; the cut items stay dimmed until it's done.
                                    paste: (elements, target, cut) => new Promise<void>((resolve) => {
                                        log.text = `${cut ? 'Moving' : 'Copying'} ${list(elements)} into ${target?.id ?? 'the root'}…`;
                                        setTimeout(() => {
                                            history.transact(() => {
                                                for (let element of elements) {
                                                    if (cut) {
                                                        files.move(element.id, target?.id ?? null);
                                                    }
                                                    else {
                                                        files.add(copy(element, ++copies), target?.id ?? null);
                                                    }
                                                }
                                            }, `${cut ? 'Move' : 'Paste'} ${items(elements)}`);

                                            log.text = `${cut ? 'Moved' : 'Copied'} ${list(elements)} into ${target?.id ?? 'the root'}`;
                                            resolve();
                                        }, 1000);
                                    })
                                },
                                path: (element, relative) => relative ? element.id : `/home/dev/ui/${element.id}`,
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Selection: <code>${() => [...state.selection].join(', ') || 'nothing'}</code></p>
                        <p class='file-tree-demo-caption'>${() => log.text}</p>
                    </div>
                `;
            },
            title: 'multi-select, clipboard, context menu'
        },
        {
            render: () => {
                let editor = new FileTreeEditor(),
                    files = new FileTreeElements(workspace()),
                    history = new FileTreeHistory(files),
                    log = reactive({ message: 'F2 renames the focused row; Alt+N and Alt+Shift+N add a file or folder; Ctrl+Z undoes' }),
                    next = 0,
                    state = reactive({ selected: 'index' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo-actions'>
                            <button class='button' onclick='${() => editor.create('file')}' type='button'>New file</button>
                            <button class='button' onclick='${() => editor.create('folder')}' type='button'>New folder</button>
                            <button class='button' onclick='${() => editor.rename()}' type='button'>Rename</button>
                        </div>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                // Stands in for the file system: the new item lands in the store, which adds its row
                                // live, with the folders a path like 'a/b.ts' names around it.
                                create: (parent, parts, kind) => {
                                    let made = nest(parts, kind, () => `new-${++next}`);

                                    history.transact(() => files.add(made[0], parent?.id ?? null), `Create ${parts.join('/')}`);
                                    log.message = `Created ${parts.join('/')} in ${parent?.name ?? 'the root'}`;
                                    // Once the input has closed, handing focus back to the row it opened from.
                                    setTimeout(() => {
                                        state.selected = made[made.length - 1].id;
                                    });
                                },
                                editor,
                                elements: files,
                                expanded: ['src'],
                                history,
                                // Settles after a moment, as a disk write would; the input waits on it.
                                rename: (element, name) => new Promise<boolean>((resolve) => {
                                    setTimeout(() => {
                                        log.message = `Renamed ${element.name} to ${name}`;
                                        history.transact(() => files.rename(element.id, name), `Rename ${element.name}`);
                                        resolve(true);
                                    }, 400);
                                }),
                                shortcuts: true,
                                state,
                                validate: (name) => EXECUTABLE_EXTENSION.test(name) ? 'Executables can\'t be added to this project' : undefined
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => log.message}</p>
                    </div>
                `;
            },
            title: 'inline create and rename, validation'
        },
        {
            render: () => {
                let drops = 0,
                    files = new FileTreeElements(movable()),
                    history = new FileTreeHistory(files),
                    state = reactive({ selected: '' }),
                    ui = reactive({ ask: false, last: 'Drag a row onto a folder; hold Alt/Option to copy.' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                drag: {
                                    confirm: (drop) => !ui.ask || window.confirm(
                                        `${drop.copy ? 'Copy' : 'Move'} ${drop.elements.map((element) => element.name).join(', ')} into ${drop.target?.name ?? 'the top level'}?`
                                    ),
                                    // What an editor would do with a drop, which the tree only reports: the store
                                    // moves the rows live, and selecting what landed opens the folder it went into.
                                    drop: (drop) => {
                                        let into = drop.target?.id ?? null,
                                            landed: string[] = [];

                                        drops++;

                                        history.transact(() => {
                                            for (let element of drop.elements) {
                                                if (drop.copy) {
                                                    let clone = copy(element, drops);

                                                    files.add(clone, into);
                                                    landed.push(clone.id);
                                                }
                                                else if (files.move(element.id, into)) {
                                                    landed.push(element.id);
                                                }
                                            }
                                        }, `${drop.copy ? 'Copy' : 'Move'} ${items(drop.elements)}`);

                                        ui.last = `${drop.copy ? 'Copied' : 'Moved'} ${drop.elements.map((element) => element.name).join(', ')} into ${drop.target?.name ?? 'the top level'}.`;

                                        if (landed.length) {
                                            state.selected = landed[0];
                                        }
                                    }
                                },
                                elements: files,
                                expanded: ['components', 'src'],
                                history,
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.last}</p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    ui.ask = !ui.ask;
                                }}'
                                type='button'
                            >
                                ${() => ui.ask ? 'Confirm drops: on' : 'Confirm drops: off'}
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'drag and drop, Alt/Option copies, locked items stay put'
        },
        {
            render: () => {
                let count = 0,
                    failed = false,
                    files = new FileTreeElements(live()),
                    history = new FileTreeHistory(files),
                    state = reactive({ selected: 'src/app.ts' });

                // The folder to act in: the selected folder, or the selected file's.
                function folder() {
                    let element = files.get(state.selected);

                    if (!element) {
                        return null;
                    }

                    return element.type === 'folder' ? element.id : files.index.get(element.id)!.parent;
                }

                function load(element: FileTreeElement) {
                    return new Promise<FileTreeElement[]>((resolve, reject) => {
                        setTimeout(() => {
                            // Fails every other time, to show the error row and retry.
                            if (element.id === 'flaky' && (failed = !failed)) {
                                reject(new Error('Connection timed out'));
                                return;
                            }

                            resolve([
                                { id: `${element.id}/nested`, name: 'nested', type: 'folder' },
                                { id: `${element.id}/data.json`, name: 'data.json' },
                                { id: `${element.id}/notes.md`, name: 'notes.md' }
                            ]);
                        }, 900);
                    });
                }

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({ elements: files, expanded: ['src'], history, load, state })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    let id = `new-${++count}`;

                                    history.transact(() => files.add({ id, name: `untitled-${count}.ts` }, folder()));
                                    state.selected = id;
                                }}'
                                type='button'
                            >
                                Add
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    let element = files.get(state.selected);

                                    if (element) {
                                        history.transact(() => files.rename(element.id, `renamed-${element.name}`));
                                    }
                                }}'
                                type='button'
                            >
                                Rename
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    let element = files.get(state.selected);

                                    if (element && element.id !== 'lib') {
                                        history.transact(() => files.move(element.id, files.index.get(element.id)!.parent === 'lib' ? 'src' : 'lib'));
                                    }
                                }}'
                                type='button'
                            >
                                Move
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    if (files.get(state.selected)) {
                                        history.transact(() => files.remove(state.selected));
                                    }
                                }}'
                                type='button'
                            >
                                Delete
                            </button>
                            <button class='button' onclick='${() => history.undo()}' type='button'>Undo</button>
                        </div>
                    </div>
                `;
            },
            title: 'live updates, lazy folders'
        },
        {
            render: () => {
                let copies = 0,
                    decorations = new FileTreeDecorations(),
                    editor = new FileTreeEditor(),
                    files = new FileTreeElements(workspace()),
                    next = 0,
                    state = reactive({ selected: 'index', selection: new Set<string>() }),
                    ui = reactive({ ask: false, mirrored: 'Delete, paste, duplicate, drag, F2 or Alt+N, then Ctrl+Z and Ctrl+Shift+Z' }),
                    history = new FileTreeHistory(files, {
                        // Undoing a delete recreates files; an app would ask first, or apply the step to disk and
                        // refuse when that fails.
                        confirm: (step) => {
                            let added = step.operations.filter((value) => value.type === 'add');

                            return !ui.ask || !added.length || window.confirm(
                                `${step.direction === 'undo' ? 'Undo' : 'Redo'} "${step.label}"? It recreates ${added.map((value) => value.element.name).join(', ')}.`
                            );
                        },
                        depth: 20
                    });

                decorations.replace([
                    ['button', { additions: 12, deletions: 3, status: 'modified' }],
                    ['env', { status: 'ignored' }],
                    ['header', { additions: 40, status: 'untracked' }]
                ]);

                // What the store applied, in order, for the app to mirror on disk.
                history.subscribe((step) => {
                    ui.mirrored = `${step.direction === 'undo' ? 'Undid' : 'Redid'} ${step.label}: ${step.operations.map(operation).join(', ')}`;
                });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button ${() => !history.canUndo && '--disabled'}'
                                onclick='${() => history.undo()}'
                                type='button'
                            >
                                Undo
                            </button>
                            <button
                                class='button ${() => !history.canRedo && '--disabled'}'
                                onclick='${() => history.redo()}'
                                type='button'
                            >
                                Redo
                            </button>
                            <button class='button' onclick='${() => editor.create('file')}' type='button'>New file</button>
                            <button
                                class='button'
                                onclick='${() => {
                                    ui.ask = !ui.ask;
                                }}'
                                type='button'
                            >
                                ${() => ui.ask ? 'Confirm restores: on' : 'Confirm restores: off'}
                            </button>
                        </div>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                create: (parent, parts, kind) => {
                                    let made = nest(parts, kind, () => `created-${++next}`);

                                    history.transact(() => files.add(made[0], parent?.id ?? null), `Create ${parts.join('/')}`);
                                },
                                decorations,
                                display: { stats: true },
                                drag: {
                                    drop: (drop) => {
                                        history.transact(() => {
                                            for (let element of drop.elements) {
                                                if (drop.copy) {
                                                    files.add(copy(element, ++copies), drop.target?.id ?? null);
                                                }
                                                else {
                                                    files.move(element.id, drop.target?.id ?? null);
                                                }
                                            }
                                        }, `${drop.copy ? 'Copy' : 'Move'} ${items(drop.elements)}`);
                                    }
                                },
                                editor,
                                elements: files,
                                expanded: ['components', 'src'],
                                history,
                                // Every operation is one transaction, however many items it takes.
                                operations: {
                                    delete: (elements) => {
                                        history.transact(() => {
                                            for (let element of elements) {
                                                files.remove(element.id);
                                            }
                                        }, `Delete ${items(elements)}`);
                                    },
                                    duplicate: (elements) => {
                                        history.transact(() => {
                                            for (let element of elements) {
                                                files.add(copy(element, ++copies), files.index.get(element.id)?.parent ?? null);
                                            }
                                        }, `Duplicate ${items(elements)}`);
                                    },
                                    paste: (elements, target, cut) => {
                                        history.transact(() => {
                                            for (let element of elements) {
                                                if (cut) {
                                                    files.move(element.id, target?.id ?? null);
                                                }
                                                else {
                                                    files.add(copy(element, ++copies), target?.id ?? null);
                                                }
                                            }
                                        }, `${cut ? 'Move' : 'Paste'} ${items(elements)}`);
                                    }
                                },
                                rename: (element, name) => {
                                    history.transact(() => files.rename(element.id, name), `Rename ${element.name}`);
                                },
                                shortcuts: true,
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.mirrored}</p>
                        <ol class='file-tree-demo-history'>
                            ${() => html`
                                ${history.undoable.map((entry) => html`<li class='file-tree-demo-history-step'>${entry.label}</li>`)}
                                ${[...history.redoable].reverse().map((entry) => html`<li class='file-tree-demo-history-step --undone'>${entry.label}</li>`)}
                            `}
                        </ol>
                    </div>
                `;
            },
            title: 'undo and redo, history list, mirrored steps'
        },
        {
            render: () => {
                let files = new FileTreeElements(packages()),
                    mounted = reactive({ count: 0, saved: '' }),
                    snapshot: FileTreeSnapshot = { expanded: ['package-0', 'package-1'] };

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${() => {
                                // Read so each remount builds a fresh tree from the snapshot.
                                mounted.count;

                                return fileTree({
                                    elements: files,
                                    empty: () => html`
                                        <p>No files yet</p>
                                        <button class='button' onclick='${() => files.add(packages())}' type='button'>Add files</button>
                                    `,
                                    snapshot
                                });
                            }}
                        </div>
                        <p class='file-tree-demo-caption'>Saved: <code>${() => mounted.saved || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    // As a consumer would store it, then hand it back.
                                    mounted.saved = JSON.stringify(snapshot);
                                    snapshot = JSON.parse(mounted.saved);
                                    mounted.count++;
                                }}'
                                type='button'
                            >
                                Save & remount
                            </button>
                            <button
                                class='button'
                                onclick='${() => {
                                    for (let element of [...files.elements]) {
                                        files.remove(element.id);
                                    }
                                }}'
                                type='button'
                            >
                                Remove all
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'persisted open folders and scroll, empty state'
        },
        {
            render: () => {
                let decorations = new FileTreeDecorations(),
                    files = new FileTreeElements(roots()),
                    state = reactive({ selected: 'app/src/index.ts' }),
                    ui = reactive({ docs: false, log: 'Right-click a root, drag files between roots, Alt+N adds a file' });

                decorations.replace([
                    ['api/routes/users.ts', { additions: 24, deletions: 6, status: 'modified' }],
                    ['api/server.ts', { errors: 1 }],
                    ['app/src/components/header.tsx', { additions: 58, status: 'untracked' }],
                    ['app/src/index.ts', { additions: 3, deletions: 1, status: 'modified' }],
                    ['shared/src/lib/types.ts', { warnings: 2 }]
                ]);

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                // A path like 'a/b.ts' names the folders to make on the way; roots always hold it.
                                create: (parent, parts, kind) => {
                                    files.add(nest(parts, kind, path(parent!.id))[0], parent!.id);
                                    ui.log = `Created ${parts.join('/')} in ${parent!.name}`;
                                },
                                decorations,
                                display: { stats: true },
                                drag: {
                                    drop: ({ elements, target }) => {
                                        for (let element of elements) {
                                            files.move(element.id, target!.id);
                                        }

                                        ui.log = `Moved ${list(elements)} into ${target!.name}`;
                                    }
                                },
                                elements: files,
                                // Matched within each root, so every root's own node_modules is hidden.
                                exclude: ['node_modules'],
                                menu: (elements, position, root) => {
                                    ui.log = root
                                        ? `Root menu at ${Math.round(position.x)}, ${Math.round(position.y)}: remove ${list(elements)} from the workspace`
                                        : `Menu for ${list(elements) || 'the background'}`;
                                },
                                roots: true,
                                shortcuts: true,
                                state,
                                toggle: true
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.log}</p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    if (ui.docs) {
                                        files.remove('docs');
                                    }
                                    else {
                                        files.add({ children: [], id: 'docs', name: 'docs', type: 'folder' });
                                    }

                                    ui.docs = !ui.docs;
                                }}'
                                type='button'
                            >
                                ${() => ui.docs ? 'Remove docs root' : 'Add docs root'}
                            </button>
                            <button
                                class='button'
                                onclick='${() => files.move(files.elements[files.elements.length - 1].id, null, 0)}'
                                type='button'
                            >
                                Move last root first
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'multi-root workspace'
        }
    ]
};
