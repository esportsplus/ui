import { html } from '@esportsplus/template';


export default (data: { class?: string, content?: any } = {}) => html`
    <section class='page ${data?.class}'>
        ${data?.content}
    </section>
`;