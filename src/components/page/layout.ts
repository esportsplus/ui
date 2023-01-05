import { html } from '@esportsplus/template';


type Data = {
    class?: string;
    content?: any;
};


export default (data: Data = {}) => html`
    <section class='page ${data?.class}'>
        ${data?.content}
    </section>
`;