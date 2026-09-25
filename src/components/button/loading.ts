import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { alert, check, spinner } from './icons';
import faces from './faces';


type A = Attributes & {
    action: () => unknown;
    error?: string;
    onclick?: never;
    ondisconnect?: never;
    pending?: string;
    success?: string;
    timeout?: number;
};


export default component<A, string>(
    ({ action, error = 'Try again', pending, success = 'Done', timeout = 1400, ...attributes }, content) => {
        let run = 0,
            state = reactive({ status: 'idle' as 'error' | 'idle' | 'pending' | 'success' }),
            timer: ReturnType<typeof setTimeout> | undefined;

        return html`
            <button
                class='button button--feedback'
                type='button'
                ${attributes}
                ${{
                    'aria-busy': () => state.status === 'pending' && 'true',
                    'aria-disabled': () => state.status === 'pending' && 'true',
                    ondisconnect: () => {
                        clearTimeout(timer);
                        run++;
                    },
                    onclick: async (e) => {
                        e.preventDefault();

                        if (state.status === 'pending') {
                            return;
                        }

                        let id = ++run,
                            status: 'error' | 'success' = 'success';

                        clearTimeout(timer);
                        state.status = 'pending';

                        try {
                            await action();
                        }
                        catch {
                            status = 'error';
                        }

                        if (id !== run) {
                            return;
                        }

                        state.status = status;
                        timer = setTimeout(() => state.status = 'idle', timeout);
                    }
                }}
            >
                ${faces(() => state.status, [
                    { content, key: 'idle' },
                    { content: pending ?? content, icon: spinner, key: 'pending' },
                    { content: success, icon: check, key: 'success', tone: 'success' },
                    { content: error, icon: alert, key: 'error', tone: 'error' }
                ])}
            </button>
            <span class='button-status' role='status' aria-live='polite'>
                ${() => state.status === 'success' ? success : state.status === 'error' ? error : ''}
            </span>
        `;
    }
);
