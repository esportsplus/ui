import { html } from '../../app';
import type { Renderable } from '../../app';
import './scss/index.scss';


const preview = (title: string | null, node: Renderable<unknown>, id?: string) => html`
    <div
        class='preview card --border-default --border-border'
        id='${id ?? ''}'
        style='--border-radius: var(--border-radius-600); --border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color); margin-bottom: var(--size-500);'
    >
        ${title !== null && html`
            <div class='preview-bar'>
                <span class='preview-title'>${title}</span>
            </div>
        `}

        <div class='preview-stage'>${node}</div>
    </div>
`;


export { preview };
