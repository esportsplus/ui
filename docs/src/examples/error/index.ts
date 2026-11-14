import { effect, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { error, input, select } from '@esportsplus/ui/components';
import 'docs/examples/error/scss/index.scss';


type Check = (value: string) => string[];

type Text = {
    check: Check;
    description?: string;
    duration?: number;
    label: string;
    placeholder: string;
    row?: boolean;
    type?: string;
    // Starts filled in, its errors already showing.
    value?: string;
};


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Personal providers, turned away so the list shows a long, wrapping message.
const PERSONAL = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com']);

const WEEKEND = new Set(['saturday', 'sunday']);


let instance = 0;


function email(value: string) {
    if (!value) {
        return ['Required'];
    }

    return EMAIL.test(value) ? [] : ['That doesn\'t look like an email address'];
}

// Every problem with an address at once, so the error can list them together.
function issues(value: string) {
    if (!value) {
        return ['Required'];
    }

    let at = value.lastIndexOf('@'),
        domain = value.slice(at + 1).toLowerCase(),
        found: string[] = [];

    if (/\s/.test(value)) {
        found.push('Remove the spaces');
    }

    if (value.startsWith('.') || value.endsWith('.')) {
        found.push('Addresses can\'t start or end with a dot');
    }

    if (at === -1) {
        found.push('Add an @ between the name and the domain');
    }
    else {
        if (value.indexOf('@') !== at) {
            found.push('Use only one @');
        }

        if (!/\.[^.\s]+$/.test(domain)) {
            found.push('Add a domain after the @, like example.com');
        }

        if (PERSONAL.has(domain)) {
            found.push('Use your work address; personal domains like gmail.com aren\'t accepted for team accounts');
        }
    }

    return found;
}

function name(value: string) {
    if (!value) {
        return ['Required'];
    }

    return value.length < 2 ? ['Use at least 2 characters'] : [];
}

// Checked on leaving the field or on Enter, then again as you type once it shows an error, so the error goes the
// moment the value is fixed.
function text({ check, description, duration, label, placeholder, row = false, type = 'text', value }: Text) {
    let id = `error-example-${++instance}`,
        state = reactive({ active: false, error: value === undefined ? '' : check(value).join('\n') });

    function validate(value: string) {
        state.error = check(value).join('\n');
    }

    return html`
        <div class='group ${row ? 'group--grid' : 'group--column'}'>
            <label class='group-label' for='${id}'>${label}</label>
            ${input({
                'aria-describedby': `${id}-error`,
                'aria-invalid': () => state.error ? 'true' : 'false',
                id,
                onblur: (e: FocusEvent) => validate((e.target as HTMLInputElement).value),
                oninput: (e: Event) => {
                    if (state.error) {
                        validate((e.target as HTMLInputElement).value);
                    }
                },
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        validate((e.target as HTMLInputElement).value);
                    }
                },
                placeholder,
                state,
                type,
                value
            })}
            ${error({ description, duration, id: `${id}-error`, state })}
        </div>
    `;
}


export default {
    name: 'error',
    variants: [
        {
            render: () => html`
                <div class='error-demo'>
                    ${text({ check: name, label: 'Name', placeholder: 'Ada Lovelace' })}
                    ${text({ check: email, label: 'Email', placeholder: 'you@example.com', type: 'email' })}
                </div>
            `,
            title: 'input · leave the field or press Enter'
        },
        {
            render: () => html`
                <div class='error-demo'>
                    ${text({ check: name, description: 'Shown on invoices and shared links.', label: 'Name', placeholder: 'Ada Lovelace' })}
                    ${text({ check: issues, description: 'We only use this for sign-in links.', label: 'Work email', placeholder: 'you@company.com', type: 'email' })}
                </div>
            `,
            title: 'input, description'
        },
        {
            render: () => html`
                <div class='error-demo error-demo--row'>
                    ${text({ check: name, label: 'Name', placeholder: 'Ada Lovelace', row: true })}
                    ${text({ check: email, label: 'Email', placeholder: 'you@example.com', row: true, type: 'email' })}
                </div>
            `,
            title: 'input, group--grid'
        },
        {
            render: () => html`
                <div class='error-demo'>
                    ${text({ check: issues, label: 'Work email', placeholder: 'you@company.com', type: 'email', value: '.a b@gmail.com' })}
                </div>
            `,
            title: 'input, multiple errors'
        },
        {
            render: () => html`
                <div class='error-demo'>
                    ${text({ check: email, duration: 3000, label: 'Email', placeholder: 'you@example.com', type: 'email' })}
                </div>
            `,
            title: 'input, duration · hides after 3s'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', render: false, selected: 'monday' as number | string });

                effect(() => {
                    state.error = WEEKEND.has(String(state.selected)) ? 'Weeks start on a weekday here' : '';
                });

                return html`
                    <div class='error-demo'>
                        <div class='group group--column'>
                            <span aria-hidden='true' class='group-label'>Week starts on</span>
                            ${select({
                                label: 'Week starts on',
                                options: { monday: 'Monday', saturday: 'Saturday', sunday: 'Sunday' },
                                state,
                                style: '--width: 100%;'
                            })}
                            ${error({ description: 'Calendars and date pickers start here.', state })}
                        </div>
                    </div>
                `;
            },
            title: 'select, description · pick a weekend day'
        }
    ]
};
