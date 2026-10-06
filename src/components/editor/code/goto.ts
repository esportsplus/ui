import { flush, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import input from '~/components/input';
import { action } from './find';
import close from '@esportsplus/ui/svg/close.svg';


type Host = {
    focus: VoidFunction;
    go: (line: number, column: number) => void;
};


const TARGET = /^\s*(\d+)(?::(\d+))?\s*$/;


// The go-to-line bar: 'line' or 'line:column'.
const goto = (host: Host) => {
    let field: HTMLInputElement | undefined,
        state = reactive({ invalid: false, open: false, value: '' });

    let api = {
        close: () => {
            state.open = false;
            host.focus();
        },
        open: (line: number) => {
            state.invalid = false;
            state.open = true;
            state.value = String(line);
            // The bar must be displayed before its field can take focus.
            flush();
            field?.focus();
            field?.select();
        },
        state,
        template: () => html`
            <form
                aria-label='Go to line'
                class='code-editor-goto'
                ${{
                    class: () => state.open && '--active',
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Escape' && !e.isComposing) {
                            e.preventDefault();
                            api.close();
                        }
                    },
                    onsubmit: (e: SubmitEvent) => {
                        e.preventDefault();

                        let match = TARGET.exec(state.value);

                        state.invalid = !match;

                        if (match) {
                            state.open = false;
                            host.go(Number(match[1]), Number(match[2] ?? 1));
                        }
                    }
                }}
            >
                ${input({
                    'aria-invalid': () => state.invalid ? 'true' : 'false',
                    'aria-label': 'Go to line and optional column',
                    autocomplete: 'off',
                    class: 'code-editor-goto-input',
                    inputmode: 'numeric',
                    onconnect: (element: HTMLInputElement) => {
                        field = element;
                    },
                    oninput: (e: Event) => {
                        state.invalid = false;
                        state.value = (e.target as HTMLInputElement).value;
                    },
                    placeholder: 'Line:column',
                    value: () => state.value
                })}
                <button class='button code-editor-find-button code-editor-find-button--text' type='submit'>Go</button>
                ${action('Close go to line', close, () => api.close())}
            </form>
        `
    };

    return api;
};


export { goto };
