import { html } from '@esportsplus/template';
import glass from '@esportsplus/ui/modifiers/glass';

import type { Modifier } from 'docs/types';


const modifiers: Modifier[] = [
    {
        description: 'Uniform or progressive backdrop blur; glass() adds a uniform overlay, glass(\'progressive\') adds seven masked layers, and --blur sets the blur radius.',
        name: 'glass',
        variants: [
            {
                render: () => html`
                    <div style='background: linear-gradient(120deg, var(--color-blue-400), var(--color-purple-400)); border-radius: var(--border-radius-500); padding: var(--size-700);'>
                        <div ${glass()} style='border-radius: var(--border-radius-400); color: var(--color-white-400); padding: var(--size-500);'>Frosted glass</div>
                    </div>
                `,
                title: 'uniform'
            },
            {
                render: () => html`
                    <div style='background: linear-gradient(120deg, var(--color-blue-400), var(--color-purple-400)); border-radius: var(--border-radius-500); padding: var(--size-700);'>
                        <div ${glass('progressive')} style='border-radius: var(--border-radius-400); color: var(--color-white-400); padding: var(--size-500);'>Progressive frosted glass</div>
                    </div>
                `,
                title: 'progressive'
            }
        ]
    },
    {
        description: 'Thin, token-colored scrollbar styling for scrollable containers.',
        name: 'scrollbar',
        variants: [
            {
                render: () => html`
                    <div class='--scrollbar modifiers-scrollbar' style='border-radius: var(--border-radius-400); height: var(--size-900); padding: var(--size-400); width: 100%;'>
                        <div style='height: 480px;'>Scroll me — the container uses --scrollbar for a thin, token-colored scrollbar.</div>
                    </div>
                `,
                title: 'scrollbar'
            }
        ]
    }
];


export { modifiers };
