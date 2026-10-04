import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { range } from '@esportsplus/ui/components';


export default [
    {
        render: () => html`
            <div style='display: flex; align-items: center; justify-content: center; gap: 48px;'>
                ${range({ 'aria-label': 'Volume', class: 'range--slider', max: 100, min: 0, orientation: 'vertical', value: 50 })}
                ${range.filter({ class: 'range--slider', label: 'Range', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 0, value: [20, 70] })}
            </div>
        `,
        title: 'vertical sliders — single and dual thumb'
    },
    {
        render: () => range.filter({ class: 'range--slider', label: 'Volume', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 5, value: 50 }),
        title: 'vertical slider with label, value and ticks'
    },
    {
        render: () => range.filter({ class: 'range--slider', disabled: true, label: 'Allocation', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 0, value: [20, 70] }),
        title: 'disabled vertical slider'
    },
    {
        render: () => range({ 'aria-label': 'Volume', class: 'range--slider', max: 100, min: 0, value: 50 }),
        title: 'slider'
    },
    {
        render: () => range.filter({ class: 'range--slider', label: 'Opacity', max: 100, min: 0, prefix: '', step: 1, ticks: 0, value: 50 }),
        title: 'slider with label and value'
    },
    {
        render: () => range.filter({ class: 'range--slider', label: 'Price', max: 100, min: 0, step: 1, ticks: 0, value: [25, 75] }),
        title: 'slider with two thumbs'
    },
    {
        render: () => range({ 'aria-label': 'Volume', class: 'range--slider', disabled: true, max: 100, min: 0, value: 50 }),
        title: 'disabled slider'
    },
    {
        render: () => range.filter({ class: 'range--slider', disabled: true, label: 'Allocation', max: 100, min: 0, prefix: '', step: 1, ticks: 0, value: [20, 70] }),
        title: 'disabled dual-thumb slider'
    },
    {
        render: () => range.filter({ class: 'range--slider', format: (value: number) => `${value} GB`, label: 'Storage', max: 35, min: 5, prefix: '', step: 1, ticks: 3, value: 15 }),
        title: 'slider with reference labels'
    },
    {
        render: () => range.filter({ class: 'range--slider', label: 'Value', max: 12, min: 0, prefix: '', step: 1, ticks: 13, value: 5 }),
        title: 'slider with ticks'
    },
    {
        render: () => {
            let state = reactive({ active: false, error: '', value: 0.4 });

            return html`
                <form style='display: grid; gap: 12px; width: 100%;' onsubmit='${(event: Event) => event.preventDefault()}'>
                    <label for='range-slider-zoom'>Zoom <output for='range-slider-zoom'>${() => `${Math.round(state.value * 100)}%`}</output></label>
                    ${range({ class: 'range--slider', id: 'range-slider-zoom', max: 1, min: 0, name: 'zoom', state, step: 0.01 })}
                    <code>zoom=${() => state.value}</code>
                </form>
            `;
        },
        title: 'slider with decimal steps, shared state and form field'
    }
];
