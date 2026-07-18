import { html, type Renderable } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


const category = (entries: Entry[]): Renderable<unknown> => html`
    ${entries.map((entry) => html`
        <section class='viewer-entry' data-name='${entry.name}' id='viewer-${entry.name}'>
            <h2 class='viewer-entry-title'>${entry.name}</h2>

            <div class='grid'>
                ${entry.variants.map((variant) => html`
                    <div class='card viewer-variant'>
                        <div class='viewer-variant-title'>${variant.title}</div>
                        ${variant.render()}
                    </div>
                `)}
            </div>
        </section>
    `)}
`;


export default category;
