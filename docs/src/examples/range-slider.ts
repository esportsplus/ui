import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { rangeSlider } from '@esportsplus/ui';


let usd = (value: number) => `$${value.toLocaleString('en-US')}`;


export default {
    name: 'range-slider',
    variants: [
        {
            render: () => rangeSlider({ format: usd, label: 'Price', max: 1000, min: 0, prefix: '$', step: 10, value: [200, 750] }),
            title: 'price'
        },
        {
            render: () => {
                let state = reactive({ high: 32, low: 18 });

                return html`
                    <div style='display: flex; flex-direction: column; gap: var(--size-400); width: min(440px, 100%);'>
                        ${rangeSlider({ format: (value) => `${value}°C`, label: 'Temperature', max: 40, min: -10, state, step: 0.5 })}
                        <small style='color: var(--color-text-300); font-variant-numeric: tabular-nums;'>
                            ${() => `state: { low: ${state.low}, high: ${state.high} }`}
                        </small>
                    </div>
                `;
            },
            title: 'controlled state, fractional step'
        },
        {
            render: () => rangeSlider({
                label: 'Volume',
                max: 100,
                min: 0,
                style: '--fill: var(--color-blue-400); --thumb-dot: var(--color-blue-400); --tooltip-background: var(--color-blue-400);',
                value: [0, 100]
            }),
            title: 'custom colors'
        }
    ]
};
