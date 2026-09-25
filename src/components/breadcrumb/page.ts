import { component, html } from '@esportsplus/template';


export default component(
    (attributes, content) => html`
        <span
            aria-current='page'
            aria-disabled='true'
            class='breadcrumb-page'
            role='link'
            ${attributes}
        >
            ${content}
        </span>
    `
);
