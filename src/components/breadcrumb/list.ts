import { component, html } from '@esportsplus/template';


export default component(
    (attributes, content) => html`
        <ol class='breadcrumb-list' ${attributes}>
            ${content}
        </ol>
    `
);
