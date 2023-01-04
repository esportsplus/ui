import { html } from '@esportsplus/template';
import { header } from '~/components/page';


type Data = {
    action?: any;
    button?: {
        class?: string;
        content?: any;
        style?: string;
    };
    class?: string;
    content?: any;
};


export default (data: Data & Parameters<typeof header>[0]) => html`
    ${header(data)}

    <form class='${data?.class}' ${data?.action || ''}>
        ${data?.content || ''}

        ${data?.button ? html`
            <button class="button ${data?.button?.class || ''}" style='${data?.button?.style || ''}'>
                ${data?.button?.content || ''}
            </button>
        ` : ''}
    </form>
`;