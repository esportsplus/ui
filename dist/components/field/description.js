import { html } from '@esportsplus/template';
export default (data) => {
    if (!data?.description) {
        return '';
    }
    return html `
        <div class='field-description'>
            ${data.description}
        </div>
    `;
};
