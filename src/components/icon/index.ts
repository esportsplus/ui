import { html } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    (attributes, href: string) => {
        if (href[0] !== '#') {
            href = '#' + href;
        }

        return html`
            <div class='icon' ${attributes}>
                <svg><use href='${href}' /></svg>
            </div>
        `;
    }
);