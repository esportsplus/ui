import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'text',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400);'>
                    <div class='text' style='--font-size: var(--font-size-600); --font-weight: var(--font-weight-600);'>Large bold text</div>
                    <div class='text'>Default body text at font-size 400.</div>
                    <div class='text' style='--font-size: var(--font-size-300); --color: var(--color-text-300);'>Small muted caption text.</div>
                    <div class='text' style='--color: var(--color-purple-300); --font-weight: var(--font-weight-500);'>Coloured emphasis text.</div>
                </div>
            `,
            title: 'sizes, weights, colours'
        }
    ]
};


export default entry;
