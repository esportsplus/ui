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

export function rangeBubbleVariations(): Variant[] {
    let currency = (value: number) => `$${value}`,
        designs = [
            { format: String, label: 'Volume', max: 100, min: 0, step: 1, title: 'Bubble · Exact value above the thumb', values: [42] },
            { format: currency, label: 'Monthly budget', max: 100, min: 0, step: 1, title: 'Bubble · Dual thumb range', values: [25, 75] },
            { format: currency, label: 'Price', max: 1000, min: 0, step: 50, title: 'Bubble · Stepped price range', values: [200, 800] },
            { format: String, label: 'Brightness', max: 100, min: 0, step: 1, title: 'Bubble · Without value bubble', tooltip: false, values: [36] },
            { disabled: true, format: String, label: 'Allocation', max: 100, min: 0, step: 1, title: 'Bubble · Disabled range', values: [20, 70] }
        ];

    return designs.map(({ disabled, format, label, max, min, step, title, tooltip, values }) => ({
        title,
        render: () => {
            let dual = values.length === 2,
                id = `range-bubble-${++instance}`,
                state = reactive({ high: values[values.length - 1], low: dual ? values[0] : min }),
                fraction = (value: number) => (value - min) / (max - min),
                thumbs = (dual ? ['low', 'high'] : ['high']) as ('high' | 'low')[];

            return html`
                <div class='form-prototype range-bubble ${dual ? 'range-bubble--dual' : 'range-bubble--single'} ${disabled && 'range-bubble--disabled'} ${tooltip === false && 'range-bubble--quiet'}'
                    style='${() => `--from: ${fraction(state.low)}; --to: ${fraction(state.high)};`}'>
                    <div class='range-bubble-heading'>
                        <label id='${id}'>${label}</label>
                        ${tooltip === false && html`<output>${() => format(state.high)}</output>`}
                    </div>
                    <div class='range-bubble-control'>
                        <div class='range-bubble-fill' aria-hidden='true'></div>
                        ${thumbs.map((key) => html`
                            <input type='range' min='${min}' max='${max}' step='${step}' value='${state[key]}'
                                aria-disabled='${disabled ? 'true' : 'false'}'
                                aria-labelledby='${id}'
                                aria-valuetext='${() => format(state[key])}'
                                tabindex='${disabled ? -1 : 0}'
                                oninput='${(event: Event) => {
                                    let target = event.target as HTMLInputElement,
                                        value = Number(target.value);

                                    value = key === 'low' ? Math.min(value, state.high) : Math.max(value, state.low);
                                    target.value = String(value);
                                    state[key] = value;
                                }}'>
                            <div class='range-bubble-thumb' style='${() => `--at: ${fraction(state[key])};`}' aria-hidden='true'>
                                <span class='range-bubble-value'>${() => format(state[key])}</span>
                            </div>
                        `)}
                    </div>
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
