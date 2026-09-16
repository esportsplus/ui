import { html, type Renderable } from '@esportsplus/template';
import { meta } from '~/viewer/meta';
import type { Entry } from '~/viewer/types';


const entry = (item: Entry): Renderable<unknown> => html`
    <article class='viewer-entry' data-name='${item.name}' id='viewer-${item.name}'>
        <header class='viewer-entry-header'>
            <h2 class='viewer-entry-title'>${item.name}</h2>
            <p class='viewer-entry-description'>${meta[item.name]?.description ?? ''}</p>
        </header>

        <div class='viewer-variants'>
            ${item.variants.map((variant) => html`
                <figure class='viewer-preview'>
                    <figcaption class='viewer-preview-bar'>
                        <span class='viewer-preview-tab --active'>Preview</span>
                        <span class='viewer-preview-title'>${variant.title}</span>
                    </figcaption>

                    <div class='viewer-preview-stage'>
                        ${variant.render()}
                    </div>
                </figure>
            `)}
        </div>
    </article>
`;


export default entry;
