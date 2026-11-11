import { html } from '@esportsplus/template';
import { group, icon, input, select, textarea } from '@esportsplus/ui/components';
import help from '@esportsplus/ui/svg/help.svg';


let countries = { de: '+49', fr: '+33', jp: '+81', us: '+1' },
    fonts = [
        { label: 'Geist', value: 'geist' },
        { label: 'Inter', value: 'inter' },
        { label: 'System UI', value: 'system' }
    ],
    instance = 0,
    weekStarts = [
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' }
    ];


export default {
    name: 'group',
    variants: [
        {
            render: () => html`
                <div class='group' style='width: min(100%, 320px);'>
                    ${['Design', 'Engineering', 'Marketing', 'Operations', 'Sales', 'Support'].map((team) => html`
                        <span class='button button--surface'>${team}</span>
                    `)}
                </div>
            `,
            title: 'default · items wrap'
        },
        {
            render: () => {
                let id = `group-example-${++instance}`;

                return html`
                    <div class='group group--column' style='width: min(100%, 320px);'>
                        <label class='group-label' for='${id}'>Project name</label>
                        ${input({ 'aria-describedby': `${id}-description`, id, placeholder: 'Enter a project name' })}
                        <small class='group-description' id='${id}-description'>Shown on invoices and shared links.</small>
                    </div>
                `;
            },
            title: 'group--column'
        },
        {
            render: () => {
                let id = `group-example-${++instance}`;

                return html`
                    <div class='group group--column' style='width: min(100%, 320px);'>
                        <label class='group-label' for='${id}'>
                            Email
                            <span aria-hidden='true' class='group-label-required'>*</span>
                        </label>
                        ${input({ 'aria-describedby': `${id}-description`, id, placeholder: 'you@example.com', required: true, type: 'email' })}
                        <small class='group-description' id='${id}-description'>We only use this for sign-in links.</small>
                    </div>
                `;
            },
            title: 'required'
        },
        {
            render: () => {
                let id = `group-example-${++instance}`;

                return html`
                    <div class='group group--column group--invalid' style='width: min(100%, 320px);'>
                        <label class='group-label' for='${id}'>Username</label>
                        ${input({ 'aria-describedby': `${id}-description`, 'aria-invalid': 'true', id, value: 'a' })}
                        <small class='group-description' id='${id}-description'>Use at least 3 characters.</small>
                    </div>
                `;
            },
            title: 'invalid'
        },
        {
            render: () => {
                let id = `group-example-${++instance}`;

                return html`
                    <div class='group group--column' style='width: min(100%, 320px);'>
                        <label class='group-label' for='${id}'>Notes</label>
                        ${textarea({ 'aria-describedby': `${id}-description`, id, placeholder: 'Write a few notes', rows: 3 })}
                        <small class='group-description' id='${id}-description'>Only you can see these.</small>
                    </div>
                `;
            },
            title: 'textarea'
        },
        {
            render: () => html`
                <div class='group group--column' style='width: min(100%, 320px);'>
                    <span aria-hidden='true' class='group-label'>Font</span>
                    ${select({ label: 'Font', options: fonts, selected: 'inter' })}
                    <small class='group-description'>Used for headings and body text.</small>
                </div>
            `,
            title: 'select'
        },
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-400); width: min(100%, 440px);'>
                    <div class='group group--row'>
                        <span aria-hidden='true' class='group-label'>Font</span>
                        ${select({ label: 'Font', options: fonts, selected: 'geist' })}
                    </div>
                    <div class='group group--row'>
                        <span aria-hidden='true' class='group-label'>Week starts on</span>
                        ${select({ label: 'Week starts on', options: weekStarts, selected: 'monday' })}
                        <small class='group-description'>Calendars and date pickers start here.</small>
                    </div>
                </div>
            `,
            title: 'group--row'
        },
        {
            render: () => {
                let id = `group-example-${++instance}`;

                return html`
                    <div class='group group--column' style='width: min(100%, 320px);'>
                        <label class='group-label' for='${id}'>Phone number</label>
                        ${group({}, html`
                            <div class='group-item group-item--overlay'>
                                ${select({ label: 'Country code', options: countries, selected: 'us', style: '--height: 28px; --width: max-content;' })}
                            </div>
                            ${input({ id, inputmode: 'tel', placeholder: '(123) 000-0000', type: 'tel' })}
                            ${icon({ 'aria-hidden': 'true', class: 'group-item group-item--overlay' }, help)}
                        `)}
                        <small class='group-description'>The country code's width sets where the number starts.</small>
                    </div>
                `;
            },
            title: 'group · overlay items of any width'
        }
    ]
};
