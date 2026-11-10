import { effect, flush, reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { error, input, select } from '@esportsplus/ui/components';
import alternatives from 'docs/examples/error/alternatives';
import 'docs/examples/error/scss/index.scss';


// The error's own look: a fill class and the glass modifier.
type Look = Pick<Parameters<typeof error>[0], 'class' | 'glass'>;

type Text = Look & {
    check: (value: string) => string;
    duration?: number;
    label: string;
    placeholder: string;
    type?: string;
};


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WEEKEND = new Set(['saturday', 'sunday']);


let instance = 0;


function email(value: string) {
    if (!value) {
        return 'Required';
    }

    return EMAIL.test(value) ? '' : 'That doesn\'t look like an email address';
}

// A repeat is cleared and flushed first, so the error sees a new failure and shakes again.
function fail(state: { error: string }, text: string) {
    if (state.error === text) {
        state.error = '';
        flush();
    }

    state.error = text;
}

function field(label: string, id: string, control: Renderable<unknown>, row = false) {
    return html`
        <div class='field ${row ? 'field--row' : ''}'>
            <label class='field-label' for='${id}'>${label}</label>
            ${control}
        </div>
    `;
}

function name(value: string) {
    if (!value) {
        return 'Required';
    }

    return value.length < 2 ? 'Use at least 2 characters' : '';
}

// Name and email stacked, in one of the error's looks.
function pair(look: Look = {}) {
    return html`
        <div class='error-demo'>
            ${text({ ...look, check: name, label: 'Name', placeholder: 'Ada Lovelace' })}
            ${text({ ...look, check: email, label: 'Email', placeholder: 'you@example.com', type: 'email' })}
        </div>
    `;
}

// Checked on Enter; typing or leaving the field clears the error.
function text({ check, class: classname, duration, glass, label, placeholder, type = 'text' }: Text, row = false) {
    let id = `error-example-${++instance}`,
        state = reactive({ active: false, error: '' });

    return field(label, id, error({ class: classname, duration, glass, state }, input({
        id,
        oninput: () => {
            state.error = '';
        },
        onkeydown: (e: KeyboardEvent) => {
            if (e.key !== 'Enter') {
                return;
            }

            let message = check((e.target as HTMLInputElement).value);

            if (message) {
                fail(state, message);
            }
            else {
                state.error = '';
            }
        },
        placeholder,
        state,
        type
    })), row);
}


export default {
    name: 'error',
    variants: [
        {
            render: () => pair(),
            title: 'input · press Enter to check'
        },
        {
            render: () => pair({ glass: 'uniform' }),
            title: 'input, error--glass'
        },
        {
            render: () => pair({ class: 'error--surface' }),
            title: 'input, error--surface'
        },
        {
            render: () => pair({ class: 'error--surface-primary' }),
            title: 'input, error--surface-primary'
        },
        {
            render: () => html`
                <div class='error-demo error-demo--row'>
                    ${text({ check: name, label: 'Name', placeholder: 'Ada Lovelace' }, true)}
                    ${text({ check: email, label: 'Email', placeholder: 'you@example.com', type: 'email' }, true)}
                </div>
            `,
            title: 'input, field--row'
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
                        <div class='field'>
                            <span aria-hidden='true' class='field-label'>Week starts on</span>
                            ${error({ state }, select({
                                label: 'Week starts on',
                                options: { monday: 'Monday', saturday: 'Saturday', sunday: 'Sunday' },
                                state,
                                style: '--width: 100%;'
                            }))}
                        </div>
                    </div>
                `;
            },
            title: 'select · pick a weekend day'
        },
        ...alternatives
    ]
};
