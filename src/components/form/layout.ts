import { html } from '@esportsplus/template';
import { header } from '~/components/page';


type Data = {
    action?: any;
    button?: {
        class?: any;
        content?: any;
        style?: string;
    };
    class?: string;
    content?: any;
} & Parameters<typeof header>[0];


export default (data: Data) => html`
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