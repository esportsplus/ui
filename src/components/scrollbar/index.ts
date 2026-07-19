import { html, type Attributes } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory<Attributes>(
    function(this: { attributes?: Attributes }, attributes, content) {
        return html`
            <div class='scrollbar' ${this?.attributes} ${attributes}>
                ${content}
            </div>
        `;
    }
);
export type { Attributes };
