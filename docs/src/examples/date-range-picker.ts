import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { dateRangePicker, tooltip } from '@esportsplus/ui';
import './date-range-picker.scss';


export default {
    name: 'date-range-picker',
    variants: [
        {
            render: () => dateRangePicker(),
            title: 'default'
        },
        {
            render: () => {
                let label = reactive({ value: 'Pick dates' });

                return html`
                    <div class='date-range-picker-demo date-range-picker-demo--popover'>
                        ${tooltip.onclick(html`
                            <button class='button date-range-picker-demo-trigger' type='button'>
                                <svg aria-hidden='true' fill='none' height='16' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16' width='16'><rect height='11' rx='2' width='12' x='2' y='3' /><path d='M2 6.5h12M5.5 1.5v3M10.5 1.5v3' /></svg>
                                ${() => label.value}
                            </button>
                            <div class='tooltip-content tooltip-content--s date-range-picker-demo-content'>
                                ${dateRangePicker({
                                    onapply: (range) => {
                                        label.value = dateRangePicker.describe(range);
                                    }
                                })}
                            </div>
                        `)}
                    </div>
                `;
            },
            title: 'popover (tooltip.onclick)'
        },
        {
            render: () => {
                let state = reactive({ end: '2026-03-14' as string | null, start: '2026-02-23' as string | null });

                return html`
                    <div class='date-range-picker-demo'>
                        ${dateRangePicker({ state, today: '2026-03-10' })}
                        <small class='date-range-picker-demo-state'>${() => `state: { start: ${state.start}, end: ${state.end} }`}</small>
                    </div>
                `;
            },
            title: 'controlled range across months'
        },
        {
            render: () => dateRangePicker({ style: '--accent: var(--color-blue-400); --width: 360px;' }),
            title: 'narrow (single month)'
        }
    ]
};
