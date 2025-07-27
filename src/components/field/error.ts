import { html } from '@esportsplus/template';


export default (state: { error: unknown }) => {
    return () => {
        if (!state.error) {
            return '';
        }

        return html`
            <div class='field-error --text-bold'>
                ${state.error}
            </div>
        `;
    };
}