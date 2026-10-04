import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { range } from '@esportsplus/ui/components';
import { rangeVariations } from '~/examples/range/prototypes';
import sliders from '~/examples/range/sliders';
import '~/examples/range/scss/index.scss';


export default {
    name: 'range',
    variants: [
        ...sliders,
        ...rangeVariations(),
        {
            render: () => range.filter({ label: 'Price', max: 1000, min: 0, step: 50, value: [200, 800] }),
            title: 'stepped price range'
        },
        {
            render: () => range.filter({ format: (value: number) => `${value}%`, label: 'Brightness', max: 100, min: 0, prefix: '', step: 1, value: 36 }),
            title: 'single value'
        },
        {
            render: () => range.filter({ disabled: true, label: 'Allocation', max: 100, min: 0, prefix: '', step: 1, value: [20, 70] }),
            title: 'disabled'
        },
        {
            render: () => range.filter({ fields: true, label: 'Price', max: 1000, min: 0, step: 10, value: [200, 750] }),
            title: 'min and max fields'
        },
        {
            render: () => {
                let state = reactive({ high: 32, low: 18 });

                return html`
                    <div style='display: grid; gap: 12px; justify-items: center; width: 100%;'>
                        ${range.filter({
                            fields: true,
                            format: (value: number) => `${value}°C`,
                            label: 'Temperature',
                            max: 40,
                            min: -10,
                            prefix: '',
                            state,
                            step: 0.5,
                            ticks: 6
                        })}
                        <code style='color: var(--color-text-300); font-size: 13px;'>${() => `state: { low: ${state.low}, high: ${state.high} }`}</code>
                    </div>
                `;
            },
            title: 'fields, controlled state, fractional step'
        },
        {
            render: () => range.filter({
                fields: true,
                label: 'Volume',
                max: 100,
                min: 0,
                prefix: '',
                step: 1,
                style: '--range-color: var(--color-blue-400); --thumb-border: var(--color-blue-400); --focus-color: oklch(from var(--color-blue-400) l c h / 0.3);',
                value: [0, 100]
            }),
            title: 'fields, custom colors'
        },
        {
            render: () => range.filter({}),
            title: 'price range (hover outside the selection)'
        },
        {
            render: () => {
                let state = reactive({ high: 32, low: 8 });

                return html`
                    <div style='display: grid; gap: 12px; justify-items: center; width: 100%;'>
                        ${range.filter({ label: 'Distance', max: 50, min: 0, prefix: '', state, step: 1, ticks: 6, format: (value: number) => `${value} km` })}
                        <code style='color: var(--color-text-300); font-size: 13px;'>${() => `${state.low}–${state.high} km`}</code>
                    </div>
                `;
            },
            title: 'custom unit, shared state'
        },
        {
            render: () => range.filter({ label: 'Budget', max: 25000, min: 0, step: 250, ticks: 3, value: [2500, 18000] }),
            title: 'larger numbers'
        }
    ]
};
