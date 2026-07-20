import { html } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    function(this, attributes, content) {
        return html`
            <div class='sidebar --flex-column --scrollbar' ${this?.attributes} ${attributes}>
                ${content}
            </div>
        `;
    }
);
