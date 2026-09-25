import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { rangeFilter } from '@esportsplus/ui';


export default {
    name: 'range-filter',
    variants: [
        {
            render: () => rangeFilter({}),
            title: 'price range (hover outside the selection)'
        },
        {
            render: () => {
                let state = reactive({ high: 32, low: 8 });

                return html`
                    <div style='display: grid; gap: 12px; justify-items: center; width: 100%;'>
                        ${rangeFilter({ label: 'Distance', max: 50, min: 0, prefix: '', state, step: 1, ticks: 6, format: (value: number) => `${value} km` })}
                        <code style='color: var(--color-text-300); font-size: 13px;'>${() => `${state.low}–${state.high} km`}</code>
                    </div>
                `;
            },
            title: 'custom unit, shared state'
        },
        {
            render: () => rangeFilter({ label: 'Budget', max: 25000, min: 0, step: 250, ticks: 3, value: [2500, 18000] }),
            title: 'larger numbers'
        }
    ]
};
