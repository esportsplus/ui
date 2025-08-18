import { html } from '@esportsplus/template';
import template from '~/components/template';


export default template.factory(
    (attributes, content) => html`
        <div class='field-description' ${attributes}>
            ${content}
        </div>
    `
);