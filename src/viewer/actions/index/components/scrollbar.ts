import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let box = 'height: 160px; border: 1px solid var(--color-border-400); border-radius: var(--border-radius-400);';

function rows(count: number) {
    return html`
        <div style='display: flex; flex-direction: column; gap: var(--size-400); padding: var(--size-500); width: 100%;'>
            ${Array.from({ length: count }).map((_, i) => html`
                <div class='text'>Row ${i + 1}</div>
            `)}
        </div>
    `;
}


const entry: Entry = {
    name: 'scrollbar',
    variants: [
        {
            render: () => html`<div class='--scrollbar' style='${box}'>${rows(14)}</div>`,
            title: 'default bar'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar--hidden' style='${box}'>${rows(14)}</div>`,
            title: 'hidden bar'
        }
    ]
};


export default entry;
