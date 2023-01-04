import { html } from '@esportsplus/template';
import { alert, scrollbar } from '~/components';


type Data = {
    anchor?: {
        content?: any;
    };
    content?: any;
    page?: {
        class?: string;
        content?: any;
    };
    scrollbar?: {
        style?: string;
    };
    site?: {
        content?: any;
    };
};


export default (data: Data = {}) => {
    let bar = scrollbar({
            fixed: true,
            style: data?.scrollbar?.style
        });

    return html`
        <section class='site' ${bar.attributes}>
            <section class='page --padding-horizontal --padding-horizontal-sidebars ${data?.page?.class}'>
                ${data?.page?.content}
            </section>

            ${data?.site?.content || ''}
            ${bar.html}
        </section>

        <section class='anchors'>
            ${alert.html()}
            ${data?.anchor?.content || ''}
        </section>

        ${data?.content || ''}
    `;
};