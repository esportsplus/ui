import { html } from '@esportsplus/template';
import 'docs/examples/grid/scss/index.scss';


let cell = 'padding: var(--size-500); border-radius: var(--border-radius-300); text-align: center;';


export default {
    name: 'grid',
    variants: [
        {
            render: () => html`
                <div class='grid'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-demo-item grid-item text' style='${cell}'>Item ${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'auto-fit (min 200px)'
        },
        {
            render: () => html`
                <div class='grid' style='--min-width: 120px;'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-demo-item grid-item text' style='${cell}'>${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'min-width 120px'
        }
    ]
};
