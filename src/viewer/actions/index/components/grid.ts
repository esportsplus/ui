import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let cell = 'padding: var(--size-500); border-radius: var(--border-radius-300); background: var(--color-grey-300); text-align: center;';


const entry: Entry = {
    name: 'grid',
    variants: [
        {
            render: () => html`
                <div class='grid'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-item text' style='${cell}'>Item ${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'auto-fit (min 200px)'
        },
        {
            render: () => html`
                <div class='grid' style='--min-width: 120px;'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-item text' style='${cell}'>${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'min-width 120px'
        }
    ]
};


export default entry;
