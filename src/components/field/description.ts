import { html } from '@esportsplus/template';


export default (data: { description?: string }) => {
    if (!data?.description) {
        return '';
    }

    return html`
        <div class='field-description --margin-top --margin-300'>${data.description}</div>
    `;
}