import { html, svg } from '@esportsplus/template';
import './scss/index.scss';


export default (attributes: Record<string, unknown>, icon: Parameters<typeof svg.sprite>[0]) => {
    return html`
        <div class='icon' ${attributes}>
            ${svg.sprite(icon)}
        </div>
    `;
};