import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { editor, FileTreeDecorations, FileTreeEditor, FileTreeElements, FileTreeHistory, icon, input, select, switch as toggle } from '@esportsplus/ui/components';
import symlink from '@esportsplus/ui/svg/corner-down-right.svg';
import lock from '@esportsplus/ui/svg/lock.svg';
import type {
    FileTreeController,
    FileTreeElement,
    FileTreeHistoryOperation,
    FileTreeIconOptions,
    FileTreeImportEntry,
    FileTreeJump,
    FileTreeKind,
    FileTreeSnapshot,
    FileTreeSortCase,
    FileTreeSortOrder
} from '@esportsplus/ui/components/editor/tree';
import 'docs/examples/file-tree/scss/index.scss';


type Legend = {
    label: string;
    // Built per render, since a rendered sample can't be shown in two places at once.
    sample: () => Renderable<unknown>;
};


// The library button, dressed as the other examples' controls.
const ACTION = 'button file-tree-demo-action';

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
            letter('64%', 'Custom badge, in its own color', undefined, { color: 'light-dark(var(--color-purple-400), oklch(from var(--color-purple-400) 0.74 0.16 h))' })
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


// What each text file in 'notes()' holds, dragged out as a data URL.
const TEXTS: Record<string, string> = {
    'notes/drafts/letter.txt': 'Dear reader,\n\nThis file was dragged out of a web page.\n',
    'notes/ideas.md': '# Ideas\n\n- Drag rows out of the tree\n- Drop folders into it\n',
    'notes/todo.txt': 'Ship the file tree\nWrite the docs\n',
    'README.md': '# Notes\n\nDrag any file to the desktop.\n'
};

// The children a lazy 'vendor' folder fetches, by folder id; 'vendor/lib' is lazy too.
const VENDOR: Record<string, FileTreeElement[]> = {
    vendor: [
        { id: 'vendor/lib', name: 'lib', type: 'folder' },
        { id: 'vendor/LICENSE', name: 'LICENSE' }
    ],
    'vendor/lib': [
        { id: 'vendor/lib/parse.ts', name: 'parse.ts' },
        { id: 'vendor/lib/print.ts', name: 'print.ts' }
    ]
};

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

// Dropped entries joined to the store under 'target', ids as paths from it; one already there is left as it is. Returns
// the ids of what was dropped at the top, not what's inside dropped folders.
function imported(files: FileTreeElements, target: FileTreeElement | null, entries: readonly FileTreeImportEntry[]) {
    let base = target ? `${target.id}/` : '',
        out: string[] = [];

    for (let entry of entries) {
        let at = entry.path.lastIndexOf('/'),
            id = base + entry.path,
            name = entry.path.slice(at + 1),
            element: FileTreeElement = entry.file
                ? { id, modified: entry.file.lastModified, name, size: entry.file.size }
                : { children: [], id, name, type: 'folder' };

        if (files.add(element, at === -1 ? target?.id ?? null : base + entry.path.slice(0, at)) && at === -1) {
            out.push(id);
        }
    }

    return out;
}

// What a history label calls them: one by name, several by count.
function items(elements: FileTreeElement[]) {
    return elements.length === 1 ? elements[0].name : `${elements.length} items`;
}

function legend() {
    return html`
        <div class='file-tree file-tree-demo-legend'>
            ${LEGEND.map((group) => html`
                <section class='file-tree-demo-legend-group'>
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

// Fresh per render, since drops change it in place. Ids are paths, which 'TEXTS' goes by.
function notes(): FileTreeElement[] {
    return [
        { children: [], id: 'archive', name: 'archive', type: 'folder' },
        {
            children: [
                { children: [{ id: 'notes/drafts/letter.txt', name: 'letter.txt' }], id: 'notes/drafts', name: 'drafts', type: 'folder' },
                { id: 'notes/ideas.md', name: 'ideas.md' },
                { id: 'notes/todo.txt', name: 'todo.txt' }
            ],
            id: 'notes',
            name: 'notes',
            type: 'folder'
        },
        { id: 'README.md', name: 'README.md' }
    ];
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
// One of each file type the tree has artwork for, the generic file last, then the folders with artwork of their own.
function types(): FileTreeElement[] {
    let files = [
            'AGENTS.md', 'App.svelte', 'App.swift', 'App.vue', 'app.tsx', 'backup.tar.gz', 'biome.json', 'bootstrap.min.css',
            'build.zig', 'bun.lockb', 'ci.yml', 'CLAUDE.md', 'data.json', 'deploy.sh', 'Dockerfile', 'eslint.config.js',
            'Gemfile', 'guide.md', 'index.html', 'index.js', 'index.ts', 'inter.woff2', 'logo.svg', 'main.c', 'main.go',
            'main.rs', 'main.tf', 'module.wasm', 'next.config.ts', 'notes.txt', 'package-lock.json', 'package.json',
            'page.astro', 'photo.png', 'pnpm-lock.yaml', 'postcss.config.js', 'project.code-workspace', 'README.md',
            'report.csv', 'schema.graphql', 'schema.sql', 'styles.scss', 'svgo.config.js', 'tailwind.config.ts',
            'theme.css', 'tsconfig.json', 'vite.config.ts', 'webpack.config.js', 'worker.py', '.babelrc',
            '.browserslistrc', '.gitignore', '.mcp.json', '.oxlintrc.json', '.prettierrc', '.stylelintrc', 'unknown.custom'
        ],
        folders = ['.git', 'assets', 'components', 'config', 'dist', 'node_modules', 'public', 'scripts', 'src', 'tests'];

    return [
        {
            children: files.map((name) => ({ id: `types/${name}`, name })),
            id: 'types',
            name: 'types',
            type: 'folder'
        },
        { children: [{ id: 'docs/guide.md', name: 'guide.md' }], id: 'docs', name: 'docs', type: 'folder' },
        ...folders.map((name): FileTreeElement => ({ children: [], id: name, name, type: 'folder' }))
    ];
}

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
            render: () => html`
                <div class='file-tree-demo-icons'>
                    ${([
                        ['Colored', 'file-tree-demo', {}],
                        ['Colored, dark color scheme', 'file-tree-demo file-tree-demo--dark', {}],
                        ['Monochrome', 'file-tree-demo', { colored: false }]
                    ] as [string, string, FileTreeIconOptions][]).map(([caption, style, icons]) => html`
                        <figure class='file-tree-demo-figure'>
                            ${editor.tree({
                                class: style,
                                compact: false,
                                elements: types(),
                                expanded: ['types', 'docs'],
                                icons,
                                label: `${caption} file and folder icons`,
                                sticky: false
                            })}
                            <figcaption class='file-tree-demo-caption'>${caption}</figcaption>
                        </figure>
                    `)}
                </div>
            `,
            title: 'file type and named folder icons, colored and monochrome'
        },
        {
            render: () => {
                let state = reactive({ selected: 'button' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${editor.tree({ elements: ELEMENTS, expanded: ['app', 'lib'], state, toggle: true })}
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
                    opened = reactive({ dirty: false, file: 'src/components/file-tree/index.ts' }),
                    git = new FileTreeDecorations(),
                    problems = new FileTreeDecorations(),
                    state = reactive({ selected: opened.file }),
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
                    opened.file = state.selected = id;
                    tabs.update([[id, { editor: { ...tabs.get(id)?.editor, open: true } }]]);
                };

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${editor.tree({
                                decorations: [git, problems, tabs, coverage],
                                display: { stats: true },
                                elements: REPOSITORY,
                                open: (element) => view(element.id),
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>Viewing: <code>${() => opened.file}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='${ACTION}'
                                onclick='${() => {
                                    opened.dirty = !opened.dirty;
                                    tabs.update([['package.json', { editor: { open: true, unsaved: opened.dirty } }]]);

                                    if (!opened.dirty) {
                                        git.update([['package.json', { additions: 2, deletions: 2, status: 'modified' }]]);
                                    }
                                }}'
                                type='button'
                            >
                                ${() => opened.dirty ? 'Save package.json' : 'Edit package.json'}
                            </button>
                            <button
                                class='${ACTION}'
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
                    ${editor.tree({ elements: LOCKED, expanded: ['project'], indicator: 'never' })}
                </div>
            `,
            title: 'locked items, natural sort, no indicator'
        },
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${editor.tree({ elements: MONOREPO, expanded: ['package-0'], toggle: true })}
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
                            ${editor.tree({
                                controller: (value) => {
                                    controller = value;
                                },
                                elements: MONOREPO,
                                expanded: ['package-0']
                            })}
                        </div>
                        <div class='file-tree-demo-actions'>
                            <button class='${ACTION}' onclick='${() => controller?.find('file-42.')}' type='button'>
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
                            ${editor.tree({
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
                            <button class='${ACTION}' onclick='${() => controller?.find('index')}' type='button'>
                                Find index
                            </button>
                            <button
                                class='${ACTION}'
                                onclick='${() => {
                                    files.add({ id: `src/components/card/index-${++count}.ts`, name: `index-${count}.ts` }, 'src/components/card');
                                }}'
                                type='button'
                            >
                                Add a matching file
                            </button>
                            <button
                                class='${ACTION}'
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
                                return editor.tree({ elements: PROJECT, expanded: ['src'], sort });
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
                            ${editor.tree({ decorations, display, elements: PROJECT, exclude: EXCLUDE, expanded: ['src'] })}
                        </div>
                        <p class='file-tree-demo-caption'>Excluded: <code>${EXCLUDE.join(', ')}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='${ACTION}'
                                onclick='${() => {
                                    display.dotfiles = !display.dotfiles;
                                }}'
                                type='button'
                            >
                                ${() => display.dotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
                            </button>
                            <button
                                class='${ACTION}'
                                onclick='${() => {
                                    display.ignored = !display.ignored;
                                }}'
                                type='button'
                            >
                                ${() => display.ignored ? 'Hide gitignored' : 'Show gitignored'}
                            </button>
                            <button
                                class='${ACTION}'
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
                            ${editor.tree({
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
                            ${editor.tree({
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
                                class='${ACTION}'
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
                        ${editor.tree({
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
                            ${() => editor.tree({
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
                                class='${ACTION}'
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
                                class='${ACTION}'
                                onclick='${() => {
                                    display.dotfiles = !display.dotfiles;
                                }}'
                                type='button'
                            >
                                ${() => display.dotfiles ? 'Hide dotfiles' : 'Show dotfiles'}
                            </button>
                            <button
                                class='${ACTION}'
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
                    opened = reactive({ file: '', how: '' }),
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
                            ${editor.tree({
                                controller: (value) => {
                                    controller = value;
                                },
                                decorations,
                                elements: REPOSITORY,
                                expand: 'dblclick',
                                open: (element, { mode, side }) => {
                                    opened.file = element.id;
                                    opened.how = side ? `${mode}, to the side` : mode;
                                },
                                preview: true,
                                reveal: 'select',
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>
                            Viewing: <code>${() => opened.file || 'nothing'}</code>${() => opened.how && ` (${opened.how})`}
                        </p>
                        <div class='file-tree-demo-actions'>
                            <button class='${ACTION}' onclick='${() => controller?.previous('change')}' type='button'>
                                Previous change
                            </button>
                            <button class='${ACTION}' onclick='${() => controller?.next('change')}' type='button'>
                                Next change
                            </button>
                            <button
                                class='${ACTION}'
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
                            ${editor.tree({
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
                let naming = new FileTreeEditor(),
                    files = new FileTreeElements(workspace()),
                    history = new FileTreeHistory(files),
                    log = reactive({ message: 'F2 renames the focused row; Alt+N and Alt+Shift+N add a file or folder; Ctrl+Z undoes' }),
                    next = 0,
                    state = reactive({ selected: 'index' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo-actions'>
                            <button class='${ACTION}' onclick='${() => naming.create('file')}' type='button'>New file</button>
                            <button class='${ACTION}' onclick='${() => naming.create('folder')}' type='button'>New folder</button>
                            <button class='${ACTION}' onclick='${() => naming.rename()}' type='button'>Rename</button>
                        </div>
                        <div class='file-tree-demo'>
                            ${editor.tree({
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
                                editor: naming,
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
                            ${editor.tree({
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
                                class='${ACTION}'
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
                let files = new FileTreeElements(movable()),
                    state = reactive({ selected: '' }),
                    ui = reactive({
                        entries: '',
                        last: 'Drop files or folders from your computer onto a folder, or below the rows for the top level.'
                    });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${editor.tree({
                                elements: files,
                                expanded: ['src'],
                                operations: {
                                    // Stands in for writing to disk: what was dropped joins the store, folders walked
                                    // through, under the folder it landed on.
                                    import: (target, entries) => {
                                        let added = imported(files, target, entries);

                                        ui.entries = entries.map((entry) => entry.file ? `${entry.path} (${entry.file.size} bytes)` : `${entry.path}/`).join(', ');
                                        ui.last = `Imported ${entries.length} ${entries.length === 1 ? 'item' : 'items'} into ${target?.name ?? 'the top level'}.`;

                                        if (added.length) {
                                            state.selected = added[0];
                                        }
                                    }
                                },
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.last}</p>
                        <p class='file-tree-demo-caption'>Entries: <code>${() => ui.entries || 'nothing yet'}</code></p>
                    </div>
                `;
            },
            title: 'drop files and folders from the desktop'
        },
        {
            render: () => {
                let drops = 0,
                    files = new FileTreeElements(notes()),
                    state = reactive({ selected: '' }),
                    ui = reactive({ last: 'Drag a file to the desktop or into another app; within the tree it still moves, and Alt/Option copies.' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${editor.tree({
                                drag: {
                                    drop: (drop) => {
                                        let into = drop.target?.id ?? null;

                                        drops++;

                                        for (let element of drop.elements) {
                                            if (drop.copy) {
                                                files.add(copy(element, drops), into);
                                            }
                                            else {
                                                files.move(element.id, into);
                                            }
                                        }

                                        ui.last = `${drop.copy ? 'Copied' : 'Moved'} ${drop.elements.map((element) => element.name).join(', ')} into ${drop.target?.name ?? 'the top level'}.`;
                                    }
                                },
                                elements: files,
                                expanded: ['notes'],
                                // Text files leave as data URLs: the desktop saves them as they are, and an editor or
                                // a text field takes the text. A copy's id carries a '~' suffix.
                                export: (element) => {
                                    let text = TEXTS[element.id.split('~')[0]];

                                    if (text === undefined) {
                                        return null;
                                    }

                                    return {
                                        name: element.name,
                                        text,
                                        type: 'text/plain',
                                        url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
                                    };
                                },
                                state
                            })}
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.last}</p>
                    </div>
                `;
            },
            title: 'drag files out to the desktop or another app'
        },
        {
            render: () => {
                let controller: FileTreeController | undefined,
                    decorations = new FileTreeDecorations(),
                    state = reactive({ selected: '' }),
                    ui = reactive({ last: 'Alt+F5 / Shift+Alt+F5 step through changes and F8 / Shift+F8 through problems while the tree has focus.' });

                decorations.replace([
                    ['src/components/card/expand.ts', { status: 'untracked' }],
                    ['src/components/file-tree/index.ts', { errors: 2, status: 'modified' }],
                    ['src/components/heatmap/index.ts', { warnings: 1 }],
                    ['tsconfig.json', { staged: 'modified' }],
                    // Inside folders not loaded yet, which a jump loads on its way.
                    ['vendor/lib/parse.ts', { errors: 1, status: 'modified' }],
                    ['vendor/lib/print.ts', { status: 'added' }]
                ]);

                async function go(kind: FileTreeJump, step: 'next' | 'previous') {
                    let element = await controller?.[step](kind);

                    ui.last = element ? `${step === 'next' ? 'Next' : 'Previous'} ${kind}: ${element.id}` : `No ${kind}s.`;
                }

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${editor.tree({
                                controller: (value) => {
                                    controller = value;
                                },
                                decorations,
                                elements: [...structuredClone(REPOSITORY), { id: 'vendor', name: 'vendor', type: 'folder' }],
                                load: (element) => new Promise<FileTreeElement[]>((resolve) => {
                                    setTimeout(() => resolve(VENDOR[element.id] ?? []), 600);
                                }),
                                preview: true,
                                state
                            })}
                        </div>
                        <div class='file-tree-demo-actions'>
                            <button class='${ACTION}' onclick='${() => go('change', 'previous')}' type='button'>Previous change</button>
                            <button class='${ACTION}' onclick='${() => go('change', 'next')}' type='button'>Next change</button>
                            <button class='${ACTION}' onclick='${() => go('problem', 'previous')}' type='button'>Previous problem</button>
                            <button class='${ACTION}' onclick='${() => go('problem', 'next')}' type='button'>Next problem</button>
                        </div>
                        <p class='file-tree-demo-caption'>${() => ui.last}</p>
                    </div>
                `;
            },
            title: 'next and previous change or problem, through lazy folders'
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
                            ${editor.tree({ elements: files, expanded: ['src'], history, load, state })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='${ACTION}'
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
                                class='${ACTION}'
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
                                class='${ACTION}'
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
                                class='${ACTION}'
                                onclick='${() => {
                                    if (files.get(state.selected)) {
                                        history.transact(() => files.remove(state.selected));
                                    }
                                }}'
                                type='button'
                            >
                                Delete
                            </button>
                            <button class='${ACTION}' onclick='${() => history.undo()}' type='button'>Undo</button>
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
                    naming = new FileTreeEditor(),
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
                                class='${ACTION} ${() => !history.canUndo && '--disabled'}'
                                onclick='${() => history.undo()}'
                                type='button'
                            >
                                Undo
                            </button>
                            <button
                                class='${ACTION} ${() => !history.canRedo && '--disabled'}'
                                onclick='${() => history.redo()}'
                                type='button'
                            >
                                Redo
                            </button>
                            <button class='${ACTION}' onclick='${() => naming.create('file')}' type='button'>New file</button>
                            <button
                                class='${ACTION}'
                                onclick='${() => {
                                    ui.ask = !ui.ask;
                                }}'
                                type='button'
                            >
                                ${() => ui.ask ? 'Confirm restores: on' : 'Confirm restores: off'}
                            </button>
                        </div>
                        <div class='file-tree-demo'>
                            ${editor.tree({
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
                                editor: naming,
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

                                return editor.tree({
                                    elements: files,
                                    empty: () => html`
                                        <p>No files yet</p>
                                        <button class='${ACTION}' onclick='${() => files.add(packages())}' type='button'>Add files</button>
                                    `,
                                    snapshot
                                });
                            }}
                        </div>
                        <p class='file-tree-demo-caption'>Saved: <code>${() => mounted.saved || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='${ACTION}'
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
                                class='${ACTION}'
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
                            ${editor.tree({
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
                                class='${ACTION}'
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
                                class='${ACTION}'
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
