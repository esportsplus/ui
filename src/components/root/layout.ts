import { html } from '@esportsplus/template';
import { scrollbar } from '~/components';


type Data = {
    overlay?: {
        class?: string;
        content?: any;
    };
    site?: {
        class?: string;
        content?: any;
        scrollbar?: {
            style?: string;
        };
    };
};


export default (data: Data = {}) => {
    let s = scrollbar({
            fixed: true,
            style: data?.site?.scrollbar?.style || '--background-default: var(--color-black-400);'
        });

    return html`
        <section class='site ${data?.site?.class || ''}' ${s.attributes}>
            ${data?.site?.content || ''}
            ${s.html}
        </section>

        <section class='overlay ${data?.overlay?.class || ''}'>
            ${data?.overlay?.content || ''}
        </section>
    `;
};