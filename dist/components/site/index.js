import { html } from '@esportsplus/template';
import { onclick } from '../../components/root/index.js';
import scrollbar from '../../components/scrollbar/index.js';
import './scss/index.scss';
export default ({ attributes, content, scrollbar: sb }) => {
    sb ??= {};
    sb.attributes ??= {};
    sb.attributes.style ??= '--background-default: var(--color-black-400);';
    sb.fixed ??= true;
    let { html: h, parent } = scrollbar(sb);
    return html `
        <section class='site' ${attributes} ${{ onclick }} ${parent.attributes}>
            ${content || ''}
            ${h}
        </section>
    `;
};
