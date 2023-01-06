import { html } from '@esportsplus/template';
import { tooltip } from '~/components';


export default (data: { required?: boolean, title?: string }) => {
    if (!data?.title) {
        return '';
    }

    return html`
        <div class="field-title --flex-horizontal-space-between --flex-vertical">
            ${data.title}

            ${data?.required && html`
                <div class="bubble --background-primary --margin-left" ${tooltip.onhover()}>
                    <span class="tooltip-message tooltip-message--w">Required</span>
                </div>
            `}
        </div>
    `;
}