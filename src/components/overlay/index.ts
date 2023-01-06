import { html } from '@esportsplus/template';


type Data = {
    class?: string;
    content?: any;
};


export default (data: Data = {}) => html`
    <section class='overlay ${data?.class || ''}'>
        ${data?.content || ''}
    </section>
`;