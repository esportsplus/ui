import { html } from '@esportsplus/template';
import tooltip from '~/components/tooltip';


export default (data: { required?: boolean, title?: { attributes?: Record<string, unknown>, content: unknown; } }) => {
    if (!data?.title) {
        return '';
    }

    return html`
        <div class='field-title --flex-horizontal-space-between --flex-vertical' ${data.title.attributes}>
            ${data.title.content}

            ${data?.required && tooltip.onhover({ class: 'bubble --background-primary --margin-left' }, html`
                <span class='tooltip-message tooltip-message--w'>Required</span>
            `)}
        </div>
    `;
}