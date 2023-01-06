import { html } from '@esportsplus/template';


export default (data: { error: string }) => {
    return () => {
        if (!data.error) {
            return '';
        }

        return html`
            <div class='field-error --margin-top --margin-300 --text-bold'>${data.error}</div>
        `;
    };
}