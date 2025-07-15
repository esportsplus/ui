import { html } from '@esportsplus/template';


export default (data: { error: unknown }) => {
    return () => {
        if (!data.error) {
            return '';
        }

        return html`
            <div class='field-error --text-bold'>
                ${data.error}
            </div>
        `;
    };
}