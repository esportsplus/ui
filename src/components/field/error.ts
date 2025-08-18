import { html, Renderable } from '@esportsplus/template';


export default (state: { error: Renderable<unknown> }) => {
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