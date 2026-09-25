import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { check, copy, cross } from './icons';
import write from '../clipboard/write';
import faces from './faces';


type A = Attributes & {
    error?: string;
    onclick?: never;
    ondisconnect?: never;
    success?: string;
    timeout?: number;
    value: string;
};


export default component<A, string>(
    ({ error = 'Failed', success = 'Copied', timeout = 2000, value, ...attributes }, content = 'Copy') => {
        let state = reactive({ status: 'idle' as 'error' | 'idle' | 'success' }),
            reset = () => {
                clearTimeout(timer);
                state.status = 'idle';
            },
            timer: ReturnType<typeof setTimeout> | undefined;

        return html`
            <button
                class='button button--feedback'
                type='button'
                ${attributes}
                ${{
                    ondisconnect: reset,
                    onclick: async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (!value) {
                            return;
                        }

                        reset();
                        state.status = await write(value) ? 'success' : 'error';
                        timer = setTimeout(reset, timeout);
                    }
                }}
            >
                ${faces(() => state.status, [
                    { content, icon: copy, key: 'idle' },
                    { content: success, icon: check, key: 'success', tone: 'success' },
                    { content: error, icon: cross, key: 'error', tone: 'error' }
                ])}
            </button>
            <span class='button-status' role='status' aria-live='polite'>
                ${() => state.status === 'success' ? success : state.status === 'error' ? error : ''}
            </span>
        `;
    }
);
