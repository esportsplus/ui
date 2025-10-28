import { html } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    (attributes, content) => {
        return html`
            <a class='back link --padding-0px --flex-vertical' ${attributes}>
                ${content}
            </a>
        `;
    }
);