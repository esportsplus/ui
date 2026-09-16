import { frame } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
    name: 'frame',
    variants: [
        {
            render: () => frame(
                { class: '--active', style: 'height: 160px; border: 1px solid var(--color-border-400); border-radius: var(--border-radius-400);' },
                html`
                    <div style='display: flex; flex-direction: column; gap: var(--size-400); padding: var(--size-500); width: 100%;'>
                        ${Array.from({ length: 12 }).map((_, i) => html`
                            <div class='text'>Scrollable row ${i + 1}</div>
                        `)}
                    </div>
                `
            ),
            title: 'scroll frame'
        }
    ]
};


export default entry;
