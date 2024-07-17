import { html } from '@esportsplus/template';
import { onclick } from '~/components/root';
import scrollbar from '~/components/scrollbar';


type Data = {
    class?: string;
    content?: any;
    scrollbar?: Parameters<typeof scrollbar>[0];
};


export default (data: Data) => {
    let sb = data.scrollbar ??= {};

    sb.attributes ??= {};
    sb.attributes.style ??= '--background-default: var(--color-black-400);';
    sb.fixed ??= true;

    let { attributes: a, html: h } = scrollbar(sb);

    return html`
        <section class='site ${data?.class || ''}' ${{ onclick }} ${a}>
            ${data?.content || ''}
            ${h}
        </section>
    `;
};