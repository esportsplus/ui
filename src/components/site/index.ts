import { html } from '@esportsplus/template';
import { scrollbar } from '~/components';


type Data = {
    class?: string;
    content?: any;
    scrollbar?: {
        style?: string;
    };
};


export default (data: Data) => {
    let { attributes: a, html: h } = scrollbar({
            fixed: true,
            style: data?.scrollbar?.style || '--background-default: var(--color-black-400);'
        });

    return html`
        <section class='site ${data?.class || ''}' ...${a}>
            ${data?.content || ''}
            ${h}
        </section>
    `;
};