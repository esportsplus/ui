import { treeView } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


const PROJECT = [
    {
        children: [
            {
                children: [{ name: 'layout.tsx' }, { name: 'page.tsx' }, { name: 'globals.css' }],
                name: 'app'
            },
            {
                children: [
                    {
                        children: [{ name: 'code-block.tsx' }, { name: 'reading-progress.tsx' }, { name: 'tree-view.tsx' }],
                        name: 'components'
                    },
                    { name: 'registry.ts' }
                ],
                name: 'lab'
            },
            { children: [{ name: 'cn.ts' }], name: 'lib' }
        ],
        name: 'src'
    },
    { children: [{ name: 'favicon.svg' }, { name: 'og.png' }], name: 'public' },
    { name: 'package.json' },
    { name: 'README.md' }
];


export default {
    name: 'tree-view',
    variants: [
        {
            render: () => html`
                <div
                    class='card'
                    style='
                        --background-default: var(--color-white-300);
                        --border-radius: var(--border-radius-600);
                        --box-shadow-default: var(--box-shadow-300);
                        --padding-horizontal: 6px;
                        --padding-vertical: 6px;
                        max-width: 100%;
                        width: 360px;
                    '
                >
                    ${treeView({
                        'aria-label': 'Project files',
                        nodes: PROJECT,
                        open: ['src', 'src/app'],
                        selected: 'src/app/page.tsx'
                    })}
                </div>
            `,
            title: 'project files'
        },
        {
            render: () => {
                let state = reactive({ selected: '' });

                return html`
                    <div class='--flex-column' style='gap: var(--size-400); max-width: 100%; width: 360px;'>
                        ${treeView({ 'aria-label': 'Project files', nodes: PROJECT, state })}

                        <div class='text'>
                            Selected: ${() => state.selected || 'nothing'}
                        </div>
                    </div>
                `;
            },
            title: 'bound state'
        }
    ]
};
