import { html, svg } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory(
    (attributes, icon: Parameters<typeof svg.sprite>[0]) => {
        return html`
            <div class='icon' ${attributes}>
                ${svg.sprite(icon)}
            </div>
        `;
    }
);