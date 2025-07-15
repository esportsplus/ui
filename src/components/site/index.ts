import { html } from '@esportsplus/template';
import { onclick } from '../root';
import scrollbar from '../scrollbar';
import './scss/index.scss';


type Data = {
    attributes?: Record<string, unknown>;
    content?: any;
    scrollbar?: Parameters<typeof scrollbar>[0];
};


export default ({ attributes, content, scrollbar: sb }: Data) => {
    sb ??= {};
    sb.attributes ??= {};
    sb.attributes.style ??= '--background-default: var(--color-black-400);';
    sb.fixed ??= true;

    let { html: h, parent } = scrollbar(sb);

    return html`
        <section class='site' ${attributes} ${{ onclick }} ${parent.attributes}>
            ${content || ''}
            ${h}
        </section>
    `;
};