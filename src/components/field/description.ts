import { html } from '@esportsplus/template';


export default (data: { description?: { attributes?: Record<string, unknown>, content: unknown; } }) => {
    if (!data?.description) {
        return '';
    }

    return html`
        <div class='field-description' ${data.description.attributes}>
            ${data.description.content}
        </div>
    `;
}