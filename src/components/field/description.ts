import { html } from '@esportsplus/template';


export default (data: { description?: unknown }) => {
    if (!data?.description) {
        return '';
    }

    return html`
        <div class='field-description'>
            ${data.description}
        </div>
    `;
}