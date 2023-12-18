import { html } from '@esportsplus/template';


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


export default (data: Data) => html`
    <form class='${data?.class}' ${data?.action || ''}>
        ${data?.content || ''}

        ${data?.button?.content ? html`
            <button class="button ${data?.button?.class || ''}" style='${data?.button?.style || ''}'>
                ${data?.button?.content || ''}
            </button>
        ` : ''}
    </form>
`;