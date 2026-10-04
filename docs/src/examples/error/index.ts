import { effect, flush, onCleanup, reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { error, input, select } from '@esportsplus/ui/components';
import 'docs/examples/error/scss/index.scss';


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WEEKEND = new Set(['saturday', 'sunday']);


function email(hint: string, duration?: number) {
    let state = reactive({ active: false, error: '' });

    return field('Email', hint, error({ direction: 'ne', duration, state }, input({
        class: 'error-demo-input',
        oninput: () => {
            state.error = '';
        },
        onkeydown: (e: KeyboardEvent) => {
            if (e.key !== 'Enter') {
                return;
            }

            let value = (e.target as HTMLInputElement).value;

            if (EMAIL.test(value)) {
                state.error = '';
            }
            else {
                fail(state, value ? 'That doesn\'t look like an email address' : 'Required');
            }
        },
        placeholder: 'you@example.com',
        state
    })));
}

// A repeat is cleared and flushed first, so the error sees a new failure and shakes again.
function fail(state: { error: string }, text: string) {
    if (state.error === text) {
        state.error = '';
        flush();
    }

    state.error = text;
}

function field(label: string, hint: string, control: Renderable<unknown>) {
    return html`
        <div class='error-demo'>
            <div class='error-demo-label'>
                ${label}
                <span class='error-demo-hint'>${hint}</span>
            </div>
            ${control}
        </div>
    `;
}


export default {
    name: 'error',
    variants: [
        {
            render: () => email('Press Enter to check'),
            title: 'input'
        },
        {
            render: () => email('Press Enter to check; the error hides after 3s', 3000),
            title: 'input, duration'
        },
        {
            render: () => {
                let state = reactive({ active: false, error: '', render: false, selected: 'monday' as number | string });

                onCleanup(effect(() => {
                    state.error = WEEKEND.has(String(state.selected)) ? 'Weeks start on a weekday here' : '';
                }));

                return field('Week starts on', 'Pick a weekend day', error({ direction: 'ne', state }, select({
                    options: { monday: 'Monday', saturday: 'Saturday', sunday: 'Sunday' },
                    state
                })));
            },
            title: 'select'
        }
    ]
};
