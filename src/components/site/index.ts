import { html } from '@esportsplus/template';
import { onclick } from '~/components/root';
import scrollbar from '~/components/scrollbar';


type Data = {
    class?: string;
    content?: any;
    scrollbar?: Parameters<typeof scrollbar>[0];
};


export default (data: Data) => {
    data.scrollbar ??= {};
    data.scrollbar.fixed ??= true;
    data.scrollbar.style ??= '--background-default: var(--color-black-400);';

    let { attributes: a, html: h } = scrollbar(data.scrollbar || {});

    return html`
        <section class='site ${data?.class || ''}' ${{ onclick }} ${a}>
            ${data?.content || ''}
            ${h}
        </section>
    `;
};