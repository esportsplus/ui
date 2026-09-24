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
    let designs = [
            { label: 'Volume', mode: 'heading', title: 'Heading · Value above the track', unit: '%', value: 60 },
            { label: 'Radius', mode: 'inline', title: 'Inline · Label and value inside the track', unit: 'px', value: 40 }
        ],
        ticks = [
            ['', ''],
            ['major', ' · 10% ticks'],
            ['all', ' · 10% and 2% ticks']
        ];

    return designs.flatMap(({ label, mode, title, unit, value }) => ticks.map(([tick, suffix]) => ({
        title: title + suffix,
        render: () => {
            let id = `range-surface-${++instance}`,
                state = reactive({ value });

            return html`
                <div class='form-prototype range-surface range-surface--${mode} ${tick && `range-surface--ticks-${tick}`}'
                    style='${() => `--fraction: ${state.value / 100};`}'>
                    ${mode === 'heading' && html`
                        <div class='range-surface-heading'>
                            <label for='${id}'>${label}</label>
                            <output for='${id}'>${() => state.value}${unit}</output>
                        </div>
                    `}
                    <div class='range-surface-control'>
                        <div class='range-surface-fill' aria-hidden='true'></div>
                        ${mode !== 'inline' && html`<div class='range-surface-handle' aria-hidden='true'></div>`}
                        ${mode !== 'heading' && html`
                            <label for='${id}' class='range-surface-label'>${label}</label>
                            <output for='${id}' class='range-surface-value'>${() => state.value}${unit && html`<span>${unit}</span>`}</output>
                        `}
                        <input id='${id}' type='range' min='0' max='100' step='1' value='${value}'
                            oninput='${(event: Event) => state.value = Number((event.target as HTMLInputElement).value)}'>
                    </div>
                </div>
            `;
        }
    })));
}
