import { input, textarea } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import type { Variant } from 'docs/types';
import 'docs/examples/form-prototypes/scss/index.scss';


let instance = 0;

const fieldOptions = [
    ['halo', 'Halo · Expanding focus ring'],
    ['underline', 'Underline · Draw from center'],
    ['lift', 'Lift · Soft spring elevation'],
    ['wash', 'Wash · Tinted focus surface'],
    ['bracket', 'Bracket · Growing side accents']
];

export function fieldVariations(kind: 'input' | 'textarea'): Variant[] {
    return fieldOptions.map(([mode, title]) => ({
        title,
        render: () => {
            let id = `field-prototype-${++instance}`,
                attributes = {
                    id,
                    placeholder: kind === 'input' ? 'Enter a project name…' : 'Write a few notes…',
                    ...(kind === 'textarea' ? { rows: 3 } : {})
                };

            return html`
                <div class='form-prototype field-prototype field-prototype--${mode}'>
                    <label for='${id}'>${kind === 'input' ? 'Project name' : 'Notes'}</label>
                    <div class='field-prototype-surface'>
                        ${kind === 'input' ? input.call({}, attributes) : textarea.call({}, attributes)}
                    </div>
                    <small>Focus and type to try the ${mode} animation.</small>
                </div>
            `;
        }
    }));
}
