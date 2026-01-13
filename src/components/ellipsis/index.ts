import { html, Attributes } from '@esportsplus/template';
import './scss/index.scss';


export default (attributes?: Attributes) => html`
    <div class='ellipsis' ${attributes}>
        <span></span>
        <span></span>
        <span></span>
    </div>
`;