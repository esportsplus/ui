import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let dot = 'padding: var(--size-200) var(--size-400); border-radius: var(--border-radius-300); background: var(--color-purple-300); color: var(--color-white-400);',
    stage = 'position: relative; height: 140px; border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400);';


const entry: Entry = {
    name: 'anchor',
    variants: [
        {
            render: () => html`
                <div style='${stage}'>
                    ${['n', 'ne', 'nw', 's', 'se', 'sw'].map((direction) => html`
                        <div class='anchor anchor--${direction} --active' style='${dot}'>${direction}</div>
                    `)}
                </div>
            `,
            title: 'positions'
        }
    ]
};


export default entry;
