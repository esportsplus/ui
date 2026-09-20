import { input, textarea } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Variant } from '../types';
import './form-prototypes.scss';


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

export function rangeVariations(): Variant[] {
    return [
        ['halo', 'Halo · Thumb grows with a focus ring'],
        ['pill', 'Pill · Wide thumb on a fine track'],
        ['lift', 'Lift · Thumb rises while dragging'],
        ['steps', 'Steps · Snapping scale'],
        ['meter', 'Meter · Thick filled track']
    ].map(([mode, title]) => ({
        title,
        render: () => {
            let id = `range-prototype-${++instance}`,
                state = reactive({ value: 40 });
            return html`
                <div class='form-prototype range-prototype range-prototype--${mode}'>
                    <div class='range-prototype-heading'>
                        <label for='${id}'>Volume</label>
                        <output for='${id}'>${() => state.value}%</output>
                    </div>
                    <input id='${id}' type='range' min='0' max='100' step='${mode === 'steps' ? 10 : 1}' value='40'
                        style='${() => `--progress: ${state.value}%;`}'
                        oninput='${(event: Event) => state.value = Number((event.target as HTMLInputElement).value)}'>
                    <div class='range-prototype-scale'><span>0</span><span>50</span><span>100</span></div>
                </div>
            `;
        }
    }));
}
