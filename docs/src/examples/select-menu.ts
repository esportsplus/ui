import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { selectMenu } from '@esportsplus/ui';
import './select-menu.scss';


let fonts = [
        { label: 'Geist', value: 'geist' },
        { label: 'Inter', value: 'inter' },
        { label: 'Montserrat', value: 'montserrat' },
        { label: 'System UI', value: 'system' }
    ],
    timeZones = [
        { detail: 'UTC-10', label: 'Honolulu', value: 'honolulu' },
        { detail: 'UTC-9', label: 'Anchorage', value: 'anchorage' },
        { detail: 'UTC-8', label: 'Los Angeles', value: 'los-angeles' },
        { detail: 'UTC-7', label: 'Denver', value: 'denver' },
        { detail: 'UTC-6', label: 'Chicago', value: 'chicago' },
        { detail: 'UTC-5', label: 'New York', value: 'new-york' },
        { detail: 'UTC-3', label: 'São Paulo', value: 'sao-paulo' },
        { detail: 'UTC+0', label: 'London', value: 'london' },
        { detail: 'UTC+1', label: 'Berlin', value: 'berlin' },
        { detail: 'UTC+4', label: 'Dubai', value: 'dubai' },
        { detail: 'UTC+5:30', label: 'Kolkata', value: 'kolkata' },
        { detail: 'UTC+9', label: 'Tokyo', value: 'tokyo' }
    ],
    weekStarts = [
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' }
    ];


export default {
    name: 'select-menu',
    variants: [
        {
            render: () => html`
                <div class='select-menu-demo'>
                    ${[
                        { label: 'Time zone', options: timeZones, value: 'kolkata' },
                        { label: 'Week starts on', options: weekStarts, value: 'monday' }
                    ].map((row) => html`
                        <div class='select-menu-demo-row'>
                            <span aria-hidden='true'>${row.label}</span>
                            ${selectMenu(row)}
                        </div>
                    `)}
                </div>
            `,
            title: 'settings'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', value: 'montserrat' });

                return html`
                    <div class='select-menu-demo'>
                        <div class='select-menu-demo-row'>
                            <span aria-hidden='true'>Font</span>
                            ${selectMenu({ label: 'Font', name: 'font', options: fonts, state })}
                        </div>
                        <span class='select-menu-demo-status'>
                            ${() => `value: ${state.value}${state.active ? ' (open)' : ''}`}
                        </span>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
};
