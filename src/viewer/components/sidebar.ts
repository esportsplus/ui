import { sidebar } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let panel = 'height: 100%; --padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); background: var(--color-grey-300);',
    stage = 'position: relative; height: 200px; border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400); overflow: hidden;';

function panelContent(side: string) {
    return html`
        <div class='card' style='${panel}'>
            <div class='text' style='font-weight: var(--font-weight-600);'>${side} sidebar</div>
        </div>
    `;
}


const entry: Entry = {
    name: 'sidebar',
    variants: [
        {
            render: () => html`
                <div style='${stage}'>
                    ${sidebar({ class: 'sidebar--floating sidebar--w --active', style: '--width: 160px;' }, panelContent('left'))}
                </div>
            `,
            title: 'floating left'
        },
        {
            render: () => html`
                <div style='${stage}'>
                    ${sidebar({ class: 'sidebar--floating sidebar--e --active', style: '--width: 160px;' }, panelContent('right'))}
                </div>
            `,
            title: 'floating right'
        }
    ]
};


export default entry;
