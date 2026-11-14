import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { range } from '@esportsplus/ui/components';
import sliders from 'docs/examples/range/sliders';
import surface from 'docs/examples/range/surface';
import 'docs/examples/range/scss/index.scss';


export default {
    name: 'range',
    variants: [
        ...sliders,
        ...surface,
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
            render: () => range.filter({}),
            title: 'price range (hover outside the selection)'
        },
        {
            render: () => {
                let state = reactive({ high: 32, low: 8 });

                return html`
                    <div class='range-demo'>
                        ${range.filter({ label: 'Distance', max: 50, min: 0, prefix: '', state, step: 1, ticks: 6, format: (value: number) => `${value} km` })}
                        <code class='range-demo-status'>${() => `${state.low}–${state.high} km`}</code>
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
