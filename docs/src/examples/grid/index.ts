import { html } from '@esportsplus/template';
import 'docs/examples/grid/scss/index.scss';


export default {
    name: 'grid',
    variants: [
        {
            render: () => html`
                <div class='grid'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-demo-item grid-item preview-text'>Item ${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'auto-fit (min 200px)'
        },
        {
            render: () => html`
                <div class='grid' style='--min-width: 120px;'>
                    ${Array.from({ length: 6 }).map((_, i) => html`
                        <div class='grid-demo-item grid-item preview-text'>${i + 1}</div>
                    `)}
                </div>
            `,
            title: 'min-width 120px'
        }
    ]
};
