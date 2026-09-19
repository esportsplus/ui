import { html } from '../../app';
import type { Renderable } from '../../app';
import './scss/index.scss';


const preview = (title: string | null, node: Renderable<unknown>, id?: string) => html`
    <div class='preview card --border --border-default --border-border --border-radius-600 --margin-bottom --margin-vertical-500' id='${id ?? ''}'>
        ${title !== null && html`
            <div class='preview-bar'>
                <span class='preview-title'>${title}</span>
            </div>
        `}

        <div class='preview-stage'>${node}</div>
    </div>
`;


export { preview };
