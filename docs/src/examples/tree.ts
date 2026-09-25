import { tree } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let frame = 'background: var(--color-white-400); border: 1px solid var(--color-border-300); border-radius: var(--border-radius-500); box-shadow: var(--box-shadow-300); max-width: 320px; padding: var(--size-200); width: 100%;',
    nodes = [
        {
            children: [
                {
                    children: [
                        { id: 'src/components/button.ts', label: 'button.ts', meta: '4 kB' },
                        { id: 'src/components/tree.ts', label: 'tree.ts', meta: '9 kB' }
                    ],
                    id: 'src/components',
                    label: 'components'
                },
                { id: 'src/index.ts', label: 'index.ts', meta: '2 kB' },
                { id: 'src/utilities.ts', label: 'utilities.ts', meta: '3 kB' }
            ],
            id: 'src',
            label: 'src'
        },
        {
            children: [
                { id: 'docs/getting-started.md', label: 'getting-started.md', meta: '6 kB' },
                { id: 'docs/theming.md', label: 'theming.md', meta: '5 kB' }
            ],
            id: 'docs',
            label: 'docs'
        },
        { id: 'package.json', label: 'package.json', meta: '1 kB' },
        { id: 'README.md', label: 'README.md', meta: '3 kB' }
    ];


export default {
    name: 'tree',
    variants: [
        {
            render: () => {
                let state = reactive({ selected: 'src/components/tree.ts' });

                return html`
                    <div class='--flex-column' style='--gap-vertical: var(--size-400); width: 100%;'>
                        <div style='${frame}'>
                            ${tree({
                                expanded: ['src', 'src/components'],
                                label: 'Repository files',
                                nodes,
                                select: (id) => state.selected = id,
                                selected: state.selected
                            })}
                        </div>

                        <div class='text' style='--color-default: var(--color-text-300); --font-size: var(--font-size-300);'>
                            Selected: ${() => state.selected}
                        </div>
                    </div>
                `;
            },
            title: 'file browser'
        }
    ]
};
