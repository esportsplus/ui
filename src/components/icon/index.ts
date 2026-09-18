import { component, html } from '@esportsplus/template';
import './scss/index.scss';


export default component(
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