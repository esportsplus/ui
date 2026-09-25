import { datalist } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let hours = Object.fromEntries(
        Array.from({ length: 24 }, (_, i) => [i, `${String(i).padStart(2, '0')}:00`])
    ),
    months = {
        jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
        jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December'
    };


export default {
    name: 'datalist',
    variants: [
        {
            render: () => datalist({ options: months, [datalist.scroller]: { 'aria-label': 'Month' } }),
            title: 'options'
        },
        {
            render: () => datalist({ options: hours, selected: 9 }),
            title: 'pre-selected'
        },
        {
            render: () => datalist({ options: months, style: '--rotate: 0deg;' }),
            title: 'flat (no drum)'
        },
        {
            render: () => {
                let state = reactive({ error: '', selected: 'jun' as number | string, settled: true });

                return html`
                    ${datalist({ options: months, state })}

                    <p style='margin-top: var(--size-400);'>
                        ${() => state.settled ? `Selected ${months[state.selected as keyof typeof months]}` : 'Scrolling…'}
                    </p>
                `;
            },
            title: 'reactive state'
        }
    ]
};
