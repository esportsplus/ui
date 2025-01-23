import { html } from '@esportsplus/template';


export default (properties?: Record<PropertyKey, unknown>) => {
    return html`
        <div class="loading --border-width-700 --size-800" style='--border-color: var(--color-border-500);' ${properties}></div>
    `;
};