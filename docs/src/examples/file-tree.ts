import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { fileTree } from '@esportsplus/ui';
import type { FileTreeElement } from '~/components/file-tree';
import './file-tree.scss';


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


export default {
    name: 'file-tree',
    variants: [
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${fileTree({
                        elements: ELEMENTS,
                        expanded: ['src', 'app', 'components', 'ui', 'lib'],
                        selected: 'button'
                    })}
                </div>
            `,
            title: 'default'
        },
        {
            render: () => {
                let state = reactive({ selected: 'page' });

                return html`
                    <div class='file-tree-demo-stack'>
                        <div class='file-tree-demo'>
                            ${fileTree({ elements: ELEMENTS, state, toggle: true })}
                        </div>
                        <p class='file-tree-demo-caption'>Selected: <code>${() => state.selected || 'nothing'}</code></p>
                    </div>
                `;
            },
            title: 'selection state, expand/collapse all'
        },
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${fileTree({ elements: LOCKED, expanded: ['project'], indicator: false })}
                </div>
            `,
            title: 'locked items, natural sort, no indicator'
        },
        {
            render: () => html`
                <div class='file-tree-demo'>
                    ${fileTree({ dir: 'rtl', elements: ELEMENTS, expanded: ['src', 'components'], sort: 'none' })}
                </div>
            `,
            title: 'right to left, source order'
        }
    ]
};
