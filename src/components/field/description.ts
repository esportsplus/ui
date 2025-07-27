import { html, type Attributes } from '@esportsplus/template';
import template from '~/components/template';


export default template.factory<Attributes>(
    (attributes, content) => html`
        <div class='field-description' ${attributes}>
            ${content}
        </div>
    `
);