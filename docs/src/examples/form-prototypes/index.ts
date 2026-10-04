import { input, textarea } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';
import type { Variant } from 'docs/types';
import 'docs/examples/form-prototypes/scss/index.scss';


const OPTIONS = [
    ['halo', 'Halo · Expanding focus ring'],
    ['underline', 'Underline · Draw from center'],
    ['lift', 'Lift · Soft spring elevation'],
    ['wash', 'Wash · Tinted focus surface'],
    ['bracket', 'Bracket · Growing side accents']
];


let instance = 0;


function fieldVariations(kind: 'input' | 'textarea'): Variant[] {
    return OPTIONS.map(([mode, title]) => ({
        render: () => {
            let id = `field-prototype-${++instance}`;

            return html`
                <div class='form-prototype field-prototype field-prototype--${mode}'>
                    <label for='${id}'>${kind === 'input' ? 'Project name' : 'Notes'}</label>
                    <div class='field-prototype-surface'>
                        ${kind === 'input'
                            ? input({ id, placeholder: 'Enter a project name…' })
                            : textarea({ id, placeholder: 'Write a few notes…', rows: 3 })}
                    </div>
                    <small>Focus and type to try the ${mode} animation.</small>
                </div>
            `;
        },
        title
    }));
}


export { fieldVariations };
