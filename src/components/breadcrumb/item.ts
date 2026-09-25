import { component, html } from '@esportsplus/template';


export default component(
    (attributes, content) => html`
        <li class='breadcrumb-item' ${attributes}>
            ${content}
        </li>
    `
);
