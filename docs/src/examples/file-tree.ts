import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { fileTree, FileTreeDecorations, FileTreeEditor, FileTreeElements } from '@esportsplus/ui';
import type {
    FileTreeController,
    FileTreeElement,
    FileTreeSnapshot,
    FileTreeSortCase,
    FileTreeSortOrder
} from '~/components/file-tree';
import './file-tree.scss';


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

// A pasted or dropped copy, named apart from what it copies.
function copy(element: FileTreeElement, uid: number): FileTreeElement {
    return { ...duplicate(element, uid), name: element.name.replace(/(\.[^.]*)?$/, ' copy$1') };
}

function duplicate(element: FileTreeElement, uid: number): FileTreeElement {
    return {
        ...element,
        children: element.children?.map((child) => duplicate(child, uid)),
        id: `${element.id}~${uid}`
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

function packages(): FileTreeElement[] {
    return Array.from({ length: 12 }, (_, p) => ({
        children: Array.from({ length: 30 }, (_, f) => ({ id: `package-${p}/file-${f}`, name: `file-${f}.ts` })),
        id: `package-${p}`,
        name: `package-${p}`,
        type: 'folder' as const
    }));
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
                let settings = reactive({ case: 'insensitive' as FileTreeSortCase, order: 'folders' as FileTreeSortOrder, unicode: false });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo-actions'>
                            <label>
                                Order
                                <select onchange='${(event: Event) => {
                                    settings.order = (event.target as HTMLSelectElement).value as FileTreeSortOrder;
                                }}'>
                                    ${ORDERS.map((order) => html`<option value='${order}'>${order}</option>`)}
                                </select>
                            </label>
                            <label>
                                Case
                                <select onchange='${(event: Event) => {
                                    settings.case = (event.target as HTMLSelectElement).value as FileTreeSortCase;
                                }}'>
                                    ${CASES.map((value) => html`<option value='${value}'>${value}</option>`)}
                                </select>
                            </label>
                            <label>
                                <input
                                    onchange='${() => {
                                        settings.unicode = !settings.unicode;
                                    }}'
                                    type='checkbox'
                                />
                                Unicode
                            </label>
                        </div>
                        <div class='file-tree-demo'>
                            ${() => {
                                let sort = { case: settings.case, order: settings.order, unicode: settings.unicode };

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
                                    { color: 'var(--color-green-500)', match: /^tests(\/|$)/ },
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
                    log = reactive({ text: 'Ctrl/Shift+click, Shift+arrows, Ctrl+A, Ctrl+X then Ctrl+V, Delete, Shift+Alt+C, right-click' }),
                    state = reactive({ selected: 'src/components/file-tree/index.ts', selection: new Set<string>() });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({
                                elements: files,
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
                                        for (let element of elements) {
                                            files.remove(element.id);
                                        }

                                        log.text = `${permanent ? 'Deleted' : 'Trashed'} ${list(elements)}`;
                                    },
                                    duplicate: (elements) => {
                                        for (let element of elements) {
                                            files.add(copy(element, ++copies), files.index.get(element.id)?.parent ?? null);
                                        }

                                        log.text = `Duplicated ${list(elements)}`;
                                    },
                                    // A move takes a moment on disk; the cut items stay dimmed until it's done.
                                    paste: (elements, target, cut) => new Promise<void>((resolve) => {
                                        log.text = `${cut ? 'Moving' : 'Copying'} ${list(elements)} into ${target?.id ?? 'the root'}…`;
                                        setTimeout(() => {
                                            for (let element of elements) {
                                                if (cut) {
                                                    files.move(element.id, target?.id ?? null);
                                                }
                                                else {
                                                    files.add(copy(element, ++copies), target?.id ?? null);
                                                }
                                            }

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
                    log = reactive({ message: 'F2 renames the focused row; Alt+N and Alt+Shift+N add a file or folder' }),
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
                                    let id = '',
                                        root: FileTreeElement | undefined,
                                        tail: FileTreeElement | undefined;

                                    for (let i = 0, n = parts.length; i < n; i++) {
                                        let element: FileTreeElement = i === n - 1 && kind === 'file'
                                            ? { id: `new-${++next}`, name: parts[i] }
                                            : { children: [], id: `new-${++next}`, name: parts[i], type: 'folder' };

                                        if (tail) {
                                            tail.children!.push(element);
                                        }
                                        else {
                                            root = element;
                                        }

                                        id = element.id;
                                        tail = element;
                                    }

                                    files.add(root!, parent?.id ?? null);
                                    log.message = `Created ${parts.join('/')} in ${parent?.name ?? 'the root'}`;
                                    // Once the input has closed, handing focus back to the row it opened from.
                                    setTimeout(() => {
                                        state.selected = id;
                                    });
                                },
                                editor,
                                elements: files,
                                expanded: ['src'],
                                // Settles after a moment, as a disk write would; the input waits on it.
                                rename: (element, name) => new Promise<boolean>((resolve) => {
                                    setTimeout(() => {
                                        log.message = `Renamed ${element.name} to ${name}`;
                                        files.rename(element.id, name);
                                        resolve(true);
                                    }, 400);
                                }),
                                shortcuts: true,
                                state,
                                validate: (name) => /\.exe$/i.test(name) ? 'Executables can\'t be added to this project' : undefined
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

                                        ui.last = `${drop.copy ? 'Copied' : 'Moved'} ${drop.elements.map((element) => element.name).join(', ')} into ${drop.target?.name ?? 'the top level'}.`;

                                        if (landed.length) {
                                            state.selected = landed[0];
                                        }
                                    }
                                },
                                elements: files,
                                expanded: ['components', 'src'],
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
                            ${fileTree({ elements: files, expanded: ['src'], load, state })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                        <div class='file-tree-demo-actions'>
                            <button
                                class='button'
                                onclick='${() => {
                                    let id = `new-${++count}`;

                                    files.add({ id, name: `untitled-${count}.ts` }, folder());
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
                                        files.rename(element.id, `renamed-${element.name}`);
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
                                        files.move(element.id, files.index.get(element.id)!.parent === 'lib' ? 'src' : 'lib');
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
                                        files.remove(state.selected);
                                    }
                                }}'
                                type='button'
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            },
            title: 'live updates, lazy folders'
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
        }
    ]
};
