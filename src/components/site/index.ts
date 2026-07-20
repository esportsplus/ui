import { html } from '@esportsplus/template';
import { onclick } from '~/components/root';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    function(this, attributes, content) {
        return html`
            <div class='site --scrollbar' ${{ onclick }} ${this?.attributes} ${attributes}>
                ${content}
            </div>
        `;
    }
);
