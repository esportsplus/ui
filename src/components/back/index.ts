import { html, Attributes, Renderable } from '@esportsplus/template';
import './scss/index.scss';


export default ({ attributes, content }: { attributes?: Attributes, content?: Renderable<any> }) => {
    return html`
        <a class='back link --padding-0px --flex-vertical' ${attributes}>
            ${content}
        </a>
    `;
};