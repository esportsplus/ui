import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


export default component(
    function(this: { attributes?: Attributes } | void, attributes: Attributes, href: string) {
        return html`
            <div class='icon' ${this?.attributes} ${attributes}>
                <svg>
                    <use href='${href}' />
                </svg>
            </div>
        `;
    }
);
