import { html, Attributes, svg } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory<Attributes, Parameters<typeof svg.sprite>[0]>(
    (attributes, icon) => {
        return html`
            <div class='icon' ${attributes}>
                ${svg.sprite(icon)}
            </div>
        `;
    }
);