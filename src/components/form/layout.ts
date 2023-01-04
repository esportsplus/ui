import { html } from '@esportsplus/template';
import { layout } from '~/components/page';


type Data = {
    action?: any;
    button?: {
        class?: string;
        content?: any;
        style?: string;
    };
    content?: any;
    width?: string;
};


export default (data: Data & Parameters<typeof layout>[0]) => {
    data.content = html`
        <form class='--margin-top --margin-800' ${data?.action || ''}>
            ${data?.content || ''}

            ${data?.button ? html`
                <button class="button ${data?.button?.class || ''}" style='${data?.button?.style || ''}'>
                    ${data?.button?.content || ''}
                </button>
            ` : ''}
        </form>
    `;
    data.width = data?.width || '480px';

    return layout(data);
};