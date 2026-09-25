import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    // Width of the highlight band in px.
    width?: number;
};


export default component<A>(
    function(this, { width = 100, ...attributes }, content) {
        return html`
            <span class='shiny-text' style='${`--shine-width: ${width}px`}' ${this?.attributes} ${attributes}>
                ${content}
            </span>
        `;
    }
);
