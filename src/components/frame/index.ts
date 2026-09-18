import { component, html } from '@esportsplus/template';
import './scss/index.scss';


export default component(
    function(this, attributes, content) {
        return html`
            <div class='frame --scrollbar' ${this?.attributes} ${attributes}>
                ${content}
            </div>
        `;
    }
);
