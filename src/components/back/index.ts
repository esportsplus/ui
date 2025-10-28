import { html, Attributes } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    function (this: { attributes?: Attributes }, attributes, content) {
        return html`
            <a
                class='back link --padding-0px --flex-vertical'
                ${this.attributes}
                ${attributes}
            >
                ${content}
            </a>
        `;
    }
);