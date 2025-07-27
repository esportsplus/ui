import { html, Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import tooltip from '~/components/tooltip';
import template from '~/components/template';


export default template.factory<Attributes & { required?: boolean }>(
    (attributes, content) => html`
        <div class='field-title --flex-horizontal-space-between --flex-vertical' ${omit(attributes, ['required'])}>
            ${content}

            ${attributes.required && tooltip.onhover({ class: 'bubble --background-primary --margin-left' }, html`
                <span class='tooltip-message tooltip-message--w'>Required</span>
            `)}
        </div>
    `
);